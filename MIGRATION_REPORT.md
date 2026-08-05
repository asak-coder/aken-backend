# Phase 1 – Migration Report: MongoDB Atlas → Supabase PostgreSQL

**Date:** 2026-08-05
**Scope:** A K ENGINEERING backend (`aken-backend`) – full data layer migration
**Goal:** Replace MongoDB Atlas with Supabase PostgreSQL. No rewrite, no architecture change, no API contract change.

---

## 1. Execution Summary

| Area | Current (MongoDB) | Target (Supabase PostgreSQL) |
|---|---|---|
| Driver/ODM | Mongoose 9 | `@supabase/supabase-js` v2 |
| Connection | `utils/db.js` → `mongoose.connect(MONGO_URI)` | `utils/supabaseClient.js` (service-role client) |
| Models | 12 Mongoose schemas in `models/` | 12 PostgreSQL tables + repository modules in `models/` (same file paths, Mongoose-compatible API surface) |
| ID format | ObjectId (24-hex) | UUID v4 (textual) – exposed as `_id` string to clients, so the API contract is unchanged |
| Auth | bcrypt + JWT HttpOnly cookie (custom) | **Unchanged** – users table moved to PostgreSQL; login/CSRF/session flow preserved (Supabase Auth NOT adopted – see §7) |
| Files/GridFS | None | None – no storage migration required (see §6) |
| Transactions | None used | Added where beneficial for multi-table writes (quotation→project conversion) |

**Files that must change (backend only):**
- `package.json` (remove `mongoose`, add `@supabase/supabase-js`)
- `utils/db.js` (rewrite to Supabase bootstrap)
- `utils/envValidation.js` (MONGO_URI → SUPABASE_* checks)
- `models/*.js` (all 12 – rewrite as repositories; same export names/methods)
- `.env.example` (replace MONGO_URI with SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY)
- `user select("+passwordHash")` support → repository `select` flag passthrough

**Files that do NOT need to change (migration guarantee):**
- All `routes/*.js` except none – routes keep working because model method surface is preserved
- All `middleware/*` (validation happens at HTTP layer, not Mongo)
- All `utils/*` except `db.js` and `envValidation.js`
- Entire `aken-frontend/` (API contract preserved)

---

## 2. MongoDB Inventory

### 2.1 Collections / Models

| Model | Path | Purpose | Key fields | Relationships |
|---|---|---|---|---|
| User | `models/User.js` | Admin/sales auth | name, email (unique), passwordHash, role (admin/sales), lastLoginAt | – |
| Lead | `models/Lead.js` | Website enquiries + CRM | contactPerson, email, companyName, phone, message, serviceType, projectLocation, estimatedTonnage, projectType, timeline, 5×UTM fields, gclid/fbclid/msclkid, landingPage, referrerUrl, status, owner, ownerId→User, ownerAssignedAt, emailNotifications{}, whatsappNotifications{}, notes[], dealValue, probability | ownerId→User; notes embedded |
| ActivityLog | `models/ActivityLog.js` | Audit trail | leadId→Lead, action, performedBy→User | leadId, performedBy |
| Quotation | `models/Quotation.js` | Quotations | leadId→Lead, quotationNumber, items[], subtotal, gst, totalAmount, status, validTill | leadId; items embedded |
| Project | `models/Project.js` | Execution projects | quotationId→Quotation, leadId→Lead, projectName, clientName, projectOwner, projectValue, startDate, expectedCompletion, status, progressPercentage, budgetAllocated, budgetSpent, siteStatus, material/labour/equipment/other/dailyExpense costs, totalSpent | quotationId, leadId; `pre("save")` hook re-computes totalSpent/clamps progress |
| BOQ | `models/BOQ.js` | Bill of quantities | projectId→Project, description, boqQty, boqRate, actualQty, actualCost | projectId |
| Material | `models/Material.js` | Material tracking | projectId→Project, materialName, plannedQty, orderedQty, receivedQty, usedQty, rate | projectId |
| LabourEntry | `models/LabourEntry.js` | Labour tracking | projectId→Project, role, workers, workingDays, totalCost, outputQuantity | projectId |
| Invoice | `models/Invoice.js` | Invoicing | projectId→Project, invoiceNumber, amount, paidAmount, dueDate, status | projectId |
| Forecast | `models/Forecast.js` | Monthly forecast | month (unique), projectedRevenue, confirmedRevenue, cashInflow | – |
| Tender | `models/Tender.js` | Tenders | tenderName, client, estimatedValue, submissionDate, status, probability | – |

