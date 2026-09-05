"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  UNIQUE_VIOLATION_SQLSTATE,
  isDuplicateKeyError,
  mapDuplicateKeyError,
  extractConstraintName,
  extractDetailColumns,
} = require("../utils/duplicateKeyError");

const { sendError } = require("../utils/apiResponse");

// ---------------------------------------------------------------------------
// Fixtures: PostgREST / Postgres unique-violation shapes
// ---------------------------------------------------------------------------

function supabaseStyleQuotationError() {
  return {
    code: "23505",
    message:
      'duplicate key value violates unique constraint "quotations_number_uq"',
    details: "Key (quotation_number)=(Q-1) already exists.",
  };
}

function supabaseStyleInvoiceError() {
  return {
    code: "23505",
    message:
      'duplicate key value violates unique constraint "invoices_number_uq"',
    details: "Key (invoice_number)=(INV-1) already exists.",
  };
}

function repoStyleError({ table, constraint = null, details = null, hint = null }) {
  return {
    name: "RepositoryError",
    code: "23505",
    message: constraint
      ? `duplicate key value violates unique constraint "${constraint}"`
      : "duplicate key value violates unique constraint",
    details,
    hint,
    dbTable: table,
  };
}

function nonDuplicateError() {
  return {
    code: "23506", // foreign_key_violation
    message: "foreign key violation",
    details: "Key (lead_id) is not present in table leads.",
  };
}

// ---------------------------------------------------------------------------
// isDuplicateKeyError
// ---------------------------------------------------------------------------

test("isDuplicateKeyError recognizes SQLSTATE 23505", () => {
  assert.equal(isDuplicateKeyError(supabaseStyleQuotationError()), true);
  assert.equal(isDuplicateKeyError({ code: "23505" }), true);
});

test("isDuplicateKeyError rejects non-23505 errors and null", () => {
  assert.equal(isDuplicateKeyError(nonDuplicateError()), false);
  assert.equal(isDuplicateKeyError(null), false);
  assert.equal(isDuplicateKeyError(undefined), false);
  assert.equal(isDuplicateKeyError(new Error("boom")), false);
});

test("UNIQUE_VIOLATION_SQLSTATE is 23505", () => {
  assert.equal(UNIQUE_VIOLATION_SQLSTATE, "23505");
});

// ---------------------------------------------------------------------------
// Extraction helpers
// ---------------------------------------------------------------------------

test("extractConstraintName reads constraint field first, then message", () => {
  const withField = { constraint: "quotations_number_uq", message: "" };
  assert.equal(extractConstraintName(withField), "quotations_number_uq");

  const fromMessage = {
    message: 'duplicate key value violates unique constraint "invoices_number_uq"',
  };
  assert.equal(extractConstraintName(fromMessage), "invoices_number_uq");
});

test("extractConstraintName returns null when absent", () => {
  assert.equal(extractConstraintName(null), null);
  assert.equal(extractConstraintName(new Error("generic")), null);
});

test("extractDetailColumns parses Postgres details", () => {
  const error = supabaseStyleQuotationError();
  assert.deepEqual(extractDetailColumns(error), ["quotation_number"]);
});

test("extractDetailColumns handles composite keys and missing details", () => {
  const composite = {
    details: "Key (quotation_number, status)=(Q-1, Draft) already exists.",
  };
  assert.deepEqual(extractDetailColumns(composite), [
    "quotation_number",
    "status",
  ]);
  assert.deepEqual(extractDetailColumns(new Error("no details")), []);
});

// ---------------------------------------------------------------------------
// mapDuplicateKeyError — quotation_number
// ---------------------------------------------------------------------------

test("duplicate quotation_number maps to DUPLICATE_QUOTATION_NUMBER (column match)", () => {
  const mapped = mapDuplicateKeyError(supabaseStyleQuotationError(), "quotations");
  assert.deepEqual(mapped, {
    statusCode: 409,
    code: "DUPLICATE_QUOTATION_NUMBER",
    message: "Quotation number already exists.",
  });
});

