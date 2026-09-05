# SUPABASE NEW PROJECT BASELINE

**Date:** 2026-08-12
**Type:** Read-only baseline audit. No schema applied, no data written, no SQL executed.
**Verification method:** Static review of `supabase/SCHEMA.sql`, `supabase/FUNCTIONS.sql`, `supabase/DATABASE_AUDIT.md`, `supabase/AUDIT_FIXES.sql`, `SQL_VALIDATION_PLAN.md`, all 11 backend repositories (`aken-backend/models/*`), repository factory (`createRepository.js`), notification workers, owner assignment, connection layer — plus live read-only PostgREST probes (HTTP GET only) against the project.

---

## 1. Project Identity

| Item | Value |
|---|---|
| Project reference | `garrlnwamcwnypjrsfji` |
| Project URL | `https://garrlnwamcwnypjrsfji.supabase.co` |
| Source of reference | `aken-backend/.env` (`SUPABASE_URL` + `DATABASE_URL` host), `aken-backend/.env.example` docs |
| In git history | Never committed (local `.env` only) |
| Access model | Backend connects with **service-role key** (bypasses RLS); custom JWT-cookie auth; Supabase Auth intentionally not used |
| Migrations / Backups | None recorded |

## 2. Current Database State

**Confirmed empty.** Live read-only probes (2026-08-12T13:28 UTC):

- PostgREST root (`GET /rest/v1/`): **HTTP 200 — project reachable**.
- All 15 application tables probed (`GET /rest/v1/<table>?select=id&limit=1`): every table returned **404 `PGRST205` (not in schema cache)** — i.e., absent.
- No migrations, no backups, no schema application ever recorded for this project.

This matches the prior findings in `PRODUCTION_DATA_SOURCE_DISCOVERY.md` and `RENDER_SUPABASE_PRODUCTION_CHECK.md`.

## 3. Existing Public Tables

**None.** Probed table list (all 404 / absent):

`leads`, `projects`, `quotations`, `invoices`, `users`, `materials`, `labour_entries`, `forecasts`, `activity_logs`, `boq_entries`, `tenders`, `lead_email_notifications`, `lead_whatsapp_notifications`, `lead_notes`, `quotation_items`

-> **No application tables exist. No unexpected production objects found.**

## 4. Existing Functions

**None** (no user functions in the public schema — the project has never had `SCHEMA.sql`/`FUNCTIONS.sql` applied). The PostgREST root exposes only the standard `/` and `/rpc/...` plumbing.

## 5. Existing Indexes

**None.** No tables → no indexes.

## 6. Existing Triggers

**None.** No tables → no triggers.

## 7. Existing Constraints

**None.** No tables → no constraints.

## 8. Existing RLS

Not measurable at table level (no tables). Per project state, nothing to report; RLS will be enabled for all 15 tables with **zero policies (deny-by-default)** when `SCHEMA.sql` is applied.

## 9. Existing Grants

No application objects exist. The only relevant note for later: default Supabase privileges apply (public schema USAGE to `public`, default EXECUTE on functions). The pending `AUDIT_FIXES.sql` §8 hardens this (P12) — to be applied only in a future approved write phase.

## 10. Expected Schema from SCHEMA.sql

**Extension:** `pgcrypto` (only).

**Tables (15) and their source models:**

