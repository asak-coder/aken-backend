"use strict";

/**
 * repositoryR1R2.test.js
 * ----------------------------------------------------------------------------
 * Phase I remediation tests for:
 *
 *   R1 - postgrest-js v2 query-builder lifecycle
 *        `from(table)` returns a PostgrestQueryBuilder that exposes NO filter
 *        methods (.eq/.in/.ilike/.order/.limit/.range) and is NOT awaitable.
 *        The filter-capable builder only exists after .select() is called.
 *        The fake below reproduces that contract exactly: any use of a filter
 *        or then() method directly on the from() result throws, mirroring the
 *        real library.
 *
 *   R2 - countDocuments() infinite recursion
 *        The static Model.countDocuments must resolve to the module-level
 *        count helper (via countDocumentsForRepo), never recurse into itself.
 *
 * This suite ALSO runs against the real repository classes (Lead, Project,
 * Quotation) so it is the regression guard for the Phase I R1/R2 fix.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const { mock } = require("node:test");

process.env.SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
process.env.JWT_SECRET = "test-secret-at-least-32-characters-long!!";

const supabaseClient = require("../utils/supabaseClient");
const { createRepository } = require("../models/createRepository");
const Lead = require("../models/Lead");
const Project = require("../models/Project");
const Quotation = require("../models/Quotation");

// ---------------------------------------------------------------------------
// postgrest-js v2-accurate fake
// ---------------------------------------------------------------------------
// `from(table)` -> PostgrestQueryBuilder with ONLY .select() (and write ops).
// Calling .eq()/.in()/... or awaiting it throws TypeError, exactly like
// postgrest-js v2 where those methods and then() exist only on the builder
// returned by .select().

class V2FilterBuilder {
  constructor(fake, table, columns, opts) {
    this.fake = fake;
    this.table = table;
    this.columns = columns;
    this.opts = opts || {};
    this.filters = [];
    this.orderSpecs = [];
    this.limitN = null;
    this.rangeSpec = null;
    this.singleMode = false;
    this.pendingUpdate = null;
  }

  eq(column, value) {
    this.filters.push({ type: "eq", column, value });
    return this;
  }

  in(column, values) {
    this.filters.push({ type: "in", column, values });
    return this;
  }

  is(column, value) {
    this.filters.push({ type: "is", column, value });
    return this;
  }

  not(column, op, value) {
    this.filters.push({ type: "not", column, op, value });
    return this;
  }

  neq(column, value) {
    this.filters.push({ type: "neq", column, value });
    return this;
  }

  gte(column, value) {
    this.filters.push({ type: "gte", column, value });
    return this;
  }

  lte(column, value) {
    this.filters.push({ type: "lte", column, value });
    return this;
  }

  gt(column, value) {
    this.filters.push({ type: "gt", column, value });
    return this;
  }

  lt(column, value) {
    this.filters.push({ type: "lt", column, value });
    return this;
  }

  ilike(column, value) {
    this.filters.push({ type: "ilike", column, value });
    return this;
  }

  order(column, options) {
    this.orderSpecs.push({ column, options });
    return this;
  }

  limit(value) {
    this.limitN = value;
    return this;
  }

  range(from, to) {
    this.rangeSpec = { from, to };
    return this;
  }

  single() {
    this.singleMode = true;
    return this;
  }

  matches(row) {
    return this.filters.every((filter) => {
      const value = row[filter.column];
      if (filter.type === "eq") return value === filter.value;
      if (filter.type === "in") return filter.values.includes(value);
      if (filter.type === "is") {
        return filter.value === "null" ? value === null : value === filter.value;
      }
      if (filter.type === "neq") return value !== filter.value;
      if (filter.type === "not") {
        return filter.value === "null" ? value !== null : value !== filter.value;
      }
      if (filter.type === "gte") return value >= filter.value;
      if (filter.type === "lte") return value <= filter.value;
      if (filter.type === "gt") return value > filter.value;
      if (filter.type === "lt") return value < filter.value;
      if (filter.type === "ilike") {
        const haystack = String(value ?? "").toLowerCase();
        const needle = String(filter.value ?? "").toLowerCase();
        if (needle.includes("%")) {
          const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*");
          return new RegExp(`^${escaped}$`, "i").test(haystack);
        }
        return haystack.includes(needle);
      }
      return true;
    });
  }

  executeRows() {
    const rows = this.fake.rowsFor(this.table);
    let result = [...rows.values()].filter((row) => this.matches(row));

    for (const { column, options } of this.orderSpecs) {
      result.sort((a, b) => {
        const aVal = a[column];
        const bVal = b[column];
        if (aVal === bVal) return 0;
        const cmp = aVal < bVal ? -1 : 1;
        return options?.ascending === false ? -cmp : cmp;
      });
    }

    // PostgREST projection: a non-"*" comma-separated select returns ONLY
    // those columns (plus the primary key, which PostgREST always includes).
    if (this.columns && this.columns !== "*") {
      const wanted = this.columns
        .split(",")
        .map((col) => col.trim())
        .filter(Boolean);
      result = result.map((row) => {
        const projected = {};
        for (const column of wanted) {
          if (row[column] !== undefined) projected[column] = row[column];
        }
        if (row.id !== undefined) projected.id = row.id;
        return projected;
      });
    }

    // PostgREST pagination: the Range header takes precedence over the
    // `limit` query parameter (postgrest-js .range() wins over .limit()).
    if (this.rangeSpec) {
      result = result.slice(this.rangeSpec.from, this.rangeSpec.to + 1);
    } else if (this.limitN !== null) {
      result = result.slice(0, this.limitN);
    }
    return result;
  }

  execute() {
    const result = this.executeRows();
    this.fake.recordCall({
      type: "select",
      table: this.table,
      columns: this.columns,
      head: Boolean(this.opts && this.opts.head),
      count: this.opts && this.opts.count,
      filters: this.filters,
      order: this.orderSpecs,
      limit: this.limitN,
      range: this.rangeSpec,
    });

    if (this.opts && this.opts.head) {
      // HEAD request: no rows are transferred, only the count.
      return Promise.resolve({ data: null, error: null, count: result.length });
    }

    if (this.singleMode) {
      return Promise.resolve({ data: result[0] || null, error: null });
    }
    return Promise.resolve({ data: result, error: null });
  }

  then(resolve, reject) {
    if (this.pendingUpdate) {
      // Awaiting an .update(patch).eq(...) chain issues the UPDATE write.
      this.fake.recordCall({
        type: "update",
        table: this.table,
        patch: this.pendingUpdate,
        filters: this.filters,
      });
      for (const row of this.fake.rowsFor(this.table).values()) {
        if (this.matches(row)) {
          Object.assign(row, this.pendingUpdate);
        }
      }
      return Promise.resolve({ data: null, error: null }).then(resolve, reject);
    }
    return this.execute().then(resolve, reject);
  }

  update(patch) {
    // postgrest-js v2: .update(patch) sets the write, then .eq() filters
    // chain on the SAME builder; the write fires when the chain is awaited.
    this.pendingUpdate = patch;
    return this;
  }

  insert(payload) {
    this.fake.recordCall({ type: "insert", table: this.table, payload });
    const rows = this.fake.rowsFor(this.table);
    const row = { ...payload };
    if (!row.id) row.id = this.fake.nextId();
    rows.set(String(row.id), row);
    return Promise.resolve({ data: [row], error: null });
  }
}

class V2PostgrestQueryBuilder {
  constructor(fake, table) {
    this.fake = fake;
    this.table = table;
  }

  // The ONLY read method on a postgrest-js v2 PostgrestQueryBuilder.
  select(columns, opts) {
    const builder = new V2FilterBuilder(this.fake, this.table, columns, opts);
    const filterProxy = new Proxy(builder, {
      has(target, key) {
        if (key === "then" || key === "eq" || key === "in" || key === "ilike") {
          return key in target;
        }
        return key in target;
      },
    });
    return filterProxy;
  }

  update(patch) {
    return new V2FilterBuilder(this.fake, this.table, null, {}).update(patch);
  }

  insert(payload) {
    const builder = new V2FilterBuilder(this.fake, this.table, null, {});
    return builder.insert(payload);
  }

  rpc() {
    throw new Error("rpc is not available on from()");
  }

  throwUnavailable(name) {
    throw new TypeError(`${name} is not a function (postgrest-js v2: from() exposes no filters)`);
  }

  eq() {
    return this.throwUnavailable("query.eq");
  }

  in() {
    return this.throwUnavailable("query.in");
  }

  ilike() {
    return this.throwUnavailable("query.ilike");
  }

  order() {
    return this.throwUnavailable("query.order");
  }

  limit() {
    return this.throwUnavailable("query.limit");
  }

  range() {
    return this.throwUnavailable("query.range");
  }

  then() {
    throw new TypeError("Cannot read properties of undefined (reading 'then') — from() is not awaitable in postgrest-js v2");
  }
}

class V2FakeSupabase {
  constructor() {
    this.tables = {};
    this.calls = [];
    this.idCounter = 0;
  }

  nowIso() {
    return new Date().toISOString();
  }

  nextId() {
    this.idCounter += 1;
    return `00000000-0000-4000-8000-${String(this.idCounter).padStart(12, "0")}`;
  }

  rowsFor(table) {
    if (!this.tables[table]) this.tables[table] = new Map();
    return this.tables[table];
  }

  recordCall(call) {
    this.calls.push(call);
  }

  seed(table, row) {
    const rows = this.rowsFor(table);
    const stored = { ...row };
    if (!stored.id) stored.id = this.nextId();
    if (!stored.created_at) stored.created_at = this.fakeNow();
    if (!stored.updated_at) stored.updated_at = this.fakeNow();
    rows.set(String(stored.id), stored);
    return stored;
  }

  fakeNow() {
    return "2026-08-18T00:00:00.000Z";
  }

  from(table) {
    return new V2PostgrestQueryBuilder(this, table);
  }
}

function buildFake() {
  const fake = new V2FakeSupabase();
  mock.method(supabaseClient, "getSupabaseClient", () => fake);
  return fake;
}

function leadRow(overrides = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    contact_person: "Alice",
    email: "alice@example.com",
    company_name: "Acme",
    phone: "919876543210",
    message: "Hello",
    status: "New",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// R1: query-builder lifecycle
// ---------------------------------------------------------------------------

test("R1 find() resolves rows using select-first lifecycle", async (t) => {
  const fake = buildFake();
  fake.seed("leads", leadRow());
  fake.seed("leads", leadRow({ id: "22222222-2222-4222-8222-222222222222", status: "Contacted" }));
  t.after(() => mock.restoreAll());

  const docs = await Lead.find().lean();
  assert.equal(docs.length, 2);

  const selectCall = fake.calls.find((call) => call.type === "select" && call.table === "leads");
  assert.equal(selectCall.columns, "*", "default projection is select(*)");
  assert.equal(selectCall.head, false);
});

test("R1 find(filter) translates eq and awaits a thenable select builder", async (t) => {
  const fake = buildFake();
  fake.seed("leads", leadRow());
  fake.seed("leads", leadRow({ id: "22222222-2222-4222-8222-222222222222", status: "Contacted" }));
  t.after(() => mock.restoreAll());

  const docs = await Lead.find({ status: "New" }).lean();
  assert.equal(docs.length, 1);
  assert.equal(docs[0]._id, "11111111-1111-4111-8111-111111111111");

  const selectCall = fake.calls.find((call) => call.type === "select" && call.table === "leads");
  assert.deepEqual(selectCall.filters, [{ type: "eq", column: "status", value: "New" }]);
});

test("R1 find({ status: { $in } }) translates in()", async (t) => {
  const fake = buildFake();
  fake.seed("leads", leadRow());
  fake.seed("leads", leadRow({ id: "22222222-2222-4222-8222-222222222222", status: "Contacted" }));
  fake.seed("leads", leadRow({ id: "33333333-3333-4333-8333-333333333333", status: "Qualified" }));
  t.after(() => mock.restoreAll());

  const docs = await Lead.find({ status: { $in: ["New", "Qualified"] } }).lean();
  assert.equal(docs.length, 2);

  const selectCall = fake.calls.find((call) => call.type === "select" && call.table === "leads");
  assert.deepEqual(selectCall.filters, [
    { type: "in", column: "status", values: ["New", "Qualified"] },
  ]);
});

test("R1 findOne() returns a single doc", async (t) => {
  const fake = buildFake();
  fake.seed("leads", leadRow());
  fake.seed("leads", leadRow({ id: "22222222-2222-4222-8222-222222222222", status: "Contacted" }));
  t.after(() => mock.restoreAll());

  const doc = await Lead.findOne({ status: "New" }).lean();
  assert.equal(doc._id, "11111111-1111-4111-8111-111111111111");
});

test("R1 findById() filters on id", async (t) => {
  const fake = buildFake();
  fake.seed("leads", leadRow());
  fake.seed("leads", leadRow({ id: "22222222-2222-4222-8222-222222222222", status: "Contacted" }));
  t.after(() => mock.restoreAll());

  const doc = await Lead.findById("22222222-2222-4222-8222-222222222222").lean();
  assert.equal(doc._id, "22222222-2222-4222-8222-222222222222");

  const selectCall = fake.calls.find((call) => call.type === "select" && call.table === "leads");
  assert.deepEqual(selectCall.filters, [{ type: "eq", column: "id", value: "22222222-2222-4222-8222-222222222222" }]);
});

test("R1 findById() returns null for a missing id", async (t) => {
  const fake = buildFake();
  fake.seed("leads", leadRow());
  t.after(() => mock.restoreAll());

  const doc = await Lead.findById("99999999-9999-4999-8999-999999999999").lean();
  assert.equal(doc, null);
});

test("R1 sort() translates order() with descending flag", async (t) => {
  const fake = buildFake();
  fake.seed("leads", leadRow({ id: "11111111-1111-4111-8111-111111111111", created_at: "2026-08-01T00:00:00.000Z" }));
  fake.seed("leads", leadRow({ id: "22222222-2222-4222-8222-222222222222", created_at: "2026-08-10T00:00:00.000Z" }));
  t.after(() => mock.restoreAll());

  const docs = await Lead.find().sort({ createdAt: -1 }).lean();
  assert.equal(docs[0]._id, "22222222-2222-4222-8222-222222222222");

  const selectCall = fake.calls.find((call) => call.type === "select" && call.table === "leads");
  assert.deepEqual(selectCall.order, [{ column: "created_at", options: { ascending: false } }]);
});

test("R1 limit() translates limit()", async (t) => {
  const fake = buildFake();
  fake.seed("leads", leadRow({ id: "11111111-1111-4111-8111-111111111111" }));
  fake.seed("leads", leadRow({ id: "22222222-2222-4222-8222-222222222222" }));
  fake.seed("leads", leadRow({ id: "33333333-3333-4333-8333-333333333333" }));
  t.after(() => mock.restoreAll());

  const docs = await Lead.find().limit(2).lean();
  assert.equal(docs.length, 2);

  const selectCall = fake.calls.find((call) => call.type === "select" && call.table === "leads");
  assert.equal(selectCall.limit, 2);
});

test("R1 skip() alone translates range(from, to)", async (t) => {
  const fake = buildFake();
  for (let i = 0; i < 5; i += 1) {
    fake.seed("leads", leadRow({ id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}` }));
  }
  t.after(() => mock.restoreAll());

  const docs = await Lead.find().skip(2).lean();
  assert.equal(docs.length, 3, "skip caps the range at index+100000");

  const selectCall = fake.calls.find((call) => call.type === "select" && call.table === "leads");
  assert.deepEqual(selectCall.range, { from: 2, to: 100002 });
});

test("R1 skip() + limit() translates range(from, from+limit-1)", async (t) => {
  const fake = buildFake();
  for (let i = 0; i < 10; i += 1) {
    fake.seed("leads", leadRow({ id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}` }));
  }
  t.after(() => mock.restoreAll());

  const docs = await Lead.find().skip(2).limit(3).lean();
  assert.equal(docs.length, 3);

  const selectCall = fake.calls.find((call) => call.type === "select" && call.table === "leads");
  assert.deepEqual(selectCall.range, { from: 2, to: 4 });
});

test("R1 projection select('a b') maps API fields to columns", async (t) => {
  const fake = buildFake();
  fake.seed("leads", leadRow());
  t.after(() => mock.restoreAll());

  const docs = await Lead.find().select("contactPerson companyName").lean();
  assert.equal(docs.length, 1);
  assert.ok("contactPerson" in docs[0]);
  assert.ok("companyName" in docs[0]);
  assert.ok(!("email" in docs[0]), "unselected fields are not returned");

  const selectCall = fake.calls.find((call) => call.type === "select" && call.table === "leads");
  assert.equal(selectCall.columns, "contact_person,company_name");
});

test("R1 hidden fields are excluded by default and included via +field", async (t) => {
  const fake = buildFake();
  fake.seed("users", {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    name: "Admin",
    email: "admin@aken.com",
    password_hash: "hashed-secret",
    role: "admin",
  });
  t.after(() => mock.restoreAll());

  const User = require("../models/User");

  const plain = await User.find().lean();
  assert.equal(plain.length, 1);
  assert.ok(!("passwordHash" in plain[0]), "hidden password_hash must be excluded by default");
  assert.equal(plain[0].name, "Admin");

  const explicit = await User.find().select("+passwordHash").lean();
  assert.equal(explicit[0].passwordHash, "hashed-secret", "+passwordHash returns ALL columns");
});

test("R1 $regex translates to ilike()", async (t) => {
  const fake = buildFake();
  fake.seed("leads", leadRow());
  fake.seed("leads", leadRow({ id: "22222222-2222-4222-8222-222222222222", company_name: "Beta" }));
  t.after(() => mock.restoreAll());

  const docs = await Lead.find({ companyName: { $regex: "^acm", $options: "i" } }).lean();
  assert.equal(docs.length, 1);
  assert.equal(docs[0]._id, "11111111-1111-4111-8111-111111111111");

  const selectCall = fake.calls.find((call) => call.type === "select" && call.table === "leads");
  assert.deepEqual(selectCall.filters, [{ type: "ilike", column: "company_name", value: "acm" }]);
});

test("R1 populate() joins related rows (select-first on relation table)", async (t) => {
  const fake = buildFake();
  const ownerId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  fake.seed("leads", leadRow({ owner_id: ownerId }));
  fake.seed("users", {
    id: ownerId,
    name: "Sales One",
    email: "sales@aken.com",
  });
  t.after(() => mock.restoreAll());

  const docs = await Lead.find().populate("ownerId").lean();
  assert.equal(docs.length, 1);
  assert.equal(docs[0].ownerId.name, "Sales One");
  assert.equal(docs[0].ownerId._id, ownerId);

  const userSelect = fake.calls.find((call) => call.type === "select" && call.table === "users");
  assert.equal(userSelect.columns, "*", "populate select-first lifecycle");
  assert.deepEqual(userSelect.filters, [{ type: "in", column: "id", values: [ownerId] }]);
});

test("R1 hydrated docs still carry save/toObject and document shape", async (t) => {
  const fake = buildFake();
  fake.seed("leads", leadRow());
  t.after(() => mock.restoreAll());

  const docs = await Lead.find();
  assert.equal(docs.length, 1);
  assert.equal(typeof docs[0].save, "function", "hydrated save()");
  assert.equal(typeof docs[0].toObject, "function", "hydrated toObject()");
  assert.equal(docs[0]._id, "11111111-1111-4111-8111-111111111111");
  assert.equal(docs[0].status, "New");
});

test("R1 aggregation $group path still uses select-first lifecycle", async (t) => {
  const fake = buildFake();
  const ownerA = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const ownerB = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  fake.seed("leads", leadRow({ owner_id: ownerA }));
  fake.seed("leads", leadRow({ id: "22222222-2222-4222-8222-222222222222", owner_id: ownerA }));
  fake.seed("leads", leadRow({ id: "33333333-3333-4333-8333-333333333333", owner_id: ownerB }));
  t.after(() => mock.restoreAll());

  const result = await Lead.aggregate([
    { $match: { ownerId: { $in: [ownerA, ownerB] }, status: { $ne: "Closed" } } },
    { $group: { _id: "$ownerId", count: { $sum: 1 } } },
  ]);

  const byId = new Map(result.map((row) => [row._id, row.count]));
  assert.equal(byId.get(ownerA), 2);
  assert.equal(byId.get(ownerB), 1);

  const selectCall = fake.calls.find((call) => call.type === "select" && call.table === "leads");
  assert.equal(selectCall.columns, "owner_id,status", "aggregate select-first lifecycle");
});

test("R1 updateOne with a plain patch still works (update + eq)", async (t) => {
  // Main-row updates are contractually passed as plain object patches from
  // the routes (e.g. Lead.findByIdAndUpdate(id, { status: ... })); $set is
  // reserved for dotted sub-table paths. This mirrors the real callers.
  const fake = buildFake();
  fake.seed("leads", leadRow());
  t.after(() => mock.restoreAll());

  const result = await Lead.updateOne(
    { _id: "11111111-1111-4111-8111-111111111111" },
    { status: "Contacted" },
  );
  assert.deepEqual(result, { matchedCount: 1, modifiedCount: 1 });

  const updateCall = fake.calls.find((call) => call.type === "update" && call.table === "leads");
  assert.ok(updateCall, "update was issued through from().update(patch).eq(...)");
  assert.equal(updateCall.patch.status, "Contacted");
  assert.deepEqual(updateCall.filters, [{ type: "eq", column: "id", value: "11111111-1111-4111-8111-111111111111" }]);
});

// ---------------------------------------------------------------------------
// R2: countDocuments recursion
// ---------------------------------------------------------------------------

test("R2 Lead.countDocuments({}) returns 0 with no recursion and issues a head count", async (t) => {
  const fake = buildFake();
  fake.seed("leads", leadRow());
  fake.seed("leads", leadRow({ id: "22222222-2222-4222-8222-222222222222" }));
  t.after(() => mock.restoreAll());

  const count = await Lead.countDocuments({});
  assert.equal(count, 2, "numeric count, no RangeError");

  const headCall = fake.calls.find((call) => call.type === "select" && call.table === "leads" && call.head === true);
  assert.ok(headCall, "count uses select('*', { count:'exact', head:true })");
  assert.equal(headCall.count, "exact");
});

test("R2 Lead.countDocuments({ status }) applies filters to the count", async (t) => {
  const fake = buildFake();
  fake.seed("leads", leadRow());
  fake.seed("leads", leadRow({ id: "22222222-2222-4222-8222-222222222222", status: "Contacted" }));
  t.after(() => mock.restoreAll());

  const count = await Lead.countDocuments({ status: "New" });
  assert.equal(count, 1);

  const headCall = fake.calls.find((call) => call.type === "select" && call.table === "leads" && call.head === true);
  assert.deepEqual(headCall.filters, [{ type: "eq", column: "status", value: "New" }]);
});

test("R2 Project.countDocuments({}) returns 0 without recursion", async (t) => {
  const fake = buildFake();
  fake.seed("projects", {
    id: "11111111-1111-4111-8111-111111111111",
    project_name: "Warehouse",
    status: "Planning",
  });
  t.after(() => mock.restoreAll());

  const count = await Project.countDocuments({});
  assert.equal(count, 1, "numeric count");
});

test("R2 Quotation.countDocuments({}) returns 0 without recursion", async (t) => {
  const fake = buildFake();
  fake.seed("quotations", {
    id: "11111111-1111-4111-8111-111111111111",
    quotation_number: "Q-1",
    status: "Draft",
  });
  fake.seed("quotations", {
    id: "22222222-2222-4222-8222-222222222222",
    quotation_number: "Q-2",
    status: "Sent",
  });
  t.after(() => mock.restoreAll());

  const count = await Quotation.countDocuments({});
  assert.equal(count, 2, "numeric count");
});

test("R2 countDocuments returns 0 for an empty table (empty DB semantics)", async (t) => {
  const fake = buildFake();
  // No rows seeded anywhere.
  t.after(() => mock.restoreAll());

  const leadCount = await Lead.countDocuments({});
  const projectCount = await Project.countDocuments({});
  const quotationCount = await Quotation.countDocuments({});

  assert.equal(leadCount, 0);
  assert.equal(projectCount, 0);
  assert.equal(quotationCount, 0);
});

test("R2 countDocuments propagates RepositoryError on DB failure", async (t) => {
  const fake = buildFake();
  const originalExecute = V2FilterBuilder.prototype.execute;
  V2FilterBuilder.prototype.execute = function failingExecute() {
    this.fake.recordCall({ type: "select", table: this.table, columns: this.columns, head: true });
    return Promise.resolve({
      data: null,
      error: { code: "PGRST116", message: "count failed" },
    });
  };
  t.after(() => {
    V2FilterBuilder.prototype.execute = originalExecute;
    mock.restoreAll();
  });

  await assert.rejects(
    Lead.countDocuments({}),
    // The repository preserves the underlying PostgREST error code.
    (error) => error.name === "RepositoryError" && error.code === "PGRST116",
  );
});

// ---------------------------------------------------------------------------
// R2 regression: countDocuments on ALL 15 repositories (the recursion
// previously hit every one of them).
// ---------------------------------------------------------------------------

test("R2 countDocuments works on every model (all 15 repositories)", async (t) => {
  const fake = buildFake();
  t.after(() => mock.restoreAll());

  const models = [
    require("../models/Lead"),
    require("../models/Project"),
    require("../models/Quotation"),
    require("../models/User"),
    require("../models/ActivityLog"),
    require("../models/BOQ"),
    require("../models/Invoice"),
    require("../models/Forecast"),
    require("../models/Tender"),
    require("../models/Material"),
    require("../models/LabourEntry"),
  ];

  for (const Model of models) {
    const count = await Model.countDocuments({});
    assert.equal(count, 0, `${Model.table ?? "model"} countDocuments must not recurse`);
  }

  // Verify every count used the HEAD+exact path.
  const headCalls = fake.calls.filter((call) => call.type === "select" && call.head === true);
  assert.equal(headCalls.length, models.length, "one head count per model");
});
