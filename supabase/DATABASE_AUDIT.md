# A K ENGINEERING — PostgreSQL Database Audit

**Date:** 2026-08-06
**Scope:** `supabase/SCHEMA.sql`, `supabase/FUNCTIONS.sql`, repository layer (`aken-backend/models`), route query inventory, RLS, extensions, storage.
**Method:** Static review of DDL + cross-referencing every read/write path in the backend (routes, repositories, notification workers, owner-assignment, analytics RPC dispatch).
**Status:** Audit only. No schema was modified. Fixes are provided in `supabase/AUDIT_FIXES.sql` and must be applied only after review + data-prep checks.

---

## 1. Database Architecture Report

### 1.1 Inventory

| # | Object | Type | Purpose |
|---|--------|------|---------|
| 1 | `public.users` | table | Custom-auth admin/sales accounts (bcrypt, JWT cookie). Supabase Auth intentionally not used. |
| 2 | `public.leads` | table | Website enquiries + CRM pipeline (status/owner/deal/probability/attribution). |
| 3 | `public.lead_email_notifications` | table (1:1) | Email delivery state (was embedded `emailNotifications`). |
| 4 | `public.lead_whatsapp_notifications` | table (1:1) | WhatsApp delivery state (was embedded `whatsappNotifications`). |
| 5 | `public.lead_notes` | table (1:N) | Lead notes (was embedded `notes[]`). |
| 6 | `public.activity_logs` | table | Audit trail (lead/action/performed_by). |
| 7 | `public.quotations` | table | Quotation headers. |
| 8 | `public.quotation_items` | table (1:N) | Quotation line items (was embedded `items[]`). |
| 9 | `public.projects` | table | Execution projects with cost breakdown + spending. |
| 10 | `public.boq_entries` | table (1:N) | Bill of quantities per project. |
| 11 | `public.materials` | table (1:N) | Material tracking per project. |
| 12 | `public.labour_entries` | table (1:N) | Labour tracking per project. |
| 13 | `public.invoices` | table (1:N) | Invoices per project. |
| 14 | `public.forecasts` | table | Monthly revenue forecast (unique month). |
| 15 | `public.tenders` | table | Tenders pipeline. |
| 16 | `public.v_lead_overview` | view | Lead + notification status join for dashboards. |
| 17 | `public.set_updated_at()` | function/trigger | Maintains `updated_at` on 10 tables. |
| 18–26 | `lead_analytics_summary`, `revenue_lead_facet`, `revenue_quotation_facet`, `revenue_project_facet`, `revenue_invoice_facet`, `project_summary`, `invoice_totals`, `owner_lead_load`, `least_loaded_sales_user` | functions | SQL replacements for the 5 Mongo aggregation pipeline shapes. |

**Extensions:** `pgcrypto` (only). **Storage buckets:** none created — matches migration decision (no file persistence; quotation PDFs are generated in-memory). **RLS:** enabled on all 15 tables with zero policies → deny-by-default; backend uses the service-role key (bypasses RLS). `anon`/`authenticated` get nothing.

**Verified runtime facts:** (a) `activity_logs` has **no active writer** — the `ActivityLog` repository file exists but is never imported by any route/controller/utility, so the table is reserved for future audit logging; its FK problems (P1/P3) are latent guardrails, not active data-loss paths. (b) The frontend **never calls PostgREST directly** — `aken-frontend/src/app/api/public/leads/route.ts` and the admin proxy route through the Express backend, and the anon key is unused for data access. Deny-by-default RLS is therefore airtight in practice.

### 1.2 Relationship map

```
users 1───N leads            (leads.owner_id, ON DELETE SET NULL)
users 1───N activity_logs    (activity_logs.performed_by, ON DELETE CASCADE ⚠)
leads 1───1 lead_email_notifications    (PK = lead_id, CASCADE)
leads 1───1 lead_whatsapp_notifications (PK = lead_id, CASCADE)
leads 1───N lead_notes       (CASCADE)
leads 1───N activity_logs    (CASCADE ⚠)
leads 1───N quotations       (quotations.lead_id, SET NULL)
quotations 1───N quotation_items (CASCADE)
quotations 1───1 projects     (projects.quotation_id, SET NULL)
leads 1───1 projects         (projects.lead_id, SET NULL)
projects 1───N boq_entries   (CASCADE)
projects 1───N materials     (CASCADE)
projects 1───N labour_entries (CASCADE)
projects 1───N invoices      (CASCADE)
```

