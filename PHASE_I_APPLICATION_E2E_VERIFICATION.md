# PHASE I — APPLICATION END-TO-END VERIFICATION

**Date:** 2026-08-16
**Scope:** Audit-only. No code modified. No AUDIT_FIXES.sql run. No data inserted/migrated/deleted. No B2 UPSERT RPCs invoked. No emails/WhatsApp messages sent.

---

## 1. Final Verdict

# PHASE I = FAIL

The application's data-access layer (repository) is incompatible with the installed `@supabase/postgrest-js` v2.x query-builder API, and the frontend admin CSRF chain is still broken. Both are production-blocking defects verified against the live environment with read-only probes. Per phase instructions, defects are documented below and **not fixed**.

---

## 2. Executive Summary of Blocking Defects

| ID | Defect | Impact | Verified |
|----|--------|--------|----------|
| R1 | `createRepository` calls `.eq/.in/.is/.order/.limit/.range` directly on the raw `from(table)` builder; in postgrest-js v2 these methods only exist **after `.select()`** | Every filtered read, sort, pagination, `findById`, `findOne`, `updateOne`, `findByIdAndUpdate`, `exists` with filter, and admin login/lead-detail path throws `TypeError: query.eq is not a function` / `query.order is not a function` | Live probe — `from('leads').eq === undefined`, `from('leads').order === undefined`, `.select('*').eq === function`; `Lead.find({status:'New'})` → TypeError |
| R2 | `Model.countDocuments` (static) is a named function expression that recursively calls itself, shadowing the module-level `countDocuments` helper | `RangeError: Maximum call stack size exceeded` on every `countDocuments` (bootstrap admin check, project pagination totals, export) | Live probe — RangeError in 4 ms; direct `from('users').select(head).count` returns `count=0` (control OK) |
| R3 | Frontend admin clients never send `X-CSRF-Token`; backend `csrfProtection` requires cookie==header for every unsafe admin route | Every admin write (convert to project, status/owner update, notes, project CRUD, logout) returns `403 CSRF_INVALID` through the admin proxy | Static chain audit — `LeadsClient/quotations/projects/revenue` `fetch()` calls carry no `x-csrf-token`; `admin-proxy` only forwards it if the browser sends it |
| R4 | Capabilities estimator posts a nested payload to `/api/public/leads`; backend `validateCreateLead` requires flat `contactPerson/email/companyName/phone/message` | Estimator submissions return 400 `VALIDATION_FAILED`; the page's fail-safe still shows "success", so leads are silently dropped | Static audit of `capabilities-estimation/page.tsx` payload vs `leadValidation.js` |
| R5 | Careers form is frontend-only; no backend endpoint persists it | Applications are never stored (client-side success message only) | Static audit of `CareersClient.tsx` `handleSubmit` |
| R6 | `/projects` references 5 gallery JPGs, 1 MP4 and 1 poster under `/public/projects/*` that do not exist; hero video `/hero-fabrication.mp4/.webm` missing | 404s on projects page media; hero video silently falls back to poster | Directory listing of `aken-frontend/public` |
| R7 | Local dev env missing `JWT_SECRET`, `RESEND_API_KEY`, `CORS_ORIGINS`, `BOOTSTRAP_*`, `QUOTATION_GENERATE_PDF`, etc. | Local login/journaling muted; email notifications skipped locally; production platform vars not verifiable from this machine | Env presence probe (names only) |

---

## 3. Backend Write-Path Audit

All routes were inspected end-to-end. "Repository method" column reflects `createRepository` (Mongoose-compatible wrapper over Supabase PostgREST). Tables/constraints are from `supabase/SCHEMA.sql` (15 tables, verified present, 0 rows).

