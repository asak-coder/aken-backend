/**
 * createRepository.js
 * ----------------------------------------------------------------------------
 * Builds a Mongoose-compatible repository over Supabase PostgreSQL.
 *
 * Every model under ./models becomes a thin config passed to this factory.
 * Routes and utilities keep calling Mongoose-style APIs:
 *
 *   Model.find(filter?)                  -> Query (awaitable Array<Doc>)
 *   Model.findById(id)                   -> Query (Doc | null)
 *   Model.findOne(filter?)               -> Query (Doc | null)
 *   Model.create(payload)                -> Promise<Doc> (hydrated, has save())
 *   Model.findByIdAndUpdate(id, patch, { new, runValidators }) -> Doc | null
 *   Model.updateOne(filter, { $set, $inc }) -> { matchedCount, modifiedCount }
 *   Model.exists(filter)                 -> truthy doc | null
 *   Model.countDocuments(filter)         -> number
 *   Model.aggregate(pipeline)            -> SQL analytics function result
 *
 * Query chain support: .select("a b c") .lean() .sort({k:-1}) .skip(n)
 *                      .limit(n) .populate("rel"[, "a b c"])
 *
 * Rows (snake_case) serialize to API docs (camelCase + `_id` + ISO dates),
 * so the HTTP contract is unchanged. Hydrated docs carry hidden save() /
 * toObject() / toJSON() like Mongoose documents.
 *
 * Dotted $set/$inc paths ("emailNotifications.attemptCount") are routed to
 * the 1:1 sub-tables declared in subTables. Nested arrays (notes, items) are
 * persisted via joinConfigs on save().
 *
 * Filters are translated to explicit PostgREST operators (.eq/.in/.is/.not/
 * .neq/.gte/.lte/.gt/.lt/.ilike) — never `.match()` — so null/isolation and
 * range semantics are correct.
 */

const { getSupabaseClient } = require("../utils/supabaseClient");

class RepositoryError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "RepositoryError";
    Object.assign(this, options);
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OBJECT_ID_REGEX = /^[0-9a-f]{24}$/i;

