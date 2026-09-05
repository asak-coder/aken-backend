# PHASE I REMEDIATION — R1 + R2

**Date:** 2026-08-18 (local)
**Project:** `garrlnwamcwnypjrsfji`
**Scope:** R1 + R2 only. No R3-R7. No schema / functions / privileges / data changes.

---

## 1. R1 Root Cause

`aken-backend/models/createRepository.js` — `createQuery()` / `buildBaseQuery()` chained PostgREST query methods directly on the value returned by `supabase.from(table)`:

```js
let query = getSupabaseClient().from(modelRepo.table);
const ops = buildFilterOpsByFilterList(state.filters, modelRepo.apiToColumn);
query = applyFilterOps(query, ops);      // query.eq(...) / query.in(...) etc.
...
query = query.order(...);
query = query.limit(...);
query = query.range(...);
const { data, error } = await query;      // await directly on from()
```

With the installed version (`@supabase/postgrest-js@2.109.0`, via `@supabase/supabase-js@2.109.0`), `from(table)` returns a **`PostgrestQueryBuilder`** that exposes **no** filter methods (`.eq/.in/.ilike/...`), **no** pagination methods (`.order/.limit/.range`), and **is not awaitable**. The filter-capable, awaitable builder is created only by calling `.select()` first.

Confirmed live:

```
R1 lifecycle: from('leads').eq is undefined (native postgrest-js)  -> typeof .eq = undefined
```

Effect: every query-based path that used a filter, sort, pagination, or `findById` threw `TypeError: query.eq is not a function` (or `.order`/`.limit`/`.range`), breaking admin login, bootstrap, detail reads, filtered lists, pagination, exports, admin updates, project conversion (its `findById`/`findOne` pre-checks), notification workers (`Lead.exists`/`findById`), and owner resolution (`User.findOne`).

The **only** broken path was `buildBaseQuery()`. Every other read/write path in the file already established the query builder first (`.select(...)`, `.insert(...)`, `.update(...)`).

## 2. R1 Technical Explanation

postgrest-js v2 lifecycle:

1. `supabase.from("leads")` -> `PostgrestQueryBuilder` — only write/select entry points (`.select`, `.insert`, `.update`, `.upsert`, `.delete`).
2. `.select(columns, opts)` -> `PostgrestFilterBuilder` — all filters (`.eq/.in/.is/.not/.neq/.gt/.gte/.lt/.lte/.ilike`), sorting (`.order`), pagination (`.limit/.range`), `.single()`, and `then()`.
3. Awaiting the filter builder executes the request.

The fix initializes the filter builder **first**, then applies filters/sorts/pagination on it:

```js
const columns = projectionColumns();
let query = getSupabaseClient()
  .from(modelRepo.table)
  .select(columns ? columns.join(",") : "*");

const ops = buildFilterOpsByFilterList(state.filters, modelRepo.apiToColumn);
query = applyFilterOps(query, ops);
// then sort / limit / range exactly as before
```

Projection columns are resolved **before** `.select()` (previously after), which preserves the exact hidden-field / `+field` / projection semantics. Everything else in the file was already v2-correct and was left untouched.

## 3. Exact Files Modified (R1)

| File | Change |
|---|---|
| `aken-backend/models/createRepository.js` | `buildBaseQuery()` now calls `.select(...)` on the `from()` result **before** applying filters/sort/pagination; projection resolution moved ahead of `.select()`. |

## 4. Exact Functions/Methods Modified (R1)

| Function / Method | Change |
|---|---|
| `createQuery` -> `buildBaseQuery()` | `.select(columns \| "*")` now initializes the PostgREST filter builder; `projectionColumns()` resolved before `.select()`. |

**One related fix** discovered while tracing R1's broken caller list:

| Function / Method | Change |
|---|---|
| `executeAggregate()` | Dispatch now also accepts **match-first** `$group` pipelines (`[{ $match: {...} }, { $group: ... }]`) on `leads`, which is exactly the pipeline `utils/ownerAssignment.js` (`findLeastLoadedSalesUser`) sends. Previously the guard `if (firstStage.$group)` rejected it with `DB_AGGREGATE_UNSUPPORTED` -> automatic owner assignment on lead creation always failed. The in-memory owner-count branch (already present, already select-first) is now actually reachable. |