| Route | HTTP | Table(s) | Repo method(s) | Required / key columns | FKs | CHECK / UNIQUE constraints | Server-side validation | Expected success | Expected DB error | HTTP mapping |
|---|---|---|---|---|---|---|---|---|---|---|
| `POST /api/leads` | leads, lead_notes, lead_email_notifications, lead_whatsapp_notifications | `Lead` ctor + `save()` (INSERT), `persistChildren` (notes join + sub-table upsert RPCs) | contact_person, email, company_name, phone, message; optional service fields + attribution | owner_id → users (set null) | leads_contact/email/company/phone/message length, status enum, deal_value/probability ranges | `validateCreateLead` (required fields, email/phone regex, attribution lengths, estimatedTonnage > 0) | 201 `{leadId, owner, ownerId}` | 23505 n/a; FK 23503 if owner_id invalid; CHECK violations | 400 VALIDATION_FAILED; 500 LEAD_CREATE_FAILED |
| `GET/POST /api/leads/analytics/summary` | leads (RPC `lead_analytics_summary`) | `Lead.aggregate` → RPC | — | — | — | query param clamps (months 3–24, source/owner limit 3–20) | 200 analytics | RPC error | 500 LEAD_ANALYTICS_FETCH_FAILED |
| `GET /api/leads` | leads | `Lead.find().sort({createdAt:-1})` | — | — | — | admin session + role | 200 list | — | **BROKEN (R1): `query.order is not a function`** |
| `GET /api/leads/:id` | leads (+notes, notification joins) | `Lead.findById(...).lean()` | — | — | — | admin session + role | 200 doc | — | **BROKEN (R1): `query.eq is not a function`** |
| `PUT /api/leads/:id/status` | leads | `Lead.findByIdAndUpdate` | status | — | status enum | `validateLeadStatusUpdate` | 200 doc | — | **BROKEN (R1)** — csrf also required (R3) |
| `PUT /api/leads/:id/owner` | leads, users | `resolveLeadOwnerAssignment` (`User.findOne({_id, role})` filtered) + `Lead.findByIdAndUpdate` | owner, owner_id, owner_assigned_at | owner_id → users | owner length | `validateLeadOwnerUpdate` + owner resolution | 200 doc | 400 invalid owner | **BROKEN (R1): `User.findOne` filter throws** — csrf (R3) too |
| `PUT /api/leads/:id` | leads | `Lead.findByIdAndUpdate` | — | — | — | `validateLeadUpdate` (status/owner/attribution locked) | 200 doc | — | **BROKEN (R1)** — csrf (R3) |
| `POST /api/leads/:id/notes` | lead_notes | `Lead.findById` then `save()` (UPDATE) + `persistChildren` | text, added_by | lead_id → leads (cascade) | lead_notes_text_length ≤ 2000, added_by ≤ 80 | note text required (400 INVALID_NOTE) | 200 | — | **BROKEN (R1)** — csrf (R3) |
| `POST /api/leads/:id/notifications/retry` | leads, lead_email_notifications | `Lead.exists` (select-then-eq ⇒ OK) + worker `sendLeadNotificationEmails` (`Lead.findById` ⇒ BROKEN) | — | — | — | admin + csrf + limiter | 200 | 404 missing lead; 500 worker error | **BROKEN at worker `Lead.findById` (R1)** — csrf (R3) |
| `POST /api/leads/:id/whatsapp/retry` | leads, lead_whatsapp_notifications | same pattern | — | — | — | same | 200 | — | **BROKEN at worker `Lead.findById` (R1)** — csrf (R3) |
| `GET /api/leads/client/:quotationNumber` | quotations | `Quotation.findOne({quotationNumber})` | quotation_number | — | unique `quotations_number_uq` | admin + role | 200 | — | **BROKEN (R1): filtered `findOne`** |
| `GET /api/projects` | projects (+leads, quotations populate) | `Project.find(filter).populate(...).sort().skip().limit()` + `countDocuments` | — | lead_id/quotation_id FK (set null) | projects_status/site_status/name lengths, progress range, money ≥ 0 | status/siteStatus/leadId/quotationId filter validation; page/limit clamps | 200 paged | — | **BROKEN (R1 + R2)** |
| `GET /api/projects/summary` | projects (RPC `project_summary`) | `Project.aggregate` → RPC | — | — | — | admin | 200 summary | — | OK (RPC live-tested, Phase H) |
| `GET /api/projects/margin/overview` | projects, invoices (RPC `invoice_totals`) | `Project.find().select().lean()` (no filter ⇒ OK) + `Invoice.aggregate` → RPC | — | — | — | admin | 200 | — | OK |
| `GET /api/projects/:id` | projects (+populates) | `Project.findById(...)` | — | — | — | admin | 200/404 | — | **BROKEN (R1)** |
| `GET /api/projects/:id/margin` | projects, materials, labour_entries, boq_entries, invoices | `Project.findById`; `Material/Labour/BOQ/Invoice.find({projectId})` | — | project_id FKs | — | admin | 200/404 | — | **BROKEN (R1)** |
| `POST /api/projects` | projects | `Project.create` (INSERT + beforeSave guards) | project_name, client_name, project_value; leadId/quotationId optional | lead_id/quotation_id FK (set null); UNIQUE `projects_lead_uq` (partial) | projects_status/site_status, progress_range, money ≥ 0 | `projectPayloadFromBody` (names, status enums, money ≥ 0, progress 0–100, valid dates, valid ids) | 201 doc | 23505 lead | 409 DUPLICATE_PROJECT_FOR_LEAD (B1) | INSERT works live; 409 mapping correct |
| `POST /api/projects/from-lead/:leadId` | projects, leads | `Lead.findById` ⇒ BROKEN before `createProjectSafely` | — | projects_lead_uq | lead status must be Closed (409 LEAD_NOT_CLOSED) | valid leadId (400) | 200/201 `{alreadyExists, project}` | 23505 | 409 DUPLICATE_PROJECT_FOR_LEAD | **BROKEN (R1) at `Lead.findById`** — csrf (R3) |
| `PUT /api/projects/:id` | projects | `Project.findByIdAndUpdate` | — | projects_lead_uq | — | `projectPayloadFromBody` | 200/404 | 23505 | 409 (B1) | **BROKEN (R1)** — csrf (R3) |
| `POST /api/quotations` | quotations, quotation_items | `Quotation.create` (INSERT + beforeSave total integrity + persistChildren items) | items[].description/quantity/rate/amount; subtotal/gst/totalAmount derived | lead_id → leads (set null) | CHECK `quotations_total_integrity` where present; status enum; money ≥ 0; item qty > 0 | `quotationValidation` (F1) | 201 doc | 23505 number | 409 DUPLICATE_QUOTATION_NUMBER (F2) | INSERT works; F2 mapping correct |
| `POST /api/quotations/:id/convert` | quotations, leads, projects | `Quotation.findById` ⇒ BROKEN | — | projects_lead_uq | — | admin + csrf + limiter | 200/201 `{alreadyExists, project}` | 23505 | 409 DUPLICATE_PROJECT_FOR_LEAD (F3) | **BROKEN (R1) at `Quotation.findById`** — csrf (R3) |
| `POST /api/auth/login` | users | `User.findOne({email}).select("+passwordHash")` | email, password_hash | — | UNIQUE users_email_uq; role enum ('admin','sales') | identifier+password required; bcrypt compare | 200 `{role, csrfToken}` + cookies | — | **BROKEN (R1): filtered `findOne` throws, plus `User.updateOne` (R1), plus JWT_SECRET missing locally (R7)** |
| `POST /api/auth/logout` | — | JWT/cookie clear + csrfProtection | — | — | — | session + csrf | 200 | — | csrf required (R3); proxy forwards only if header present |
| `GET /api/auth/session` | — | JWT verify + fresh csrf cookie | — | — | — | session | 200 `{authenticated, user, csrfToken}` | — | OK |
| `POST /api/bootstrap/admin` | users | `User.countDocuments()` ⇒ **R2 RangeError** | name, email, password_hash, role | — | users_email_uq, password ≥ 12 | BOOTSTRAP_ADMIN_EMAIL allowlist, empty-DB or secret gate | 201 | — | **BROKEN (R2)** |
| `POST /api/bootstrap/admin-reset` | users | `User.findOne` + `save()` | — | — | — | ENABLE_ADMIN_RESET + token gate | 200/201 | — | **BROKEN (R2/R1)** (disabled by default) |
| Webhooks (health/receive) | — | none | — | — | — | bearer token | 200 | — | OK |
| `GET /api/system/env-check` | — | none | — | — | — | admin | 200 diagnostics | — | OK |
| `GET /api/export/:entity` | leads/quotations/projects/invoices | `find(filter).sort().lean()` (+populate) + `countDocuments` (pagination n/a here) | — | — | — | entity allowlist, csv-only | 200 CSV | — | **BROKEN (R1 + R2)** |

