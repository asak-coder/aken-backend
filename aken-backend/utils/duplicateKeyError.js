/**
 * duplicateKeyError.js
 * ----------------------------------------------------------------------------
 * Single source of truth for translating PostgreSQL SQLSTATE 23505
 * (unique_violation) into a stable business error.
 *
 * Every database write in this project goes through
 * ./models/createRepository.js, which preserves the Supabase/PostgREST error
 * `code` on the RepositoryError it throws. A unique-constraint violation
 * therefore always surfaces as `error.code === "23505"` plus the Postgres
 * diagnostic fields (`message`, `details`, and optionally `constraint`).
 *
 * This module is table- and column-aware so that:
 *   - quotation_number uniqueness -> { statusCode: 409, code: "DUPLICATE_QUOTATION_NUMBER", ... }
 *   - invoice_number  uniqueness -> { statusCode: 409, code: "DUPLICATE_INVOICE_NUMBER", ... }
 *   - projects.lead_id uniqueness (projects_lead_uq) ->
 *       { statusCode: 409, code: "DUPLICATE_PROJECT_FOR_LEAD", ... }
 *   - any other unique constraint -> stable generic 409 (never a raw 500)
 *
 * The mapper is pure (no I/O) so it can be unit-tested without a database and
 * reused by every route that creates or updates quotations/invoices/projects.
 *
 * Constraint name vs column detection:
 *   Supabase JS / PostgREST surfaces unique violations as, for example:
 *     code    = "23505"
 *     message = 'duplicate key value violates unique constraint "quotations_number_uq"'
 *     details = 'Key (quotation_number)=(Q-1) already exists.'
 *   Detection order:
 *     1. Postgres `constraint` field when exposed by the driver.
 *     2. Constraint name quoted inside `message`.
 *     3. Column list parenthesised in `details` ("Key (a, b)=(...) already exists.").
 *   Whichever identifier is found is matched case-insensitively against the
 *   known unique columns for the table.
 */

const UNIQUE_VIOLATION_SQLSTATE = "23505";

const TABLE_COLUMN_MAP = {
  quotations: {
    columns: ["quotation_number"],
    code: "DUPLICATE_QUOTATION_NUMBER",
    message: "Quotation number already exists.",
  },
  invoices: {
    columns: ["invoice_number"],
    code: "DUPLICATE_INVOICE_NUMBER",
    message: "Invoice number already exists.",
  },
  projects: {
    columns: ["lead_id", "leadId", "projects_lead_uq"],
    code: "DUPLICATE_PROJECT_FOR_LEAD",
    message: "A project already exists for this lead.",
  },
};

const GENERIC_DUPLICATE = {
  code: "DUPLICATE_VALUE",
  message: "A record with the same unique value already exists.",
};

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

function extractConstraintName(error) {
  if (!error) return null;

  if (typeof error.constraint === "string" && error.constraint.trim()) {
    return error.constraint.trim();
  }

  const message =
    typeof error.message === "string" ? error.message : String(error.message || "");

  // 'duplicate key value violates unique constraint "name"'
  const quoted = message.match(/unique constraint "([^"]+)"/i);
  if (quoted) return quoted[1];

  return null;
}

function extractDetailColumns(error) {
  if (!error) return [];

  const details = typeof error.details === "string" ? error.details : "";
  // Postgres: 'Key (column_a, column_b)=(value) already exists.'
  const match = details.match(/Key\s*\(([^)]+)\)\s*=/i);
  if (!match) return [];

  return match[1]
    .split(",")
    .map((part) => part.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

function isDuplicateKeyError(error) {
  if (!error) return false;
  return String(error.code) === UNIQUE_VIOLATION_SQLSTATE;
}

function findTableConfig(error, table) {
  // Explicit table argument wins; otherwise fall back to the table annotated
  // on the repository error itself (repo write paths set `dbTable`).
  const sourceTable = table || error?.dbTable || "";
  const normalizedTable = String(sourceTable).toLowerCase();
  return TABLE_COLUMN_MAP[normalizedTable] || null;
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

function tokenize(identifier) {
  return String(identifier)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function identifiersMatch(identifiers, knownColumns) {
  const identifierTokens = new Set(
    identifiers.flatMap((identifier) => tokenize(identifier)),
  );

  return knownColumns.some((column) =>
    tokenize(column).some((token) => identifierTokens.has(token)),
  );
}

/**
 * Map a database error to a 409 business error, or null when the error is not a
 * unique-constraint violation.
 *
 * @param {Error} error - Repo/DB error (RepositoryError or Supabase error).
 * @param {string} [table] - Repository table name, e.g. "quotations" |
 *                           "invoices" | "projects".
 * @returns {{ statusCode: 409, code: string, message: string } | null}
 */
function mapDuplicateKeyError(error, table) {
  if (!isDuplicateKeyError(error)) return null;

  const config = findTableConfig(error, table);
  if (config) {
    const constraint = extractConstraintName(error);
    const columns = extractDetailColumns(error);
    const identifiers = [...new Set([constraint, ...columns])].filter(Boolean);

    const matched = identifiers.length > 0
      ? identifiersMatch(identifiers, config.columns)
      : false;

    if (matched) {
      return {
        statusCode: 409,
        code: config.code,
        message: config.message,
      };
    }
  }

  return {
    statusCode: 409,
    code: GENERIC_DUPLICATE.code,
    message: GENERIC_DUPLICATE.message,
  };
}

module.exports = {
  UNIQUE_VIOLATION_SQLSTATE,
  isDuplicateKeyError,
  mapDuplicateKeyError,
  extractConstraintName,
  extractDetailColumns,
};