| Table | Maps from (Mongo model) | FK dependencies |
|---|---|---|
| `users` | User.js | — |
| `leads` | Lead.js | `owner_id → users(id) ON DELETE SET NULL` |
| `lead_email_notifications` | Lead.embedded `emailNotifications` | `lead_id → leads(id) ON DELETE CASCADE` (1:1, PK=lead_id) |
| `lead_whatsapp_notifications` | Lead.embedded `whatsappNotifications` | `lead_id → leads(id) ON DELETE CASCADE` (1:1, PK=lead_id) |
| `lead_notes` | Lead.embedded `notes[]` | `lead_id → leads(id) ON DELETE CASCADE` |
| `activity_logs` | ActivityLog.js | `lead_id → leads(id) CASCADE`, `performed_by → users(id) CASCADE` ⚠ (see blockers) |
| `quotations` | Quotation.js | `lead_id → leads(id) ON DELETE SET NULL` |
| `quotation_items` | Quotation.embedded `items[]` | `quotation_id → quotations(id) ON DELETE CASCADE` |
| `projects` | Project.js | `quotation_id → quotations(id) SET NULL`, `lead_id → leads(id) SET NULL` |
| `boq_entries` | BOQ.js | `project_id → projects(id) ON DELETE CASCADE` |
| `materials` | Material.js | `project_id → projects(id) ON DELETE CASCADE` |
| `labour_entries` | LabourEntry.js | `project_id → projects(id) ON DELETE CASCADE` |
| `invoices` | Invoice.js | `project_id → projects(id) ON DELETE CASCADE` |
| `forecasts` | Forecast.js | — |
| `tenders` | Tender.js | — |

**Enum/CHECK constraints** (reproduce Mongoose enums + numeric bounds): roles `admin|sales`; lead statuses `New|Contacted|Quoted|Closed`; quotation statuses `Draft|Sent|Approved|Rejected`; project statuses `Planning|In Progress|Completed`; site statuses `Not Started|Foundation|Structure|Cladding|Finishing|Completed`; invoice statuses `Pending|Partially Paid|Paid`; tender statuses `Preparing|Submitted|Under Review|Won|Lost`; non-negative money/quantity/percent bounds; `users.email` lowercase + unique; `leads.phone` 7–20 length; `forecasts.month` `^\d{4}-\d{2}$` unique.

**Indexes:** unique (users_email, forecasts_month) + all Mongo indexes reproduced (lead owner/status, created_at desc, UTM composite; quotation lead/status/number/valid_till; project quotation/lead/status+site; child-table project_id composites; tender/client/status/submission).

**Triggers:** `set_updated_at()` on 10 tables (users, leads, quotations, projects, boq_entries, materials, labour_entries, invoices, forecasts, tenders).

**Views:** `v_lead_overview` (lead + notification status join; convenience, not backend-required).

**RLS:** enabled on all 15 tables; zero policies → default deny. `anon`/`authenticated` revoked; `service_role` granted all.

**Seed:** none — first admin via bootstrap endpoint (`BOOTSTRAP_*` env).

## 11. Expected Functions from FUNCTIONS.sql

| Function | Purpose | Used by code? |
|---|---|---|
| `lead_analytics_summary(int,int,int)` | `$facet` lead analytics → jsonb | ✓ `Lead.aggregate` dispatch |
| `revenue_lead_facet(int,int)` | Revenue overview lead facet | ✓ |
| `revenue_quotation_facet(int)` | Revenue overview quotation facet | ✓ |
| `revenue_project_facet(int)` | Revenue overview project facet | ✓ |
| `revenue_invoice_facet(int)` | Revenue overview invoice facet | ✓ |
| `project_summary()` | Project summary group | ✓ |
| `invoice_totals()` | Invoice totals (margin overview) | ✓ |
| `owner_lead_load(uuid[])` | Owner load counts | Defined; current `ownerAssignment.js` uses the in-repository aggregate fallback — compatible, no blocker |
| `least_loaded_sales_user(uuid[])` | Least-loaded sales user | Defined; not invoked by current code — compatible, no blocker |
| `upsert_lead_email_notification(...)` | Atomic 1:1 upsert (`B2`) | ✓ `Lead.js subTables.upsertRpc` |
| `upsert_lead_whatsapp_notification(...)` | Atomic 1:1 upsert (`B2`) | ✓ `Lead.js subTables.upsertRpc` |

All `EXECUTE` revoked from `public`; granted to `service_role` only. No `SECURITY DEFINER`.

## 12. Code / Schema Compatibility

Verified per entity — **no blocking mismatch.**