**Summary:** Only unfiltered `find()` (await-default select), `aggregate` (RPC dispatch), and `create` (INSERT) work against the real DB. Every filtered read, sort, pagination, detail read, update, and count is broken (R1/R2). This includes **admin login itself**.

---

## 4. Backend Read-Path Audit (empty DB semantics)

Verified read-only against the live Supabase database with the backend's own models (probe output preserved in audit notes):

- `Quotation.find().populate("leadId")` → `Array(0)` ✅ (await triggers default `select("*")`; populate is in-memory)
- `Project.find().select(...).lean()` (no filter/sort) → empty array ✅
- `Lead.find().sort({createdAt:-1})` → `TypeError: query.order is not a function` ❌ (R1)
- `Lead.findById(validUUID)` / `Project.findById` / `Quotation.findById` / `Invoice.findById` → `TypeError: query.eq is not a function` ❌ (R1)
- `Lead.findOne({_id:'not-a-uuid'})` → same TypeError (malformed-UUID handling is therefore unreachable: the builder throws before any UUID semantics; PostgREST 22P02 handling is never exercised) ⚠️
- `Project.find({status:'Planning'})`, `Lead.find({status:'New'})`, `Quotation.find({status:'Draft'})` → TypeError ❌ (R1)
- `Model.countDocuments({})` (all 15 tables) → `RangeError: Maximum call stack size exceeded` ❌ (R2); control `from('users').select('*', {count:'exact', head:true})` → `count=0` ✅ (proves DB is reachable and empty; defect is in the wrapper, not the DB)
- Analytics RPCs (`lead_analytics_summary`, `revenue_*_facet`, `project_summary`, `invoice_totals`, `owner_lead_load`, `least_loaded_sales_user`) — previously live-tested 9/9 (Phase H), unchanged. No Mongoose operators, `.populate()` incompatibilities, or Mongo-specific syntax are used in the RPC layer. ✅
- Empty collections are handled correctly **when** the underlying query executes (defaults/zero-fill in analytics routes, `null` for missing detail docs, empty array rendering in clients).

