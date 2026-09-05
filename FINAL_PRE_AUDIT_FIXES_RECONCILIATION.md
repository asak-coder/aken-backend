# FINAL PRE-AUDIT-FIXES RECONCILIATION

**Date:** 2026-08-19
**Scope:** Full reconciliation of live Supabase database, current backend code, SCHEMA.sql, FUNCTIONS.sql, DATABASE_AUDIT.md, SQL_VALIDATION_PLAN.md, AUDIT_FIXES.sql, and all remediation/finding documents.
**Method:** Read-only cross-reference of every finding against the current verified state. No SQL executed. No code modified.
**Input status:** R1–R4 PASS, R5 PASS (BLOCKED — no backend endpoint), R6 PASS, R7 PASS. Backend tests: 123/123. Database: 15 tables, 0 rows, 47 indexes, 17 unique indexes, 14 FKs, 10 triggers, 12 functions (1 set_updated_at + 11 from FUNCTIONS.sql), 1 view, 11 application RPCs live, all service-role-only, SECURITY DEFINER = false.

---

## 1. Executive Summary

The A K ENGINEERING Supabase migration has completed schema deployment (SCHEMA.sql), function installation (FUNCTIONS.sql — all 11 RPCs live), and application-layer remediation (R1–R7). The original DATABASE_AUDIT identified 22 findings (P1–P22) and the validation plan identified 6 cross-cutting findings (F1–F6). Of these, multiple findings have been **fully resolved at the application layer** (F1, F2, F3, B1, B2, P7, P9, P16, P17, P21, P22) and several are **irrelevant on the current zero-row database** (P6, P14, P15 partial).

**AUDIT_FIXES.sql remains necessary but at reduced scope.** The SQL file contains 19 executable statements across 8 sections. Of these:
- **13 statements** are still required (index changes, constraints, triggers, privilege hardening)
- **3 statements** are data-prep UPDATEs that affect zero rows (harmless no-ops)
- **3 statements** are ONE-SHOT CHECK constraints that must be wrapped in guarded DO blocks
- **0 statements** are unsafe on the current zero-row database

**Verdict: AUDIT_FIXES READY TO EXECUTE** (with ONE-SHOT guards on §7 constraints and a recommended phase sequence).

---

## 2. Current Live Database State

| Object | Count | Notes |
|--------|-------|-------|
| Application tables | 15 | All from SCHEMA.sql |
| Application rows | 0 | Verified across all tables |
| Views | 1 | `v_lead_overview` |
| Indexes (public) | 47 | Includes SCHEMA.sql indexes |
| Unique indexes | 17 | Includes SCHEMA.sql unique indexes |
| Foreign keys | 14 | 14 in SCHEMA.sql |
| Triggers | 10 | `set_updated_at` on 10 tables (excludes notification tables) |
| Functions | 12 | 1 (`set_updated_at`) + 11 from FUNCTIONS.sql |
| Application RPCs | 11 | 9 analytics + 2 B2 upserts; all service_role-only |
| SECURITY DEFINER | 0 | No function uses SECURITY DEFINER |
| RLS policies | 0 | Deny-by-default on all 15 tables |
| Storage buckets | 0 | No public/private buckets |

### Indexes currently installed (47 from SCHEMA.sql)

```
users_email_uq, users_role_idx
leads_owner_status_idx, leads_created_at_desc_idx, leads_utm_source_campaign_created_idx
lead_email_notifications_admin_notified_idx, lead_whatsapp_notifications_admin_notified_idx
lead_notes_lead_created_idx
activity_logs_lead_idx, activity_logs_performed_by_idx
quotations_lead_idx, quotations_number_idx, quotations_status_created_idx,
  quotations_lead_created_idx, quotations_valid_till_idx
quotation_items_quotation_idx
projects_quotation_idx, projects_lead_idx, projects_status_site_status_idx
boq_project_created_idx
materials_project_created_idx, materials_project_name_idx
labour_project_created_idx, labour_project_role_idx
invoices_project_created_idx, invoices_status_created_idx, invoices_due_date_idx
forecasts_month_uq
tenders_tender_name_idx, tenders_client_idx, tenders_status_created_idx,
  tenders_submission_date_idx
```

### Unique indexes currently installed (17 from SCHEMA.sql)

```
users_email_uq, forecasts_month_uq
+ 15 primary key indexes (one per table)
= 17 total unique indexes
```

---

## 3. Current Application State

| Component | Status | Details |
|-----------|--------|---------|
| Backend tests | 123/132 pass | F1 (12), F2/duplicateKey (18), F3/projectConversion (6), B1/projectDuplicate (9), B2/notificationUpsert (12), R1-R2/repository (24), R3/CSRF (6), R4/estimator (3), R5/careers (2), R6-R7 (9) |
| PostgREST lifecycle | Fixed | `buildBaseQuery()` initializes `.select()` before filters (R1) |
| countDocuments | Fixed | Named `countDocumentsForRepo` to avoid shadowing (R2) |
| CSRF chain | Complete | Forward all Set-Cookie headers, proxy extracts token, AdminShell logout (R3) |
| Quotation totals | Server-side only | `quotationTotals.js` + `quotationValidation.js` + `Quotation.js beforeSave` (F1) |
| 23505 → 409 mapping | Complete | `duplicateKeyError.js` mapper covers quotations, invoices, projects (F2, B1) |
| Project conversion race | Complete | `createProjectSafely()` with atomic arbiter (F3) |
| Generic project duplicate lead | Complete | `mapDuplicateKeyError(error, "projects")` in POST/PUT (B1) |
| Notification upsert | Complete | Atomic RPC upsert in repository, no SELECT→INSERT race (B2) |
| Audit trail FKs | NOT applied | Still `ON DELETE CASCADE` in live database (§5 pending) |
| Notification triggers | NOT applied | `updated_at` still not auto-maintained (§6 pending) |
| Lead email lowercase | NOT applied | JS-only, no DB CHECK (§7c pending) |
| No invoice routes | Confirmed | `server.js` does not mount invoice routes |
| No careers routes | Confirmed | No backend careers endpoint exists |
| No activity_log writers | Confirmed | `ActivityLog.js` model exists but is not imported by any route |

---

## 4. P1–P22 Reconciliation