### 2.2 Indexes (must be reproduced in PostgreSQL)

- `leads`: `(ownerId, status)`, `(createdAt desc)`, `(utmSource, utmCampaign, createdAt desc)`, `(emailNotifications.adminNotifiedAt, createdAt desc)`, `(whatsappNotifications.adminNotifiedAt, createdAt desc)`
- `users`: unique `(email)`
- `projects`: `(quotationId)`, `(leadId)`, `(status, siteStatus)`
- `quotations`: `(leadId)`, `(status, createdAt desc)`, `(leadId, createdAt desc)`, `(quotationNumber)`, `(validTill)`
- `activity_logs`: `(leadId)`, `(performedBy)`
- `boq_entries`: `(projectId, createdAt desc)`
- `materials`: `(projectId, createdAt desc)`, `(projectId, materialName)`
- `labour_entries`: `(projectId, createdAt desc)`, `(projectId, role)`
- `invoices`: `(projectId, createdAt desc)`, `(status, createdAt desc)`, `(dueDate)`
- `forecasts`: unique `(month)`
- `tenders`: `(status, createdAt desc)`, `(submissionDate)`

### 2.3 Aggregation Pipelines (must be translated to SQL)

| Route | Entity | Pipelines |
|---|---|---|
| `GET /api/leads/analytics/summary` | Lead | 1× `$facet` → overview / statusDistribution / sourceDistribution / ownerDistribution / monthlyTrend / recentLeads |
| `GET /api/projects/summary` | Project | 1× `$group` → counts by status + sums |
| `GET /api/projects/margin/overview` | Project, Invoice | Project find-all + 1× Invoice `$group` |
| `GET /api/revenue/overview` | Lead, Quotation, Project, Invoice | 4× `$facet` → totals / sourceDistribution / stageDistribution / monthly |

All pipelines follow a narrow, repeated pattern: `$group` with `$sum/$cond/$ifNull/$multiply`, `$dateToString("%Y-%m")`, `$match` (createdAt ≥), `$sort`, `$limit`, `$facet`. These translate 1:1 to SQL `FILTER (WHERE ...)`, `to_char(date_trunc('month', created_at), 'YYYY-MM')`, and `GROUP BY` / window-free aggregates. **No `$lookup`, no `$unwind`, no `$geoNear`, no graphLookup** – nothing exotic.

### 2.4 Transactions

- **MongoDB:** none used.
- **PostgreSQL target:** single multi-statement transaction for `quotation → project` conversion (`/api/quotations/:id/convert`) and `lead → project` conversion (`/api/projects/from-lead/:leadId`) to guarantee atomicity. Lead create + notifications stays non-transactional (notifications are fire-and-forget by design).

### 2.5 Mongoose Hooks / Middleware

- `Project.pre("save")`: clamps `progressPercentage` to 0–100; recomputes `totalSpent` as sum of category costs (fallback `budgetSpent`); warns on budget exceed; forces 100%/Completed on `status === "Completed"`.
- **Migration:** reproduced inside the Project repository `create/update` paths (kept in one place, applied to both insert and update).

### 2.6 Validation Rules

Validation lives in HTTP middleware, not in Mongo:
- `leadValidation.js`: regexes for email/phone/owner, length caps, status enum, update-field allowlist.
- `quotationValidation.js`: item count ≤200, description ≤500, qty >0 ≤1e6, rate cap, GST default 18% cap 28%, backend-computed subtotal/gst/total.
- `projectRoutes.js projectPayloadFromBody`: sanitizeText, money parsers, status/siteStatus enums, ObjectId checks.

