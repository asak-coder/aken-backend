# FUNCTIONS PRE-EXECUTION AUDIT — `supabase/FUNCTIONS.sql`

**Audit date:** 2026-08-13
**Audit scope:** `supabase/FUNCTIONS.sql` — full read + cross-reference against `supabase/SCHEMA.sql`, `B2_NOTIFICATION_UPSERT.md`, `aken-backend/models/createRepository.js`, `aken-backend/models/Lead.js`, `aken-backend/models/Quotation.js`, `aken-backend/routes/leadRoutes.js`, `aken-backend/routes/revenueRoutes.js`, `aken-backend/routes/projectRoutes.js`, `aken-backend/utils/ownerAssignment.js`, `aken-backend/utils/leadEmailNotifications.js`, `aken-backend/utils/leadWhatsAppNotifications.js`, `supabase/DATABASE_AUDIT.md`, `SQL_VALIDATION_PLAN.md`.
**Method:** Static audit. **No SQL from FUNCTIONS.sql was executed. No file was modified except this report.**

---

## 1. Project identity

| Item | Value |
|---|---|
| Supabase project ID | `garrlnwamcwnypjrsfji` |
| Supabase URL | `https://garrlnwamcwnypjrsfji.supabase.co` |
| Database | PostgreSQL (Supabase, PG15+) |
| Schema | `public` |
| Execution environment | Supabase Dashboard → SQL Editor → Primary Database |
| Role | `postgres` |
| Architecture | Frontend → Next.js (proxy) → Express backend → Supabase **service-role** client → Postgres functions/tables. Frontend never touches PostgREST application tables directly. |

---

## 2. Current schema state (verified baseline)

| Object | Count |
|---|---|
| Application tables | 15 (activity_logs, boq_entries, forecasts, invoices, labour_entries, lead_email_notifications, lead_notes, lead_whatsapp_notifications, leads, materials, projects, quotation_items, quotations, tenders, users) |
| Views | 1 (`v_lead_overview`) |
| Application-table rows | 0 |
| Public indexes | 47 |
| Unique indexes | 17 |
| Foreign keys | 14 |
| Triggers | 10 (`set_updated_at` on 10 tables) |
| RLS-enabled tables | 15 |
| RLS policies | 0 (deny-by-default) |
| **Functions in `public` (pre-execution)** | **1 — `public.set_updated_at()` (from SCHEMA.sql)** |

`SCHEMA.sql` has already been executed successfully. `AUDIT_FIXES.sql`, `SQL_VALIDATION_PLAN.md`, Phase 1 and Phase 2 SQL are **out of scope and must not be run**.

---

## 3. Complete function inventory — `supabase/FUNCTIONS.sql`

`FUNCTIONS.sql` defines **11 functions** (9 analytics/load + 2 B2 upserts). All are created with `CREATE OR REPLACE FUNCTION` (idempotent).

### 3.1 Analytics / load functions

| # | Function | Arguments | Return | Language / volatility | Referenced tables | Referenced columns |
|---|----------|-----------|--------|------------------------|-------------------|--------------------|
| 1 | `lead_analytics_summary` | `p_months int`, `p_source_limit int`, `p_owner_limit int` | `jsonb` | `sql` / `stable` | `public.leads` | status, deal_value, probability, created_at, utm_source, owner, id, contact_person, company_name |
| 2 | `revenue_lead_facet` | `p_months int`, `p_source_limit int` | `jsonb` | `sql` / `stable` | `public.leads` | status, deal_value, probability, created_at, utm_source |
| 3 | `revenue_quotation_facet` | `p_months int` | `jsonb` | `sql` / `stable` | `public.quotations` | status, total_amount, created_at |
| 4 | `revenue_project_facet` | `p_months int` | `jsonb` | `sql` / `stable` | `public.projects` | status, project_value, created_at |
| 5 | `revenue_invoice_facet` | `p_months int` | `jsonb` | `sql` / `stable` | `public.invoices` | amount, paid_amount, created_at |
| 6 | `project_summary` | — | `jsonb` | `sql` / `stable` | `public.projects` | status, project_value, total_spent, progress_percentage |
| 7 | `invoice_totals` | — | `jsonb` | `sql` / `stable` | `public.invoices` | amount, paid_amount |
| 8 | `owner_lead_load` | `p_user_ids uuid[]` | `TABLE("_id" uuid, count bigint)` | `sql` / `stable` | `public.leads` | owner_id, status |
| 9 | `least_loaded_sales_user` | `p_user_ids uuid[]` | `uuid` | `sql` / `stable` | `public.leads`, `public.users` | leads.owner_id, leads.status, users.id, users.role, users.name, users.email |

