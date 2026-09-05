# SQL Validation & Execution Plan — `supabase/AUDIT_FIXES.sql`

**Date:** 2026-08-06
**Author:** Senior PostgreSQL DBA / Supabase Architect review
**Status:** VALIDATION COMPLETE — execution approved with conditions (see §9)
**Inputs reviewed:** `supabase/DATABASE_AUDIT.md` (P1–P22), `supabase/AUDIT_FIXES.sql`, `supabase/SCHEMA.sql`, `supabase/FUNCTIONS.sql`, backend write/read paths (`createRepository.js`, `Lead.js`, `Quotation.js`, `Invoice.js`, `Project.js`, `quotationValidation.js`, `leadValidation.js`, `leadRoutes.js`, `quotationRoutes.js`, `projectRoutes.js`, `exportRoutes.js`, `revenueRoutes.js`, `leadEmailNotifications.js`, `leadWhatsAppNotifications.js`, `ownerAssignment.js`, `server.js`).

---

## 0. Environment Baseline (observed, not re-audited)

| Fact | Source |
|---|---|
| Supabase PostgreSQL 15+, single shared DB; backend connects with **service-role key** (bypasses RLS) | `supabaseClient.js`, `SCHEMA.sql` |
| All 15 tables RLS-enabled, zero policies → deny-by-default; `anon`/`authenticated` revoked in schema | `SCHEMA.sql` |
| `activity_logs` has **no active writer** (model exists, never imported by any route) | `DATABASE_AUDIT.md`, route inventory |
| **No invoice CREATE/UPDATE route exists** in the backend (`routes/` has no `invoiceRoutes.js`; `server.js` mounts only leads/quotations/projects/revenue/export/system/auth/bootstrap/integrations) | `server.js`, `routes/` listing |
| Quotation numbers: written as trimmed string, may be `''`; lookups only via equality (`GET /api/leads/client/:quotationNumber`) | `quotationValidation.js`, `leadRoutes.js` |
| Notification sub-table rows: written fetch-then-insert via `applySubTableUpdates` (P9 race confirmed); `updated_at` never written by repo | `createRepository.js`, notification utils |
| Quotation `totalAmount`: route **honors client-supplied value** (`Math.min(totalAmount, 9_999_999_999)`), may differ from `subtotal + gst` | `quotationValidation.js` |
| `leads.email` is lowercased in JS middleware on create + update; no DB-level lowercase guard today | `leadValidation.js`, `SCHEMA.sql` |
| Lead → project conversion (`POST /from-lead/:leadId`): `findOne` then `create`, no transaction (P8 race confirmed) | `projectRoutes.js` |
| All 9 analytics functions already revoke `public` EXECUTE and grant `service_role`; `set_updated_at()` is the only public-schema function still executable by PUBLIC | `FUNCTIONS.sql`, `SCHEMA.sql` |

---

## 1. Statement-by-Statement Validation

Legend for idempotency:
- **IDEMPOTENT** = safe to execute multiple times.
- **ONE-SHOT** = second execution fails with a specific, expected error (must be wrapped/guarded or run once).

---

### §1 — Drop redundant / unused indexes (P11, P13)

#### 1.1 `drop index if exists public.quotations_lead_idx;`

| Item | Assessment |
|---|---|
| Purpose | P11: `quotations_lead_idx (lead_id)` is a leftmost prefix of `quotations_lead_created_idx (lead_id, created_at desc)`; pure write overhead. |
| Risk | **Low** |
| Est. time | < 100 ms (index metadata + buffer; table small) |
| Table locks | `ACCESS EXCLUSIVE` on the index only (brief; Postgres `DROP INDEX` takes an AEL on the index, not the table — concurrent table DML unaffected beyond a brief lock on the index relation) |
| Downtime | None (sub-second) |
| Backward compat | Full. App queries on `lead_id` (`Quotation.find({ leadId })`, `.eq('lead_id', …)`) are served by the composite `(lead_id, created_at desc)` (leftmost prefix). Verified no route filters quotations by `lead_id` without ordering that would break. |
| Idempotent | **Yes** (`if exists`) |
| App dependency on old behavior | None — `quotations_lead_created_idx` already exists in `SCHEMA.sql` and covers the same scans. |
| Veto | None. |

#### 1.2 P13 drops (commented out in the file)

Seven `drop index` statements are **commented out** by default. No execution action. If re-enabled later, each is `DROP INDEX` (idempotent, no data impact) but requires a decision per index (roadmap queries). **Recommendation: leave commented; re-review in 4–6 weeks against `pg_stat_user_indexes` (see §11b of fixes file) before dropping.** No shutdown impact if executed later.