### 1.3 Conventions in use (verified consistent)

- UUID v4 PKs via `gen_random_uuid()` (core since PG13; `pgcrypto` is a harmless belt-and-braces).
- `snake_case` columns; repository layer maps to camelCase + `_id`; HTTP contract unchanged.
- `NUMERIC(14,2)` money, `NUMERIC(14,4)` quantities, `NUMERIC(10,2)` labour counts, `NUMERIC(5,2)` percents.
- Mongoose enum sets reproduced as CHECK constraints; non-negative CHECKs on all money/qty.
- Every FK column has a supporting index (verified one-by-one) — no FK without index.
- `updated_at` maintained by trigger on: users, leads, quotations, projects, boq_entries, materials, labour_entries, invoices, forecasts, tenders. **Missing on the two notification tables (they have the column but no trigger).** ⚠
- Analytics functions: `STABLE LANGUAGE sql`, schema-qualified tables, EXECUTE revoked from `anon`/`authenticated` and granted to `service_role` only. No `SECURITY DEFINER` (no privilege escalation surface). ✓
- RLS deny-by-default is the correct posture for the service-role architecture. ✓

---

## 2. Problems, Severity, and Fixes

Legend: **CRITICAL** → data loss/security breach · **HIGH** → financial/audit integrity · **MEDIUM** → correctness/concurrency/perf at scale · **LOW** → hygiene.