### 3.2 B2 notification upserts

| # | Function | Arguments | Return | Language / volatility | Referenced tables |
|---|----------|-----------|--------|------------------------|-------------------|
| 10 | `upsert_lead_email_notification` | `p_lead_id uuid`, `p_admin_notified_at timestamptz NULL`, `p_has_admin_notified_at boolean false`, `p_client_acknowledged_at timestamptz NULL`, `p_has_client_acknowledged_at boolean false`, `p_last_attempt_at timestamptz NULL`, `p_has_last_attempt_at boolean false`, `p_attempt_count_delta int 0`, `p_last_error text NULL`, `p_has_last_error boolean false`, `p_last_error_details jsonb NULL`, `p_has_last_error_details boolean false` | `int` | `plpgsql` / `volatile` | `public.lead_email_notifications` |
| 11 | `upsert_lead_whatsapp_notification` | Same as #10 **plus** `p_last_fallback_url text NULL`, `p_has_last_fallback_url boolean false` | `int` | `plpgsql` / `volatile` | `public.lead_whatsapp_notifications` |

### 3.3 Per-function audit matrix

| # | Used by backend? | Backend file / call site | Requires existing tables? | Safe on empty DB? | SECURITY DEFINER | EXECUTE privileges | Data-modifying? | Idempotent? |
|---|------------------|--------------------------|---------------------------|--------------------|--------------------|--------------------|-----------------|-------------|
| 1 | ✅ | `createRepository.js` `executeAggregate` → `leadRoutes.js` `GET /analytics/summary` | `leads` | ✅ | No | revoked public; `service_role` only | read-only | ✅ |
| 2 | ✅ | `createRepository.js` → `revenueRoutes.js` `GET /overview` | `leads` | ✅ | No | revoked public; `service_role` only | read-only | ✅ |
| 3 | ✅ | `createRepository.js` → `revenueRoutes.js` `GET /overview` | `quotations` | ✅ | No | revoked public; `service_role` only | read-only | ✅ |
| 4 | ✅ | `createRepository.js` → `revenueRoutes.js` `GET /overview` | `projects` | ✅ | No | revoked public; `service_role` only | read-only | ✅ |
| 5 | ✅ | `createRepository.js` → `revenueRoutes.js` `GET /overview` | `invoices` | ✅ | No | revoked public; `service_role` only | read-only | ✅ |
| 6 | ✅ | `createRepository.js` → `projectRoutes.js` `GET /summary` | `projects` | ✅ | No | revoked public; `service_role` only | read-only | ✅ |
| 7 | ✅ | `createRepository.js` → `projectRoutes.js` `GET /margin/overview` | `invoices` | ✅ | No | revoked public; `service_role` only | read-only | ✅ |
| 8 | ⚠️ Defined, **not dispatched** | None — backend handles the leads `$match`+`$group` owner-count shape inline in `executeAggregate` (`ownerAssignment.js` path) | `leads` | ✅ | No | revoked public; `service_role` only | read-only | ✅ |
| 9 | ⚠️ Defined, **not dispatched** | None — `ownerAssignment.js` uses `User.find` + inline lead aggregate + JS sort | `leads`, `users` | ✅ | No | revoked public; `service_role` only | read-only | ✅ |
| 10 | ✅ | `createRepository.js` `buildUpsertRpcArgs`/`callUpsertRpc` via `Lead.js` `subTables.emailNotifications.upsertRpc` → workers `leadEmailNotifications.js`, retry `POST /:id/notifications/retry`, `save()` | `lead_email_notifications` (FK → `leads`) | ✅ | No | revoked public; `service_role` only | **writes** (atomic upsert) | ✅ |
| 11 | ✅ | same via `Lead.js` `subTables.whatsappNotifications.upsertRpc` → `leadWhatsAppNotifications.js`, retry `POST /:id/whatsapp/retry`, `save()` | `lead_whatsapp_notifications` (FK → `leads`) | ✅ | No | revoked public; `service_role` only | **writes** (atomic upsert) | ✅ |