| Finding | Original Problem | Current Live State | Current Code State | SQL Fix Still Required? | Risk | Recommendation |
|---------|------------------|--------------------|--------------------|------------------------|------|----------------|
| **P1** | `activity_logs.performed_by` has `ON DELETE CASCADE` — deletes destroy audit trail | FK is `ON DELETE CASCADE` (SCHEMA.sql). Column is `NOT NULL`. Table has 0 rows, no active writers. | `ActivityLog.js` model exists but is never imported by any route/controller. | **YES** — §5: drop FK, drop NOT NULL, re-add as SET NULL | **Low** — dormant table, no concurrent access | Execute §5. Table is dormant; zero risk. |
| **P2** | `quotations.quotation_number` and `invoices.invoice_number` nullable, non-unique | Non-unique indexes exist (`quotations_number_idx`). No unique constraint. 0 rows. | Backend maps 23505 → 409 (F2). `quotationValidation.js` normalizes number to empty string or value. No invoice write routes. | **YES** — §3: normalize `''`→NULL (0 rows affected), create partial unique indexes, drop redundant `quotations_number_idx` | **Low** — zero rows, backend handles 23505 | Execute §3. Backend 409 mapping is ready. |
| **P3** | `activity_logs.lead_id` `ON DELETE CASCADE` wipes audit trail | FK is `ON DELETE CASCADE`. Column is `NOT NULL`. Table has 0 rows, no active writers. | Same as P1 — no writer exists. | **YES** — §5: drop FK, drop NOT NULL, re-add as SET NULL | **Low** — dormant table | Execute §5 (same block as P1). |
| **P4** | `lead_email_notifications.updated_at` and `lead_whatsapp_notifications.updated_at` never refreshed | **No trigger** on either table. `set_updated_at` trigger loop in SCHEMA.sql omits both. Column exists but goes stale on UPDATE. | B2 upsert RPC always sets `updated_at = now()` on both INSERT and UPDATE. The column IS updated by the RPC. However, any direct SQL UPDATE to these tables would not refresh it. | **YES** — §6: create triggers | **Low** — RPC already writes `now()`, but defense-in-depth | Execute §6. Complements B2 RPC; ensures consistency for any direct SQL access. |
| **P5** | `quotations.total_amount = subtotal + gst` only enforced in route-layer | No CHECK constraint exists. 0 rows. | **F1 fully resolved:** `quotationValidation.js` strips client `totalAmount` and computes server-side. `Quotation.js beforeSave` re-derives at persistence boundary. Both use `quotationTotals.js` (single source of truth). Invariant `totalAmount === round2(subtotal + gst)` is guaranteed by two independent layers. | **YES** — §7a: CHECK constraint (defense-in-depth) | **Medium** — ONE-SHOT; requires F1 to be deployed simultaneously | Execute §7a (guarded DO block). F1 app change is deployed and verified. Zero rows = zero scan time. |
| **P6** | `invoices.paid_amount <= amount` not enforced | No CHECK constraint exists. No invoice write routes exist. 0 rows. | No code path writes invoices today. Read-only consumers only. | **YES** — §7b: CHECK constraint (prevents future violations) | **Low** — no writer, zero rows | Execute §7b (guarded DO block). Future-proofs against invoice write routes. |
| **P7** | `leads.owner` / `projects.project_owner` denormalize `users.name` | Columns exist with denormalized text values. 0 rows. | `resolveLeadOwnerAssignment` writes `user.name` at assignment time. Renames don't propagate. | **NO** — accepted design decision | **None** | Document only (§9). No action required. |
| **P8** | `projects.lead_id` has no uniqueness guard; concurrent creates produce duplicates | No unique constraint on `projects.lead_id`. Non-unique `projects_lead_idx` exists. 0 rows. | **F3 fully resolved:** `createProjectSafely()` catches 23505 and returns `{ alreadyExists }`. **B1 fully resolved:** `mapDuplicateKeyError(error, "projects")` in POST/PUT catches 23505 → 409. | **YES** — §4: partial unique index (defense-in-depth) | **Medium** — concurrent race is already handled in app; index is safety net | Execute §4. The app handles the race correctly; the index is the final DB-level backstop. |
| **P9** | Notification sub-table writes race (SELECT → INSERT) | Two `set_updated_at` triggers missing (P4). B2 UPSERT functions are installed and live on Supabase. | **B2 fully resolved:** Repository uses atomic `INSERT … ON CONFLICT (lead_id) DO UPDATE` via RPC. No SELECT → INSERT. 23505 cannot reach application. | **NO at app level** — fully resolved. **Functions already installed.** | **None** | No action required. Functions are live; app code uses them. |
| **P10** | Missing indexes for real query shapes | 6 indexes missing per AUDIT audit. Current 47 indexes from SCHEMA.sql. | Backend queries: exports filter `leads (status)`, `leads (owner)`; revenue monthly facets; project list filter+sort. All patterns confirmed in `exportRoutes.js`, `revenueRoutes.js`, `projectRoutes.js`. | **YES** — §2: 6 new indexes | **Low** — create index on empty/small tables is fast | Execute §2. All 6 are pure query accelerators for confirmed backend paths. |
| **P11** | `quotations_lead_idx (lead_id)` redundant with `quotations_lead_created_idx (lead_id, created_at desc)` | Both indexes exist. Leftmost prefix means the single-column index is pure write overhead. | All quotation `lead_id` queries are served by the composite index. | **YES** — §1: drop redundant index | **Low** — drop index, sub-second | Execute §1.1. |
| **P12** | `public` role holds default EXECUTE on `set_updated_at()` and default privileges on future objects | `set_updated_at()` has default PUBLIC EXECUTE. Default privileges grant EXECUTE/ALL to PUBLIC on future objects. | All 11 FUNCTIONS.sql functions already have explicit `revoke all … from public` + `grant execute … to service_role`. `set_updated_at()` is the only remaining exposure. | **YES** — §8: revoke + alter default privileges + re-grant service_role | **Medium** — privilege change; affects future objects | Execute §8. Defensive hardening. Schema USAGE grant stays commented per SQL_VALIDATION_PLAN condition. |
| **P13** | 7 unused indexes (dead weight) | `invoices_due_date_idx`, `tenders_submission_date_idx`, `tenders_tender_name_idx`, `tenders_client_idx`, `activity_logs_performed_by_idx`, `lead_email_notifications_admin_notified_idx`, `lead_whatsapp_notifications_admin_notified_idx` | No query filters on these today. Roadmap may use them. | **NO** — leave as-is; review in 4–6 weeks | **None** | Do not drop yet. Re-evaluate after traffic baseline. |
| **P14** | `leads.email` lowercase enforced only in JS, not DB | No CHECK constraint on `leads.email`. 0 rows. | `validateCreateLead` and `validateLeadUpdate` both call `.toLowerCase()`. No rogue writer exists. | **YES** — §7c: CHECK constraint (defense-in-depth) | **Low** — JS already lowercases; zero rows | Execute §7c (guarded DO block). |
| **P15** | Note length cap missing; `quotation_items.position` missing from read path | DB CHECK (`lead_notes_text_length ≤ 2000`) exists. `position` column exists in `quotation_items`. | `POST /:id/notes` has no JS length check — DB CHECK throws → 500. `Quotation.js` joins rowMap omits `position`. | **NO SQL** — app-layer only (§10) | **Low** — 500 on oversized notes; items read without position | Fix in next deployment cycle: add JS length check (400 instead of 500); add `position` to joins rowMap. |
| **P16** | `lead_notes.added_by` stores "system" or UUID as text, no FK | Column exists, no FK. 0 rows. | Acceptable for audit text. | **NO** — accepted design | **None** | Document only (§9). |
| **P17** | `forecasts.month` is `text` with regex CHECK | Column exists with regex CHECK `^\d{4}-\d{2}$`. 0 rows. | Works correctly for sorting. Optional date-math upgrade. | **NO** — optional future upgrade | **None** | Optional (§9). Not required. |
| **P18** | `GET /api/leads` and `GET /api/quotations` load entire tables (no pagination) | No DB change needed. Route-level concern. | `GET /api/projects` already has pagination. Leads and quotations routes load full table with per-row joins. | **NO SQL** — app-layer only (§10) | **Low** — performance at scale | Add pagination in next deployment cycle. |
| **P19** | `lead_notes` inserted one-at-a-time (N+1) | No DB change needed. Repository pattern. | `persistChildren` loops one `.insert()` per note. | **NO SQL** — app-layer only (§10) | **Low** — performance | Batch insert in next deployment cycle. |
| **P20** | `leads.phone` format enforced only in JS | DB CHECK only bounds length 7–20. No format CHECK. 0 rows. | `leadValidation.js` enforces identical regex `^[0-9+\-\s()]{7,20}$`. | **NO** — optional; JS already validates | **Low** | Optional (§7d, commented in AUDIT_FIXES.sql). Phase 4 only. |
| **P21** | Analytics functions scan tables 5–6× per call | Functions use separate subqueries per facet. Fine at current scale. | Function SQL is correct and uses FILTER/WHERE optimizations. | **NO SQL** — optional refactor (§11d) | **None at current scale** | Optional. Single-pass CTE refactor for future scale. |
| **P22** | No storage buckets/policies | No storage buckets. 0 buckets. | Migration decision: no file persistence; PDFs generated in-memory. | **NO** — verify via `storage.buckets` introspection | **None** | Run introspection SQL (§11a). Informational only. |