---

## 5. Validation Verification (no persistent data created)

Backend test suite (run live, see §9) plus route-level mock testing verified the following validation dimensions without touching the database:

| Scenario | Result | Evidence |
|---|---|---|
| Malformed UUIDs (leadId in quotation, lead/quotation/owner ids) | ✅ Rejected at middleware/routes with 400 (quotation leadId regex), 400 INVALID_LEAD_ID (from-lead), 400 owner hint | quotationValidation.test.js, projectRoutes validation tests |
| Malformed UUIDs via `findById` | ⚠️ Cannot reach PostgREST: repo throws `query.eq is not a function` first (R1) | live probe |
| Missing required fields (lead create, project create, note) | ✅ 400 with details list | validateCreateLead/projectPayloadFromBody/route tests |
| Invalid enums (status/siteStatus, invitation of project status) | ✅ 400 | route + schema CHECK constraints static audit |
| Invalid numeric values (projectValue < 0, probability < 0/>100, estimatedTonnage ≤ 0, progress outside 0–100) | ✅ 400 | middleware + projectPayloadFromBody |
| Invalid quotation totals (client-forged totalAmount) | ✅ 400-level sanitization + server recompute (F1) | quotationValidation.test.js |
| Duplicate-number handling (quotation/invoice) | ✅ 23505 → 409 mapping (unit) | duplicateKeyError.test.js (20+ asserts) |
| Duplicate-project-for-lead (create/update/from-lead race) | ✅ 409 DUPLICATE_PROJECT_FOR_LEAD (mocked HTTP) | projectDuplicateRoutes.test.js |
| Invalid ownership assignment (harmful owner hint) | ✅ 400 via resolveLeadOwnerAssignment | ownerAssignment static audit; **live blocked by R1** |
| Invalid pagination (page/limit clamps) | ✅ clamped server-side (1–5000 / 1–100) | static audit of parsePositiveInteger |

**Coverage gap:** The passing route-level tests (`projectDuplicateRoutes.test.js`, `notificationUpsert.test.js`) stub `supabaseClient` with a `FakeQueryBuilder` whose `.eq/.in/order/...` methods exist directly on `from()`. The real postgrest-js v2 builder does **not** — hence the suite passes while the live app is broken. The fake builder must match the real API surface (select-first chain) for tests to guard R1.

---

## 6. Previously-Fixed Defects Re-Verification

### F1 — Quotation totalAmount is server-derived ✅ CODE-CORRECT (unaffected by R1)
- `middleware/quotationValidation.js`: client `totalAmount` is **never read**; `computeQuotationTotals` derives `subtotal`, `gst`, `totalAmount`; sanitized body always overwrites `totalAmount`.
- `models/Quotation.js` `beforeSave: enforceTotalIntegrity` recomputes `totalAmount = roundMoney(subtotal + gst)` on every INSERT/UPDATE — persistence-boundary guarantee matching the DB CHECK constraint.
- Tests: `quotationTotals.test.js` (14 tests incl. forged totalAmount ignored), `quotationValidation.test.js` (5 F1-specific tests) — all pass.
- Reachable live: quotation CREATE uses `Quotation.create` (INSERT) which is functional. ✅

