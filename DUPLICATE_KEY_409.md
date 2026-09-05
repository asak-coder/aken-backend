# Duplicate Quotation/Invoice Number → HTTP 409 (F2)

## Root cause

The `quotations.invoice_number`-style unique constraints are enforced at the
PostgreSQL layer. When the database rejects a write with SQLSTATE `23505`
(`unique_violation`) the narrow path is:

```
PostgREST error { code: "23505", message, details }
  -> createRepository.js wraps it as RepositoryError (code preserved)
  -> route catch block hard-codes statusCode: 500
  -> sendError() returns HTTP 500
```

Because every route catch block previously mapped *all* failures to 500, a
perfectly predictable business condition (duplicate number) was indistinguishable
from a server fault and the client could not tell the user to fix the input.

Note: the SHIPPED `supabase/SCHEMA.sql` today defines only non-unique indexes on
`quotations(quotation_number)` and no index on `invoices(invoice_number)`; the
unique constraints are being added in an upcoming migration. This change makes
the backend behave correctly the moment those constraints exist, and it also
preserves `error.code` (`23505`) on `RepositoryError` exactly as PostgREST
reports it.

## Interception strategy

All quotation/invoice writes already flow through a single repository layer
(`models/createRepository.js`), so the interception is implemented there plus a
thin, table-aware mapper:

1. `utils/duplicateKeyError.js` (new) — pure mapper:
   - `isDuplicateKeyError(error)` → true when `error.code === "23505"`.
   - `mapDuplicateKeyError(error, table?)` →
     `{ statusCode: 409, code, message }` or `null` (non-duplicate errors).
   - Detects the violating column from either the Postgres constraint name
     (`error.constraint`, or quoted in `error.message`) or the `details` string
     (`Key (quotation_number)=(Q-1) already exists.`), and matches tokens
     case-insensitively so any auto-generated name
     (`quotations_number_uq`, `quotations_quotation_number_key`) resolves.
   - Returns a **stable generic 409** (`DUPLICATE_VALUE`) for any other
     `23505` so no unique violation can ever surface as a raw 500.
2. `models/createRepository.js` — the three write paths that can raise 23505
   (`saveDocument` INSERT, `saveDocument` UPDATE, `runUpdateOperation` UPDATE)
   now annotate the `RepositoryError` with `dbTable` plus `constraint` /
   `details` passthrough. Future invoice create/update routes are covered with
   zero route changes when `mapDuplicateKeyError(error)` is used.
3. `routes/quotationRoutes.js` — the two write endpoints
   (`POST /api/quotations`, `POST /api/quotations/:id/convert`) map 23505
   before falling through to their existing 500 handler.
4. `utils/apiResponse.js` — `sendError` gains an opt-in `flat: true` envelope
   that returns `{ success: false, code, message }` at the requested status.
   The default nested `{ success: false, error: { code, message }, requestId }`
   envelope is byte-for-byte unchanged, preserving backward compatibility.

## Response contract (new)

```
HTTP 409 Conflict
{
  "success": false,
  "code": "DUPLICATE_QUOTATION_NUMBER",   // or DUPLICATE_INVOICE_NUMBER
  "message": "Quotation number already exists."   // or "Invoice number already exists."
}
```

- `DUPLICATE_QUOTATION_NUMBER` / `DUPLICATE_INVOICE_NUMBER` are emitted only
  when the violating identifier actually matches that column.
- Any other `23505` → `DUPLICATE_VALUE` (still 409, never 500).
- Non-duplicate errors are untouched (same 500 codes/messages as before).

## Endpoints audited

| Endpoint | Method | Write path | Duplicate risk |
|---|---|---|---|
| `/api/quotations` | POST | `Quotation.create()` → INSERT | `quotation_number` |
| `/api/quotations/:id/convert` | POST | `quotation.save()` → UPDATE | `quotation_number` |
| `/api/projects` POST, `/api/projects/:id` PUT, `/api/projects/from-lead/:leadId` | POST/PUT | `Project.create()` / `findByIdAndUpdate` / `save()` | no unique business column in scope (falls back to 500 as before) |
| `/api/leads/*` (status/owner/details/notes) | PUT/POST | `findByIdAndUpdate` / `save()` | no unique business column in scope (unchanged) |
| `/api/export/:entity`, `/api/revenue/overview`, `/api/projects/:id/margin` | GET | reads only (`Invoice` is read-only today) | n/a |
| Invoice create/update | future | `Invoice.create()` / `save()` → same `saveDocument` single choke point | `invoice_number` (covered by the same mapper) |

There are currently **no invoice create/update routes** in the backend —
`Invoice` is used only for reads (exports, revenue aggregates, margin
calculations). When invoice write routes are added, wire them exactly like the
quotation routes:

```js
const duplicate = mapDuplicateKeyError(error);
if (duplicate) {
  return sendError(res, req, {
    statusCode: duplicate.statusCode,
    code: duplicate.code,
    message: duplicate.message,
    flat: true,
    err: error,
  });
}
```

(`mapDuplicateKeyError(error)` resolves the table from the annotated
`error.dbTable === "invoices"`, so no table argument is required.)

## Modified / added files

| File | Change |
|---|---|
| `aken-backend/utils/duplicateKeyError.js` | **New.** Table/column-aware 23505 → 409 mapper (pure, unit-testable). |
| `aken-backend/models/createRepository.js` | Write paths (`saveDocument` INSERT/UPDATE, `runUpdateOperation`) annotate `RepositoryError` with `dbTable`, `constraint`, `details`. No behavior change elsewhere. |
| `aken-backend/routes/quotationRoutes.js` | `POST /` and `POST /:id/convert` catch blocks map 23505 → flat 409 before the existing 500 fallback. |
| `aken-backend/utils/apiResponse.js` | `sendError` supports opt-in `flat: true` envelope; default nested envelope unchanged. |
| `aken-backend/tests/duplicateKeyError.test.js` | **New.** 18 tests covering detection, extraction, quotation/invoice mapping (column, constraint-name, `dbTable` fallback, Postgres default-style names), generic 409, non-duplicate passthrough, and the flat HTTP envelope + backward-compat envelope. |

## Verification

```
cd aken-backend && npm test
# 44 tests, 44 pass (18 new duplicate-key tests + 26 existing F1 tests, no regressions)
```

Manual smoke: modified modules (`createRepository`, `quotationRoutes`,
`apiResponse`, `duplicateKeyError`) require cleanly.

## Why the mapper matches identifiers by token

Postgres constraint names are auto-generated or abbreviated in ways that defeat
plain substring matching against the column name:

- `quotations_number_uq` does **not** contain `quotation_number` (Supports
  "number"↔"quotation_number" tokenized match).
- `quotations_quotation_number_key` (Postgres default) does contain it, but a
  short custom name like `uq_qtn_num` would not.

The matcher tokenizes both sides on non-alphanumeric boundaries and requires a
shared token, so every realistic naming convention (explicit `constraint`
field, quoted name in `message`, `details` column list, `*_number_uq`,
`*_<column>_key`) resolves to the right business code while remaining
conservative enough to not misclassify unrelated constraints.