test("duplicate quotation_number maps for Postgres default-style constraint name", () => {
  // Postgres auto-names UNIQUE(table_column_key); Supabase/PostgREST often
  // surfaces only this name in `message` (no `details`).
  const error = {
    code: "23505",
    message:
      'duplicate key value violates unique constraint "quotations_quotation_number_key"',
  };
  const mapped = mapDuplicateKeyError(error, "quotations");
  assert.equal(mapped.statusCode, 409);
  assert.equal(mapped.code, "DUPLICATE_QUOTATION_NUMBER");
});

test("duplicate quotation_number maps via constraint-name match when details are absent", () => {
  const error = { code: "23505", message: 'duplicate key value violates unique constraint "quotations_number_uq"' };
  const mapped = mapDuplicateKeyError(error, "quotations");
  assert.equal(mapped.code, "DUPLICATE_QUOTATION_NUMBER");
});

test("duplicate quotation_number maps using error.dbTable when table arg omitted", () => {
  const error = repoStyleError({
    table: "quotations",
    constraint: "quotations_number_uq",
    details: "Key (quotation_number)=(Q-1) already exists.",
  });
  const mapped = mapDuplicateKeyError(error);
  assert.equal(mapped.statusCode, 409);
  assert.equal(mapped.code, "DUPLICATE_QUOTATION_NUMBER");
});

// ---------------------------------------------------------------------------
// mapDuplicateKeyError — invoice_number
// ---------------------------------------------------------------------------

test("duplicate invoice_number maps to DUPLICATE_INVOICE_NUMBER (column match)", () => {
  const mapped = mapDuplicateKeyError(supabaseStyleInvoiceError(), "invoices");
  assert.deepEqual(mapped, {
    statusCode: 409,
    code: "DUPLICATE_INVOICE_NUMBER",
    message: "Invoice number already exists.",
  });
});

test("duplicate invoice_number maps via constraint-name match when details are absent", () => {
  const error = { code: "23505", message: 'duplicate key value violates unique constraint "invoices_number_uq"' };
  const mapped = mapDuplicateKeyError(error, "invoices");
  assert.equal(mapped.code, "DUPLICATE_INVOICE_NUMBER");
});

test("duplicate invoice_number maps using error.dbTable when table arg omitted", () => {
  const error = repoStyleError({
    table: "invoices",
    constraint: "invoices_number_uq",
    details: "Key (invoice_number)=(INV-1) already exists.",
  });
  const mapped = mapDuplicateKeyError(error);
  assert.equal(mapped.statusCode, 409);
  assert.equal(mapped.code, "DUPLICATE_INVOICE_NUMBER");
});

// ---------------------------------------------------------------------------
// mapDuplicateKeyError — projects.lead_id (projects_lead_uq, Phase 2)
// ---------------------------------------------------------------------------

function projectsLeadIdError() {
  return {
    code: "23505",
    message:
      'duplicate key value violates unique constraint "projects_lead_uq"',
    details: "Key (lead_id)=(11111111-1111-4111-8111-111111111111) already exists.",
  };
}

test("duplicate projects.lead_id maps to DUPLICATE_PROJECT_FOR_LEAD (constraint-name match)", () => {
  const error = projectsLeadIdError();
  const mapped = mapDuplicateKeyError(error, "projects");
  assert.deepEqual(mapped, {
    statusCode: 409,
    code: "DUPLICATE_PROJECT_FOR_LEAD",
    message: "A project already exists for this lead.",
  });
});

test("duplicate projects.lead_id maps via the error.dbTable fallback when table arg omitted", () => {
  const error = {
    name: "RepositoryError",
    code: "23505",
    message:
      'duplicate key value violates unique constraint "projects_lead_uq"',
    details: "Key (lead_id)=(11111111-1111-4111-8111-111111111111) already exists.",
    dbTable: "projects",
  };
  const mapped = mapDuplicateKeyError(error);
  assert.equal(mapped.statusCode, 409);
  assert.equal(mapped.code, "DUPLICATE_PROJECT_FOR_LEAD");
});