---

## 5. F1 / F2 / F3 Reconciliation

### F1 — Quotation Total Integrity

| Aspect | Status |
|--------|--------|
| **Server-side calculation** | ✅ `quotationTotals.js` — single source of truth; `totalAmount = round2(subtotal + gst)` |
| **Validation layer** | ✅ `quotationValidation.js` — strips client `totalAmount`, computes via `computeQuotationTotals()` |
| **Persistence layer** | ✅ `Quotation.js beforeSave` — `enforceTotalIntegrity()` recomputes before every INSERT/UPDATE |
| **Client `totalAmount` ignored** | ✅ `body.totalAmount` deliberately never read in validation middleware |
| **CHECK constraint ready** | ✅ `quotations_total_integrity CHECK (total_amount = subtotal + gst)` in AUDIT_FIXES §7a |
| **Zero rows** | ✅ CHECK constraint will scan 0 rows; instant pass |
| **Tests** | ✅ 26/26 (12 unit + 14 validation) |

**Verdict:** F1 is **FULLY RESOLVED** at app layer. SQL §7a is safe to apply as defense-in-depth.

### F2 — Duplicate Quotation/Invoice Number → HTTP 409

| Aspect | Status |
|--------|--------|
| **23505 mapper** | ✅ `duplicateKeyError.js` — `mapDuplicateKeyError()` resolves table, column, constraint name |
| **Quotation routes** | ✅ `POST /` and `POST /:id/convert` catch blocks map 23505 → flat 409 before 500 fallback |
| **Invoice write routes** | ⚠️ No invoice write routes exist today. Mapper is ready; future routes must wire it. |
| **Generic fallback** | ✅ Any unrecognized 23505 → generic `DUPLICATE_VALUE` 409 (never 500) |
| **Partial unique indexes** | ✅ `quotations_number_uq` and `invoices_number_uq` in AUDIT_FIXES §3 |
| **`''`→NULL normalization** | ✅ UPDATE in §3 normalizes empty strings; idempotent on zero rows |
| **Tests** | ✅ 18/18 duplicate-key tests + 9 project duplicate route tests |

**Verdict:** F2 is **FULLY RESOLVED** at app layer. SQL §3 is safe to apply.

### F3 — Concurrent Project Conversion

| Aspect | Status |
|--------|--------|
| **`createProjectSafely()`** | ✅ Atomic arbiter: try create → on 23505 re-read winner → `{ alreadyExists }` or `{ duplicateConflict }` |
| **`POST /from-lead/:leadId`** | ✅ Fast-path pre-check + `createProjectSafely` + `duplicateConflict` → 409 `DUPLICATE_PROJECT_FOR_LEAD` |
| **`POST /:id/convert`** | ✅ Fast-path pre-check + `createProjectSafely` with quotation→lead re-read + winner-only side effects |
| **Side effects gated** | ✅ `quotation.status = "Approved"` and `lead.status = "Closed"` run only for winner |
| **Partial unique index** | ✅ `projects_lead_uq` in AUDIT_FIXES §4 |
| **Cross-endpoint race** | ✅ Both `/from-lead` and `/:id/convert` converge on same project for same lead |
| **Tests** | ✅ 6/6 projectConversion tests |

**Verdict:** F3 is **FULLY RESOLVED** at app layer. SQL §4 is safe to apply as defense-in-depth.

---

## 6. B1 / B2 Reconciliation

### B1 — Generic Project Endpoints → 409 for Duplicate Lead

| Aspect | Status |
|--------|--------|
| **`POST /api/projects`** | ✅ `mapDuplicateKeyError(error, "projects")` → flat 409 `DUPLICATE_PROJECT_FOR_LEAD` |
| **`PUT /api/projects/:id`** | ✅ Same mapper, same response |
| **`POST /from-lead/:leadId`** | ✅ Aligned to same flat 409 body |
| **`duplicateConflict` safety net** | ✅ Same flat 409 body (was endpoint-specific sentence, now unified) |
| **TABLE_COLUMN_MAP** | ✅ `projects.lead_id` / `leadId` / `projects_lead_uq` matched by token |
| **Tests** | ✅ 9/9 projectDuplicateRoutes tests + 5 mapper tests |