## 5. R1 Compatibility Solution

Minimal, contract-preserving: introduce the mandatory `.select()` initialization in `buildBaseQuery()`; do not change query API, filter translation, projections, pagination, sorting, populate/join, hydration, or error codes. All other repository code paths already followed the v2 lifecycle.

## 6. R1 Tests

New suite: `aken-backend/tests/repositoryR1R2.test.js` — fake Supabase client that faithfully models postgrest-js v2: `from()` returns an object with **no** filter/then methods (access throws), `.select()` returns the filter-capable thenable builder. Tests run against the **real repository classes** (Lead / Project / Quotation / User).

Coverage (all pass):

- `find()` — select(`*`) first
- `find({ status: "New" })` — `.eq` after select
- `find({ status: { $in: [...] } })` — `.in` after select
- `findOne()`
- `findById()` + missing-id -> `null`
- `sort()` -> `.order(column, { ascending })`
- `limit()` -> `.limit(n)`
- `skip()` -> `.range(from, to)` (skip-capped at +100000)
- `skip() + limit()` -> `.range(from, from+limit-1)`
- projection `.select("a b")` -> column mapping, unselected fields omitted
- hidden fields (`password_hash`) excluded by default, included via `+passwordHash`
- `$regex` -> `.ilike` (with `$options` no-op)
- `populate()` -> select-first join on relation table
- hydrated docs carry `save()` / `toObject()`
- aggregation `$group` path (select-first on `owner_id,status`)
- update path via `from().update(patch).eq(...)` (plain-patch `updateOne`, matching real route callers)

The old fake builder in `notificationUpsert.test.js` was **not** modified — the new suite complements it.

## 7. R1 Live Supabase Verification

Script: `supabase/backups/phase_i_r1r2_live_smoke.cjs` — READ-ONLY (SELECT/HEAD only), uses the real backend `supabaseClient` (service-role) and the real repository classes against `garrlnwamcwnypjrsfji`.

```
PASS  R1 lifecycle: from('leads').eq is undefined (native postgrest-js)  -> typeof .eq = undefined
PASS  R1 Lead.find() (live)                              -> rows=0
PASS  R1 Lead.find({ status: 'New' }) (live)             -> rows=0
PASS  R1 Lead.find({ status: { $in: ['New','Contacted'] } }) -> rows=0
PASS  R1 Lead.findOne({}) (live)                         -> doc=null
PASS  R1 Lead.findById(<valid UUID>) (live)              -> doc=null
PASS  R1 Lead.find().sort({createdAt:-1}).limit(5)       -> rows=0
PASS  R1 Project.find().select('projectName status')     -> rows=0
PASS  R1 owner path: User.find({role:'sales'})           -> users=0
PASS  R1 owner path: Lead.aggregate(match-first owner group) -> agg=0
```

Empty results are correct for the empty database. **No records were inserted.**

## 8. R2 Root Cause

In `createRepository.js`, the module-level count helper and the static method shared the same name, and the static was a **named function expression** whose own name shadowed the module-level helper inside its body:

```js
async function countDocuments(modelRepo, filter) { ... }   // module-level helper

// factory:
Model.countDocuments = function countDocuments(filter) {
  return countDocuments(modelRepo, filter || {});           // resolves to ITSELF
};
```

`countDocuments(modelRepo, ...)` inside the named function expression bound to the function expression's own `countDocuments` name -> the static recursed into itself forever -> `RangeError: Maximum call stack size exceeded` on **every** repository.

## 9. R2 Technical Explanation

JavaScript named function expressions create a binding for their own name in their own scope. That binding shadows the outer module-scope `function countDocuments(...)` helper. The static therefore called itself with arguments `(modelRepo, filter)` that it then ignored (the named function's parameter is `filter`), so the first argument of the recursive call was `filter` (the previous call's second argument) and recursion never terminated. The module-level helper implementation itself was already correct (`select('*', { count: 'exact', head: true })` + filter translation + `count || 0`) — only the identifier collision caused the bug.

Fix: rename the module-level helper to `countDocumentsForRepo` and keep the public `Model.countDocuments(filter)` API unchanged.