| ID | Severity | Area | Problem | Fix (ref `AUDIT_FIXES.sql` + app-change notes) |
|----|----------|------|---------|--------------------------------------|
| P1 | **HIGH** | FKs / audit | `activity_logs.performed_by` has `ON DELETE CASCADE` — deleting a user destroys the entire audit trail of who did what. | FK → `ON DELETE SET NULL`, column nullable. §5 |
| P2 | **HIGH** | Uniqueness / finance | `quotations.quotation_number` and `invoices.invoice_number` are nullable, non-unique, and validation stores `''` for empty — duplicate business document numbers are possible. | Normalize `''`→NULL, partial unique indexes (`btrim <> ''`). §3 |
| P3 | **HIGH** | FKs / audit | `activity_logs.lead_id` `ON DELETE CASCADE` wipes the audit trail when a lead is deleted. No delete route exists today, but the guardrail is wrong. | Change to `ON DELETE SET NULL` (lead_id nullable). §5 |
| P4 | **MEDIUM** | Triggers | `lead_email_notifications.updated_at` and `lead_whatsapp_notifications.updated_at` are never refreshed — the `set_updated_at` trigger loop omits both tables, and the repository's sub-table update path doesn't set `updated_at` either. Column silently goes stale. | Add both triggers (§6). |
| P5 | **MEDIUM** | Integrity | `quotations.total_amount = subtotal + gst` is only enforced in route-layer validation; direct SQL/other writers can store inconsistent totals. | Data-normalize first, then CHECK constraint (§7a). |
| P6 | **MEDIUM** | Integrity | `invoices.paid_amount <= amount` not enforced; over-payment can be recorded. | Data-verify, then CHECK (§7b). |
| P7 | **MEDIUM** | Normalization | `leads.owner` (text) duplicates `users.name` next to `owner_id` FK. `resolveLeadOwnerAssignment` writes `user.name` at assignment time; a later user rename leaves stale owner names in every lead (and projects.project_owner has the same pattern). No DB can keep them in sync. | Accept & document, or backfill from FK on rename. Consider views instead of the column for display. §9 (documentation) |
| P8 | **MEDIUM** | Data integrity | `projects.lead_id` has no uniqueness guard; `POST /from-lead/:leadId` checks `findOne` then `create` — two concurrent requests produce duplicate projects for one lead (the route itself declares 1-per-lead semantics). | Partial unique index `WHERE lead_id IS NOT NULL`. §4 |
| P9 | **MEDIUM** | Concurrency / race | Notification sub-table writes are fetch-then-insert with no transaction: two concurrent notification runs for the same lead can both see "no row" and both INSERT, tripping the PK on `lead_id`. | Repository-level upsert (`INSERT … ON CONFLICT (lead_id) DO UPDATE`) in `applySubTableUpdates`/`persistChildren`. §10 (app) |
| P10 | **MEDIUM** | Indexes (perf) | **Missing indexes** for real query shapes: exports filter `leads (status)`, `leads (owner)`; revenue monthly facets + exports sort `quotations/projects/invoices` by `created_at desc`; project list filter+sort `(status, site_status, created_at desc)`. | §2 index additions |
| P11 | **MEDIUM** | Indexes (perf) | **Redundant index:** `quotations_lead_idx (lead_id)` is a prefix of `quotations_lead_created_idx (lead_id, created_at desc)` — pure write overhead. | Drop `quotations_lead_idx`. §1 |
| P12 | **LOW** | Security hardening | `anon`/`authenticated` are revoked, but the `public` role still holds schema-USAGE + default EXECUTE on functions such as `set_updated_at()` (Postgres default is EXECUTE to PUBLIC). No policy grants exist so exposure is theoretical, but defense-in-depth is cheap. | `REVOKE … FROM public` + `ALTER DEFAULT PRIVILEGES` (§8). |
| P13 | **LOW** | Dead indexes | Unused index candidates (no query filters on them): `invoices_due_date_idx`, `tenders_submission_date_idx`, `tenders_tender_name_idx`, `tenders_client_idx`, `activity_logs_performed_by_idx`, `lead_email_notifications_admin_notified_idx`, `lead_whatsapp_notifications_admin_notified_idx`. Keep only if roadmap queries exist. | §1 (review/drop) |
| P14 | **LOW** | Constraint | `leads.email` lowercase is enforced only in JS middleware, not by the DB (`users.email` has a CHECK; `leads.email` does not). A future writer bypassing validation stores mixed-case duplicates for the same person. | Add lowercase CHECK (after normalizing data). §7c |
| P15 | **LOW** | API/UX bug | `POST /api/leads/:id/notes` doesn't cap note length; DB CHECK (≤2000) then throws → 500 instead of 400. Also `quotation_items.position` is written by `persistChildren` but omitted from the read-path `joins` rowMap — positions never reach the API. | Route length validation; add `position` to joins rowMap. §10 (app) |
| P16 | **LOW** | Normalization | `lead_notes.added_by` stores either `"system"` or a user UUID as text — no FK, no type distinction. Acceptable for audit text, but UUID-shaped values are untyped. | Document; or add nullable `added_by_user_id uuid REFERENCES users ON DELETE SET NULL`. §9 |
| P17 | **LOW** | Normalization | `forecasts.month` is `text` with a regex CHECK. Works because `YYYY-MM` sorts lexicographically, but range/date math requires casts. | Optional: stored-generated `month_date date`. §9 |
| P18 | **LOW** | Scaling (route) | `GET /api/leads` and `GET /api/quotations` load the entire table with per-row joins (no pagination) — mirrors legacy Mongo behavior, but becomes the first thing to break at volume. | Route-level pagination (out of schema scope). §10 (app) |
| P19 | **LOW** | Writer fan-out | `lead_notes` are inserted one `INSERT … .single()` per note (N+1) from `persistChildren`. | Batch insert via one `.insert([…])` call. §10 (app) |
| P20 | **LOW** | Constraint | `leads.phone` charset is validated in JS only; DB CHECK only bounds length 7–20. | Optional format CHECK (verify data first). §7d |
| P21 | **LOW** | Functions/perf | Analytics functions scan the underlying tables 5–6× per call (one subquery per facet). Correct but wasteful; fine <100k rows, cheap to consolidate. | Single-pass CTE variants (§11 performance). |
| P22 | **INFO** | Storage | No buckets, no storage policies — matches migration report §5. Recommended: verify via `storage.buckets` that dashboard default buckets (e.g. `public`) are absent or locked down. | Run introspection SQL (§11). |