**Migration impact:** none of these reference Mongo. The only Mongo-isms are the "is ObjectId" checks (`/^[a-fA-F0-9]{24}$/`, `mongoose.Types.ObjectId.isValid`). UUIDs (36-char) would fail these checks → **must update**:
- `quotationValidation.js` `isValidObjectIdLike` → accept 24-hex **or** UUID v4.
- `projectRoutes.js` `isValidObjectId` → same.
- `ownerAssignment.js` `mongoose.Types.ObjectId.isValid(hint)` → UUID regex.
- `quotationValidation.js` passes `leadId` through as string – fine.

### 2.7 Pagination / Search

- Projects list: `?page=&limit=` (default 20, max 100) + filters `status`, `siteStatus`, `leadId`, `quotationId` → PostgreSQL `OFFSET/LIMIT` + parameterized `WHERE`.
- Exports (CSV): filters `status`, `owner`, `source` per entity → parameterized SQL.
- **No free-text search exists server-side** (frontend `projects` public page uses static content; careers/estimator are frontend-only). No full-text index required. `materialName` prefix search on `(projectId, materialName)` is covered by the index.

### 2.8 Repository / Service Layer

None – routes use models directly. The **model files become the repository layer** (thin Supabase adapters). This preserves every `require("../models/X")` import and every `Model.method()` call site.

---

## 3. API Contract (must remain identical)

| Concern | MongoDB today | PostgreSQL target |
|---|---|---|
| Primary key in JSON | `_id` (24-hex string) | `_id` (UUID string) – serialized from `id` column |
| Date fields | ISO strings (Mongoose → JSON) | ISO strings (Postgres timestamptz → JSON) |
| Response envelope | `{ success, data, requestId }` via `sendSuccess` | unchanged |
| Rich objects on lists | `populate("leadId")` → nested object | repository join → nested object with same keys (`_id`, `contactPerson`, `companyName`, `email`, `status`, `owner`, …) |
| Lead `notes` | embedded array | separate `lead_notes` table joined into `notes` |
| Notification sub-objects | `emailNotifications`, `whatsappNotifications` embedded | separate 1:1 tables joined into the same sub-object shape |
| Export CSV formats | stable | unchanged (serializer consumes repository output) |

**Backward compatibility note:** old 24-hex ObjectIds in existing Atlas data would be invalid UUIDs. The data migration script (Phase 7) maps each old ObjectId to a deterministic new UUID and rewrites all references using a lookup map, so relationships survive. The Mongo `_id` values are NOT preserved exactly (Postgres `uuid` requires 8-4-4-4-12); use the anon-key pattern if URLs leak IDs – they don't (frontend only uses IDs in API calls, not public URLs).

---

## 4. Data Shape Changes (Mongo embedded → Relational)

| Mongo embedded | PostgreSQL |
|---|---|
| `Lead.notes[]` | `lead_notes` table (1:N) |
| `Lead.emailNotifications{}` | `lead_email_notifications` table (1:1) |
| `Lead.whatsappNotifications{}` | `lead_whatsapp_notifications` table (1:1) |
| `Quotation.items[]` | `quotation_items` table (1:N) |

Everything else maps to direct columns. `lastErrorDetails` (Mixed JSON) → `jsonb` column.

---

## 5. File Storage Evaluation

- **GridFS:** not used.
- **Local disk uploads:** none on backend (no multer/gridfs references).
- **Quotation PDFs:** generated in-memory (pdfkit) and attached to Resend emails – never persisted.
- **Frontend media:** static files under `aken-frontend/public/media` served by Vercel/Next – not stored in MongoDB.
- **Conclusion:** Supabase Storage migration is **not required**. No code changes. Documented for completeness only.

---

## 6. Authentication Migration Decision

**Decision: keep the existing custom auth (bcrypt + JWT HttpOnly cookie + CSRF), store users in the PostgreSQL `users` table.**