### F2 — SQLSTATE 23505 → HTTP 409 ⚠️ CODE-CORRECT BUT PARTIALLY UNREACHABLE
- `utils/duplicateKeyError.js` maps 23505 to `DUPLICATE_QUOTATION_NUMBER (409)` / `DUPLICATE_INVOICE_NUMBER (409)` / `DUPLICATE_PROJECT_FOR_LEAD (409)` with constraint-name + column parsing; unit-tested (20+ asserts), flat `{success:false, code, message}` envelope.
- Quotation create (INSERT) and `POST /api/projects` (INSERT) are live-functional, so their 409 mapping is reachable.
- Invoice writes and project update/from-lead paths are **unreachable live** because of R1 (findById/findOne fail before any insert), so F2 cannot fire on those paths until R1 is fixed.

### F3 — Concurrent lead/quotation project conversion ⚠️ CODE-CORRECT BUT UNREACHABLE LIVE
- `utils/projectConversion.js` `createProjectSafely`: try create → on 23505 re-read existing → `{alreadyExists:true, project}`; safety-net `{duplicateConflict:true}` → stable 409; winner-only side effects.
- Unit tests (8 tests) exercise the exact race with an in-memory stub — all pass.
- The two conversion routes both begin with `Lead.findById` / `Quotation.findById`, both broken by R1. F3 cannot execute against the real DB until R1 is fixed.

### B1 — Duplicate leadId project create/update → 409 DUPLICATE_PROJECT_FOR_LEAD ⚠️ PARTIAL
- HTTP-level tests (10) confirm create/update/from-lead race mapping with mocked models. Create path is live-reachable. Update/from-lead paths blocked by R1 (and from-lead additionally requires CSRF, R3).

### B2 — Notification UPSERT ⚠️ WIRING CORRECT; LIVE PATH BLOCKED BY R1
- `createRepository`: `buildUpsertRpcArgs` + `callUpsertRpc (INSERT … ON CONFLICT DO UPDATE)`; `Lead.js` configures `upsertRpc: upsert_lead_email_notification / upsert_lead_whatsapp_notification` with `incrementColumn: attempt_count`; `$set` of the increment column rejected (`DB_INCREMENT_UNSUPPORTED`); save() never clobbers counters.
- **Not invoked live** per phase instructions (static verification). Phase H confirmed both RPCs exist, execute as service_role, and privileges are restricted to service_role; `rls_auto_enable` is service_role-only; `ensure_rls` disabled.
- Tests: `notificationUpsert.test.js` (12 tests; concurrent retries ⇒ one row, merged counter, no 23505) — pass against the fake builder.
- Live note: the worker entry point `sendLeadNotificationEmails`/`sendLeadWhatsAppNotifications` first call `Lead.findById(leadId)` → broken by R1, so retries and post-create notifications cannot run against the real DB.

---

## 7. Frontend / Backend Contract Audit

| Frontend call | Method | Backend route | Payload shape | Auth/cookies | CSRF | Status |
|---|---|---|---|---|---|---|
| `/api/public/leads` (SmartEnquiryWizard) | POST | `/api/leads` (public create) | flat `{name?, company?, phone, email, serviceType, projectLocation, estimatedTonnage, projectType, timeline, notes, ...attribution}` — matches legacy keys `contactPerson||name`, `companyName||company`, `message||notes` | none | none needed | ✅ Contract matches; live blocked by R1 only if owner hint resolved (default auto-assign works: unfiltered `User.find` returns [] ⇒ Unassigned) |
| `/api/public/leads` (Capabilities estimator) | POST | `/api/leads` | **NESTED** `{source, page, leadType, contact:{email,phone,company,location}, project:{…}, estimate:{…}}` | — | — | ❌ **R4**: fails backend `validateCreateLead` (no flat contact fields) → 400; UI fail-safe hides the failure, dropping the lead |
| `/api/admin-login` | POST | `/api/auth/login` via proxy | `{identifier, password}` | forwards backend Set-Cookie (session + csrf) to browser | none (login exempt) | ✅ Envelope OK; **live login blocked by R1** (`User.findOne`) + local JWT_SECRET missing (R7) |
| `/api/admin-session` | GET | `/api/auth/session` | — | forwards Cookie | none | ✅ |
| `/api/admin-proxy/…` (all admin reads) | GET | `/api/leads|projects|quotations|revenue|export|system` | — | forwards Cookie | n/a (SAFE) | Reads: analytics RPCs OK; list/detail **broken by R1/R2** |
| `/api/admin-proxy/projects/from-lead/:id` (LeadsClient) | POST | `/api/projects/from-lead/:leadId` | `{}` | forwards Cookie | **NOT SENT** | ❌ **R3** (403 CSRF_INVALID) + R1 |
| `/api/admin-proxy/quotations/:id/convert` (Quotations page) | POST | `/api/quotations/:id/convert` | `{}` | forwards Cookie | **NOT SENT** | ❌ **R3** + R1 |
| Logout | — | no UI control exists; `/api/admin-logout` route forwards `x-csrf-token` only if present | — | — | header never supplied by UI | ❌ **R3** (login page/header/footer contain no logout affordance) |
| `/api/admin-logout` | POST | `/api/auth/logout` | — | forwards Cookie + optional CSRF | depends on caller | ⚠️ Route functional if a caller supplies the token; no caller does |