| Code repository | Schema table(s) | Field map | RPC/join usage | Status |
|---|---|---|---|---|
| `Lead.js` | `leads` + `lead_notes` + both notification tables | Full match | joins rebuild embedded docs; RPC upserts | ✓ |
| `User.js` | `users` | Full match; `password_hash` hidden by default | — | ✓ |
| `Project.js` | `projects` | Full match; `beforeSave` reproduces Mongo `pre("save")` guards | relations leadId/quotationId | ✓ |
| `Quotation.js` | `quotations` + `quotation_items` | Full match; `beforeSave` enforces `total = subtotal + gst` (F1) | items 1:N join, `position` mapped | ✓ |
| `Invoice.js` | `invoices` | Full match | relation projectId | ✓ |
| `Material.js` | `materials` | Full match | relation projectId | ✓ |
| `LabourEntry.js` | `labour_entries` | Full match | relation projectId | ✓ |
| `Forecast.js` | `forecasts` | Full match | — | ✓ |
| `Tender.js` | `tenders` | Full match | — | ✓ |
| `BOQ.js` | `boq_entries` | Full match | — | ✓ |
| `ActivityLog.js` | `activity_logs` | Full match | — | ✓ (no active writer — dormant/audit-reserved) |
| Notification workers | both notification tables | Match; use `$inc attemptCount` + RPC upsert (B2) | ✓ |
| `ownerAssignment.js` | `leads`/`users` | Match; aggregate fallback path | ✓ |
| `createRepository.js` | all tables | Generic PostgREST layer (`.eq/.in/.is/...`, never `.match()`); UUID + camelCase mapping | RPC dispatch for 7 analytics functions | ✓ |

**Expected files present:** `supabase/SCHEMA.sql` ✓, `supabase/FUNCTIONS.sql` ✓, `supabase/AUDIT_FIXES.sql` ✓, `supabase/DATABASE_AUDIT.md` ✓, `SQL_VALIDATION_PLAN.md` ✓. All present in the working tree.

**Functions the code will invoke after schema application:** all present in `FUNCTIONS.sql` (analytics dispatch + the two B2 upsert RPCs). The repository layer already expects and calls exactly these names.

## 13. Blockers

**No blockers.** Notes for the future write phase (not blocking; already planned/documented):

1. **Known audit findings (P1–P22)** are captured in `supabase/DATABASE_AUDIT.md` with idempotent fixes in `supabase/AUDIT_FIXES.sql`. The code-side counterparts (F1 quotation total integrity, F2 23505→409, F3 alreadyExists, B2 notification upsert) are **already implemented** in the current codebase.
2. **`activity_logs` FKs use `ON DELETE CASCADE`** (P1/P3, HIGH) — latent guardrail only; the table has no active writer. Fixed by `AUDIT_FIXES.sql` §5 in the same write phase.
3. **`AUDIT_FIXES.sql` §7 constraints are ONE-SHOT** and conditioned on Phase 3 data-verification — none of that applies to an empty database (0 rows to verify), but the execution plan ordering in `SQL_VALIDATION_PLAN.md` should still be respected.
4. **Unused-but-defined functions** (`owner_lead_load`, `least_loaded_sales_user`) are not a conflict; current code uses the repository aggregate fallback for owner balancing.
5. **Storage buckets:** none expected (quotation PDFs are generated in-memory, never persisted) — verify `storage.buckets` emptiness in the write phase per audit P22.

---

## FINAL GATE

- [x] Database confirmed empty of application tables — **verified live (15/15 absent, PGRST205)**
- [x] `SCHEMA.sql` present
- [x] `FUNCTIONS.sql` present
- [x] Code/schema mapping — no blocking mismatch (11/11 repositories + notification tables + RPC dispatch verified)
- [x] No unexpected production objects exist

**BASELINE PASS**

The project `garrlnwamcwnypjrsfji` is a clean, confirmed-empty database. No SQL was executed, no objects were modified, and no secrets were exposed during this audit.