test("duplicate projects.lead_id maps for Postgres default-style constraint name", () => {
  const error = {
    code: "23505",
    message:
      'duplicate key value violates unique constraint "projects_lead_id_key"',
  };
  const mapped = mapDuplicateKeyError(error, "projects");
  assert.equal(mapped.statusCode, 409);
  assert.equal(mapped.code, "DUPLICATE_PROJECT_FOR_LEAD");
});

test("23505 on projects with a non-lead column falls back to stable generic 409", () => {
  // No unique constraint exists on project_name today; a hypothetical one must
  // not be mislabelled as DUPLICATE_PROJECT_FOR_LEAD.
  const error = {
    code: "23505",
    details: "Key (project_name)=(Acme Project) already exists.",
  };
  const mapped = mapDuplicateKeyError(error, "projects");
  assert.deepEqual(mapped, {
    statusCode: 409,
    code: "DUPLICATE_VALUE",
    message: "A record with the same unique value already exists.",
  });
});

test("non-duplicate errors on projects map to null (fall through to existing 500 handler)", () => {
  const error = {
    code: "23506", // foreign_key_violation
    details: "Key (lead_id) is not present in table leads.",
  };
  assert.equal(mapDuplicateKeyError(error, "projects"), null);
});

// ---------------------------------------------------------------------------
// mapDuplicateKeyError — edge cases
// ---------------------------------------------------------------------------

test("non-duplicate errors map to null (route falls through to existing handler)", () => {
  assert.equal(mapDuplicateKeyError(nonDuplicateError(), "quotations"), null);
  assert.equal(mapDuplicateKeyError(new Error("boom"), "quotations"), null);
  assert.equal(mapDuplicateKeyError(null, "quotations"), null);
});

test("unrecognized table with 23505 still returns a stable generic 409", () => {
  const error = { code: "23505", details: "Key (whatever)=(x) already exists." };
  const mapped = mapDuplicateKeyError(error, "unknown_table");
  assert.deepEqual(mapped, {
    statusCode: 409,
    code: "DUPLICATE_VALUE",
    message: "A record with the same unique value already exists.",
  });
});

// ---------------------------------------------------------------------------
// sendError — flat envelope (HTTP contract)
// ---------------------------------------------------------------------------

function buildResMock() {
  const captured = {};
  const res = {
    status(code) {
      captured.statusCode = code;
      return this;
    },
    json(payload) {
      captured.body = payload;
      return this;
    },
  };
  return { res, captured };
}

test("sendError flat returns { success:false, code, message } at 409", () => {
  const { res, captured } = buildResMock();
  const req = { requestId: "test-request-id" };

  const returned = sendError(res, req, {
    statusCode: 409,
    code: "DUPLICATE_QUOTATION_NUMBER",
    message: "Quotation number already exists.",
    flat: true,
    err: supabaseStyleQuotationError(),
  });

  assert.equal(returned, res);
  assert.equal(captured.statusCode, 409);
  assert.deepEqual(captured.body, {
    success: false,
    code: "DUPLICATE_QUOTATION_NUMBER",
    message: "Quotation number already exists.",
  });
});

test("sendError default envelope is unchanged (backward compatibility)", () => {
  const { res, captured } = buildResMock();
  const req = { requestId: "test-request-id" };

  sendError(res, req, {
    statusCode: 404,
    code: "QUOTATION_NOT_FOUND",
    message: "Quotation not found",
  });

  assert.equal(captured.statusCode, 404);
  assert.deepEqual(captured.body, {
    success: false,
    error: {
      code: "QUOTATION_NOT_FOUND",
      message: "Quotation not found",
    },
    requestId: "test-request-id",
  });
});