function isUuidLike(value) {
  return typeof value === "string" && UUID_REGEX.test(value);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toIso(value) {
  if (value === null || value === undefined) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function normalizeId(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return String(value);
}

function assertPk(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    throw new RepositoryError("Invalid resource id", { statusCode: 400 });
  }
  return normalized;
}

// ---------------------------------------------------------------------------
// Row <-> API doc serialization
// ---------------------------------------------------------------------------

function fromDbRow(row, fieldMap, relations = {}) {
  if (!row) return null;

  const doc = {};
  for (const [column, apiName] of Object.entries(fieldMap)) {
    if (row[column] !== undefined && row[column] !== null) {
      doc[apiName] = row[column];
    }
  }

  if (row.id !== undefined) {
    doc._id = String(row.id);
  }
  if (row.created_at !== undefined) {
    doc.createdAt = toIso(row.created_at);
  }
  if (row.updated_at !== undefined) {
    doc.updatedAt = toIso(row.updated_at);
  }

  for (const [apiName, relConfig] of Object.entries(relations)) {
    const relRow = row[`__${apiName}`];
    if (relRow && isPlainObject(relRow)) {
      doc[apiName] = fromDbRow(relRow, relConfig.rowMap);
    }
  }

  return doc;
}

function toDbRow(payload, fieldMap) {
  const row = {};
  for (const [column, apiName] of Object.entries(fieldMap)) {
    if (payload[apiName] === undefined) continue;
    const value = payload[apiName];
    if (value instanceof Date) {
      row[column] = value.toISOString();
    } else if (isPlainObject(value) || Array.isArray(value)) {
      row[column] = JSON.stringify(value);
    } else {
      row[column] = value;
    }
  }
  return row;
}

function stripOperators(updateObject) {
  const result = {};
  for (const [key, value] of Object.entries(updateObject || {})) {
    if (key.startsWith("$")) continue;
    result[key] = value;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Filter translation -> [{ type, column, value }]
// ---------------------------------------------------------------------------

function resolveColumn(apiToColumn, key) {
  return apiToColumn[key] || null;
}

function toFilterOps(filter, fieldMap) {
  const ops = [];

  for (const [key, rawValue] of Object.entries(filter || {})) {
    if (rawValue === undefined) continue;
    const column = resolveColumn(fieldMap, key);
    if (!column) continue;

    if (!isPlainObject(rawValue)) {
      if (rawValue === null) {
        ops.push({ type: "is", column, value: "null" });
      } else {
        ops.push({ type: "eq", column, value: rawValue });
      }
      continue;
    }

    for (const [op, value] of Object.entries(rawValue)) {
      if (op === "$in") {
        const ids = (value || []).map((item) => normalizeId(item)).filter(Boolean);
        if (ids.length > 0) ops.push({ type: "in", column, value: ids });
      } else if (op === "$ne") {
        if (value === null) {
          ops.push({ type: "not.is", column, value: "null" });
        } else {
          ops.push({ type: "neq", column, value });
        }
      } else if (op === "$gte") {
        ops.push({ type: "gte", column, value });
      } else if (op === "$lte") {
        ops.push({ type: "lte", column, value });
      } else if (op === "$gt") {
        ops.push({ type: "gt", column, value });
      } else if (op === "$lt") {
        ops.push({ type: "lt", column, value });
      } else if (op === "$regex") {
        let pattern = String(value || "");
        pattern = pattern.replace(/^\^/, "").replace(/\$$/, "");
        ops.push({ type: "ilike", column, value: pattern });
      } else if (op === "$exists") {
        // no-op for row stores
      } else {
        ops.push({ type: "eq", column, value });
      }
    }
  }

  return ops;
}

function applyFilterOps(query, ops) {
  for (const op of ops) {
    if (op.type === "eq") {
      query = query.eq(op.column, op.value);
    } else if (op.type === "in") {
      query = query.in(op.column, op.value);
    } else if (op.type === "is") {
      query = query.is(op.column, op.value);
    } else if (op.type === "not.is") {
      query = query.not(op.column, "is", op.value);
    } else if (op.type === "neq") {
      query = query.neq(op.column, op.value);
    } else if (op.type === "gte") {
      query = query.gte(op.column, op.value);
    } else if (op.type === "lte") {
      query = query.lte(op.column, op.value);
    } else if (op.type === "gt") {
      query = query.gt(op.column, op.value);
    } else if (op.type === "lt") {
      query = query.lt(op.column, op.value);
    } else if (op.type === "ilike") {
      query = query.ilike(op.column, op.value);
    }
  }
  return query;
}

function buildFilterOpsByFilterList(filters, fieldMap) {
  const combined = [];
  for (const filter of filters) {
    combined.push(...toFilterOps(filter, fieldMap));
  }
  return combined;
}

// ---------------------------------------------------------------------------
// Hydration (Mongoose-like docs with save/toObject/toJSON)
// ---------------------------------------------------------------------------

function hydratePlain(doc, modelRepo) {
  const hydrated = { ...doc };

  Object.defineProperty(hydrated, "save", {
    enumerable: false,
    configurable: true,
    writable: true,
    value: (options) => modelRepo.saveDocument(hydrated, options || {}),
  });

  Object.defineProperty(hydrated, "toObject", {
    enumerable: false,
    configurable: true,
    writable: true,
    value: () => ({ ...hydrated }),
  });

  return hydrated;
}

// ---------------------------------------------------------------------------
// Query builder (chainable, awaitable)
// ---------------------------------------------------------------------------

function createQuery(modelRepo, single, positionalFilter) {
  const state = {
    single,
    filters: [],
    sort: null,
    selects: null,
    lean: false,
    skip: 0,
    limit: null,
    populates: [],
  };

  if (positionalFilter && Object.keys(positionalFilter).length > 0) {
    state.filters.push(positionalFilter);
  }

  function projectionColumns() {
    const hidden = new Set(modelRepo.hiddenFields || []);

    if (!state.selects || state.selects.length === 0) {
      // Default: exclude hidden fields (e.g. password_hash) unless requested.
      if (hidden.size === 0) {
        return null;
      }
      const columns = [];
      for (const column of Object.keys(modelRepo.fieldMap)) {
        if (!hidden.has(column)) columns.push(column);
      }
      return columns;
    }

    const requestedHidden = state.selects.filter((field) => field.startsWith("+"));
    const includeHidden = requestedHidden.some((field) => hidden.has(modelRepo.apiToColumn[field.slice(1)]));

    if (includeHidden) {
      // +<hidden> requested: return ALL columns (defaults + hidden).
      return null;
    }

    const columns = [];
    for (const field of state.selects) {
      const column = modelRepo.apiToColumn[field];
      if (column && !hidden.has(column)) columns.push(column);
    }
    return columns.length > 0 ? columns : null;
  }

  function buildBaseQuery() {
    let query = getSupabaseClient().from(modelRepo.table);

    const ops = buildFilterOpsByFilterList(state.filters, modelRepo.apiToColumn);
    query = applyFilterOps(query, ops);

    const columns = projectionColumns();
    if (columns) {
      query = query.select(columns.join(","));
    }

    if (state.sort) {
      for (const [key, direction] of Object.entries(state.sort)) {
        const column = modelRepo.apiToColumn[key];
        if (!column) continue;
        query = query.order(column, { ascending: direction === 1 });
      }
    }

    if (state.limit) {
      query = query.limit(state.limit);
      if (state.skip) {
        query = query.range(state.skip, state.skip + state.limit - 1);
      }
    } else if (state.skip) {
      query = query.range(state.skip, state.skip + 100000);
    }

    return query;
  }

  async function attachJoins(docs) {
    if (docs.length === 0 || !modelRepo.joins) {
      return docs;
    }

    for (const join of modelRepo.joins) {
      const ids = [...new Set(docs.map((doc) => doc._id).filter(Boolean))];
      if (ids.length === 0) continue;

      let joinQuery = getSupabaseClient()
        .from(join.table)
        .select("*")
        .in(join.fkColumn, ids);

      if (join.orderBy) {
        for (const [column, direction] of Object.entries(join.orderBy)) {
          joinQuery = joinQuery.order(column, { ascending: direction === 1 });
        }
      }

      const { data: joinRows, error: joinError } = await joinQuery;
      if (joinError) {
        throw new RepositoryError(
          `Join ${join.table} failed: ${joinError.message}`,
          { code: joinError.code || "DB_JOIN_FAILED" },
        );
      }

      const rowsByParent = new Map();
      for (const row of joinRows || []) {
        const parentId = String(row[join.fkColumn] || "");
        if (!rowsByParent.has(parentId)) {
          rowsByParent.set(parentId, []);
        }
        rowsByParent.get(parentId).push(row);
      }

      for (const doc of docs) {
        const children = rowsByParent.get(doc._id);
        if (join.cardinality === "1:N" || join.cardinality === "array") {
          doc[join.apiName] = (children || []).map((childRow) =>
            fromDbRow(childRow, join.rowMap),
          );
        } else {
          const childRow = (children || [])[0];
          doc[join.apiName] = childRow
            ? fromDbRow(childRow, join.rowMap)
            : { ...join.defaults };
        }
      }
    }

    return docs;
  }

  async function attachPopulates(docs) {
    for (const populate of state.populates) {
      const relConfig = modelRepo.relations[populate.field];
      if (!relConfig) continue;

      const ids = [...new Set(
        docs
          .map((doc) => doc[populate.field])
          .filter((value) => typeof value === "string" && value),
      )];
      if (ids.length === 0) continue;

      const relQuery = getSupabaseClient()
        .from(relConfig.table)
        .select("*")
        .in("id", ids);

      const { data: relRows, error: relError } = await relQuery;
      if (relError) {
        throw new RepositoryError(
          `Populate ${populate.field} failed: ${relError.message}`,
          { code: relError.code || "DB_POPULATE_FAILED" },
        );
      }

      const relMap = new Map((relRows || []).map((row) => [String(row.id), row]));
      const selectedFields = populate.select
        ? populate.select.split(/\s+/).filter(Boolean)
        : null;

      for (const doc of docs) {
        const relRow = relMap.get(String(doc[populate.field] || ""));
        if (!relRow) continue;

        const relDoc = fromDbRow(relRow, relConfig.rowMap);
        if (selectedFields && selectedFields.length > 0) {
          const trimmed = { _id: relDoc._id };
          for (const field of selectedFields) {
            if (relDoc[field] !== undefined) {
              trimmed[field] = relDoc[field];
            }
          }
          doc[populate.field] = trimmed;
        } else {
          doc[populate.field] = relDoc;
        }
      }
    }

    return docs;
  }

  async function execute() {
    const query = buildBaseQuery();
    const { data, error } = await query;

    if (error) {
      throw new RepositoryError(
        `Query on ${modelRepo.table} failed: ${error.message}`,
        { code: error.code || "DB_QUERY_FAILED" },
      );
    }

    let rows = data || [];
    if (state.single) {
      rows = rows.slice(0, 1);
    }

    let docs = rows.map((row) => fromDbRow(row, modelRepo.fieldMap));
    docs = await attachJoins(docs);
    docs = await attachPopulates(docs);

    if (state.single) {
      const doc = docs[0] || null;
      return doc === null
        ? null
        : state.lean
          ? doc
          : hydratePlain(doc, modelRepo);
    }

    if (state.lean) {
      return docs;
    }
    return docs.map((doc) => hydratePlain(doc, modelRepo));
  }

  const queryable = {
    then(resolve, reject) {
      return execute().then(resolve, reject);
    },
    async [Symbol.asyncIterator]() {
      const values = await execute();
      return values[Symbol.asyncIterator]();
    },
    select(value) {
      if (typeof value === "string" && value.trim()) {
        state.selects = value.trim().split(/\s+/).filter(Boolean);
      }
      return queryable;
    },
    lean() {
      state.lean = true;
      return queryable;
    },
    sort(sortSpec) {
      state.sort = sortSpec || null;
      return queryable;
    },
    skip(value) {
      state.skip = toNumber(value);
      return queryable;
    },
    limit(value) {
      state.limit = toNumber(value);
      return queryable;
    },
    populate(field, selectSpec) {
      state.populates.push({ field: String(field), select: selectSpec || null });
      return queryable;
    },
  };

  return queryable;
}

// ---------------------------------------------------------------------------
// Aggregation -> SQL RPC dispatch
// ---------------------------------------------------------------------------

function extractFacetLimit(pipeline, facetKey) {
  const facet = pipeline?.[0]?.$facet;
  const stages = facet?.[facetKey] || [];
  for (const stage of stages) {
    if (stage.$limit) return stage.$limit;
  }
  return null;
}

function extractFacetMatchDate(pipeline, facetKey) {
  const facet = pipeline?.[0]?.$facet;
  const stages = facet?.[facetKey] || [];
  for (const stage of stages) {
    if (stage.$match && stage.$match.createdAt && stage.$match.createdAt.$gte) {
      return stage.$match.createdAt.$gte;
    }
  }
  return null;
}

function monthsFromDate(value) {
  const date = new Date(value);
  const now = new Date();
  if (Number.isNaN(date.getTime())) return 6;
  const months =
    (now.getFullYear() - date.getFullYear()) * 12 +
    (now.getMonth() - date.getMonth()) +
    1;
  return Math.max(1, Math.min(24, months));
}

async function callRpc(rpcName, args) {
  const { data, error } = await getSupabaseClient().rpc(rpcName, args || {});
  if (error) {
    throw new RepositoryError(`RPC ${rpcName} failed: ${error.message}`, {
      code: error.code || "DB_RPC_FAILED",
    });
  }
  // RPC returns jsonb => data = [{ <rpcName>: <jsonb> }]
  const row = (data || [])[0] || {};
  return row[rpcName] ?? row;
}

async function executeAggregate(modelRepo, pipeline) {
  const mode = modelRepo.aggregateMode;
  if (!mode) {
    throw new RepositoryError(`No aggregate handler for ${modelRepo.table}`, {
      code: "DB_AGGREGATE_UNSUPPORTED",
    });
  }

  switch (mode) {
    case "leadAnalytics": {
      const months = monthsFromDate(extractFacetMatchDate(pipeline, "monthlyTrend"));
      const sourceLimit = extractFacetLimit(pipeline, "sourceDistribution") || 8;
      const ownerLimit = extractFacetLimit(pipeline, "ownerDistribution") || 8;
      return [await callRpc("lead_analytics_summary", {
        p_months: months,
        p_source_limit: sourceLimit,
        p_owner_limit: ownerLimit,
      })];
    }
    case "revenueLead": {
      const months = monthsFromDate(extractFacetMatchDate(pipeline, "monthly"));
      const sourceLimit = extractFacetLimit(pipeline, "sourceDistribution") || 8;
      return [await callRpc("revenue_lead_facet", {
        p_months: months,
        p_source_limit: sourceLimit,
      })];
    }
    case "revenueQuotation": {
      const months = monthsFromDate(extractFacetMatchDate(pipeline, "monthly"));
      return [await callRpc("revenue_quotation_facet", { p_months: months })];
    }
    case "revenueProject": {
      const months = monthsFromDate(extractFacetMatchDate(pipeline, "monthly"));
      return [await callRpc("revenue_project_facet", { p_months: months })];
    }
    case "revenueInvoice": {
      const months = monthsFromDate(extractFacetMatchDate(pipeline, "monthly"));
      return [await callRpc("revenue_invoice_facet", { p_months: months })];
    }
    case "projectSummary":
      return [await callRpc("project_summary", {})];
    case "invoiceTotals":
      return [await callRpc("invoice_totals", {})];
    default:
      throw new RepositoryError(`Unknown aggregate mode: ${mode}`, {
        code: "DB_AGGREGATE_UNSUPPORTED",
      });
  }
}

// ---------------------------------------------------------------------------
// Count
// ---------------------------------------------------------------------------

async function countDocuments(modelRepo, filter) {
  let query = getSupabaseClient()
    .from(modelRepo.table)
    .select("*", { count: "exact", head: true });

  const ops = toFilterOps(filter, modelRepo.apiToColumn);
  query = applyFilterOps(query, ops);

  const { count, error } = await query;
  if (error) {
    throw new RepositoryError(
      `Count on ${modelRepo.table} failed: ${error.message}`,
      { code: error.code || "DB_COUNT_FAILED" },
    );
  }
  return count || 0;
}

// ---------------------------------------------------------------------------
// Update operations ($set / $inc / plain patch + dotted sub-table paths)
// ---------------------------------------------------------------------------

async function fetchSubRow(table, fkColumn, fkValue) {
  const { data, error } = await getSupabaseClient()
    .from(table)
    .select("*")
    .eq(fkColumn, fkValue);
  if (error) {
    throw new RepositoryError(`Read ${table} failed: ${error.message}`, {
      code: error.code || "DB_READ_FAILED",
    });
  }
  return (data || [])[0] || null;
}

async function resolveSubTableOps(modelRepo, update) {
  const ops = { set: {}, inc: {} };

  for (const [operator, values] of Object.entries(update || {})) {
    if (!["$set", "$inc"].includes(operator)) continue;
    for (const [dottedPath, value] of Object.entries(values || {})) {
      if (!dottedPath.includes(".")) continue;
      const [apiPrefix, field] = dottedPath.split(".");
      const subConfig = modelRepo.subTables[apiPrefix];
      if (!subConfig) continue;
      const column = subConfig.rowMap[field] || field;
      if (operator === "$set") {
        ops.set[apiPrefix] = ops.set[apiPrefix] || {};
        ops.set[apiPrefix][column] = value;
      } else {
        ops.inc[apiPrefix] = ops.inc[apiPrefix] || {};
        ops.inc[apiPrefix][column] = toNumber(value);
      }
    }
  }

  return ops;
}

async function applySubTableUpdates(modelRepo, filterValue, subOps) {
  const prefixes = new Set([...Object.keys(subOps.set), ...Object.keys(subOps.inc)]);

  for (const apiPrefix of prefixes) {
    const subConfig = modelRepo.subTables[apiPrefix];
    if (!subConfig) continue;
    if (!filterValue) continue;

    const fkColumn = Object.keys(subConfig.fkMap)[0];
    const existing = await fetchSubRow(subConfig.table, fkColumn, filterValue);

    const currentValues = existing || {};
    const patch = {};

    for (const [column, value] of Object.entries(subOps.set[apiPrefix] || {})) {
      patch[column] = value === undefined ? null : value;
    }

    for (const [column, amount] of Object.entries(subOps.inc[apiPrefix] || {})) {
      const current =
        currentValues[column] !== undefined ? toNumber(currentValues[column]) : 0;
      patch[column] = current + amount;
    }

    if (Object.keys(patch).length === 0) continue;

    if (existing) {
      const { error } = await getSupabaseClient()
        .from(subConfig.table)
        .update(patch)
        .eq(fkColumn, filterValue);
      if (error) {
        throw new RepositoryError(`Update ${subConfig.table} failed: ${error.message}`, {
          code: error.code || "DB_UPDATE_FAILED",
        });
      }
    } else {
      const insertPayload = { [fkColumn]: filterValue, ...patch };
      const { error } = await getSupabaseClient()
        .from(subConfig.table)
        .insert(insertPayload);
      if (error) {
        throw new RepositoryError(`Insert ${subConfig.table} failed: ${error.message}`, {
          code: error.code || "DB_INSERT_FAILED",
        });
      }
    }
  }
}

async function runUpdateOperation(modelRepo, filter, update) {
  const ops = toFilterOps(filter || {}, modelRepo.apiToColumn);
  const directPatch = stripOperators(update);
  const subOps = await resolveSubTableOps(modelRepo, update);

  // Main-row patch
  const mainPatch = {};
  for (const [column, apiName] of Object.entries(modelRepo.fieldMap)) {
    if (directPatch[apiName] !== undefined) {
      mainPatch[column] = directPatch[apiName];
    }
  }

  if (Object.keys(mainPatch).length > 0 && ops.length > 0) {
    let query = getSupabaseClient()
      .from(modelRepo.table)
      .update(mainPatch);
    query = applyFilterOps(query, ops);
    const { error } = await query;
    if (error) {
      throw new RepositoryError(`Update ${modelRepo.table} failed: ${error.message}`, {
        code: error.code || "DB_UPDATE_FAILED",
      });
    }
  }

  let filterValue = null;
  for (const op of ops) {
    if (op.column === "id" && (op.type === "eq" || op.type === "in")) {
      filterValue = Array.isArray(op.value) ? op.value[0] || null : op.value;
      break;
    }
  }
  if (!filterValue && filter && filter._id) {
    filterValue = normalizeId(filter._id);
  }
  await applySubTableUpdates(modelRepo, filterValue, subOps);

  return { matchedCount: 1, modifiedCount: 1 };
}

// ---------------------------------------------------------------------------
// save() / create() path
// ---------------------------------------------------------------------------

async function saveDocument(modelRepo, doc, options = {}) {
  if (modelRepo.beforeSave) {
    modelRepo.beforeSave(doc);
  }

  if (!doc._id) {
    // INSERT
    const row = toDbRow(doc, modelRepo.fieldMap);
    delete row.created_at;

    const { data, error } = await getSupabaseClient()
      .from(modelRepo.table)
      .insert(row)
      .select("*")
      .single();

    if (error) {
      throw new RepositoryError(`Insert ${modelRepo.table} failed: ${error.message}`, {
        code: error.code || "DB_INSERT_FAILED",
      });
    }

    const inserted = data;
    doc._id = String(inserted.id);
    if (inserted.created_at !== undefined) doc.createdAt = toIso(inserted.created_at);
    if (inserted.updated_at !== undefined) doc.updatedAt = toIso(inserted.updated_at);

    // Sync fields Postgres defaulted (status, probability, owner, etc.)
    for (const [column, apiName] of Object.entries(modelRepo.fieldMap)) {
      if (inserted[column] !== undefined && doc[apiName] === undefined) {
        doc[apiName] = inserted[column];
      }
    }

    await persistChildren(modelRepo, doc);
    return doc;
  }

  // UPDATE
  const filterValue = assertPk(doc._id);
  const row = toDbRow(doc, modelRepo.fieldMap);
  delete row.id;
  delete row.created_at;
  if (row.updated_at !== undefined) row.updated_at = new Date().toISOString();

  if (Object.keys(row).length > 0) {
    const { error } = await getSupabaseClient()
      .from(modelRepo.table)
      .update(row)
      .eq("id", filterValue);
    if (error) {
      throw new RepositoryError(`Save ${modelRepo.table} failed: ${error.message}`, {
        code: error.code || "DB_SAVE_FAILED",
      });
    }
  }

  await persistChildren(modelRepo, doc);
  return doc;
}

async function persistChildren(modelRepo, doc) {
  // 1:N child arrays (notes, quotation items). Insert rows without an id yet.
  for (const join of Object.values(modelRepo.joinConfigs || {})) {
    if (join.cardinality !== "array" && join.cardinality !== "1:N") continue;
    const children = Array.isArray(doc[join.apiName]) ? doc[join.apiName] : [];
    if (!doc._id) continue;

    for (const child of children) {
      if (child._id) continue; // already persisted
      const childRow = toDbRow(child, join.rowMap);
      childRow[join.fkColumn] = doc._id;
      const { data, error } = await getSupabaseClient()
        .from(join.table)
        .insert(childRow)
        .select("*")
        .single();
      if (error) {
        throw new RepositoryError(`Insert ${join.table} failed: ${error.message}`, {
          code: error.code || "DB_INSERT_FAILED",
        });
      }
      child._id = String(data.id);
      if (data.created_at !== undefined) {
        child.createdAt = toIso(data.created_at);
      }
    }
  }

  // 1:1 sub-objects (notification rows)
  for (const [apiName, subConfig] of Object.entries(modelRepo.subTables || {})) {
    const subDoc = doc[apiName];
    if (!subDoc || !isPlainObject(subDoc)) continue;
    if (!doc._id) continue;

    const patch = {};
    for (const [column, apiField] of Object.entries(subConfig.rowMap)) {
      if (subDoc[apiField] !== undefined) {
        patch[column] = subDoc[apiField];
      }
    }
    if (Object.keys(patch).length === 0) continue;

    const fkColumn = Object.keys(subConfig.fkMap)[0];
    const existing = await fetchSubRow(subConfig.table, fkColumn, doc._id);
    if (existing) {
      const { error } = await getSupabaseClient()
        .from(subConfig.table)
        .update(patch)
        .eq(fkColumn, doc._id);
      if (error) {
        throw new RepositoryError(`Update ${subConfig.table} failed: ${error.message}`, {
          code: error.code || "DB_UPDATE_FAILED",
        });
      }
    } else {
      const { error } = await getSupabaseClient()
        .from(subConfig.table)
        .insert({ [fkColumn]: doc._id, ...patch });
      if (error) {
        throw new RepositoryError(`Insert ${subConfig.table} failed: ${error.message}`, {
          code: error.code || "DB_INSERT_FAILED",
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function createRepository(config) {
  // Reverse map: API field name -> DB column (used for filters/sorts/projections).
  // fieldMap is stored as column -> apiName; invert it and add the special
  // pseudo-fields that are always available.
  const apiToColumn = {
    _id: "id",
    createdAt: "created_at",
    updatedAt: "updated_at",
  };
  for (const [column, apiName] of Object.entries(config.fieldMap || {})) {
    apiToColumn[apiName] = column;
  }

  const modelRepo = {
    table: config.table,
    fieldMap: config.fieldMap,
    apiToColumn,
    relations: config.relations || {},
    subTables: config.subTables || {},
    joins: config.joins || null,
    joinConfigs: config.joinConfigs || null,
    beforeSave: config.beforeSave || null,
    aggregateMode: config.aggregateMode || null,
    hiddenFields: config.hiddenFields || [],
  };

  function Model(payload) {
    const instance = this instanceof Model ? this : Object.create(Model.prototype);
    Object.assign(instance, payload || {});
    return instance;
  }

  Model.prototype.save = function save(options) {
    return saveDocument(modelRepo, this, options || {});
  };

  Model.prototype.toObject = function toObject() {
    return { ...this };
  };

  Object.defineProperty(Model.prototype, "toJSON", {
    enumerable: false,
    configurable: true,
    writable: true,
    value: function toJSON() {
      return { ...this };
    },
  });

  // -- statics ---------------------------------------------------------------

  Model.find = function find(filter) {
    return createQuery(modelRepo, false, filter || {});
  };

  Model.findById = function findById(id) {
    const filterValue = assertPk(id);
    return createQuery(modelRepo, true, { _id: filterValue });
  };

  Model.findOne = function findOne(filter) {
    return createQuery(modelRepo, true, filter || {});
  };

  Model.create = async function create(payload) {
    const instance = new Model(payload);
    await saveDocument(modelRepo, instance, {});
    return instance;
  };

  Model.findByIdAndUpdate = async function findByIdAndUpdate(id, update, options = {}) {
    const filterValue = assertPk(id);
    await runUpdateOperation(modelRepo, { _id: filterValue }, update);

    const doc = await Model.findById(filterValue).lean();
    if (!doc) return null;
    return options.lean ? doc : hydratePlain(doc, modelRepo);
  };

  Model.updateOne = async function updateOne(filter, update) {
    return runUpdateOperation(modelRepo, filter, update);
  };

  Model.exists = async function exists(filter) {
    let query = getSupabaseClient()
      .from(modelRepo.table)
      .select("id")
      .limit(1);
    const ops = toFilterOps(filter || {}, modelRepo.apiToColumn);
    query = applyFilterOps(query, ops);

    const { data, error } = await query;
    if (error) {
      throw new RepositoryError(`Exists on ${modelRepo.table} failed: ${error.message}`, {
        code: error.code || "DB_EXISTS_FAILED",
      });
    }
    return (data || [])[0] || null;
  };

  Model.countDocuments = function countDocuments(filter) {
    return countDocuments(modelRepo, filter || {});
  };

  Model.aggregate = function aggregate(pipeline) {
    return executeAggregate(modelRepo, pipeline);
  };

  modelRepo.saveDocument = (doc, options) => saveDocument(modelRepo, doc, options);

  return Model;
}

module.exports = {
  createRepository,
  RepositoryError,
  isUuidLike,
};