---

### §2 — Add missing indexes (P10)

#### 2.1 `create index if not exists leads_status_created_idx on public.leads (status, created_at desc);`
#### 2.2 `create index if not exists leads_owner_created_idx on public.leads (owner, created_at desc);`
#### 2.3 `create index if not exists quotations_created_at_desc_idx on public.quotations (created_at desc);`
#### 2.4 `create index if not exists projects_status_site_created_idx on public.projects (status, site_status, created_at desc);`
#### 2.5 `create index if not exists projects_created_at_desc_idx on public.projects (created_at desc);`
#### 2.6 `create index if not exists invoices_created_at_desc_idx on public.invoices (created_at desc);`

| Item | Assessment (all six share this profile) |
|---|---|
| Purpose | P10: serve the real query shapes — exports (`filter {status}` / `{owner}` + `.sort({createdAt:-1})`), revenue monthly facets (`created_at >= X`), project list (`WHERE status [+ site_status] ORDER BY created_at DESC`). |
| Risk | **Low** (each) |
| Est. time | 100 ms – 2 s each at current volume (fresh migration; tables are small). At > 1M rows this becomes a multi-second full-index build. |
| Table locks | Plain `CREATE INDEX` takes `SHARE` lock on the table — **blocks writes** (INSERT/UPDATE/DELETE) for the duration of the build. At current small volumes: negligible window. |
| Downtime | None perceptible today. **Mitigation note:** only becomes an issue at scale; if tables ever approach large volume, re-run as `CREATE INDEX CONCURRENTLY` (must be run outside an explicit transaction — acceptable in the Supabase SQL editor which auto-commits per statement). |
| Backward compat | Full — indexes are invisible to app logic. |
| Idempotent | **Yes** (`if not exists`) |
| App dependency on old behavior | None. These are pure query accelerators; confirmed the query shapes exist (`exportRoutes.js`, `revenueRoutes.js`, `projectRoutes.js` GET `/`). |
| Veto | None. |

**Notes:**
- `leads_owner_created_idx` indexes the denormalized text `owner` (P7 accepted design) — matches `exportRoutes` filter `{ owner }`. Correct target column.
- `projects_status_site_created_idx` ordering `(status, site_status, created_at desc)` — with `site_status` nullable? It is `NOT NULL DEFAULT 'Not Started'`, so no null-ordering concerns.
- No index conflicts with existing `SCHEMA.sql` indexes (verified names differ).

---

### §3 — Unique business document numbers (P2)

#### 3.1 Data-prep `update public.quotations set quotation_number = null where quotation_number is not null and btrim(quotation_number) = '';`

| Item | Assessment |
|---|---|
| Purpose | Normalize empty-string placeholders (`quotationValidation.js` stores `''` when blank) to proper NULL before the partial unique index. |
| Risk | **Low** (row-level UPDATE; only affects whitespace-only values) |
| Est. time | < 100 ms at current volume |
| Table locks | Row locks only (no table-level lock). Safe online. |
| Downtime | None |
| Backward compat | Full — `NULL` and `''` are both falsy everywhere the app reads it (`quotation.quotationNumber || quotation._id`, exports `|| ""`). Behavior-identical to the app. |
| Idempotent | **Yes** (second run matches 0 rows) |
| App dependency | `quotationValidation.js` may still write `''` for empty numbers — the UPDATE is **not** a permanent backstop. **Run the UPDATE *after* deploying the app change that stores `null` (or empty→null)** so future writes don't reintroduce `''`. If `''` is re-stored later, the partial unique index still works (predicate excludes it), but the data is messy again. |
| Veto | None. |

#### 3.2 `update public.invoices set invoice_number = null where invoice_number is not null and btrim(invoice_number) = '';`

| Item | Assessment |
|---|---|
| Purpose | Same normalization for invoices (P2). |
| Risk | **Low** |
| Est. time | < 100 ms |
| Table locks | Row locks only |
| Downtime | None |
| Backward compat | Full — same falsy-`||` usage patterns in exports (`invoice.invoiceNumber || ""`). |
| Idempotent | **Yes** |
| App dependency | No invoice write route exists today; no dependency. |
| Veto | None. |

#### 3.3 `create unique index if not exists quotations_number_uq on public.quotations (quotation_number) where quotation_number is not null and btrim(quotation_number) <> '';`