## 10. Exact R2 Files Modified

| File | Change |
|---|---|
| `aken-backend/models/createRepository.js` | Module-level `countDocuments` -> `countDocumentsForRepo`; static `Model.countDocuments` now calls `countDocumentsForRepo(modelRepo, filter || {})`. |

The count itself continues to use `select('*', { count: 'exact', head: true })` — PostgREST HEAD + exact count, zero row bodies transferred — with full Mongo filter translation and numeric return semantics.

## 11. R2 Tests

Same suite (`tests/repositoryR1R2.test.js`), all against real repository classes:

- `Lead.countDocuments({})` -> exact-count HEAD request, no recursion
- `Lead.countDocuments({ status: "New" })` -> filters applied to count
- `Project.countDocuments({})`, `Quotation.countDocuments({})`
- empty-table -> `0`
- DB error -> `RepositoryError` with preserved PostgREST code
- regression over **all 15 repositories** -> no RangeError, one HEAD count per model, all `0`

## 12. R2 Live Supabase Verification

Same live script (read-only), against real `countDocuments` on real models:

```
PASS  R2 Lead.countDocuments({}) (live)                 -> count=0
PASS  R2 Lead.countDocuments({ status: 'New' }) (live)  -> count=0
PASS  R2 Project.countDocuments({}) (live)              -> count=0
PASS  R2 Quotation.countDocuments({}) (live)            -> count=0
```

No RangeError, no recursion, no TypeError, no database write.

## 13. Full Regression Test Results

Command: `cd aken-backend && npm test`

| Metric | Value |
|---|---|
| Total tests | **100** |
| Passed | **100** |
| Failed | **0** |
| Skipped | **0** |
| Duration | 11,664 ms |

Composition: 76 pre-existing tests (all still passing) + 24 new R1/R2 tests.

Targeted R1/R2 suite alone: `node --test tests/repositoryR1R2.test.js` -> **24/24 pass** (0 fail, 0 skip, ~240 ms).

## 14. Zero Database Writes — Confirmed

- The live smoke script issues only `SELECT`/`HEAD` queries (`.find/.findOne/.findById/.countDocuments` + in-memory aggregation over reads).
- No `insert`, `update`, `upsert`, `delete`, or RPC write is invoked by either this remediation or its scripts.
- The smoke run posted **0 rows** in every table (all reads returned empty), consistent with the pre-existing verified state (0 application rows).

## 15. No Schema / Functions / Privileges Changed

- `supabase/SCHEMA.sql`, `supabase/FUNCTIONS.sql`, `supabase/AUDIT_FIXES.sql` — **not executed**, **not edited**.
- No DDL, no function changes, no `GRANT`/`REVOKE`, no RLS/policy changes.
- Only application code changed: `aken-backend/models/createRepository.js` + new test file + read-only verification script.

## 16. Remaining Phase I Blockers

R1 and R2 are cleared, but the following were NOT part of this phase's authorization and remain open:

- **R3-R7**: not started (explicitly out of scope; will wait for approval). Per prior verification docs, these encompass the schema-integrity/RLS/function-execute grants and related remediation items (`AUDIT_FIXES.sql` content).
- **Database write paths (INSERT/UPDATE) not live-exercised** in this phase: `save()`, `create()`, `findByIdAndUpdate()`, `updateOne()`, upsert RPCs, and PDF/email quotation flows were only covered by the in-memory test suite. The empty-DB mandate precluded a live write smoke test. Live verification of write paths is a recommended follow-up for a subsequent phase once data writes are authorized.

---

## Final Classification

**R1 = PASS**
- Live repository reads against Supabase (`garrlnwamcwnypjrsfji`): `find`, filtered `find`, `$in`, `findOne`, `findById`, sort+limit, projection, owner-resolution aggregate — all successful.
- postgrest-js v2 lifecycle proven live (`from('leads').eq` is `undefined`; select-first builder path works).
- Full regression: 100/100.

**R2 = PASS**
- Live `countDocuments()` on Lead / Project / Quotation returns `0` against the real empty database, with no recursion, no RangeError, no TypeError, no write.
- Regression over all 15 repositories passes.

**STOPPED as required.** No R3-R7 work started; awaiting explicit approval.