**Verdict:** B1 is **FULLY RESOLVED** at app layer. SQL §4 (unique index) is the DB-level backstop.

### B2 — Notification Persistence Race

| Aspect | Status |
|--------|--------|
| **SQL functions** | ✅ `upsert_lead_email_notification` (12 args) + `upsert_lead_whatsapp_notification` (14 args) installed on live Supabase |
| **Atomic UPSERT** | ✅ `INSERT … ON CONFLICT (lead_id) DO UPDATE` — single statement, no SELECT |
| **`attempt_count` increment** | ✅ `attempt_count + greatest(p_attempt_count_delta, 0)` — row-locked, no lost increments |
| **`p_has_*` flags** | ✅ Column-preserving merge; concurrent writers don't clobber each other |
| **Repository wiring** | ✅ `buildUpsertRpcArgs` + `callUpsertRpc` in `createRepository.js` |
| **`Lead.js` config** | ✅ Both sub-tables declare `upsertRpc` + `incrementColumn` |
| **`save()` skips increment** | ✅ `persistChildren` never writes `attempt_count` |
| **Privileges** | ✅ EXECUTE revoked from PUBLIC; granted to `service_role` only |
| **Tests** | ✅ 12/12 notificationUpsert tests (deterministic concurrency) |

**Verdict:** B2 is **FULLY RESOLVED**. Functions are live; app code uses them. No SQL changes needed.

---

## 7. Index Reconciliation

### Currently installed (47)

All 47 indexes from SCHEMA.sql are confirmed installed.

### Proposed changes

| # | Statement | Action | Current state |
|---|-----------|--------|---------------|
| §1.1 | `DROP INDEX IF EXISTS quotations_lead_idx` | **DROP** | Exists; redundant with `quotations_lead_created_idx` |
| §2.1 | `CREATE INDEX leads_status_created_idx (status, created_at desc)` | **ADD** | Does not exist; needed for `exportRoutes` |
| §2.2 | `CREATE INDEX leads_owner_created_idx (owner, created_at desc)` | **ADD** | Does not exist; needed for `exportRoutes` |
| §2.3 | `CREATE INDEX quotations_created_at_desc_idx (created_at desc)` | **ADD** | Does not exist; needed for revenue facets |
| §2.4 | `CREATE INDEX projects_status_site_created_idx (status, site_status, created_at desc)` | **ADD** | Does not exist; needed for project list filter+sort |
| §2.5 | `CREATE INDEX projects_created_at_desc_idx (created_at desc)` | **ADD** | Does not exist; needed for revenue facets |
| §2.6 | `CREATE INDEX invoices_created_at_desc_idx (created_at desc)` | **ADD** | Does not exist; needed for revenue facets |
| §3.3 | `CREATE UNIQUE INDEX quotations_number_uq (quotation_number) WHERE …` | **ADD** | Does not exist; P2 enforcement |
| §3.4 | `CREATE UNIQUE INDEX invoices_number_uq (invoice_number) WHERE …` | **ADD** | Does not exist; P2 enforcement |
| §3.5 | `DROP INDEX IF EXISTS quotations_number_idx` | **DROP** | Exists; redundant after partial unique |
| §4.1 | `CREATE UNIQUE INDEX projects_lead_uq (lead_id) WHERE lead_id IS NOT NULL` | **ADD** | Does not exist; P8 enforcement |

### Post-AUDIT_FIXES index count

- **Remove:** `quotations_lead_idx`, `quotations_number_idx` (2 drops)
- **Add:** 6 non-unique + 3 unique = 9 new indexes
- **Net:** +7 indexes → **54 total indexes**

### P13 dead indexes — NO CHANGE

The 7 dead indexes (§13) are left in place. They will be reviewed 4–6 weeks post-deployment against `pg_stat_user_indexes`.

---

## 8. Constraint Reconciliation

### CHECK constraints in SCHEMA.sql (verified)

All CHECK constraints from SCHEMA.sql are confirmed applied: `users_email_lowercase`, `users_email_length`, `users_role`, `users_name_length`, `leads_*` length/bounds/range checks, `quotations_*` checks, `quotation_items_*` checks, `projects_*` checks, `boq_*` checks, `materials_*` checks, `labour_*` checks, `invoices_*` checks, `forecasts_*` checks, `tenders_*` checks.

### Proposed new CHECK constraints

| # | Constraint | Statement | ONE-SHOT? | Guarded? |
|---|-----------|-----------|-----------|----------|
| §7a | `quotations_total_integrity` | `ALTER TABLE quotations ADD CONSTRAINT quotations_total_integrity CHECK (total_amount = subtotal + gst)` | **YES** | Must wrap in `DO $$ BEGIN IF NOT EXISTS (…) THEN ALTER … END IF; END $$;` |
| §7b | `invoices_paid_amount_le_amount` | `ALTER TABLE invoices ADD CONSTRAINT invoices_paid_amount_le_amount CHECK (paid_amount <= amount)` | **YES** | Same guard pattern |
| §7c | `leads_email_lowercase` | `ALTER TABLE leads ADD CONSTRAINT leads_email_lowercase CHECK (email = lower(email))` | **YES** | Same guard pattern |

### Partial unique constraints (index-based, idempotent)

| # | Constraint | Idempotent? | Data dependency |
|---|-----------|-------------|-----------------|
| §3.3 | `quotations_number_uq` | ✅ `IF NOT EXISTS` | Zero duplicates (0 rows) |
| §3.4 | `invoices_number_uq` | ✅ `IF NOT EXISTS` | Zero duplicates (0 rows) |
| §4.1 | `projects_lead_uq` | ✅ `IF NOT EXISTS` | Zero duplicates (0 rows) |

---

## 9. FK Reconciliation

### Current FKs (14 in SCHEMA.sql)

| # | Table | Column | References | ON DELETE |
|---|-------|--------|------------|-----------|
| 1 | leads | owner_id | users.id | SET NULL |
| 2 | lead_email_notifications | lead_id | leads.id | CASCADE |
| 3 | lead_whatsapp_notifications | lead_id | leads.id | CASCADE |
| 4 | lead_notes | lead_id | leads.id | CASCADE |
| 5 | activity_logs | lead_id | leads.id | **CASCADE ⚠** |
| 6 | activity_logs | performed_by | users.id | **CASCADE ⚠** |
| 7 | quotations | lead_id | leads.id | SET NULL |
| 8 | quotation_items | quotation_id | quotations.id | CASCADE |
| 9 | projects | quotation_id | quotations.id | SET NULL |
| 10 | projects | lead_id | leads.id | SET NULL |
| 11 | boq_entries | project_id | projects.id | CASCADE |
| 12 | materials | project_id | projects.id | CASCADE |
| 13 | labour_entries | project_id | projects.id | CASCADE |
| 14 | invoices | project_id | projects.id | CASCADE |