| Item | Assessment |
|---|---|
| Purpose | P2: enforce one non-empty quotation number per row (business document uniqueness). |
| Risk | **Medium** — the index **fails loudly** (23505 at CREATE time) if duplicate non-empty numbers already exist. That is the correct failure mode, but the file's data-prep query is commented — must run first (§3.0/Phase 2 step). |
| Est. time | < 200 ms (build + scan); duplicates make it fail fast with `duplicate key value violates unique constraint`. |
| Table locks | `SHARE` on `quotations` during build (blocks writes briefly). |
| Downtime | None perceptible at current volume. |
| Backward compat | **Behavior change for writers**: any future insert/update with a duplicate non-empty number **fails with 23505** rather than silently storing a duplicate. The API routes (`quotationRoutes.js` POST `/`, PUT paths) have no 23505 mapping → **surface as 500** until mapped. See §7 Finding F2. |
| Idempotent | **Yes** (`if not exists`) |
| App dependency on old behavior | Depends on `quotationValidation.js` (no uniqueness check today) and `GET /api/leads/client/:quotationNumber` (equality lookup now guaranteed ≤ 1 row — improvement, not break). Number generation is **not centralized** — any admin-issued duplicate will 500 until the route maps the error. Flag for app change. |
| Veto | None, with F2. |

**Planner note (verified logic):** PostgREST emits `WHERE quotation_number = '…'`; PostgreSQL's predicate-implication constant-folding proves the partial index predicate (`IS NOT NULL` + `btrim <> ''`) for a non-NULL literal equality, so the partial unique index will serve equality lookups. The drop of `quotations_number_idx` (§3.5) does not regress those lookups.

#### 3.4 `create unique index if not exists invoices_number_uq on public.invoices (invoice_number) where invoice_number is not null and btrim(invoice_number) <> '';`

| Item | Assessment |
|---|---|
| Purpose | P2: same for invoice numbers. |
| Risk | **Medium** (same duplicate-failure mode as 3.3) |
| Est. time | < 200 ms |
| Table locks | `SHARE` on `invoices` (brief) |
| Downtime | None perceptible |
| Backward compat | No invoice writer exists today — lowest app impact of the uniqueness changes. Future writers must handle 23505. |
| Idempotent | **Yes** |
| App dependency | None active. |
| Veto | None, conditioned on Phase 3 duplicate verification. |

#### 3.5 `drop index if exists public.quotations_number_idx;`

| Item | Assessment |
|---|---|
| Purpose | P2 hygiene: the old non-unique index becomes redundant for non-null equality (partial unique index covers it). |
| Risk | **Low** |
| Est. time | < 100 ms |
| Table locks | Index-level AEL (brief) |
| Downtime | None |
| Backward compat | Equality lookups on **non-empty** numbers keep the partial unique index. Equality lookups on `''` or NULL (not present in the partial index) were previously covered by `quotations_number_idx` — **no app query filters by empty string** (route lookups only receive real numbers; `Quotation.findOne({ quotationNumber })` with a param that is `''` would fall back to a seq scan, which is fine and rare). |
| Idempotent | **Yes** |
| App dependency | None. |
| Veto | None. |

---

### §4 — One project per lead (P8)

#### 4.1 `create unique index if not exists projects_lead_uq on public.projects (lead_id) where lead_id is not null;`

| Item | Assessment |
|---|---|
| Purpose | P8: enforce 1-project-per-lead at the DB level, closing the findOne-then-create race in `POST /api/projects/from-lead/:leadId`. |
| Risk | **Medium** — fails loudly (23505) if duplicate `lead_id` rows already exist in `projects` (the file comments a verification query — must run first). |
| Est. time | < 200 ms |
| Table locks | `SHARE` on `projects` (brief) |
| Downtime | None perceptible |
| Backward compat | **Behavior change for writers**: concurrent/late duplicate conversions now throw 23505. `projectRoutes.js` `from-lead` catch returns 500 `PROJECT_LEAD_CONVERT_FAILED` instead of the graceful `{ alreadyExists }`. **Must map 23505 → 200 alreadyExists** in the route (F3). The serial path is unchanged (findOne still returns early). |
| Idempotent | **Yes** |
| App dependency | `projectRoutes.js` POST `/from-lead/:leadId`; `quotationRoutes.js` POST `/:id/convert` (creates a project with `leadId` if the quotation has one — a lead previously converted from-lead will now make the convert path fail with 23505 → 500 until mapped). |
| Veto | None, with F3 (and Phase 3 duplicate check). |

#### 4.2 (commented) `drop index if exists public.projects_lead_idx;`

Not active. If executed: `projects_lead_idx (lead_id)` also covers `lead_id IS NULL` scans and serves as FK documentation; dropping is optional. **Recommendation: keep it.** No action.

---

### §5 — Audit-trail FK behaviour (P1, P3)