**Dependency risk (all functions):** none. Every referenced table and column exists in the already-executed `SCHEMA.sql` (verified column-by-column in §5/§6). No function references any index by name. #10/#11 depend only on the two notification tables' PK (`lead_id`) — the PK and its supporting constraint already exist.

---

## 4. Dependency graph

```
public.users ─────────────────────────┐
public.leads ─────────────┬───────────┤
   ▲                      │           │
   │ (FK owner_id)        │           │
   │                      ▼           ▼
   │          ┌────────────────┐  ┌──────────┐
   │          │ owner_lead_load│  │ least_   │
   │          │ (#8, unused)   │  │ loaded_  │
   │          └────────────────┘  │ sales_   │
   │                              │ user(#9) │
   │                              └──────────┘
   ├─ lead_analytics_summary (#1)      ── reads public.leads
   ├─ revenue_lead_facet (#2)          ── reads public.leads
   ├─ revenue_quot_project_inv facets (#3-#5) ── reads quotations/projects/invoices
   ├─ project_summary (#6)             ── reads public.projects
   ├─ invoice_totals (#7)              ── reads public.invoices
   ├─ upsert_lead_email_notification (#10)      ── INSERT/UPDATE public.lead_email_notifications  (1:1 to leads)
   └─ upsert_lead_whatsapp_notification (#11)   ── INSERT/UPDATE public.lead_whatsapp_notifications (1:1 to leads)
```

No function creates or drops tables, views, indexes, constraints, or triggers. No cross-function calls. The only dependency on non-table objects is the existing PK conflict target on both notification tables.

---

## 5. B2 RPC verification — PASS

### 5.1 Both required functions present

| Requirement | Status |
|---|---|
| `upsert_lead_email_notification` present in FUNCTIONS.sql | ✅ |
| `upsert_lead_whatsapp_notification` present in FUNCTIONS.sql | ✅ |

### 5.2 Requirements checklist (both functions)

| B2 requirement | Verification |
|---|---|
| `INSERT ... ON CONFLICT (lead_id) DO UPDATE` | ✅ Single statement in each function; conflict target `(lead_id)` (the PK). |
| Atomic `attempt_count` increment | ✅ `attempt_count = lead_email_notifications.attempt_count + greatest(p_attempt_count_delta, 0)` (row-locked by `ON CONFLICT DO UPDATE`). |
| No lost increments under concurrency | ✅ The `DO UPDATE` row lock serializes concurrent writers on the same `lead_id`; N concurrent `+1` deltas yield exactly N. No SELECT → INSERT window, so SQLSTATE 23505 can never reach the app from these writes. |
| `p_has_*` flags prevent unintended column overwrites | ✅ Every non-count column is gated by `p_has_<column>`; flag false → preserve existing (`else <table>.<column>`), flag true → write (NULL clears). |
| `updated_at` refreshed | ✅ Always `now()` on both INSERT and `DO UPDATE` (also on the WhatsApp variant). |
| No SELECT → INSERT race | ✅ Zero `SELECT` in either body; single atomic statement. |
| `service_role` execution supported | ✅ `grant execute ... to service_role` on the exact 12-arg (email) and 14-arg (whatsapp) signatures. |
| Repository call signature matches | ✅ See §5.3. |
| `Lead.js` sub-table definitions match RPC names | ✅ See §5.4. |
| `leadRoutes` retry paths match RPC expectations | ✅ Retry endpoints call the workers (`sendLeadNotificationEmails` / `sendLeadWhatsAppNotifications`) whose only sub-table writes are dotted `$inc/$set` → `buildUpsertRpcArgs` → RPC; 23505 path eliminated. |

