# F3 — Concurrent Lead/Quotation → Project Conversion: Race Fix

**Status:** Implemented · Verified (50/50 tests pass) · Schema unchanged

---

## 1. Root Cause

Phase 2 introduced the partial unique index `projects_lead_uq` (see
`supabase/AUDIT_FIXES.sql` §4):

```sql
create unique index if not exists projects_lead_uq
  on public.projects (lead_id)
  where lead_id is not null;
```

Both conversion endpoints performed a **check-then-insert** without a
transaction:

1. `POST /api/projects/from-lead/:leadId` — `Project.findOne({ leadId })` then `Project.create(...)`
2. `POST /api/quotations/:id/convert` — `Project.findOne({ quotationId })` then `Project.create(...)`

Under **concurrent requests**, two requests can both pass the existence check,
both attempt the INSERT, and the database correctly rejects the second with
**SQLSTATE 23505** (`unique_violation`).

Before this fix:

| Endpoint                          | Concurrent loser's response                         |
|-----------------------------------|-----------------------------------------------------|
| `POST /api/projects/from-lead/:leadId` | `500 PROJECT_LEAD_CONVERT_FAILED`            |
| `POST /api/quotations/:id/convert`    | generic `409 DUPLICATE_VALUE` (wrong shape)  |

Neither returned the established business response
`{ success: true, data: { alreadyExists: true, project } }`. F2 covered the
quotation-number/invoice-number 23505s; **F3 closes the project-creation 23505.**

## 2. Race Timeline

```
t0  Request A: findOne({ leadId: L })          -> null
t0  Request B: findOne({ leadId: L })          -> null
t1  Request A: INSERT projects row (lead L)    -> commits       [WINNER]
t1  Request B: INSERT projects row (lead L)    -> SQLSTATE 23505 [LOSER]
t2  Request B (pre-fix): catch -> 500/409      ❌
t2  Request B (post-fix): findOne({ leadId: L }) -> returns A's row
                -> 200 { alreadyExists: true, project: A's project }  ✅
```

## 3. Changes

### New: `aken-backend/utils/projectConversion.js`
`createProjectSafely({ payload, findExisting, projectRepo })`:

1. Tries `projectRepo.create(payload)`.
2. On **23505 only**, calls the caller-supplied `findExisting()` to re-read the
   committed winner.
   - Winner found → `{ alreadyExists: true, project }`
   - Winner not (yet) observable → `{ duplicateConflict: true, error }` (route
     emits a stable `409 DUPLICATE_PROJECT_FOR_LEAD` — **never HTTP 500**)
3. Any non-23505 error is re-thrown so the existing error handling is unchanged.

### `aken-backend/routes/projectRoutes.js`
`POST /from-lead/:leadId` now routes its create through `createProjectSafely`,
with `findExisting: () => Project.findOne({ leadId })`. Response contract
unchanged: `{ alreadyExists, project }` — `201` for the winner, `200` for an
already-existing read. The cheap pre-check `findOne` is retained as a fast path.

### `aken-backend/routes/quotationRoutes.js`
`POST /:id/convert` now routes its create through `createProjectSafely` with a
two-step re-read: `findExisting` looks up `quotationId` first, then falls back
to `leadId`. This also resolves the **cross-endpoint race** where
`/from-lead/:leadId` and `/:id/convert` target the same lead. Side effects
(`quotation.status = "Approved"`, `lead.status = "Closed"`) now run **only for
the winner** (`!alreadyExists`), preventing lost-update/audit churn from losing
requests.

### New: `aken-backend/tests/projectConversion.test.js`
6 tests (see §6).

## 4. Why the solution is concurrency-safe

- **Atomic arbiter is the database.** The unique index defines which INSERT
  wins; `createProjectSafely` *reacts* to the arbiter's verdict rather than
  trying to predict it with locks or pre-checks. There is no window where two
  requests can both believe they won.
- **Losers converge on the committed state.** The 23505 handler does a fresh
  read of the row the winner committed, so all clients observe the same
  logical result (`alreadyExists: true` + the same project id).
- **Idempotent by construction.** Re-running either endpoint after the race
  takes the `findOne` fast path and returns the existing project; no second
  row is ever inserted.
- **No polling, no client retry contract.** The losing request resolves inside
  the same request/response cycle.
- **No schema change.** The unique constraint stays; it remains the final
  correctness backstop.
- **Non-23505 failures are untouched.** Network errors, check violations, etc.
  still propagate to the existing 500 handlers — nothing real is swallowed.

## 5. Review checklist

| Area               | Status | Notes |
|--------------------|--------|-------|
| Repository layer   | ✅     | No repository changes required — `Project.create` already preserves `code: "23505"` + `dbTable` (createRepository.js). |
| Transaction boundaries | ✅ | Multi-statement transactions are unavailable via Supabase PostgREST; the unique index is the atomic boundary. Side effects are gated to the winner. |
| Duplicate detection | ✅    | Shared `isDuplicateKeyError` (SQLSTATE 23505) + re-read. |
| Response contracts | ✅     | `{ alreadyExists, project }` unchanged; status 201 winner / 200 already-exists; theoretical unobservable-winner case → stable 409, never 500. |
| Audit logging      | ℹ️     | `activity_logs` has **no writers today** (AUDIT_FIXES.sql §5 confirms). Conversion paths did not write audit rows before or after F3; adding audit writes is a business-logic change and out of scope per constraints. |
| Activity logging   | ℹ️     | Same as above — no behavior changed. |
| Owner assignment   | ✅     | Lead path: `projectOwner = lead.owner` (unchanged). Quotation path: `lead.owner || "Unassigned"` (unchanged). |
| Quotation conversion | ✅    | Winner-only `Approved`/`Closed` side effects now; loser never mutates status rows. |

## 6. Testing

`aken-backend/tests/projectConversion.test.js` simulates the 23505 race with
an in-memory PostgREST-like repository (deterministic, no live DB needed):

1. **Single winner** — 8 concurrent conversions → exactly 1 `alreadyExists: false`.
2. **All losers** — every other request returns `alreadyExists: true` with the
   winning project.
3. **Returned response** — identical project id across winner and losers;
   `alreadyExists` is a boolean everywhere.
4. **Database consistency** — exactly one project row per lead after the race.
5. **Idempotency** — repeat conversion returns the existing project, no insert.
6. **Cross-endpoint race** — lead path vs quotation path on the same lead
   converge on one project.
7. **Non-23505 re-thrown** — real errors still propagate (500 path preserved).
8. **duplicateConflict safety net** — 23505 with an unobservable winner returns
   `{ duplicateConflict: true }`, never throws.
9. **Winner-only side effects** — the quotation-convert side-effect guard runs
   exactly once.

Result: `npm test` → **50/50 pass, 0 fail** (including all pre-existing
duplicateKeyError / quotation tests — no regressions).
Route module load check: `ROUTES_LOAD_OK`.

## 7. Backward compatibility

- API shapes, status codes for the non-racing cases, field names, and the
  `success/data/requestId` envelope are **unchanged**.
- The winner's status codes are identical to before (201 lead convert / 200
  quotation convert).
- No database migration, no client changes, no frontend changes required.

## 8. Performance impact

- **Happy path:** one extra `findOne` only on the loser path (a b-tree lookup
  on the indexed `lead_id`/`quotation_id`), plus the retained fast-path
  pre-check — negligible.
- **No new indexes or queries on the hot list/analytics paths.**
- The unique index already existed; no write-path slowdown is introduced.
- Rate limiters on both endpoints (`leadMutationLimiter`,
  `quotationConvertLimiter`) are unchanged.