#### 5.1 `alter table public.activity_logs: drop constraint activity_logs_lead_id_fkey; alter column lead_id drop not null; add constraint activity_logs_lead_id_fkey foreign key (lead_id) references leads (id) on delete set null;`
#### 5.2 `alter table public.activity_logs: drop constraint activity_logs_performed_by_fkey; alter column performed_by drop not null; add constraint activity_logs_performed_by_fkey foreign key (performed_by) references users (id) on delete set null;`

| Item | Assessment |
|---|---|
| Purpose | P1/P3: deleting a user/lead must **not** cascade-delete the audit trail; set FK to `ON DELETE SET NULL` and make columns nullable. |
| Risk | **Low** |
| Est. time | < 100 ms (table empty or near-empty; no active writer) |
| Table locks | `ACCESS EXCLUSIVE` on `activity_logs` during the ALTERs (no concurrent access today — no writer, no reader route). |
| Downtime | None (table is dormant; no API path touches it) |
| Backward compat | Full toward the app: no route imports `ActivityLog`. Schema shape change is forward-looking (added nullability). |
| Idempotent | **Yes** — `drop constraint if exists` removes the FK, `drop not null` on an already-nullable column is a no-op, and the FK is re-added. A second run is clean. |
| App dependency | None today. **Note for the future audit-log feature**: new writers must accept nullable `lead_id`/`performed_by` and read rows where either is NULL. This is the intended semantic (trail survives deletions). |
| Veto | None. |

---

### §6 — `updated_at` triggers on notification tables (P4)

#### 6.1 `drop trigger if exists set_updated_at_lead_email_notifications on public.lead_email_notifications; create trigger ... execute function public.set_updated_at();`
#### 6.2 same for `lead_whatsapp_notifications`

| Item | Assessment |
|---|---|
| Purpose | P4: hook the existing `set_updated_at()` function onto the two 1:1 sub-tables so `updated_at` stops going stale. |
| Risk | **Low** |
| Est. time | < 50 ms each |
| Table locks | `SHARE ROW EXCLUSIVE` (brief) on each table |
| Downtime | None |
| Backward compat | Full. `set_updated_at()` is a `before update ... for each row` function; both tables already have the `updated_at` column. The repository sub-table update path never writes `updated_at` (`rowMap` omits it), so no app value is overwritten — the trigger only *fills* it. Reads unaffected. |
| Idempotent | **Yes** (drop-then-create pattern) |
| App dependency | None — complements (does not change) the P9 app-layer upsert fix in `createRepository.js`. |
| Veto | None. |

---

### §7 — Data-prep + CHECK constraints (P5, P6, P14, P20)

#### 7a. `alter table public.quotations add constraint quotations_total_integrity check (total_amount = subtotal + gst);`

| Item | Assessment |
|---|---|
| Purpose | P5: enforce `total = subtotal + gst` at the DB level for all writers (route-layer only today). |
| Risk | **MEDIUM-HIGH (the highest-risk statement in the file)** |
| Est. time | < 200 ms (scan); fails fast if violators exist |
| Table locks | `ACCESS EXCLUSIVE` on `quotations` + full-table scan (non-`NOT VALID`). At current volume: brief. |
| Downtime | None perceptible now; do **not** apply to a very large table without using `ADD CONSTRAINT ... NOT VALID` + `VALIDATE CONSTRAINT` (not used in the file). |
| Backward compat | **Behavior change for the current API.** `quotationValidation.js` stores a client-supplied `totalAmount` verbatim when present (`finalTotal = Math.min(totalAmount, 9_999_999_999)`), which can differ from `subtotal + finalGst`. After this constraint: such creates → 500. Existing rows with mismatched totals were written by this exact path — the verification query in the file is mandatory and **violators must be repaired (recompute total) before applying**. |
| Idempotent | **NO — ONE-SHOT.** `ADD CONSTRAINT` (CHECK) has no `IF NOT EXISTS` in PostgreSQL. A second run fails with `constraint "quotations_total_integrity" already exists`. Guard or run once. |
| App dependency on old behavior | **Yes, real conflict** → Finding F1: change `quotationValidation.js` to reject/ignore client `totalAmount` not equal to `subtotal + gst` (or drop the client override), and correct historical rows in Phase 3. |
| Veto | **Conditional approval**: (1) Phase 3 verification returns 0 violators (or they are repaired first); (2) F1 app change is scheduled with the deployment; (3) run once. |

#### 7b. `alter table public.invoices add constraint invoices_paid_amount_le_amount check (paid_amount <= amount);`