### 5.3 Repository ↔ RPC signature match (`buildUpsertRpcArgs`)

`buildUpsertRpcArgs(subConfig, fkColumn, fkValue, setColumns, incColumns)` builds:
`p_<fkColumn>` (→ `p_lead_id` ✅) + for every `rowMap` column except `incrementColumn`: `p_has_<column>` + `p_<column>`; plus `p_<incrementColumn>_delta` (→ `p_attempt_count_delta` ✅).

- Email subConfig rowMap → `p_admin_notified_at`, `p_client_acknowledged_at`, `p_last_attempt_at`, `p_last_error`, `p_last_error_details` (+ flags) — **all 12 names** exist in `upsert_lead_email_notification`'s parameter list. ✅
- WhatsApp subConfig rowMap → same 5 columns **plus** `p_last_fallback_url` (+ flag) — **all 14 names** exist in `upsert_lead_whatsapp_notification`. ✅
- PostgREST RPC passes named arguments, so parameter order is irrelevant; every generated key is an exact parameter name. ✅
- `incrementColumn` guard: `$set` of `attempt_count` → `DB_INCREMENT_UNSUPPORTED`; `$inc` of any other column → rejected; `save()` never writes `attempt_count`. ✅
- Return type `int` (1 on success); `callUpsertRpc` treats a resolved call as success. ✅

### 5.4 Lead.js sub-table config ↔ RPC

| Config | value | Match |
|---|---|---|
| `emailNotifications.upsertRpc` | `"upsert_lead_email_notification"` | ✅ exact function name |
| `emailNotifications.incrementColumn` | `"attempt_count"` | ✅ exact column + `p_attempt_count_delta` arg |
| `whatsappNotifications.upsertRpc` | `"upsert_lead_whatsapp_notification"` | ✅ exact function name |
| `whatsappNotifications.incrementColumn` | `"attempt_count"` | ✅ |

**Conclusion: no schema/signature incompatibility found. The B2 functions must NOT be rewritten.**

---

## 6. Analytics RPC verification — PASS

All analytics RPCs are dispatched from `createRepository.js` `executeAggregate` (single `callRpc` at line 567; the only other RPC call is `callUpsertRpc` at line 765). Verified dispatch table:

| Backend dispatch (createRepository.js) | RPC | Args (order from repo) | Function params (FUNCTIONS.sql) | Match |
|---|---|---|---|---|
| `leads` + `$facet` keys incl. `overview` | `lead_analytics_summary` | `p_months`, `p_source_limit`, `p_owner_limit` | `p_months int, p_source_limit int, p_owner_limit int` | ✅ |
| `leads` + `$facet` (no `overview`) | `revenue_lead_facet` | `p_months`, `p_source_limit` | `p_months int, p_source_limit int` | ✅ |
| `quotations` + `$facet` | `revenue_quotation_facet` | `p_months` | `p_months int` | ✅ |
| `projects` + `$facet` | `revenue_project_facet` | `p_months` | `p_months int` | ✅ |
| `invoices` + `$facet` | `revenue_invoice_facet` | `p_months` | `p_months int` | ✅ |
| `projects` + `$group` (no facet) | `project_summary` | `{}` | `()` | ✅ |
| `invoices` + `$group` (no facet) | `invoice_totals` | `{}` | `()` | ✅ |

**Return-shape verification (backend expects `[<jsonb>]` with Mongo `$facet`-shaped keys):**

