# B2 — Notification Persistence Race: SELECT → INSERT Replaced with Atomic UPSERT

**Status:** Implemented · Verified (76/76 tests pass) · Schema unchanged (functions added only)

---

## 1. Root cause

Every notification write for `lead_email_notifications` / `lead_whatsapp_notifications`
went through the repository's **fetch-then-insert** pattern:

```
SELECT row (fetchSubRow)   ← both workers observe "no row"
        ↓
INSERT row                  ← first worker wins
                            ← second worker → SQLSTATE 23505
```

Two code paths in `aken-backend/models/createRepository.js` did this:

1. **`applySubTableUpdates`** — the dotted `$set` / `$inc` path used by every
   notification write: the email/WhatsApp workers
   (`utils/leadEmailNotifications.js`, `utils/leadWhatsAppNotifications.js`) and
   the admin retry endpoints
   (`POST /api/leads/:id/notifications/retry`,
   `POST /api/leads/:id/whatsapp/retry`). A row missing → `INSERT` → the loser
   of a concurrent race threw 23505, which the retry routes' catch blocks
   turned into an HTTP 500 (`LEAD_EMAIL_RETRY_FAILED` / `LEAD_WHATSAPP_RETRY_FAILED`).
2. **`persistChildren` (1:1 sub-object branch)** — `lead.save()` with an
   `emailNotifications` / `whatsappNotifications` object on it. Same race.

The two tables are 1:1 with `leads` — `lead_id` is the PRIMARY KEY — so the
conflict arbiter already existed. The application just never used it atomically.

## 2. Fix

Replace the SELECT → INSERT (and the SELECT → UPDATE else-branch) with a single
server-side **`INSERT ... ON CONFLICT (lead_id) DO UPDATE`** statement, invoked
through a PostgREST RPC from the repository.

### Why a database function (not `.upsert()`)
PostgREST's native `.upsert()` cannot express
`attempt_count = attempt_count + excluded.attempt_count` — supplying
`attempt_count: 1` would *overwrite* the counter, losing concurrent retries.
`$inc` therefore must be evaluated inside the database, and the cleanest
Supabase primitive for that is an RPC.

### `supabase/FUNCTIONS.sql` — two new functions

```sql
public.upsert_lead_email_notification(
  p_lead_id uuid,
  p_admin_notified_at timestamptz,
  p_has_admin_notified_at boolean,
  p_client_acknowledged_at timestamptz,
  p_has_client_acknowledged_at boolean,
  p_last_attempt_at timestamptz,
  p_has_last_attempt_at boolean,
  p_attempt_count_delta int,
  p_last_error text,
  p_has_last_error boolean,
  p_last_error_details jsonb,
  p_has_last_error_details boolean
) returns int

public.upsert_lead_whatsapp_notification(
  -- same shape + p_last_fallback_url / p_has_last_fallback_url
) returns int
```

Semantics:

- **`INSERT`** when no row exists — `attempt_count` starts at
  `greatest(p_attempt_count_delta, 0)`; all other columns are NULL unless their
  `p_has_*` flag is true.
- **`ON CONFLICT (lead_id) DO UPDATE`** when the row exists:
  - `attempt_count = attempt_count + greatest(p_attempt_count_delta, 0)` —
    the conflicting row is row-locked, so concurrent `$inc` deltas queue and
    accumulate; no lost updates.
  - each ordinary column is overwritten **only if** its `p_has_*` flag is true
    and preserved otherwise — so
    `admin_notified_at`, `client_acknowledged_at`, `last_error`,
    `last_error_details`, `last_fallback_url` set by another writer are never
    clobbered, and setting a column to NULL clears it (flag true, value null).
  - `updated_at = now()` always.
- Returns `1` (rows written) — used defensively; `0` would signal a zero-row write.
- `EXECUTE` is granted to `service_role` only (matches the existing functions).

Concurrency is safe because the entire merge is **one atomic statement**: the
`ON CONFLICT ... DO UPDATE` row lock serializes concurrent writers on the same
`lead_id`, so SQLSTATE 23505 can never reach the application.

> **Nothing in `supabase/SCHEMA.sql` changed.** No table, column, index,
> constraint, or RLS policy was modified — only two functions were added to
> `supabase/FUNCTIONS.sql`. Deploy by running the appended section of that file
> (it is idempotent: `create or replace function`).