### 2.1 Things verified as correct (no action)

- All 15 FKs reference indexed columns; `ON DELETE CASCADE` on child aggregates (notes, items, boq, materials, labour, invoices, notifications) is correct.
- CHECK enum values match Mongoose enums and route validation literals (statuses, site status, roles).
- Money/qty non-negative CHECKs on every monetary/numeric field.
- `users.email` unique + lowercase; `forecasts.month` unique.
- UUID generation on every PK; `gen_random_uuid()` available on Supabase (PG15).
- RLS enabled on all 15 tables, zero policies, service-role-only grants; EXECUTE revoked from `anon`/`authenticated` on all 9 analytics functions.
- Project `pre(save)` guards (progress clamp, `total_spent` recompute, Completed normalization) reproduced in the repository `beforeSave` — correct.
- No `SECURITY DEFINER` anywhere; functions are schema-qualified; no dynamic SQL from user input.
- Repository uses explicit PostgREST operators (never `.match()`), preserving null/range semantics.

---

## 3. Performance Recommendations

1. **Apply index changes (P10/P11/P13)** — the highest-leverage, lowest-risk work. Order: drop redundant `quotations_lead_idx`, add the six missing indexes in §2 of the fixes file, then review the seven dead indexes. Re-verify with `EXPLAIN (ANALYZE, BUFFERS)` on: export queries, `GET /api/projects`, revenue monthly facets, `least_loaded_sales_user`.
2. **Consolidate analytics scans (P21).** `lead_analytics_summary` and `revenue_lead_facet` currently aggregate the whole `leads` table once per facet. Rewrite as a single scan with `FILTER (WHERE …)` into a CTE, then build the jsonb from the CTE. Same pattern for the quotation/project/invoice facets. Expect 2–5× fewer logical reads on analytics endpoints.
3. **Fix notification writes (P9 + P19).** Use `INSERT … ON CONFLICT (lead_id) DO UPDATE` for the 1:1 notification rows, and batch the `lead_notes` inserts. Removes the race and N+1 in one pass.
4. **Pagination (P18).** `GET /api/leads` and `GET /api/quotations` should adopt the `page/limit` pattern already used by projects, with `(created_at desc)` indexes added in this audit.
5. **Autovacuum/monitoring.** Enable `pg_stat_statements` (Supabase dashboard) and baseline: `seq_scan`/`idx_scan` per table, top-10 statements by total time, dead-tuple bloat on high-write tables (`leads`, `activity_logs`). Standard Supabase autovacuum defaults are fine; tune `autovacuum_vacuum_scale_factor` per-table only if bloat appears.
6. **Optional, low priority:** `forecasts.month` → generated `date` column (P17); GIN on `last_error_details` only if you ever query into the jsonb (not needed today); partial index for AR-aging `invoices (due_date) WHERE status IN ('Pending','Partially Paid')` when invoicing reports are built.
7. **RLS/storage hygiene (P12/P22).** Harden `public` schema default privileges, and confirm via `storage.buckets` that no public bucket/policy exists.

---

## 4. SQL Fixes

All fixes are provided separately, idempotent and commented, in **`supabase/AUDIT_FIXES.sql`**, grouped by problem ID. Data-prep steps (dedupe/backfill) are embedded as comments **before** each constraint — run those first or the ALTER will fail loudly on existing rows, which is the correct failure mode.

**Order of application (recommended):**
1. §1 drop redundant/unused indexes (P11/P13)
2. §2 add missing indexes (P10)
3. §3 unique business-document numbers (P2)
4. §4 one-project-per-lead (P8)
5. §5 FK behavior for audit trail (P1/P3)
6. §6 notification-table triggers (P4)
7. §7 data-prep + CHECK constraints (P5/P6/P14/P20)
8. §8 security hardening (P12)
9. §9–§11 documentation + app-layer changes (P7/P15–P19; repository upsert/batching, route pagination, analytics CTE, storage introspection)

App-layer changes (repository upsert, note batching, position in joins, route length check, pagination) are described in comments but intentionally **not** applied here — the audit is SQL-schema scoped and the user requested no modifications until the audit is complete.