Rationale:
- Login flow is deeply integrated: Express `POST /api/auth/login`, JWT signed with `JWT_SECRET`, cookie `__Host-aken_admin_session` set via `Set-Cookie` through the Next.js `admin-login` route, CSRF double-submit cookie pattern, Edge-middleware session check via `admin-session`.
- Supabase Auth would change cookie names, session validation, and the login API → frontend changes and a new credential-migration path for existing bcrypt hashes. The task priorities are "preserve existing login behavior" and "no API changes" – custom auth in PostgreSQL satisfies both.
- `bcrypt` hashes migrate as-is (same algorithm, no rehash needed).
- Any later switch can be additive: keep `users` rows and add `supabase_auth_id` mapping.

Roles/permissions are already modeled (`role: admin|sales`) with `requireRole` middleware – moved to a `CHECK` constraint + app-level enforcement (unchanged).

---

## 7. Security Posture (post-migration)

- RLS enabled on all tables; default policy = **deny**. Service-role key used by the backend (bypasses RLS); `authenticated` role granted read to non-sensitive aggregated views if ever needed; `anon` gets nothing.
- Parameterized queries via Supabase client (no string-built SQL from user input; any raw SQL uses bind params).
- Secrets: `SUPABASE_SERVICE_ROLE_KEY` server-side only; `NEXT_PUBLIC_*` never exposes it; `.env` gitignored; `envValidation.js` fails startup in production if critical Supabase vars are missing.
- Least privilege: app user runs with service role (required for RLS bypass). Storage not in use.
- Audit: `activity_logs` table already exists; extended audit events for admin mutations are additive and out of scope.

---

## 8. Performance Plan

- Indexes replicated from §2.2 with matching key order (PostgreSQL B-tree).
- `leads.owner_id` + `leads.status` composite for the owner-load-balancer query.
- Analytics queries rewritten as single-pass SQL with `FILTER` clauses + `date_trunc`/`to_char` – avoids the multi-pass `$facet` overhead and will be **faster**, with fewer round-trips.
- `populate` implemented as single bulk `IN` join per list call (no N+1).
- Pagination uses keyset-friendly `OFFSET/LIMIT` (same semantics as Mongo skip/limit).
- `gin` index optional on `last_error_details jsonb` only if needed – not in initial schema.

---

## 9. Risk Register

| Risk | Mitigation |
|---|---|
| Route code depends on Mongoose method surface | Repositories replicate `find/findById/create/findOne/findByIdAndUpdate/updateOne/exists/countDocuments/aggregate` + chainable `.populate/.select/.sort/.lean` |
| `_id` type change (ObjectId→UUID) | `id` column + serializer emits `_id`; ID-validation middleware updated to accept UUID |
| Aggregation pipelines | Only 4 unique pipeline shapes, all `$facet/$group/$dateToString` – deterministic SQL translation |
| Embedded docs (notes, items, notifications) | Normalized tables + repository joins that rebuild the exact Mongo document shape |
| Project `pre("save")` business logic | Reproduced in repository write paths, unit-tested |
| Data migration correctness | Deterministic ObjectId→UUID map; idempotent upserts; validation step |
| Backend boot behavior | `connectToDatabase()` ping checks Postgres connectivity; fail-fast on missing `SUPABASE_URL`/service-role key |

---

## 10. Deliverable Checklist (this task)

- [x] Phase 1 – this report
- [ ] Phase 2 – `supabase/SCHEMA.sql` (DDL + indexes + RLS + views)
- [ ] Phase 3 – Supabase client + env config (`.env.example`, `envValidation.js`, `db.js`, `supabaseClient.js`)
- [ ] Phase 4 – Repository rewrite of `models/*` (12 files) preserving method surface
- [ ] Phase 5 – Auth migration (users in PG; login unchanged)
- [ ] Phase 6 – Storage: N/A (documented)
- [ ] Phase 7 – `scripts/migrate/*` export/transform/import + validation
- [ ] Phase 8 – Performance (indexes, join strategy, analytics SQL)
- [ ] Phase 9 – Security (RLS, service role, ID validation update)
- [ ] Phase 10 – Testing report + boot verification