| Item | Assessment |
|---|---|
| Purpose | P6: prevent over-payment records. |
| Risk | **Low-Medium** |
| Est. time | < 200 ms (scan) |
| Table locks | `ACCESS EXCLUSIVE` on `invoices` (brief, current volume) |
| Downtime | None perceptible |
| Backward compat | Full toward the *current* app — **no invoice write route exists**; invoices are only read (`exports`, `revenue`, margin context). Future invoice writers must respect the constraint. |
| Idempotent | **NO — ONE-SHOT** (same as 7a) |
| App dependency | None active today. Historical data must be verified/cleaned in Phase 3. |
| Veto | Conditional on Phase 3 verification returning 0 `paid_amount > amount`. |

#### 7c. `update public.leads set email = lower(email) where email <> lower(email);` + `alter table public.leads add constraint leads_email_lowercase check (email = lower(email));`

| Item | Assessment |
|---|---|
| Purpose | P14: enforce lowercase email at DB level (JS middleware already lowercases; this closes the bypass path). |
| Risk | **Low-Medium** |
| Est. time | UPDATE < 100 ms; ALTER < 200 ms |
| Table locks | UPDATE: row locks. ALTER: `ACCESS EXCLUSIVE` + scan on `leads`. |
| Downtime | None perceptible |
| Backward compat | All lead writers verified lowercase first: `validateCreateLead` / `validateLeadUpdate` call `.toLowerCase()`; the public leads API route (`aken-frontend/src/app/api/public/leads/route.ts`) proxies into the same validated backend route; the WhatsApp webhook controller (`whatsappWebhookController.js`) only logs — it never writes `leads`. No rogue writer exists; the CHECK is satisfied by every current write path. |
| Idempotent | UPDATE: yes. ALTER: **NO — ONE-SHOT**. |
| App dependency | None conflicting. Note: `leads.email` is NOT unique (no unique index) so lowercasing cannot collide — the audit's assertion is correct. |
| Veto | None, conditioned on Phase 3 confirmation of all email writers lowercasing. |

#### 7d. (OPTIONAL, commented) `alter table public.leads add constraint leads_phone_format check (phone ~ '^[0-9+\-\s()]{7,20}$');`

| Item | Assessment |
|---|---|
| Purpose | P20: charset/format guard for `leads.phone`. |
| Risk | **Low** but **only if** Phase 3 verification confirms all historical rows conform (same regex is already enforced in `leadValidation.js`, so conformance is likely). |
| Est. time | < 200 ms |
| Table locks | `ACCESS EXCLUSIVE` + scan |
| Downtime | None perceptible |
| Backward compat | Full toward app (JS enforces the identical regex). |
| Idempotent | **NO — ONE-SHOT** |
| App dependency | `leadValidation.js` `PHONE_ALLOWED_REGEX` — identical pattern. |
| Veto | Optional by design; do NOT enable in Phase 2. Phase 4 only. |

---

### §8 — Security hardening (P12)

#### 8.1 `revoke all on all functions in schema public from public;`
#### 8.2 `alter default privileges in schema public revoke execute on functions from public;`
#### 8.3 `alter default privileges in schema public revoke all on tables from public;`
#### 8.4 `alter default privileges in schema public revoke all on sequences from public;`
#### 8.5 `grant execute on all functions in schema public to service_role;`
#### 8.6 `grant all on all tables in schema public to service_role;`
#### 8.7 `grant all on all sequences in schema public to service_role;`

| Item | Assessment |
|---|---|
| Purpose | P12 defense-in-depth: strip default PUBLIC EXECUTE on functions (incl. `set_updated_at()`), harden default privileges, re-assert `service_role`. |
| Risk | **Medium** — not a lock risk, but a **permissions** risk if anything downstream relies on PUBLIC defaults. |
| Est. time | < 50 ms total |
| Table locks | None — DDL metadata only, fully online (no locking of user tables; runs transactionally like other catalog changes) |
| Downtime | None |
| Backward compat | **Must hold two conditions**: (1) `revoke usage on schema public from public` stays **commented** (it is — correct, because Supabase-managed paths, dashboard SQL editor, and future PostgREST key setups need schema USAGE); (2) no app path relies on PUBLIC function default EXECUTE. Verified: backend uses `service_role` only; the 9 analytics functions already revoke PUBLIC explicitly; the only exposure removed by 8.1 is `set_updated_at()` (trigger-internal, executed as the table-owner/invoker — triggers invoke as the table owner by default, unaffected). |
| Idempotent | **Yes** — `revoke`/`grant` are naturally idempotent; `alter default privileges` re-applying is harmless. |
| App dependency | None. NOTE: `alter default privileges` is a **persistent, role-scoped setting** (applies to objects created *in the future* by the executing role). Verify the executing role is the schema owner (normally `postgres` on Supabase); future migrations by a *different* role would not inherit this hardening — document that migrations run as the same role. |
| Veto | None. The commented `revoke all on all tables/sequences ... from public` + `grant usage to service_role` block must remain commented per the file's own warning and this review's condition (1). |