| RPC | Shape produced | Route consumption | Match |
|---|---|---|---|
| `lead_analytics_summary` | `{ overview:[…], statusDistribution:[{_id,count}], sourceDistribution:[{_id,count}], ownerDistribution:[{_id,count}], monthlyTrend:[{_id, leads, quotedLeads, closedLeads, wonRevenue, pipelineRevenue}], recentLeads:[{_id, contactPerson, companyName, status, owner, utmSource, dealValue, createdAt}] }` | `leadRoutes.js`: `analytics?.overview?.[0]`, `.statusDistribution`, `.sourceDistribution`, `.ownerDistribution`, `.monthlyTrend`, `.recentLeads` | ✅ |
| `revenue_lead_facet` | `{ totals:[…], sourceDistribution:[{_id, leads, pipelineValue, weightedValue}], stageDistribution:[{_id,count,value}], monthly:[{_id, leadsCreated, pipelineValueAdded, weightedPipelineAdded, closedRevenueAdded}] }` | `revenueRoutes.js`: `leadAgg?.[0]?.totals?.[0]`, `.sourceDistribution`, `.stageDistribution`, `.monthly` | ✅ |
| `revenue_quotation_facet` | `{ totals:[…], monthly:[{_id, quotationCount, sentValue, approvedValue}] }` | `revenueRoutes.js` `.totals?.[0]`, `.monthly` | ✅ |
| `revenue_project_facet` | `{ totals:[…], monthly:[{_id, projectsBooked, bookedValue, completedValue}] }` | `revenueRoutes.js` `.totals?.[0]`, `.monthly` | ✅ |
| `revenue_invoice_facet` | `{ totals:[…], monthly:[{_id, invoiceCount, invoicedAmount, receivedAmount}] }` | `revenueRoutes.js` `.totals?.[0]`, `.monthly` | ✅ |
| `project_summary` | `[ { totalProjects, planningProjects, inProgressProjects, completedProjects, totalProjectValue, totalSpent, averageProgress } ]` | `projectRoutes.js` `/summary`: `summary?.[0]?.totalProjects` etc. | ✅ |
| `invoice_totals` | `[ { _id:null, invoicedAmount, receivedAmount } ]` | `projectRoutes.js` `/margin/overview`: `invoiceAgg[0].invoicedAmount` | ✅ |

**Referenced tables/columns vs live schema:** all columns referenced in §3.1 exist in `SCHEMA.sql` (verified one-by-one: `leads.status/deal_value/probability/created_at/utm_source/owner/id/contact_person/company_name`; `quotations.status/total_amount/created_at`; `projects.status/project_value/total_spent/progress_percentage/created_at`; `invoices.amount/paid_amount/created_at`; `users.id/role/name/email`). ✅