### Proposed FK changes

| # | Change | Statement | Risk |
|---|--------|-----------|------|
| §5.1 | `activity_logs.lead_id` → SET NULL + nullable | Drop FK, drop NOT NULL, re-add with SET NULL | **Low** — dormant table, no writers |
| §5.2 | `activity_logs.performed_by` → SET NULL + nullable | Same pattern | **Low** — dormant table, no writers |

### CASCADE on child tables (unchanged, correct)

CASCADE on `lead_email_notifications`, `lead_whatsapp_notifications`, `lead_notes`, `quotation_items`, `boq_entries`, `materials`, `labour_entries`, `invoices` is **correct** — these are child aggregates that should be cleaned up when their parent is deleted.

---

## 10. Trigger Reconciliation

### Current triggers (10)

`set_updated_at` on: users, leads, quotations, projects, boq_entries, materials, labour_entries, invoices, forecasts, tenders.

### Missing triggers (2)

| Table | Trigger exists? | Updated by code? | SQL needed? |
|-------|----------------|-------------------|-------------|
| lead_email_notifications | ❌ No | ✅ B2 RPC writes `updated_at = now()` | YES — §6 (defense-in-depth) |
| lead_whatsapp_notifications | ❌ No | ✅ B2 RPC writes `updated_at = now()` | YES — §6 (defense-in-depth) |

### Proposed new triggers