---

### §9 — Documentation / optional DDL (P7, P16, P17)

All three blocks (`v_lead_owner` view DDL, `added_by_user_id` FK column, `month_date` generated column) are **commented out** in the file. No action. If adopted later:
- `v_lead_owner`: view creation, no locks on base tables (only `ACCESS SHARE`). Idempotent via `create or replace`.
- `added_by_user_id`: `ALTER TABLE ... ADD COLUMN` — brief AEL; one-shot.
- `month_date` generated column: brief AEL + rewrite of `forecasts` (small); one-shot. The suggested `to_date(left(month,4)||'-'||right(month,2)||'-01', …)` is correct for `YYYY-MM`.

---

### §10 — App-layer changes (P9, P15, P18, P19) — NOT SQL

Documented only. Confirm alignment (from review):
- **P9 upsert** (`INSERT ... ON CONFLICT (lead_id) DO UPDATE`): current `applySubTableUpdates` + `persistChildren` do fetch-then-insert → confirmed. This is required for the §3/§4-style guarantees to be race-free on notification writes; the §6 triggers are complementary.
- **P15 note length cap at 2000**: current `POST /api/leads/:id/notes` has no JS length check; DB CHECK (`lead_notes_text_length`, ≤2000) → 500 today. Confirmed.
- **P18 pagination**: `GET /api/leads` and `GET /api/quotations` currently load full tables (`leadRoutes.js`, `quotationRoutes.js`). Confirmed. §2 indexes support the `created_at desc` order they will use.
- **P19 batch note insert**: `persistChildren` loops one `.single()` insert per note. Confirmed.

### §11 — Introspection SQL (P21, P22)

Read-only; no locks; no risk. Safe to run any time (Phase 4).

---

## 2. Cross-Cutting Findings (must be addressed)

**F1 — CHECK 7a conflicts with current quotation route behavior (HIGH, blocks Phase 2).**
`quotationValidation.js` preserves a client-supplied `totalAmount` (capped at 9,999,999,999) rather than forcing `subtotal + gst`. The DB constraint makes such writes fail. Two options:
1. App change: after computing `subtotal`/`finalGst`, set `finalTotal = computedTotal` unconditionally (ignore client total, or return 400 when `|clientTotal − computedTotal| > 0.01`).
2. Or defer 7a until the app change ships and existing violators are repaired.
**Recommended:** Option 1 + Phase 3 repair of historical rows, then apply 7a.

**F2 — Unique-number violations surface as 500 (MEDIUM).**
`quotationRoutes.js` POST `/` and any future invoice writer have no 23505 mapping. Add a PostgREST error-code branch (`code === "23505"`) → 409 with a clear message. Same for the quotation-number path.

**F3 — `POST /from-lead/:leadId` duplicate race now fails with 500 instead of graceful `alreadyExists` (MEDIUM).**
After §4, the concurrent second insert throws 23505 → catch → 500 `PROJECT_LEAD_CONVERT_FAILED`. Update `projectRoutes.js` (and `quotationRoutes.js` `/convert`) to intercept 23505 and return the `{ alreadyExists: true, project }` payload (fetch the existing row in the catch). Without this, the race is *closed at the DB* but the UX is a 500.

**F4 — Idempotency of §7 (MEDIUM process risk).** §7a/7b/7c ALTERs are ONE-SHOT (no `ADD CONSTRAINT IF NOT EXISTS` in PG). Wrap each in a guarded DO block or document that the section runs exactly once. §5/§6 are re-runnable; §1/§2/§3/§4 are `IF [NOT] EXISTS`-safe.

**F5 — `''` can be re-introduced by the app.** §3 normalizes, but `quotationValidation.js` still writes `''` for empty numbers. Pair the SQL §3 with the app tweak (write `null`), or add a trigger/CHECK to map `''` → NULL insert-time if full app change is deferred.

**F6 — Serialize the notification upsert + §6.** The §6 triggers make `updated_at` accurate; the P9 upsert makes writes race-free. Both are complements; order doesn't matter, but ship P9 with the deployment window.

---

## 3. Execution Plan

### Phase 1 — Safe online changes (no table locks beyond index-share; no behavior change)

Run in a maintenance window or low-traffic window; all statements commit individually. **No app code change required before Phase 1.**