### CSRF chain status: **ORIGINAL DEFECT STILL PRESENT**
Chain walk:
1. `POST /api/admin-login` → backend responds with `Set-Cookie: aken_csrf=<token>` (httpOnly:false) and JSON body `{ role, csrfToken }`. The Next route forwards the `Set-Cookie` to the browser. ✅
2. `GET /api/admin-session` → backend issues a **fresh** csrf cookie + returns `csrfToken` in body. The Next route merges `{...data.data, authenticated:true}` and forwards cookies. ✅
3. `POST /api/admin-logout` → forwards `x-csrf-token` **if** the browser sent it; the admin UI never sends it. ⚠️
4. All admin writes via `admin-proxy` → the proxy forwards `x-csrf-token` only if present in the incoming request; the admin clients (`LeadsClient.tsx`, `admin/quotations/page.tsx`, `admin/projects/page.tsx`, `admin/revenue/page.tsx`) issue `fetch()` with **no `x-csrf-token` header** and **never read the `aken_csrf` cookie** (httpOnly:false precisely so JS could read it). Backend `csrfProtection` → `403 CSRF_INVALID`. ❌

Conclusion: the cookie issuance side is correct (double-submit cookie with per-session rotation), but the client half of the double-submit is missing. **The original CSRF defect remains: every unsafe admin request fails (or must be sent by hand with the token).**

### Careers submission — FRONTEND-ONLY ⚠️ FUNCTIONAL GAP
`CareersClient.tsx` handles submit purely in the browser: validates file ext/size and phone, then shows a success message and resets the form. No fetch to any endpoint; resume file is never transmitted; nothing is persisted. Production note in code acknowledges this ("hook this up to an API endpoint"). **Data would be silently lost.**

### Capabilities estimator — ⚠️ LEAD MAGNET BROKEN (R4)
`capabilities-estimation/page.tsx` `onSubmitLead` posts a nested payload that fails `validateCreateLead` (see §5/§7). The `catch` block deliberately sets `step("success")`, so users are told the estimate was sent even though the backend returned 400. **No lead is captured.**

### Quotation PDF attachment flow — ⚠️ CODE VALID, NOT LIVE-TESTED
- `POST /api/quotations` generates the PDF only when `QUOTATION_GENERATE_PDF !== "false"` AND `clientEmail` present AND `sendEmail.isEmailConfigured()` (RESEND_API_KEY set). `generateQuotationPDF` uses pdfkit (dependency present).
- Attachment payload `{ filename: "quotation.pdf", content: Buffer, contentType: "application/pdf" }` matches Resend's `attachments` schema.
- Because RESEND_API_KEY is not set locally, no real email was sent and the flow was not exercised end-to-end (per phase rules). If Resend rejects Buffer content, it would surface only in production.

### Missing media — ❌ CONFIRMED
`public/` contains only: `engineers-blueprint.jpg`, `hero-steel.jpg`, `logo/logo.svg`, `media/.keep`, plus framework SVGs. The projects page references:
- `/projects/peb-shed-erection-sambalpur.jpg`
- `/projects/steel-fabrication-workshop-cutting-welding.jpg`
- `/projects/structure-erection-crane-lifting.jpg`
- `/projects/roofing-cladding-industrial-shed.jpg`
- `/projects/puf-panel-installation-insulated-shed.jpg`
- `/projects/videos/crane-lifting-structure-erection.mp4` + poster `/projects/video-posters/crane-lifting-structure-erection.jpg`

None exist → 404s on the Projects page. Hero references `/hero-fabrication.mp4`/`.webm` (missing; poster fallback `/hero-steel.jpg` exists, so hero degrades gracefully but video never plays). The build succeeds because none of these are Next `Image` static imports requiring on-disk assets.

