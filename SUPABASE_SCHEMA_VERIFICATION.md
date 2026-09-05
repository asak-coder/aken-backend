# SUPABASE SCHEMA VERIFICATION

**Date:** 2026-08-13 (UTC probe 2026-08-13T06:27:58Z)
**Result:** **SCHEMA VERIFICATION FAILED**
**Mode:** Read-only verification only. No DDL, no DML, no test data, no corrections. No `FUNCTIONS.sql`, no `AUDIT_FIXES.sql`, no Phase 1/2 SQL executed.

---

## 1. Execution Status

| Item | Finding |
|---|---|
| Task premise | `supabase/SCHEMA.sql` executed successfully in the Supabase Dashboard SQL Editor |
| Live corroboration | **NOT corroborated** — the live database does not contain the schema objects |
| Direct Postgres catalog check | **Blocked** — `DATABASE_URL` password in `aken-backend/.env` is rejected (`SQLSTATE 28P01`, documented in `SUPABASE_SCHEMA_INITIALIZATION.md`) |
| PostgREST read-only probe (service-role) | **Completed** — conclusive: schema objects absent |
| Project verified | `garrlnwamcwnypjrsfji` (project URL in task = `SUPABASE_URL` in `.env`; service-role key decodes to this ref) |

---

## 2. Table Verification (FAIL)

- **Expected tables:** 15
- **Live tables found:** **0**
- Expected list present? **No — all 15 absent** (every table returns `404 PGRST205` = not in schema cache/absent):

`leads`, `projects`, `quotations`, `invoices`, `users`, `materials`, `labour_entries`, `forecasts`, `activity_logs`, `boq_entries`, `tenders`, `lead_email_notifications`, `lead_whatsapp_notifications`, `lead_notes`, `quotation_items`

- **Unexpected application tables:** none (no unexpected relations in the OpenAPI root either)

This matches the pre-execution baseline exactly (`SUPABASE_NEW_PROJECT_BASELINE.md`: 15/15 absent), not a post-execution state.

## 3. Index Verification (NOT VERIFIABLE — tables absent)

- Expected: 32 total indexes, 2 unique (`users_email_uq`, `forecasts_month_uq`)
- Live: **not measurable** — no tables exist to hold indexes.
- Catalog query blocked by `28P01`; PostgREST does not expose index metadata.

## 4. Foreign Keys (NOT VERIFIABLE — tables absent)

- Expected: 14 FKs (`leads→users` SET NULL; `lead_email_notifications/lead_whatsapp_notifications/lead_notes→leads` CASCADE; `activity_logs→leads` CASCADE + `activity_logs→users` CASCADE; `quotations→leads` SET NULL; `quotation_items→quotations` CASCADE; `projects→quotations` + `projects→leads` SET NULL; `boq_entries/materials/labour_entries/invoices→projects` CASCADE)
- Live: **not measurable** — tables absent.

## 5. Triggers (NOT VERIFIABLE — tables absent)

- Expected: 10 (`set_updated_at_*` on users, leads, quotations, projects, boq_entries, materials, labour_entries, invoices, forecasts, tenders; function `public.set_updated_at()`)
- Live: **not measurable** — tables absent (trigger function existence requires catalog access).

## 6. Functions and Views (FAIL for view)

- `public.set_updated_at()`: **not verifiable** — requires direct catalog access (blocked `28P01`); PostgREST never exposes trigger functions, so no read-only REST check is possible.
- `v_lead_overview`: **MISSING live** — OpenAPI root does not expose it; `GET /rest/v1/v_lead_overview` → 404 PGRST205.
- Confirmed no confusion with `FUNCTIONS.sql`; no analytics RPCs were probed or invoked.

## 7. RLS Verification (NOT VERIFIABLE — tables absent)

- Expected: RLS enabled on 15 tables, 0 policies (intentional — service-role backend)
- Live: **not measurable** — tables absent.

## 8. Grants (NOT VERIFIABLE — tables absent)

- Expected: `anon`/`authenticated` revoked; `service_role` granted ALL on tables/functions/sequences in `public`
- Live: **not measurable** — no application objects exist to hold grants. No grants were modified.

## 9. Data Verification (N/A — tables absent)

- Expected: 0 rows in every application table
- Live: **not measurable** — tables absent (counts would be 0 only because nothing exists).

## 10. Repository Compatibility (static — PASS, unchanged from baseline)

Compared live schema expectations vs `aken-backend/models/*` + `models/createRepository.js`.
No code modified. All 11 repositories require exactly the 15 tables above:

| Code model | Expected table(s) | Status |
|---|---|---|
| Lead.js | `leads`, `lead_notes`, `lead_email_notifications`, `lead_whatsapp_notifications` | ✓ (static; requires the absent tables live) |
| Project.js | `projects` | ✓ static |
| Quotation.js | `quotations`, `quotation_items` | ✓ static |
| Invoice.js | `invoices` | ✓ static |
| Material.js | `materials` | ✓ static |
| LabourEntry.js | `labour_entries` | ✓ static |
| Forecast.js | `forecasts` | ✓ static |
| ActivityLog.js | `activity_logs` | ✓ static |
| User.js | `users` | ✓ static |
| BOQ.js | `boq_entries` | ✓ static |
| Tender.js | `tenders` | ✓ static |
| createRepository.js | All (PostgREST service-role) | ✓ static |

Static mapping compatibility is **not sufficient** — the live tables the repositories target do not exist.

## 11. Deviations

1. **CRITICAL — All 15 expected tables are absent live** (PGRST205 on every table). The live database is in the exact pre-execution baseline state, contradicting the task premise that `SCHEMA.sql` executed successfully in the SQL Editor.
2. `v_lead_overview` view absent live.
3. Counts for indexes/FKs/triggers/RLS/policies/grants cannot be confirmed (objects do not exist; catalog access also blocked).

## 12. Warnings

1. **Likely cause of mismatch:** `SCHEMA.sql` may have been executed in a *different* Supabase project than `garrlnwamcwnypjrsfji`, or the SQL Editor run may not have targeted/committed to this project's `public` schema. PostgREST refreshes its schema cache automatically on DDL; a stale cache over 30+ hours is implausible. PGRST205 (table absent) is distinct from a permissions error — it is not a grants/RLS issue.
2. **Known credential blocker:** `aken-backend/.env` `DATABASE_URL` password fails (`28P01`); documented in `SUPABASE_SCHEMA_INITIALIZATION.md` / `supabase/backups/README.md`. Direct-SQL verification is impossible until a valid Postgres password for `db.garrlnwamcwnypjrsfji.supabase.co` is supplied (or verification queries are run in the Dashboard SQL Editor).
3. No secrets are included in this report.
4. Nothing was modified: no tables, no data, no grants, no functions, no views.

---

## Final Gate

**SCHEMA VERIFICATION FAILED**

All verification stopped here per the task policy — `FUNCTIONS.sql` was NOT run, no corrections were made, no test data was inserted.
