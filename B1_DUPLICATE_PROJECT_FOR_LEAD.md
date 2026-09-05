# B1 — Generic Project Endpoints Return HTTP 500 for `projects_lead_uq`

**Status:** Implemented · Verified (64/64 tests pass) · Schema unchanged

---

## 1. Root cause

Phase 2 introduced the partial unique index `projects_lead_uq` (one project per
lead, non-null `lead_id`; see `supabase/AUDIT_FIXES.sql` §4):

```sql
create unique index if not exists projects_lead_uq
  on public.projects (lead_id)
  where lead_id is not null;
```

The dedicated conversion endpoints (`POST /api/projects/from-lead/:leadId`,
`POST /api/quotations/:id/convert`) already handled SQLSTATE `23505` via
`createProjectSafely()` (F3). **The generic write endpoints did not.** Their
catch blocks hard-coded every failure to `500`:

| Endpoint | Write path | Duplicate risk | Pre-fix result |
|---|---|---|---|
| `POST /api/projects` | `Project.create()` → INSERT | `lead_id` already used | `500 PROJECT_CREATE_FAILED` |
| `PUT /api/projects/:id` | `findByIdAndUpdate` → UPDATE | update points at a `lead_id` already used | `500 PROJECT_UPDATE_FAILED` |

So after the index exists, creating a second project for a lead (or re-pointing
a project to a lead that already has one) surfaced as an HTTP 500 — a server
fault — instead of a business conflict the client can act on.

## 2. Changes

### `aken-backend/utils/duplicateKeyError.js`
Added a `projects` entry to `TABLE_COLUMN_MAP`:

```js
projects: {
  columns: ["lead_id", "leadId", "projects_lead_uq"],
  code: "DUPLICATE_PROJECT_FOR_LEAD",
  message: "A project already exists for this lead.",
},
```

`mapDuplicateKeyError(error, "projects")` now classifies a 23505 on
`projects_lead_uq` as `DUPLICATE_PROJECT_FOR_LEAD`. Detection is by token match
against the constraint name (`error.constraint` or quoted in `message`) or the
`details` column list (`Key (lead_id)=(...) already exists.`), so any naming
variant (`projects_lead_uq`, Postgres default `projects_lead_id_key`, column-only
`details`) resolves. Any other 23505 on the table still falls back to the stable
generic `DUPLICATE_VALUE` — never a 500.

### `aken-backend/routes/projectRoutes.js`
- `POST /` catch block now maps 23505 → `409 DUPLICATE_PROJECT_FOR_LEAD`
  (flat envelope) before the existing `500 PROJECT_CREATE_FAILED` fallback.
- `PUT /:id` catch block now maps 23505 → `409 DUPLICATE_PROJECT_FOR_LEAD`
  (flat envelope) before the existing `500 PROJECT_UPDATE_FAILED` fallback.
- `POST /from-lead/:leadId` — two alignment changes so every project endpoint
  emits the **identical** conflict shape:
  - the `duplicateConflict` safety-net branch now uses the same flat message
    `"A project already exists for this lead."` (was an endpoint-specific
    sentence);
  - the outer catch also maps through `mapDuplicateKeyError(error, "projects")`
    before falling back to its existing 500.

The route wiring mirrors the established F2 pattern in `quotationRoutes.js`:

```js
const duplicate = mapDuplicateKeyError(error, "projects");
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

### Why `createProjectSafely()` is NOT reused for the generic endpoints
`createProjectSafely()` resolves a 23505 **idempotently** — it re-reads the
winning row and returns `{ alreadyExists: true, project }` with a 200. That is
the correct contract for lead/quotations **conversion** (retrying should
converge on the existing project). It is wrong for a generic create/update:
there the caller asked for a *new* project (or an explicit re-assignment of
`leadId`) and must be told the requested value is taken so they can change the
lead — not have the request silently succeed against a different project than
they asked for. The generic endpoints therefore reuse the pure mapper
(`mapDuplicateKeyError`) — the same primitive the conversion endpoints'
safety-net already relied on — rather than the idempotent helper.

## 3. Response contract (new, all three project write endpoints)

```
HTTP 409 Conflict
{
  "success": false,
  "code": "DUPLICATE_PROJECT_FOR_LEAD",
  "message": "A project already exists for this lead."
}
```

- Emitted for any write that would create two projects for one lead
  (`POST /`, `PUT /:id`, and the `from-lead` unobservable-winner race).
- Uses the same opt-in `flat` envelope F2 introduced for quotation/invoice
  duplicates — no new response machinery.
- Non-duplicate failures are untouched: same 500 codes/messages as before.

## 4. Files modified

| File | Change |
|---|---|
| `aken-backend/utils/duplicateKeyError.js` | Added the `projects` table config → `DUPLICATE_PROJECT_FOR_LEAD`; docs updated. |
| `aken-backend/routes/projectRoutes.js` | `POST /`, `PUT /:id` map 23505 → 409; `from-lead` branches aligned to the identical flat 409 body. |
| `aken-backend/tests/duplicateKeyError.test.js` | +5 tests: constraint-name match, `dbTable` fallback, Postgres default-style name, non-lead 23505 → generic, non-duplicate passthrough. |
| `aken-backend/tests/projectDuplicateRoutes.test.js` | **New**, 9 HTTP-level tests (see §5). |

No schema, no repository, no API-response, and no frontend changes.

## 5. Testing

**`aken-backend/tests/projectDuplicateRoutes.test.js`** runs the real router on
an ephemeral HTTP server (no new dependency; Node 20 global `fetch`), with auth
middleware stubbed and the model layer mocked per test:

1. **Duplicate lead create** — `POST /` with a taken `leadId` → 409, exact body
   `{ success:false, code:"DUPLICATE_PROJECT_FOR_LEAD", message }`.
2. **Duplicate recognition via `details` alone** — no `constraint` field → still
   `DUPLICATE_PROJECT_FOR_LEAD` (column detection).
3. **Duplicate lead update** — `PUT /:id` re-pointing to a taken `leadId` → 409.
4. **Concurrent requests** — 6 simultaneous identical `POST /` → exactly one
   201, five 409s, every 409 body byte-identical, **zero 500s**.
5. **Existing response compatibility** — successful create still `201` with the
   `{ success, data, requestId }` envelope; payload fields intact.
6. **Non-23505 preserved** — create/update DB errors still return nested
   `500 PROJECT_CREATE_FAILED` / `500 PROJECT_UPDATE_FAILED`.
7. **Validation preserved** — bad input still `400 PROJECT_VALIDATION_FAILED`
   before any write.
8. **from-lead alignment** — the `duplicateConflict` safety net emits the same
   flat 409 body as the generic endpoints.

**`aken-backend/tests/duplicateKeyError.test.js`** (+5): pure mapper coverage
for `projects` — constraint-name match, `dbTable` fallback, Postgres
default-style constraint name, non-lead 23505 → generic `DUPLICATE_VALUE`,
non-duplicate → `null`.

**Result:** `npm test` → **64/64 pass, 0 fail** (was 50; +14 new tests, no
regressions). Route load check: `ROUTES_LOAD_OK`.

## 6. Why HTTP 500 is eliminated

Every create/update path that accepts `leadId` now funnels 23505 through
`mapDuplicateKeyError` before its 500 fallback. Because the mapper returns a
non-null `409` result for **every** SQLSTATE 23505 on the projects table (specific
`DUPLICATE_PROJECT_FOR_LEAD` when the violating identifier matches
`lead_id`/`projects_lead_uq`, else stable generic `DUPLICATE_VALUE`), no unique
violation can reach a generic 500 handler. Real failures (network, check
violations, `23503` FK, etc.) are untouched and still surface as the documented
500 codes — nothing genuine is swallowed.

## 7. Backward compatibility

- Success paths: `201` create, `200` update, `200` already-exists read on
  `from-lead` — unchanged, including the nested `success/data/requestId`
  envelope.
- Error paths for non-duplicate conditions: unchanged (same 400/404/409/500
  codes and messages as before).
- The only behavior change is the 23505-on-projects outcome: `500` →
  `409 DUPLICATE_PROJECT_FOR_LEAD` (flat envelope). No client was depending on
  the 500 — it was the defect.
- The `from-lead` duplicateConflict message changed from the conversion-specific
  sentence to the shared `"A project already exists for this lead."`; code and
  status are unchanged, which is what clients branch on.

## 8. Performance impact

- **Happy path:** zero added queries — the mapper runs only in the catch block,
  which is executed only on an already-aborted write.
- **Conflict path:** the only cost is the same pure string-token matching F2
  already performs for quotations/invoices; no database round trips.
- **No new indexes, no repository changes, no change to hot list/read paths.**
- The `projects_lead_uq` index itself is unchanged (schema untouched) — it
  remains the atomic arbiter for the one-project-per-lead invariant.