---

## 8. Email & WhatsApp Configuration Audit

### Email — ✅ Resend-only, no obsolete SMTP expectations
- `utils/sendEmail.js`: uses `resend` package; reads only `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_SENDER`; sender mailbox hard-enforced to `contact@aken.firm.in`. No `SMTP_*` variables anywhere in code. `leadEmailNotifications.js` reads `LEAD_ALERT_EMAILS` (+ legacy `EMAIL_USER` fallback).
- `getBackendEnvDiagnostics()` reports email status; gracefully skips when key missing (documented "Email notifications will be skipped").
- **No real emails sent** during this phase (workers call `sendEmail` only on live lead POST; none performed; tests stub the module).

### WhatsApp — ✅ consistent webhook design, no sends performed
- `utils/whatsappWebhook.js`: fetch POST to `WHATSAPP_WEBHOOK_URL` with `WHATSAPP_WEBHOOK_TOKEN` bearer, timeout `WHATSAPP_TIMEOUT_MS` (default 8000). Env vars `WHATSAPP_ADMIN_RECIPIENTS`, `WHATSAPP_SEND_CLIENT_ACK`, `DEFAULT_COUNTRY_CODE`.
- No real messages sent (no worker invoked). Webhook receiver authed via bearer, payload validated (channel/type/to/message/leadId), no PII logging.

---

## 9. Production Configuration Audit — Environment Variables (names only; values never printed)

Local probe of `aken-backend/.env` + current process env:

| Variable | Local file | Status |
|---|---|---|
| SUPABASE_URL | present | set ✅ |
| SUPABASE_SERVICE_ROLE_KEY | present | set ✅ |
| JWT_SECRET | **absent** | ❌ missing — admin login JWT signing/verification fails (min 32 chars enforced) |
| COOKIE_DOMAIN | absent | ⚠️ not set — OK by design (host-only `__Host-` cookie in prod) |
| CORS_ORIGINS / FRONTEND_URL | **absent** (dev) | ⚠️ local fallback localhost:3000/3001; production requires explicit allowlist |
| RESEND_API_KEY | **absent** | ❌ missing — all email notifications/PDF emails skipped |
| EMAIL_FROM | present | set ✅ |
| LEAD_ALERT_EMAILS | present | set ✅ |
| QUOTATION_GENERATE_PDF | absent | ⚠️ default `true` (PDF gen gated additionally by RESEND_API_KEY) |
| WHATSAPP_WEBHOOK_URL / TOKEN / ADMIN_RECIPIENTS | present | set ✅ |
| WHATSAPP_SEND_CLIENT_ACK | present (short bool) | set (validated as boolean-like by env diagnostics) |
| DEFAULT_COUNTRY_CODE | present (short) | set |
| BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_SECRET | **absent** | ⚠️ missing — bootstrap gated to empty-DB only (fine while 0 users, but no secret escape hatch) |
| ENABLE_ADMIN_RESET / ADMIN_RESET_TOKEN | **absent** | ✅ correctly disabled |
| NODE_ENV | **absent** (dev .env) | ⚠️ default development; prod value expected on platform |

Frontend `aken-frontend/.env.local`:

| Variable | Local file | Status |
|---|---|---|
| NEXT_PUBLIC_API_URL | present | set ✅ |
| BACKEND_API_URL | present | set ✅ |
| NEXT_PUBLIC_GA_ID / GOOGLE_ADS_ID / LEAD_LABEL | **absent** | ⚠️ GA/Ads tracking disabled |
| ADMIN_AUTH_SECRET | **absent** | ⚠️ legacy frontend auth helper only; production admin auth lives in backend (JWT cookie) — dev fallback exists |

Note: This audit reflects **local .env files only**. Production values live on the deployment platform (Render/Vercel) and cannot be inspected from this machine without revealing values. No placeholder values were found among the set vars; none were printed.

---

## 10. Test & Build Results

### Backend — `aken-backend`: `node --test tests/`
```
tests 76
suites 0
pass 76
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 7944.515
```
All suites green: duplicateKeyError (23), notificationUpsert (12), projectConversion (8), projectDuplicateRoutes (10), quotationTotals (14), quotationValidation (14). ✅
**Caveat (important):** passing tests do **not** reflect live DB behavior — `notificationUpsert.test.js` and `projectDuplicateRoutes.test.js` install a fake Supabase client whose builder exposes filter methods pre-`.select()`, masking R1/R2 (see §5 coverage gap).