| # | Statement | Source |
|---|---|---|
| 1.1 | `drop index if exists public.quotations_lead_idx;` | §1 |
| 1.2 | `create index if not exists leads_status_created_idx on public.leads (status, created_at desc);` | §2 |
| 1.3 | `create index if not exists leads_owner_created_idx on public.leads (owner, created_at desc);` | §2 |
| 1.4 | `create index if not exists quotations_created_at_desc_idx on public.quotations (created_at desc);` | §2 |
| 1.5 | `create index if not exists projects_status_site_created_idx on public.projects (status, site_status, created_at desc);` | §2 |
| 1.6 | `create index if not exists projects_created_at_desc_idx on public.projects (created_at desc);` | §2 |
| 1.7 | `create index if not exists invoices_created_at_desc_idx on public.invoices (created_at desc);` | §2 |
| 1.8 | `update public.quotations set quotation_number = null where quotation_number is not null and btrim(quotation_number) = '';` | §3 data-prep |
| 1.9 | `update public.invoices set invoice_number = null where invoice_number is not null and btrim(invoice_number) = '';` | §3 data-prep |
| 1.10 | `update public.leads set email = lower(email) where email <> lower(email);` | §7c data-prep |
| 1.11 | Drop + recreate triggers on `lead_email_notifications` and `lead_whatsapp_notifications` | §6 |
| 1.12 | Security hardening: 8.1–8.7 (revoke PUBLIC function exec + default privileges, re-grant `service_role`) | §8 |

Exit criteria: all statements succeed; `\di` shows the 6 new indexes; `pg_trigger` shows 2 new triggers; a sample `EXPLAIN` on an export query uses `leads_status_created_idx`.

### Phase 2 — Constraint additions (brief table-lock windows; behavior change — schedule with app deploy)

Preconditions (from Phase 3 below — see ordering note):
- Duplicate business-document numbers resolved.
- Duplicate `projects.lead_id` rows resolved.
- Quotation `total_amount` mismatches repaired.
- Invoice `paid_amount > amount` records repaired.
- F1 app change deployed (or 7a deferred, see condition).

| # | Statement | Source | Lock |
|---|---|---|---|
| 2.1 | `create unique index if not exists quotations_number_uq on public.quotations (quotation_number) where quotation_number is not null and btrim(quotation_number) <> '';` | §3 | SHARE (quotations) |
| 2.2 | `create unique index if not exists invoices_number_uq on public.invoices (invoice_number) where invoice_number is not null and btrim(invoice_number) <> '';` | §3 | SHARE (invoices) |
| 2.3 | `drop index if exists public.quotations_number_idx;` | §3 | AEL (index) |
| 2.4 | `create unique index if not exists projects_lead_uq on public.projects (lead_id) where lead_id is not null;` | §4 | SHARE (projects) |
| 2.5 | ALTER §5 (activity_logs FKs → SET NULL + nullable) — safe anytime (dormant table) | §5 | AEL (activity_logs) |
| 2.6 | `add constraint quotations_total_integrity check (total_amount = subtotal + gst);` — **ONE-SHOT**, guard | §7a | AEL (quotations) + scan |
| 2.7 | `add constraint invoices_paid_amount_le_amount check (paid_amount <= amount);` — **ONE-SHOT**, guard | §7b | AEL (invoices) + scan |
| 2.8 | `add constraint leads_email_lowercase check (email = lower(email));` — **ONE-SHOT**, guard | §7c | AEL (leads) + scan |

Exit criteria: all constraints visible in `pg_constraint`; zero constraint-violation aborts caused by app traffic during the window; backend error logs show no new 23505/check-violation 500s (because F1–F3 were deployed simultaneously).

### Phase 3 — Data validation (before, during, and after Phases 1–2)

Run these queries **before** Phase 2 (fix data), and **re-run after** Phase 2 to prove the invariants hold.