**Stale MongoDB assumptions:** none. `owner_lead_load` (#8) and `least_loaded_sales_user` (#9) are defined but **not dispatched** by the current backend (the owner-count shape is handled inline; `ownerAssignment.js` sorts the least-loaded candidate in JS). They are documented as available/optional — installing them is harmless, and they are not a blocker.

**Empty-database behavior:** every analytic aggregates an empty table to `count = 0`, coalesced `sum = 0`, `avg → 0`, and `jsonb_agg → '[]'` via `coalesce(..., '[]'::jsonb)`. `recentLeads` returns `[]`. Routes' own `|| {}` / `|| 0` fallbacks absorb these. ✅

---

## 7. Security review — PASS

| Check | Result |
|---|---|
| `SECURITY DEFINER` on any function | **None** — all 11 are `SECURITY INVOKER` (default). No privilege-escalation surface. |
| `SET search_path` | **Not used** — every table reference is schema-qualified (`public.<table>`), so there is no search-path hijack vector. |
| Dynamic SQL (`EXECUTE`/`format`/`query_to_xml` etc.) | **None** in FUNCTIONS.sql. The only non-DML statements are DDL-style `create or replace` / `revoke` / `grant`, which run at install time as `postgres`. |
| Unsafe `EXECUTE` of user input | **Not applicable** — no dynamic SQL exists. |
| Privilege escalation | **None** — invoker rights + service-role-only grants; RLS bypass only available to the backend's service key, matching the intended architecture. |
| Unintended public EXECUTE | **None** — explicit `revoke all on function ... from public` for all 11 (with exact signatures matching each definition), then `grant execute ... to service_role`. |
| `anon`/`authenticated` access | **None** — SCHEMA.sql already revoked all function EXECUTE from `anon`/`authenticated` (pre-existing); FUNCTIONS.sql additionally revokes PUBLIC on the 11 new functions. PostgREST never exposes these to the frontend. |
| `service_role` access | ✅ Explicitly granted on all 11 (exact signatures). |

> Note: `public.set_updated_at()` (from SCHEMA.sql) retains default PUBLIC EXECUTE — this is the already-documented P12 item handled by `AUDIT_FIXES.sql` §8, which is **out of scope for this step** and must not be run now.

---

## 8. Privilege review — PASS

- `revoke all on function` × 11 — all signatures match the corresponding function definitions exactly (verified parameter counts: 3-arg, 2-arg, 1-arg ×3, 0-arg ×2, `uuid[]` ×2, 12-arg, 14-arg). ✅
- `grant execute ... to service_role` × 11 — same exact signatures. ✅
- No grants to `anon`, `authenticated`, or `public` anywhere in the file. ✅
- RLS: functions are invoked by the service-role client (RLS-bypassing), so the `INSERT ... ON CONFLICT` writes succeed; an `anon` caller would be denied both by missing EXECUTE and, even if it somehow executed, by deny-by-default RLS. ✅

---

## 9. Idempotency review — PASS

- All 11 definitions use `CREATE OR REPLACE FUNCTION` — safe to re-run. ✅
- All `revoke`/`grant` statements are naturally idempotent. ✅
- No `CREATE TABLE`/`ALTER TABLE`/`CREATE INDEX`/`DROP`/`INSERT`/`UPDATE`/`DELETE`/`TRUNCATE` at install time (the upsert functions only write when invoked at runtime). ✅
- No `DO` blocks, no `format()`, no sequence `setval`, no ownership changes. ✅

---

## 10. Empty-database safety — PASS

- All 9 analytics/load functions are pure `SELECT`/aggregation — safe on all-empty tables (see §6 empty behavior). ✅
- The 2 upsert functions only ever touch the two notification tables via `INSERT ... ON CONFLICT (lead_id)`, and their only entry points (`sendLeadNotificationEmails`, `sendLeadWhatsAppNotifications`, `save()`, retry endpoints) all first resolve an existing lead (`Lead.findById`/`Lead.exists`) before writing. With zero rows nothing is invoked. ✅
- No function performs installation-time data access or mutation. ✅

---

## 11. Expected post-execution object count

| Object | Before | After FUNCTIONS.sql | Delta |
|---|---|---|---|
| Functions in `public` (`prokind='f'`) | 1 (`set_updated_at`) | **12** | +11 |
| Tables | 15 | 15 | 0 |
| Views | 1 | 1 | 0 |
| Indexes | 47 | 47 | 0 |
| Unique indexes | 17 | 17 | 0 |
| Foreign keys | 14 | 14 | 0 |
| Triggers | 10 | 10 | 0 |
| RLS-enabled tables | 15 | 15 | 0 |
| RLS policies | 0 | 0 | 0 |
| Application rows | 0 | 0 (functions only) | 0 |

No tables, views, indexes, constraints, triggers, or data are created/modified by this script.

---

## 12. Blockers

**None.** Full inventory of stops checked:
- Missing table → none.
- Missing column → none (all 34 referenced columns verified in SCHEMA.sql).
- Function signature mismatch → none (B2 12/14-arg match repository generation; 7 analytics match dispatch).
- Invalid dependency → none (no index-, function-, or trigger-level dependencies; only PK conflict targets).
- Unsafe privilege → none (service_role-only; public revoked).
- Unexpected destructive statement → none (no DDL on tables, no DML at install).
- SECURITY DEFINER concern → none (zero SECURITY DEFINER functions).
- Non-idempotent operation → none (all `create or replace`, grants idempotent).

---

## 13. Exact SQL execution instructions

Run in **Supabase Dashboard → SQL Editor → Primary Database → Role: `postgres`**:

1. Open the SQL Editor.
2. Copy the **complete** content of `supabase/FUNCTIONS.sql` (all 11 functions + all revoke/grant statements).
3. Paste it as **one script** into the editor — do not split, reorder, or modify any statement.
4. Click **Run**.
5. **Do not** run `AUDIT_FIXES.sql` afterward yet.
6. Capture the execution result (expected: "Success. No rows returned" / success banner with no errors).
7. Then run the verification queries in §14.

If the script reports any error, do **not** retry blindly — capture the error text and report it.

---

## 14. Exact post-execution verification queries (read-only)

Run these after the script succeeds. All are read-only.

```sql
-- 1. Function count (expect 12)
select count(*) as public_function_count
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f';

-- 2. Exact function names (expect the 12 listed)
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f'
order by p.proname;

-- 3. Arguments + return types + language + volatility (all 11 new functions)
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       pg_get_function_result(p.oid) as returns,
       l.lanname as language,
       case p.provolatile when 'v' then 'volatile' when 's' then 'stable' when 'i' then 'immutable' end as volatility,
       p.prosecdef as is_security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_language l on l.oid = p.prolang
where n.nspname = 'public'
  and p.proname in (
    'lead_analytics_summary','revenue_lead_facet','revenue_quotation_facet',
    'revenue_project_facet','revenue_invoice_facet','project_summary',
    'invoice_totals','owner_lead_load','least_loaded_sales_user',
    'upsert_lead_email_notification','upsert_lead_whatsapp_notification'
  )
order by p.proname;

-- 4. SECURITY DEFINER status (expect all false / 0)
select count(*) as security_definer_count
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f' and p.prosecdef;

-- 5. EXECUTE privileges — acl for each new function (expect revoke public, grant service_role)
select p.proname, pg_get_function_identity_arguments(p.oid) as args,
       p.proacl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'lead_analytics_summary','revenue_lead_facet','revenue_quotation_facet',
    'revenue_project_facet','revenue_invoice_facet','project_summary',
    'invoice_totals','owner_lead_load','least_loaded_sales_user',
    'upsert_lead_email_notification','upsert_lead_whatsapp_notification'
  )
order by p.proname;

-- 6. B2 email UPSERT exists with exact signature (expect 1 row)
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'upsert_lead_email_notification';

-- 7. B2 WhatsApp UPSERT exists with exact signature (expect 1 row)
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'upsert_lead_whatsapp_notification';

-- 8. Analytics RPCs all present (expect 7 rows)
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'lead_analytics_summary','revenue_lead_facet','revenue_quotation_facet',
    'revenue_project_facet','revenue_invoice_facet','project_summary','invoice_totals'
  )
order by p.proname;

-- 9. No unexpected functions (expect exactly the 12 names; report any extras)
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f'
  and p.proname not in (
    'set_updated_at','lead_analytics_summary','revenue_lead_facet',
    'revenue_quotation_facet','revenue_project_facet','revenue_invoice_facet',
    'project_summary','invoice_totals','owner_lead_load',
    'least_loaded_sales_user','upsert_lead_email_notification',
    'upsert_lead_whatsapp_notification'
  );

-- 10. No table/data modifications (expect the same 15 tables; row counts stay 0)
select count(*) as table_count
from pg_tables
where schemaname = 'public';

select count(*) as leads_rows from public.leads;
select count(*) as email_notif_rows from public.lead_email_notifications;
select count(*) as whatsapp_notif_rows from public.lead_whatsapp_notifications;

-- 11. Triggers unchanged (expect 10)
select count(*) as trigger_count
from pg_trigger
where tgisinternal = false
  and tgrelid in (select oid from pg_class where relnamespace = 'public'::regnamespace);
```

> **Do not insert production/test notification records.** Backend-to-function compatibility is proven statically in §5–§6 and by re-running the existing B2 suite (`aken-backend` → `npm test`, 76/76) after the backend is deployed; no test rows are required in the database.

---

## 15. Final verdict

```
FUNCTIONS PRE-EXECUTION AUDIT = PASS
```

Next Dashboard action: **Supabase Dashboard → SQL Editor → Primary Database (role `postgres`) → paste the complete `supabase/FUNCTIONS.sql` → Run as one script (unmodified) → capture result → run the §14 read-only verification queries → STOP (do not run AUDIT_FIXES.sql yet).**