### Frontend — `aken-frontend`
- `npm run lint` → **0 errors, 1 warning** (`<img>` usage in `src/app/page.js:241`, style-only warning). ✅
- `npm run build` (Next 16.1.6 Turbopack) → first run failed after my `.next` cleanup with an environment `EPERM rmdir .next\build\chunks` (OneDrive/dir lock); after re-running: **Compiled successfully 17.4s; TypeScript 13.5s; 29 routes generated; security env-check Passed.** ✅ (Build failure was a local file-lock artifact, not a code error.)
- No dedicated frontend test or `typecheck` script exists in `package.json`; `next build` runs the TypeScript type-check, which passed.

---

## 11. Remaining Blockers (ranked)

1. **[R1] Repository builder incompatibility** — `aken-backend/models/createRepository.js`: `buildBaseQuery()` applies filters/sort/range on the raw `from()` builder; `runUpdateOperation` applies `.eq` on the raw `.update()` builder; postgrest-js v2 exposes these only after `.select()`. Breaks: login, bootstrap, all detail reads, all filtered lists, pagination, exports, every admin update, conversion endpoints, notification workers, owner resolution.
2. **[R2] `countDocuments` infinite recursion** — static shadows module helper → RangeError everywhere counts are used (bootstrap, project pagination, exports).
3. **[R3] CSRF chain incomplete** — frontend never supplies `X-CSRF-Token`; all unsafe admin requests → 403 CSRF_INVALID; no logout control in UI.
4. **[R4] Capabilities estimator payload mismatch** — nested payload fails `validateCreateLead`; failure hidden by UI fail-safe → silent lead loss.
5. **[R5] Careers submissions not persisted** — frontend-only form.
6. **[R6] Missing media assets** — `/projects/*` images/video/poster and hero videos absent.
7. **[R7] Local env gaps** — `JWT_SECRET`, `RESEND_API_KEY`, `CORS_ORIGINS`, `BOOTSTRAP_*` missing from local `.env` (production platform vars not verifiable locally).

---

## 12. Exact Files Requiring Modification (audit only — NOT modified)

1. `aken-backend/models/createRepository.js` — ensure `select()` precedes any filter/sort/range chaining (`buildBaseQuery`, `runUpdateOperation`, `applySubTableUpdates` legacy path) and rename/refactor the static `countDocuments` (currently recursive).
2. `aken-frontend/src/app/admin/leads/LeadsClient.tsx`, `aken-frontend/src/app/admin/projects/page.tsx`, `aken-frontend/src/app/admin/quotations/page.tsx`, `aken-frontend/src/app/admin/revenue/page.tsx` — add `X-CSRF-Token` (from the `aken_csrf` cookie) to all unsafe requests, ideally via a shared fetch wrapper.
3. `aken-frontend/src/app/api/admin-logout/route.ts` + a new/updated admin UI logout control — supply the token and expose logout.
4. `aken-frontend/src/app/capabilities-estimation/page.tsx` — send a flat payload compatible with `validateCreateLead` (or add a dedicated backend endpoint).
5. `aken-frontend/src/app/careers/CareersClient.tsx` (and a new backend route/storage or removal of the fake-success UX).
6. `aken-frontend/public/projects/…` — add assets or remove references (see §7 missing media list).
7. `aken-backend/.env` (local dev only) — add `JWT_SECRET` (≥32 chars) and, for email, `RESEND_API_KEY`; confirm platform-level `CORS_ORIGINS`/`BOOTSTRAP_*` for production.
8. Test-fixture parity: `aken-backend/tests/notificationUpsert.test.js` / `projectDuplicateRoutes.test.js` — align the `FakeQueryBuilder` with the real postgrest-js select-first API surface so the suite can catch R1/R2.

---

## 13. Phase Compliance

- ✅ No `AUDIT_FIXES.sql` executed.
- ✅ No data inserted, migrated, or deleted (all probes read-only; counts=0 confirmed).
- ✅ No schema/function/privilege changes; `ensure_rls` untouched.
- ✅ B2 UPSERT RPCs never invoked (static verification only).
- ✅ No emails/WhatsApp messages sent; `QUOTATION_GENERATE_PDF` flow not triggered without a live write.
- ✅ Env values never printed; presence/status only.
- ⚠️ Frontend build initially failed due to a stale `.next` directory lock (EPERM), cleared and rebuilt successfully — environment artifact, not a code defect.