### Repository wiring (`models/createRepository.js`)

- Sub-tables may now declare:
  ```js
  upsertRpc: "upsert_lead_email_notification",   // function to call
  incrementColumn: "attempt_count"                // column owned by $inc
  ```
- `applySubTableUpdates` and `persistChildren` check for `upsertRpc` **first**:
  if present, they call `buildUpsertRpcArgs(...)` + `callUpsertRpc(...)` — one
  RPC round trip, **no SELECT, no INSERT/UPDATE on the table**. Sub-tables
  without `upsertRpc` keep the legacy path untouched (backward compatible).
- `buildUpsertRpcArgs` maps the collected `$set`/`$inc` to
  `p_<column>` / `p_has_<column>` / `p_attempt_count_delta`.
- Guards (fail fast, no silent data loss):
  - direct `$set` of the `incrementColumn` → `DB_INCREMENT_UNSUPPORTED`
    (retries must use `$inc`);
  - `$inc` on any non-increment column → `DB_INCREMENT_UNSUPPORTED`.
- `save()` / `create()` **never writes the increment column** — the hydrated
  notification defaults object carries `attemptCount: 0` which must not reset
  the retry counter (nor trip the guard).
- `getSupabaseClient` is now resolved lazily through the module namespace so
  call sites see live exports (also enables test mocking).

### Model config (`models/Lead.js`)

`emailNotifications` and `whatsappNotifications` sub-tables now declare
`upsertRpc` + `incrementColumn`. **No other model uses sub-tables, so nothing
else changes behavior.**

### Routes / workers (testability + live-exports alignment)

`leadRoutes.js`, `leadEmailNotifications.js`, and `leadWhatsAppNotifications.js`
now access their collaborators through the module namespace
(`leadEmailNotifications.sendLeadNotificationEmails(...)`,
`sendEmail.sendEmail(...)`, `whatsappWebhookModule.sendWhatsAppViaWebhook(...)`)
instead of frozen require-time destructures. Behavior is identical; it makes
the workers and retry endpoints stub-able and keeps every call on the live
export.

## 3. Files modified

| File | Change |
|---|---|
| `supabase/FUNCTIONS.sql` | **New** `upsert_lead_email_notification` + `upsert_lead_whatsapp_notification` (atomic `INSERT ... ON CONFLICT`); grants. Schema untouched. |
| `aken-backend/models/createRepository.js` | RPC-atomic sub-table write path (`buildUpsertRpcArgs`, `callUpsertRpc`) used by `applySubTableUpdates` + `persistChildren`; save() skips the increment column; lazy client resolution. |
| `aken-backend/models/Lead.js` | `upsertRpc` / `incrementColumn` on both notification sub-table configs. |
| `aken-backend/routes/leadRoutes.js` | Workers invoked via live module namespace (behavior identical). |
| `aken-backend/utils/leadEmailNotifications.js` | `sendEmail` accessed via live module namespace incl. `sendEmail.sendEmail` / `sendEmail.toSafeMailError`. |
| `aken-backend/utils/leadWhatsAppNotifications.js` | `whatsappWebhook` accessed via live module namespace. |
| `aken-backend/tests/notificationUpsert.test.js` | **New** — 12 deterministic concurrency/behavior tests (below). |

No schema changes, no API-response changes, no frontend changes.

## 4. Why UPSERT is concurrency-safe

1. **One statement, one round trip.** The RPC is a single
   `INSERT ... ON CONFLICT` — there is no interleaving window where a second
   writer can observe a stale "no row" state.
2. **The PK is the arbiter.** `lead_id` is the primary key of both tables, so
   Postgres resolves all contentions in one place; a loser is never an error,
   it becomes an `ON CONFLICT DO UPDATE`.
3. **Row-lock serialization for `$inc`.** Two `+1` retry counters cannot
   overwrite each other — the second statement waits on the first's row lock and
   then reads the committed value, so N concurrent retries yield exactly
   `attempt_count = N`.
4. **Column-preserving merge.** Each writer only overwrites the columns it
   actually set (`p_has_*` flags), so a worker marking
   `adminNotifiedAt` can never erase a concurrent retry's `lastError`, and
   vice-versa. Timestamps written by a writer always land; untouched columns
   stay untouched.