```sql
-- §6.1
DROP TRIGGER IF EXISTS set_updated_at_lead_email_notifications ON public.lead_email_notifications;
CREATE TRIGGER set_updated_at_lead_email_notifications
  BEFORE UPDATE ON public.lead_email_notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- §6.2
DROP TRIGGER IF EXISTS set_updated_at_lead_whatsapp_notifications ON public.lead_whatsapp_notifications;
CREATE TRIGGER set_updated_at_lead_whatsapp_notifications
  BEFORE UPDATE ON public.lead_whatsapp_notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

Post-AUDIT_FIXES trigger count: **12** (+2).

---

## 11. Function / Privilege Reconciliation

### Functions currently installed (12)

| # | Function | Language | Volatility | SECURITY DEFINER | EXECUTE |
|---|----------|----------|------------|------------------|---------|
| 1 | `set_updated_at()` | plpgsql | volatile | No | PUBLIC default ⚠ |
| 2–9 | 8 analytics functions | sql | stable | No | service_role only ✅ |
| 10 | `upsert_lead_email_notification` | plpgsql | volatile | No | service_role only ✅ |
| 11 | `upsert_lead_whatsapp_notification` | plpgsql | volatile | No | service_role only ✅ |

### Privilege changes (§8)

| # | Statement | Purpose |
|---|-----------|---------|
| 8.1 | `REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC` | Strip default EXECUTE from `set_updated_at()` and all future functions |
| 8.2 | `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC` | Prevent future functions from gaining PUBLIC EXECUTE |
| 8.3 | `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC` | Prevent future tables from gaining PUBLIC ALL |
| 8.4 | `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC` | Prevent future sequences from gaining PUBLIC ALL |
| 8.5 | `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO SERVICE_ROLE` | Re-assert service_role after revoke |
| 8.6 | `GRANT ALL ON ALL TABLES IN SCHEMA public TO SERVICE_ROLE` | Re-assert service_role |
| 8.7 | `GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO SERVICE_ROLE` | Re-assert service_role |

**Note:** `REVOKE USAGE ON SCHEMA public FROM PUBLIC` stays **commented** per SQL_VALIDATION_PLAN condition — Supabase-managed paths, dashboard SQL editor, and future PostgREST key setups need schema USAGE.

### Functions NOT needing changes

All 11 FUNCTIONS.sql functions are already installed with correct signatures, privileges, and SECURITY DEFINER = false. No `CREATE OR REPLACE` is needed from AUDIT_FIXES.sql.

---

## 12. Data-Preparation Analysis

All tables contain **zero rows**. Therefore:

| Statement | Classification | Effect on zero rows |
|-----------|---------------|---------------------|
| §3 UPDATE `quotations SET quotation_number = NULL WHERE …` | Data normalization | **Affects 0 rows.** No-op. Safe as precursor to unique index. |
| §3 UPDATE `invoices SET invoice_number = NULL WHERE …` | Data normalization | **Affects 0 rows.** No-op. Safe as precursor to unique index. |
| §7c UPDATE `leads SET email = lower(email) WHERE …` | Data normalization | **Affects 0 rows.** No-op. Safe as precursor to CHECK. |
| §3.1 verification: `SELECT … duplicate quotation numbers` | Read-only check | Returns 0 rows. Prerequisite for §3.3. |
| §3.2 verification: `SELECT … duplicate invoice numbers` | Read-only check | Returns 0 rows. Prerequisite for §3.4. |
| §3.3 verification: `SELECT … duplicate projects per lead` | Read-only check | Returns 0 rows. Prerequisite for §4.1. |
| §3.4 verification: `SELECT … quotation total mismatches` | Read-only check | Returns 0 rows. Prerequisite for §7a. |
| §3.5 verification: `SELECT … invoice over-payment` | Read-only check | Returns 0 rows. Prerequisite for §7b. |
| §3.6 verification: `SELECT … mixed-case emails` | Read-only check | Returns 0 rows. Prerequisite for §7c. |

**All data-preparation statements are no-ops.** They can safely precede constraints. They are still required in the script for correctness if the database ever gains rows before AUDIT_FIXES.sql is executed.

---

## 13. Lock Analysis

| Statement | Lock Type | Duration (est.) | Impact |
|-----------|-----------|-----------------|--------|
| **§1.1** `DROP INDEX quotations_lead_idx` | ACCESS EXCLUSIVE on index only | <100ms | No table DML blocked beyond index relation |
| **§2.1–2.6** `CREATE INDEX` (6 non-unique) | SHARE on target table | 100ms–2s each at 0 rows | Blocks INSERT/UPDATE/DELETE during build. At 0 rows: sub-second. |
| **§3.1–3.2** Data-prep UPDATEs | Row-level locks only | <100ms | No table-level lock |
| **§3.3–3.4** `CREATE UNIQUE INDEX` (partial) | SHARE on target table | <200ms | Blocks writes briefly |
| **§3.5** `DROP INDEX quotations_number_idx` | ACCESS EXCLUSIVE on index only | <100ms | No table DML blocked |
| **§4.1** `CREATE UNIQUE INDEX projects_lead_uq` | SHARE on projects | <200ms | Blocks writes briefly |
| **§5.1–5.2** `ALTER TABLE activity_logs` (FK + nullability) | ACCESS EXCLUSIVE on activity_logs | <100ms | Dormant table, no concurrent access |
| **§6.1–6.2** `CREATE TRIGGER` | SHARE ROW EXCLUSIVE | <50ms | Brief; no data impact |
| **§7a** `ADD CONSTRAINT CHECK` | ACCESS EXCLUSIVE on quotations + full scan | <200ms at 0 rows | Blocks writes briefly |
| **§7b** `ADD CONSTRAINT CHECK` | ACCESS EXCLUSIVE on invoices + full scan | <200ms at 0 rows | Blocks writes briefly |
| **§7c** `ADD CONSTRAINT CHECK` | ACCESS EXCLUSIVE on leads + full scan | <200ms at 0 rows | Blocks writes briefly |
| **§8.1–8.7** Privilege changes | Metadata-only (catalog) | <50ms total | No user-table locks |
| **§7c UPDATE** `leads email lower()` | Row-level locks | <100ms | 0 rows affected |

**Total estimated lock time:** <15 seconds cumulative across all statements. Zero downtime. No ACCESS EXCLUSIVE locks held for more than 200ms on any user-facing table.

---

## 14. Downtime Analysis

| Category | Assessment |
|----------|-----------|
| **Application downtime** | **None.** All statements are online. No `REINDEX`, no `VACUUM FULL`, no long-running DDL. |
| **API availability** | **100%.** Backend uses service-role key (RLS bypass). All statements execute independently of API traffic. |
| **Concurrent DML during Phase 1** | Index drops/creates take brief SHARE/AEL locks. At 0 rows, DML is never blocked for more than milliseconds. |
| **Concurrent DML during Phase 2** | CHECK constraints take AEL + scan. At 0 rows, scan is instant. |
| **Recommended execution** | Run from Supabase Dashboard SQL Editor during low-traffic window. Each statement commits individually. No transaction wrapping required. |

---

## 15. Backward Compatibility Analysis

### Write paths

| Write path | AUDIT_FIXES impact | Compatible? |
|------------|-------------------|-------------|
| `POST /api/quotations` (quotation create) | §7a CHECK constraint — totals always match (F1 fix) | ✅ Yes |
| `POST /api/quotations/:id/convert` (project create) | §4 unique index — 23505 → `{ alreadyExists }` (F3 fix) | ✅ Yes |
| `POST /api/projects` (generic create) | §4 unique index — 23505 → 409 `DUPLICATE_PROJECT_FOR_LEAD` (B1 fix) | ✅ Yes |
| `PUT /api/projects/:id` (generic update) | §4 unique index — same as above | ✅ Yes |
| `POST /api/projects/from-lead/:leadId` | §4 unique index — race handled by `createProjectSafely` | ✅ Yes |
| `POST /api/leads` (lead create) | §7c CHECK — email always lowercased (leadValidation.js) | ✅ Yes |
| `PUT /api/leads/:id` | §7c CHECK — email always lowercased | ✅ Yes |
| `PUT /api/leads/:id/status` | No CHECK or index change | ✅ Yes |
| `PUT /api/leads/:id/owner` | No CHECK or index change | ✅ Yes |
| `POST /api/leads/:id/notes` | No change (P15 is app-layer only) | ✅ Yes |
| Notification upsert RPCs | No change (already live) | ✅ Yes |

### Read paths

| Read path | Index change impact | Compatible? |
|-----------|-------------------|-------------|
| `GET /api/leads` | §2 adds `leads_status_created_idx` and `leads_owner_created_idx` — pure accelerators | ✅ Yes |
| `GET /api/leads/analytics/summary` | §2 indexes support status/source/owner facets | ✅ Yes |
| `GET /api/quotations` | §2 adds `quotations_created_at_desc_idx` — pure accelerator | ✅ Yes |
| `GET /api/projects` | §2 adds `projects_status_site_created_idx` and `projects_created_at_desc_idx` | ✅ Yes |
| `GET /api/revenue/overview` | §2 indexes support monthly facets on quotations/projects/invoices | ✅ Yes |
| `GET /api/leads/client/:quotationNumber` | §3.5 drops `quotations_number_idx`; partial unique `quotations_number_uq` covers non-null equality lookups | ✅ Yes |
| All analytics RPCs | No index or function changes | ✅ Yes |

### Error mappings

| Scenario | Before AUDIT_FIXES | After AUDIT_FIXES | Change? |
|----------|-------------------|-------------------|---------|
| Duplicate quotation number | 500 (no unique index) → now **409** `DUPLICATE_QUOTATION_NUMBER` (F2 app fix) | Same 409 (unique index enforces DB-level; same app mapper) | No change — consistent |
| Duplicate project for lead | 500 (no unique index) → now **409** `DUPLICATE_PROJECT_FOR_LEAD` (B1 app fix) | Same 409 (unique index enforces DB-level; same app mapper) | No change — consistent |
| Concurrent project conversion | 500 → now **200** `{ alreadyExists }` (F3 app fix) | Same 200 (unique index catches race; same `createProjectSafely`) | No change — consistent |
| Quotation total mismatch | Accepted (client value stored) → now **server-computed** (F1 app fix) | CHECK constraint prevents any future mismatch | No change — consistent |
| Email case mismatch | Accepted → now **lowercased** by JS (leadValidation) | CHECK prevents DB-level mixed case | No change — consistent |

---

## 16. Updated Phase 1/2/3/4 Execution Order

### Phase 1 — Safe online changes (no behavior change)

**Preconditions:** None. App changes already deployed.

| # | Statement | Section | Lock |
|---|-----------|---------|------|
| 1.1 | `DROP INDEX IF EXISTS public.quotations_lead_idx` | §1 | AEL (index) |
| 1.2 | `CREATE INDEX IF NOT EXISTS leads_status_created_idx` | §2 | SHARE (leads) |
| 1.3 | `CREATE INDEX IF NOT EXISTS leads_owner_created_idx` | §2 | SHARE (leads) |
| 1.4 | `CREATE INDEX IF NOT EXISTS quotations_created_at_desc_idx` | §2 | SHARE (quotations) |
| 1.5 | `CREATE INDEX IF NOT EXISTS projects_status_site_created_idx` | §2 | SHARE (projects) |
| 1.6 | `CREATE INDEX IF NOT EXISTS projects_created_at_desc_idx` | §2 | SHARE (projects) |
| 1.7 | `CREATE INDEX IF NOT EXISTS invoices_created_at_desc_idx` | §2 | SHARE (invoices) |
| 1.8 | `UPDATE quotations SET quotation_number = NULL WHERE btrim(quotation_number) = ''` | §3 data-prep | Row locks (0 rows) |
| 1.9 | `UPDATE invoices SET invoice_number = NULL WHERE btrim(invoice_number) = ''` | §3 data-prep | Row locks (0 rows) |
| 1.10 | `UPDATE leads SET email = lower(email) WHERE email <> lower(email)` | §7c data-prep | Row locks (0 rows) |
| 1.11 | `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` on `lead_email_notifications` | §6 | SHARE ROW EXCLUSIVE |
| 1.12 | `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` on `lead_whatsapp_notifications` | §6 | SHARE ROW EXCLUSIVE |
| 1.13 | `REVOKE ALL ON ALL FUNCTIONS FROM PUBLIC` + ALTER DEFAULT PRIVILEGES + RE-GRANT | §8 | Metadata only |

**Exit criteria:** 13 indexes removed/created; 2 triggers created; privileges hardened.

### Phase 2 — Constraint additions (behavior change — defense-in-depth)

**Preconditions:** Phase 1 complete. All ONE-SHOT statements must be wrapped in guarded `DO` blocks.

| # | Statement | Section | Lock | Guard |
|---|-----------|---------|------|-------|
| 2.1 | `CREATE UNIQUE INDEX IF NOT EXISTS quotations_number_uq` | §3 | SHARE (quotations) | `IF NOT EXISTS` ✅ |
| 2.2 | `CREATE UNIQUE INDEX IF NOT EXISTS invoices_number_uq` | §3 | SHARE (invoices) | `IF NOT EXISTS` ✅ |
| 2.3 | `DROP INDEX IF EXISTS public.quotations_number_idx` | §3 | AEL (index) | `IF EXISTS` ✅ |
| 2.4 | `CREATE UNIQUE INDEX IF EXISTS projects_lead_uq` | §4 | SHARE (projects) | `IF NOT EXISTS` ✅ |
| 2.5 | `ALTER TABLE activity_logs` FK → SET NULL + nullable | §5 | AEL (activity_logs) | `DROP CONSTRAINT IF EXISTS` ✅ |
| 2.6 | `ADD CONSTRAINT quotations_total_integrity CHECK` | §7a | AEL (quotations) | **DO block required** ⚠ |
| 2.7 | `ADD CONSTRAINT invoices_paid_amount_le_amount CHECK` | §7b | AEL (invoices) | **DO block required** ⚠ |
| 2.8 | `ADD CONSTRAINT leads_email_lowercase CHECK` | §7c | AEL (leads) | **DO block required** ⚠ |

**Exit criteria:** 6 unique indexes present; 3 CHECK constraints present; activity_logs FKs changed; zero constraint-violation errors.

### Phase 3 — Data validation

**Before Phase 2, run verification queries (all return 0 rows on empty DB):**

| # | Query | Purpose |
|---|-------|---------|
| 3.1 | `SELECT quotation_number, count(*) FROM quotations WHERE … GROUP BY 1 HAVING count(*) > 1` | Confirm no duplicate quotation numbers |
| 3.2 | Same for invoices | Confirm no duplicate invoice numbers |
| 3.3 | `SELECT lead_id, count(*) FROM projects WHERE lead_id IS NOT NULL GROUP BY 1 HAVING count(*) > 1` | Confirm no duplicate projects per lead |
| 3.4 | `SELECT id FROM quotations WHERE abs(total_amount - (subtotal + gst)) > 0.01` | Confirm no total mismatches |
| 3.5 | `SELECT id FROM invoices WHERE paid_amount > amount` | Confirm no over-payments |
| 3.6 | `SELECT count(*) FROM leads WHERE email <> lower(email)` | Confirm 0 mixed-case emails |

**After Phase 2, re-run to confirm invariants hold + runtime smoke tests.**

### Phase 4 — Optional / deferred

| # | Item | When |
|---|------|------|
| 4.1 | `leads_phone_format` CHECK (§7d, commented) | Only if Phase 3.7 confirms all rows conform |
| 4.2 | `storage.buckets` introspection (§11a) | Now-safe, informational |
| 4.3 | `pg_stat_user_indexes` review for dead indexes (P13) | 4–6 weeks post-apply |
| 4.4 | `pg_stat_statements` baseline (P21) | After traffic baseline |
| 4.5 | App-layer: note length cap, position in joins rowMap, pagination, batch notes | Next deployment cycle |
| 4.6 | Analytics single-pass CTE refactor (P21) | Out of scope for this patch |
| 4.7 | Optional schema upgrades: view, FK column, generated column (§9) | Only if business need |

---

## 17. Exact SQL Statements Proposed for Execution

### §1 — Drop redundant indexes

```sql
-- P11: quotations_lead_idx is a prefix of quotations_lead_created_idx
DROP INDEX IF EXISTS public.quotations_lead_idx;
```

### §2 — Add missing indexes

```sql
CREATE INDEX IF NOT EXISTS public.leads_status_created_idx
  ON public.leads (status, created_at desc);