| # | Check | Query | Action if fails |
|---|---|---|---|
| 3.1 | Duplicate quotation numbers | `select quotation_number, count(*) from public.quotations where quotation_number is not null and btrim(quotation_number) <> '' group by 1 having count(*) > 1;` | Rename or NULL the duplicate numbers (business decision), then re-run |
| 3.2 | Duplicate invoice numbers | same on `public.invoices` | same |
| 3.3 | Duplicate projects per lead | `select lead_id, count(*) from public.projects where lead_id is not null group by 1 having count(*) > 1;` | Merge/archive duplicates (business decision), then re-run |
| 3.4 | Quotation total integrity | `select id, subtotal, gst, total_amount from public.quotations where abs(total_amount - (subtotal + gst)) > 0.01;` | Recompute `total_amount = subtotal + gst` (one UPDATE), then re-run |
| 3.5 | Invoice over-payment | `select id from public.invoices where paid_amount > amount;` | Correct `paid_amount`/`amount`, then re-run |
| 3.6 | Lead email residual mixed-case | `select count(*) from public.leads where email <> lower(email);` | Expect 0 after Phase 1.10 |
| 3.7 | Lead phone format (only if enabling 7d) | `select id, phone from public.leads where phone !~ '^[0-9+\-\s()]{7,20}$';` | Repair or skip 7d |
| 3.8 | All lead writers lowercase (P14 audit) | Grep backend for `Lead.create` / `Lead.save` / direct `leads` table writes outside the validated `leadRoutes.js` paths and webhook controller | Confirm lowercasing or fix writer |
| 3.9 | Post-apply constraint sanity | `select conname from pg_constraint where connamespace = 'public'::regnamespace and conname in ('quotations_total_integrity','invoices_paid_amount_le_amount','leads_email_lowercase','quotations_number_uq','invoices_number_uq','projects_lead_uq');` | Expect all 6 |
| 3.10 | Post-apply runtime smoke | Exercise `GET /api/leads?` (export filter+sort), `GET /api/projects` (status/site filter), `GET /api/revenue/overview`, `GET /api/quotations`, `POST /api/projects/from-lead/:leadId` ×2 concurrent | Verify faster plans + no 500s; second concurrent conversion returns `alreadyExists` (after F3) |
| 3.11 | Trigger freshness | Perform a sub-table update (`Lead.updateOne` on `emailNotifications`) and confirm `updated_at` advances | Confirms §6 |

### Phase 4 — Optional optimizations / follow-ups (no locks; deferred or out-of-schema)

| # | Item | Source | When |
|---|---|---|---|
| 4.1 | `leads_phone_format` CHECK (optional) — ONE-SHOT | §7d | Only if 3.7 clean |
| 4.2 | `storage.buckets` introspection (P22) | §11a | Now-safe |
| 4.3 | `pg_stat_user_indexes` review for the 7 dead indexes (P13) + §2 index usage | §1 comments, §11b | 4–6 weeks post-apply |
| 4.4 | `pg_stat_statements` baseline (P21 monitoring) | §11c | After traffic baseline |
| 4.5 | App-layer batch: P9 upsert, P15 note length cap + position rowMap, P18 pagination, P19 batch notes | §10 | Deploy window |
| 4.6 | Analytics single-pass CTE refactor (P21) | §11d | Out of scope (FUNCTIONS.sql refactor) |
| 4.7 | Optional schema upgrades: `v_lead_owner` view (P7), `added_by_user_id` FK (P16), `month_date` generated column (P17) | §9 | Only if business need |

---

## 4. Rollback Strategy

| Change | Rollback |
|---|---|
| Index drops (§1) | Re-create the index (one statement, no data impact) |
| Index adds (§2) | `drop index` (no data impact) |
| Data-prep updates (§3/§7c) | Reverse UPDATE is only needed if a later constraint fails; values are `'' → NULL` / email lowercasing — effectively irreversible in original casing, but semantically equivalent for the app. **Backup the payloads before Phase 1** (`create table ... as select` copies of the affected columns). |
| Unique/partial indexes (§3/§4) | `drop index` — constraints vanish, data untouched |
| FK changes (§5) | Re-apply original `ON DELETE CASCADE` + `SET NOT NULL` (only if activity_logs gains writers AND CASCADE semantics are wanted — not recommended) |
| Triggers (§6) | `drop trigger` |
| CHECK constraints (§7) | `alter table ... drop constraint` (data untouched) |
| Grants/revokes (§8) | `grant execute on all functions in schema public to public;` + reverse ALTER DEFAULT PRIVILEGES (document the original state first) |

---

## 5. Recommendation Summary

1. **Approved to execute** Phases 1–4 **in order**, with the Phase 3 gates enforced **before** Phase 2 steps 2.6–2.8.
2. **Mandatory app changes to ship in the same deployment window as Phase 2:** F1 (quotation total semantics), F2 (23505 → 409), F3 (23505 → alreadyExists). Without these, the new constraints convert race/duplicate edge cases from silent bugs into user-facing 500s.
3. **§7 ALTERs are ONE-SHOT** — wrap 2.6/2.7/2.8 in guarded DO blocks or a single-run migration script.
4. **Do not** enable the commented options (§7d, §9 additions, §4.2 index drop, `revoke usage on schema public from public`) until the explicit conditions in this document are met.
5. Expected total impact: zero downtime; table locks only during Phase 2 (sub-second to seconds at current volume); backward-compatible with the HTTP API provided F1–F3 are deployed.

**No SQL was executed during this validation.**