5. **No 23505, ever, from these writes.** The statement cannot raise a unique
   violation on its own conflict target, so the previous transient HTTP 500
   (`LEAD_EMAIL_RETRY_FAILED` / `LEAD_WHATSAPP_RETRY_FAILED`) is eliminated at
   the source.

## 5. Performance

- **Round trips dropped.** Old path: `SELECT` + (`INSERT` or `UPDATE`) = 2
  round trips per notification write, possibly delayed by lock waits.
  New path: **1 RPC**. For the worker lifecycle (attempt inc, error set, sent
  flags), this cuts per-lead notification I/O roughly in half.
- **No extra reads.** The repository never re-reads the sub-row before writing;
  clients that need the post-state already re-fetch via the lead join.
- **No new indexes / no table changes.** PK conflict resolution uses the
  existing `lead_email_notifications_pkey` / `lead_whatsapp_notifications_pkey`.
- **Unchanged hot paths.** Reads (joins, analytics) and the legacy sub-table
  path for other models are byte-for-byte unchanged.

## 6. Backward compatibility

- **API surface unchanged.** `Lead.updateOne({ $set/$inc: "emailNotifications.*" })`,
  `lead.save()`, `POST /:id/notifications/retry`, `POST /:id/whatsapp/retry`,
  and the worker return shapes (`{ ok, errors, reason }`) are identical.
- **Behavior deltas (all intended):**
  - a retry no longer returns HTTP 500 when it loses the insert race — it now
    succeeds (200 with `result.ok: true`) because the write is idempotent;
  - `attempt_count` is exactly incremented per successful retry, never reset;
  - a worker's sent-flag is preserved when a concurrent worker updates
    `lastError` and vice-versa.
- **Non-23505 failures unchanged.** Genuine provider errors (mail quota,
   webhook timeout, DB connectivity) still surface as the documented 500 codes —
  the retry endpoints' catch blocks are untouched.
- **Non-notification models untouched.** Only the two Lead notification
  sub-tables declare `upsertRpc`; every other sub-table/join/1:N path uses the
  exact previous logic.

## 7. Testing (deterministic)

`aken-backend/tests/notificationUpsert.test.js` runs against a synchronous
in-memory fake Supabase client whose RPC is a **single synchronous mutation** —
the same serialization guarantee PostgreSQL provides via `ON CONFLICT` row
locking — so concurrency tests are deterministic (no sleeps, no flake):

1. `$inc`/`$set` via `updateOne` → exactly one RPC; **zero** SELECT/INSERT on the
   table; RPC args carry `p_attempt_count_delta`, `p_has_*` flags.
2. **12 concurrent email retries** → one row, `attemptCount === 12`, no throw.
3. **10 concurrent WhatsApp retries** → one row, `attemptCount === 10`, no throw.
4. **Worker + retry overlap** → one row, counter merges (2), timestamps keep a
   writer's value, single-writer column (`adminNotifiedAt`) preserved.
5. **`save()` 1:1 sub-object** → upserts atomically, counter untouched (3).
6. Direct `$set` of `attemptCount` → `DB_INCREMENT_UNSUPPORTED`.
7. Legacy sub-tables (no `upsertRpc`) still SELECT→INSERT (compat guard).
8. HTTP retry endpoints: 200 on success (email + WhatsApp), 404 missing lead,
   genuine worker failure stays 500 with the existing code.
9. **8 concurrent `sendLeadNotificationEmails` runs end-to-end** → single row,
   `attemptCount === 8`, no INSERT anywhere, all `ok: true`.

**Full suite:** `npm test` → **76/76 pass, 0 fail** (was 64; +12 B2 tests).
No regressions in F1/F3/B1, duplicate-key mapping, project routes, quotation
validation, or totals tests.

## 8. Deploy checklist

1. Run the §9 additions of `supabase/FUNCTIONS.sql`
   (`upsert_lead_email_notification`, `upsert_lead_whatsapp_notification`, and
   the two `grant execute ... to service_role` statements).
2. Deploy the backend (repository + model + utils + routes).
3. Existing rows are unaffected — the functions are use-on-write.