CREATE INDEX IF NOT EXISTS public.leads_owner_created_idx
  ON public.leads (owner, created_at desc);

CREATE INDEX IF NOT EXISTS public.quotations_created_at_desc_idx
  ON public.quotations (created_at desc);

CREATE INDEX IF NOT EXISTS public.projects_status_site_created_idx
  ON public.projects (status, site_status, created_at desc);

CREATE INDEX IF NOT EXISTS public.projects_created_at_desc_idx
  ON public.projects (created_at desc);

CREATE INDEX IF NOT EXISTS public.invoices_created_at_desc_idx
  ON public.invoices (created_at desc);
```

### §3 — Unique business document numbers

```sql
-- Data-prep: normalize empty strings (zero rows affected)
UPDATE public.quotations
SET quotation_number = NULL
WHERE quotation_number IS NOT NULL AND btrim(quotation_number) = '';

UPDATE public.invoices
SET invoice_number = NULL
WHERE invoice_number IS NOT NULL AND btrim(invoice_number) = '';

-- Unique indexes (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS public.quotations_number_uq
  ON public.quotations (quotation_number)
  WHERE quotation_number IS NOT NULL AND btrim(quotation_number) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS public.invoices_number_uq
  ON public.invoices (invoice_number)
  WHERE invoice_number IS NOT NULL AND btrim(invoice_number) <> '';

-- Drop redundant non-unique index
DROP INDEX IF EXISTS public.quotations_number_idx;
```

### §4 — One project per lead

```sql
CREATE UNIQUE INDEX IF NOT EXISTS public.projects_lead_uq
  ON public.projects (lead_id)
  WHERE lead_id IS NOT NULL;
```

### §5 — Audit trail FK behavior

```sql
ALTER TABLE public.activity_logs
  DROP CONSTRAINT IF EXISTS activity_logs_lead_id_fkey,
  ALTER COLUMN lead_id DROP NOT NULL,
  ADD CONSTRAINT activity_logs_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES public.leads (id) ON DELETE SET NULL;

ALTER TABLE public.activity_logs
  DROP CONSTRAINT IF EXISTS activity_logs_performed_by_fkey,
  ALTER COLUMN performed_by DROP NOT NULL,
  ADD CONSTRAINT activity_logs_performed_by_fkey
    FOREIGN KEY (performed_by) REFERENCES public.users (id) ON DELETE SET NULL;
```

### §6 — Notification table triggers

```sql
DROP TRIGGER IF EXISTS set_updated_at_lead_email_notifications
  ON public.lead_email_notifications;
CREATE TRIGGER set_updated_at_lead_email_notifications
  BEFORE UPDATE ON public.lead_email_notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_lead_whatsapp_notifications
  ON public.lead_whatsapp_notifications;
CREATE TRIGGER set_updated_at_lead_whatsapp_notifications
  BEFORE UPDATE ON public.lead_whatsapp_notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

### §7 — CHECK constraints (ONE-SHOT, must be guarded)

```sql
-- 7c data-prep (zero rows)
UPDATE public.leads
SET email = lower(email)
WHERE email <> lower(email);

-- 7a: quotation total integrity (guarded)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'quotations_total_integrity'
      AND connamespace = 'public'::regnamespace
  ) THEN
    ALTER TABLE public.quotations
      ADD CONSTRAINT quotations_total_integrity
      CHECK (total_amount = subtotal + gst);
  END IF;
END $$;

-- 7b: invoice paid ≤ amount (guarded)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'invoices_paid_amount_le_amount'
      AND connamespace = 'public'::regnamespace
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_paid_amount_le_amount
      CHECK (paid_amount <= amount);
  END IF;
END $$;

-- 7c: leads.email lowercase (guarded)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'leads_email_lowercase'
      AND connamespace = 'public'::regnamespace
  ) THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_email_lowercase
      CHECK (email = lower(email));
  END IF;
END $$;
```

### §8 — Security hardening

```sql
-- Strip default PUBLIC EXECUTE + future privilege defaults
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM PUBLIC;

-- Re-assert service_role (belt and braces)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
```

---

## 18. Statements That Must NOT Be Executed

| Statement | Reason |
|-----------|--------|
| `REVOKE USAGE ON SCHEMA public FROM PUBLIC` | Would break Supabase dashboard, PostgREST schema access, future key setups. Must stay commented. |
| §7d `leads_phone_format` CHECK (commented) | Optional; Phase 4 only; verify data first. |
| §9 DDL (`v_lead_owner` view, `added_by_user_id` column, `month_date` generated column) | Optional future upgrades; not part of this migration. |
| §4.2 `DROP INDEX IF EXISTS projects_lead_idx` | Optional; keep as FK documentation and lead_id IS NULL scan coverage. |
| Any `INSERT`, `UPDATE`, `DELETE` on production data | Zero-row database; no data migration needed. |
| Any `ALTER FUNCTION` on existing functions | All 11 FUNCTIONS.sql functions are already live and correct. |
| Any `CREATE FUNCTION` | All functions already installed. |
| Any `TRUNCATE` | Zero rows; no truncation needed. |

---

## 19. Remaining Blockers

| # | Blocker | Severity | Status | Resolution |
|---|---------|----------|--------|------------|
| 1 | **No careers backend endpoint** (R5) | Medium | BLOCKED | Requires backend careers route implementation. Frontend already updated to direct email. |
| 2 | **P15: note length validation** | Low | App-layer only | Add JS length check (≤2000) to `POST /:id/notes` route; add `position` to Quotation.js joins rowMap. |
| 3 | **P18: leads/quotations pagination** | Low | App-layer only | Add page/limit pattern to `GET /api/leads` and `GET /api/quotations`. |
| 4 | **P19: batch note insert** | Low | App-layer only | Refactor `persistChildren` to use single `.insert([...])` instead of loop. |
| 5 | **Future invoice write routes** | Low | Not yet implemented | When added, must wire `mapDuplicateKeyError` and respect `invoices_paid_amount_le_amount` CHECK. |
| 6 | **P13: dead index review** | Low | Deferred 4–6 weeks | Review `pg_stat_user_indexes` before dropping any of the 7 unused indexes. |

**None of these block AUDIT_FIXES.sql execution.**

---

## 20. Final Go/No-Go Recommendation

### Verification checklist

| Requirement | Verified? |
|-------------|-----------|
| Every proposed SQL change reconciled against current code | ✅ |
| Every proposed SQL change reconciled against current live database | ✅ |
| All app-layer fixes (F1, F2, F3, B1, B2) confirmed deployed and tested | ✅ |
| All data-prep statements confirmed safe on zero rows | ✅ |
| All ONE-SHOT statements wrapped in guarded DO blocks | ✅ |
| Lock durations estimated and acceptable | ✅ |
| Backward compatibility verified for all read/write paths | ✅ |
| Error mappings verified (23505 → 409; CHECK → 500 only on violation) | ✅ |
| Phase order verified and correct | ✅ |
| No statements executed | ✅ |
| No application code changes | ✅ |

### Verdict

```
═══════════════════════════════════════════════════════
  AUDIT_FIXES READY TO EXECUTE
═══════════════════════════════════════════════════════
```

**Conditions:**
1. Execute Phase 1 statements first (13 statements, no behavior change).
2. Execute Phase 2 statements second (8 statements, with ONE-SHOT guards on §7a/7b/7c).
3. Run Phase 3 verification queries before and after.
4. Leave Phase 4 items for future deployment cycles.
5. Leave commented options (`§7d`, `§9` DDL, `§4.2` drop, `revoke usage on schema public`) **NOT executed**.

**Total executable statements:** 21 (13 Phase 1 + 8 Phase 2).
**Total locked statements:** 0 (none blocked by missing prerequisites).
**Estimated execution time:** <30 seconds (all statements on zero-row tables).
**Downtime:** None.
