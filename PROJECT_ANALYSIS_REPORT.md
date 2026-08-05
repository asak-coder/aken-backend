# A K ENGINEERING — Full Project Analysis & Architecture Report

**Generated:** 5 Aug 2026
**Scope:** Complete source-code audit of `aken-backend` + `aken-frontend` + root docs/artifacts.
**Method:** Every file in the repository was read (no assumptions; only source-code-verified findings). Config files `.env` / `.env.local` (secret-bearing) were intentionally not read; their existence is noted.

---

# PHASE 2 — ARCHITECTURE REPORT

## 1. Executive Summary

This is a two-part industrial B2B web system for A K ENGINEERING (industrial EPC / PEB / steel-fabrication contractor):

- **Frontend:** Next.js 16 (App Router) + React 19 + Tailwind CSS v4, deployed on Vercel. Marketing pages (home, about, services, projects, blog, contact, enquiry, privacy/terms, capabilities-estimator, careers) plus a protected admin dashboard (leads analytics, projects, quotations, revenue, system env-check).
- **Backend:** Express 4 (CommonJS) + MongoDB (Mongoose) + JWT-cookie auth, deployed on Render. Handles public lead intake (with email + WhatsApp notifications), admin auth, quotations, projects, revenue analytics, CSV exports, and an internal WhatsApp webhook receiver.

The codebase shows deliberate security-conscious engineering (helmet, rate limiting, CSRF middleware, input validation, env-leak prebuild scanner, `__Host-` cookies, allow-listed API proxy, CORS allowlist). However, several **critical integration bugs** currently make core flows non-functional:

1. **All admin write operations are broken (CSRF chain broken).** The backend issues session + CSRF cookies at login; the Next.js `/api/admin-login` route forwards only **one** `Set-Cookie` (the session cookie). `/api/admin-session` forwards **none**. Admin pages never send `X-CSRF-Token`. Result: every `POST/PUT` behind `csrfProtection` (convert lead→project, convert quotation→project, status/owner updates, notes, project creates/updates) returns `403 CSRF_INVALID`.
2. **`/capabilities-estimation` lead capture always fails.** It POSTs a nested payload (`contact`, `project`, `estimate`) that backend `validateCreateLead` cannot map (expects flat `name/email/phone/company/notes`). Backend returns 400; client catches and **shows a fake success message**. The estimator also visibly renders the internal price range ("hidden from user") — contradicting its own lead-gating design.
3. **Careers form submits nothing.** `CareersClient.handleSubmit` only validates then displays success; no fetch, no endpoint, no storage. User submissions (incl. resumes) are silently discarded.
4. **Quotation PDF attachment is never sent.** `quotationRoutes` builds `mailOptions.attachments`, but `sendEmail` (Resend) only forwards `from/to/subject/html/text/reply_to` — attachments are dropped. Emails say "attached quotation" with no attachment.
5. **Project/media assets are missing.** `/services` and `/projects` reference `/projects/*.jpg` and `/projects/videos/*.mp4` that do not exist in `/public` → broken images/videos site-wide; hero video sources `/hero-fabrication.*` also missing (poster fallback works).
6. **Email provider config mismatch.** Code requires `RESEND_API_KEY`; `.env.example`, `envValidation.js`, and the deployment checklist all document `SMTP_*` / `EMAIL_USER`/`EMAIL_PASS` (the old Nodemailer contract). Env diagnostics can report email "ok" while email is actually non-functional.

Beyond those, there is zero automated testing, no CI/CD, no Docker, no pagination on several admin GETs, an accidental nested `.git` at `aken-backend/aken-backend/.git`, a committed `lead-test.json` with a real phone number, CSV-injection risk in exports, PII logged to stdout, and a large amount of dead/duplicate code (unused chart components referencing non-existent lead statuses "Won/Qualified/Lost", unused `admin-proxy-middleware.ts`, unused backend `utils/analytics.ts`, unused `ActivityLog`/`Forecast`/`Tender` models, unused `Material`/`LabourEntry`/`BOQ`/`Invoice` CRUD — no endpoints exist to write these).

**Overall production readiness: 45–50/100.** The marketing site is near-ready; the admin/lead-quote operational loop is not.

## 2. Technology Stack

### Backend (`aken-backend`)
| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js (CommonJS) | — (Node >= 18 implied by `fetch`, `crypto.randomUUID`) |
| Framework | Express | ^4.18.2 |
| Database | MongoDB + Mongoose | ^9.2.1 |
| Auth | jsonwebtoken + bcryptjs | ^9.0.3 / ^3.0.3 |
| Security | helmet, cors, express-rate-limit, cookie-parser | ^8.1.0 / ^2.8.6 / ^8.2.1 / ^1.4.7 |
| Email | resend | ^6.9.4 |
| PDF | pdfkit | ^0.17.2 |
| Logging | morgan + custom JSON logger | ^1.10.1 |
| Env | dotenv | ^17.3.1 |
| Notifications | WhatsApp via generic webhook (Bearer token) + Resend email | — |

### Frontend (`aken-frontend`)
| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router, `/app`) | 16.1.6 |
| UI | React + react-dom | 19.2.3 |
| Styling | Tailwind CSS v4 (`@tailwindcss/postcss`) | ^4 |
| Charts | chart.js + react-chartjs-2 (only in unused components) | ^4.5.1 / ^5.3.1 |
| Language | TypeScript (strict) for most files; `.js` for `app/page.js` and legacy libs | — |
| Lint | ESLint 9 + `eslint-config-next/core-web-vitals` | ^9 / 16.1.6 |
| Env security | `scripts/check-public-env.mjs` runs in `prebuild` | — |

### Deployment
- Frontend → **Vercel** (`aken.firm.in`), backend → **Render** (`BACKEND_API_URL`). Documented in `DEPLOYMENT_ENV_CHECKLIST.md`.
- No Docker, no CI/CD pipeline files, no `.github/workflows`.

## 3. Folder Structure (verified)

```
NEW PROJECT/
├── .gitignore
├── AKEN_REDESIGN_PLAN.md
├── CONTENT_SYSTEM.md (inside frontend)
├── DEPLOYMENT_ENV_CHECKLIST.md
├── HANDOFF.md
├── lead-test.json                      ← committed test artifact (PII)
├── phase2-smart-project-enquiry.html   ← standalone static prototype (not in app)
├── aken-backend/
│   ├── .env (present, gitignored)
│   ├── aken-backend/.git               ← accidental nested git repo
│   ├── controllers/whatsappWebhookController.js
│   ├── middleware/{adminAuth,csrf,leadValidation,quotationValidation,rateLimiters,validateWhatsappWebhook,webhookAuth}.js
│   ├── models/{ActivityLog,BOQ,Forecast,Invoice,LabourEntry,Lead,Material,Project,Quotation,Tender,User}.js
│   ├── routes/{authRoutes,bootstrapRoutes,exportRoutes,integrationWebhookRoutes,leadRoutes,projectRoutes,quotationRoutes,revenueRoutes,systemRoutes}.js
│   ├── utils/{analytics.ts(UNUSED),apiResponse,authCookies,db,envValidation,generateQuotationPDF,leadEmailNotifications,leadWhatsAppNotifications,marginCalculator,ownerAssignment,requestLogger,sendEmail,whatsappWebhook}.js
│   └── server.js
└── aken-frontend/
    ├── .env.example / .env.local (present, gitignored)
    ├── middleware.ts
    ├── src/admin-proxy-middleware.ts    ← UNUSED (dead)
    ├── src/app/
    │   ├── layout.tsx, page.js, globals.css, robots.ts, sitemap.ts
    │   ├── admin/{page,login/leads/LeadsClient,projects,quotations,revenue,system}
    │   ├── api/{admin-login,admin-logout,admin-session,admin-proxy/[...path],public/leads}
    │   ├── about, blog/[slug], blog/slug (phantom), capabilities-estimation,
    │   │   careers(+CareersClient), contact, enquiry, privacy-policy, projects,
    │   │   services, terms-and-conditions
    ├── src/components/{AttributionTracker,GA4PageTracker,HeroMedia,KPICards(UNUSED),
    │   LazyMapEmbed,ProjectGallery,ProjectVideos,RevealOnScroll,RevenueChart(UNUSED),
    │   SalesFunnel(UNUSED),SiteFooter,SiteHeader,SmartEnquiryWizard,StatusDonutChart(UNUSED),
    │   TrackedAnchor,TrackedLink}.tsx
    ├── src/lib/{adminAuth,analytics,blog-data(+ 1 unused .md),contact,env,schema,utm}
    ├── scripts/check-public-env.mjs
    ├── public/{engineers-blueprint.jpg,hero-steel.jpg, logo/, media/}   ← NO /projects assets
```

## 4. Application Architecture

- **BFF/proxy pattern.** The browser only talks to the Vercel origin. Public lead form → `/api/public/leads` (route handler) → POSTs to Render `/api/leads` (blocks localhost target). Admin pages → `/api/admin-proxy/[...path]` (route handler) → forwards to `${BACKEND_API_URL}/api/...` with allow-listed prefixes (`/system`, `/leads`, `/projects`, `/quotations`, `/revenue`, `/export`), explicitly blocking `/auth` and `/bootstrap`.
- **Cookie auth split-brain.** Session cookie is issued by the Express backend (JWT, `__Host-aken_admin_session` in prod), and the Next.js server helper copies it into the browser response. Edge middleware checks only cookie *presence*; the backend is the source of truth for validity via `/api/admin-session` and protected routes.
- **Lead intake pipeline:** public POST → validation middleware → owner auto-assignment (least-loaded sales user) → Mongo save → fire-and-forget email + WhatsApp notifications with per-channel idempotency flags and retry endpoints.
- **Analytics:** heavy Mongo `$facet` aggregation pipelines produce lead, project, revenue, and margin dashboards.
- **Env safety:** `envValidation` produces diagnostics exposed via `/api/system/env-check`; frontend `env.ts` + prebuild script guard public env keys.

## 5. Data Flow (public → lead)

1. `SmartEnquiryWizard` (or estimator) validates client-side.
2. UTM/attribution merged from `localStorage` (`utm.js`).
3. `POST /api/public/leads` (Next) → `POST {BACKEND_API_URL}/api/leads` (Express).
4. `leadCreateLimiter` + `validateCreateLead` → strips `< >`, control chars; validates email/phone/lengths.
5. `resolveLeadOwnerAssignment` — explicit owner, `unassigned`, or least-loaded sales user.
6. `Lead.save()`; notifications fired async; response returns `{ success, data: { leadId, owner } }`.
7. Admin sees lead in `/admin/leads` (GET `/api/leads/analytics/summary`), can change status/owner, add notes, convert Closed lead → Project.
8. Quotation can be created and converted → Project; Project margins derived from `Material`/`LabourEntry`/`BOQ`/`Invoice` docs (no CRUD endpoints exist to create those — data must be seeded manually).

## 6. Component Hierarchy

```
layout.tsx
├─ RevealOnScroll (runs .reveal observers)
├─ AttributionTracker (persists UTM)
├─ GA4PageTracker (page_view on path change)
├─ SiteHeader (client: nav, services dropdown, mobile panel)
├─ {children}
│   ├─ page.js (Home) → SmartEnquiryWizard, HeroMedia, TrackedAnchor/Link, inline counters
│   ├─ services → ProjectGallery, TrackedAnchor/Link
│   ├─ projects → ProjectGallery + ProjectVideos
│   ├─ contact → SmartEnquiryWizard, LazyMapEmbed
│   ├─ enquiry → SmartEnquiryWizard
│   ├─ capabilities-estimation → inline estimator (client page)
│   ├─ careers → CareersClient (drag-drop resume)
│   ├─ blog/* → blog-data
│   └─ admin/* (client pages) → admin-proxy fetches
└─ SiteFooter
```

## 7. API Architecture

| Method | Route | Auth | CSRF | Notes |
|---|---|---|---|---|
| POST | `/api/leads` | public | no | create lead; rate-limited (8/10min prod) |
| GET | `/api/leads` | admin | no | **no pagination** |
| GET | `/api/leads/:id` / `/api/leads/analytics/summary` | admin | no | |
| PUT | `/api/leads/:id` `/status` `/owner` | admin | yes | validation middleware |
| POST | `/api/leads/:id/notes`, `notifications/retry`, `whatsapp/retry` | admin | yes | |
| GET | `/api/leads/client/:quotationNumber` | admin | no | admin-only despite name |
| POST | `/api/quotations` | admin | yes | sanitize + recompute totals; email w/ (broken) PDF |
| GET | `/api/quotations` | admin | no | **no pagination**, unbounded |
| POST | `/api/quotations/:id/convert` | admin | yes | creates project; auto-closes lead |
| GET | `/api/projects[/summary|/margin/overview|/:id/margin]` | admin | no | |
| GET | `/api/projects` | admin | no | paginated (limit≤100) |
| POST | `/api/projects` `/from-lead/:leadId` | admin | yes | |
| PUT | `/api/projects/:id` | admin | yes | |
| GET | `/api/revenue/overview` | admin | no | |
| GET | `/api/export/:entity?format=csv` | admin | no | CSV + BOM; CSV-injection risk |
| POST/GET | `/api/auth/login|logout|session` | — | login no CSRF; logout/session yes | 
| POST | `/api/bootstrap/admin` | secret/empty-DB | no | first admin or `BOOTSTRAP_SECRET` |
| POST | `/api/bootstrap/admin-reset` | token | no | disabled by default |
| POST/GET | `/api/integrations/webhooks/whatsapp[ /health]` | Bearer | no | receiver only (dispatcher stub) |
| GET | `/api/system/env-check` | admin | no | |
| GET | `/health` | none | no | readiness + env flags |

Response envelope: `{ success, data, requestId }` (or `{ success:false, error:{code,message,details?}, requestId }`). Note: exports return raw CSV.

## 8. Database Architecture

MongoDB (Atlas via `MONGO_URI`). Mongoose models:

- **User** — name, email (unique), `passwordHash` (`select:false`), role (`admin|sales`), lastLoginAt. bcrypt(12).
- **Lead** — contact info + smart-wizard fields (serviceType, projectLocation, estimatedTonnage, projectType, timeline), UTM/attribution fields, status enum (`New|Contacted|Quoted|Closed`), owner/ownerId, dealValue, probability, nested `emailNotifications` & `whatsappNotifications` state, `notes[]`. Rich compound indexes.
- **Project** — quotation/lead refs, budget/costs (material/labour/equipment/other/daily/totalSpent), status (`Planning|In Progress|Completed`), siteStatus enum, progressPercentage; `pre('save')` guards (clamps progress, recomputes totalSpent, auto-completes). **Note:** `findByIdAndUpdate` bypasses `pre('save')`.
- **Quotation** — items[], subtotal/gst/totalAmount, status (`Draft|Sent|Approved|Rejected`), validTill; `quotationNumber` indexed (not unique).
- **Invoice / Material / LabourEntry / BOQ** — per-project cost/invoice tracking (no CRUD routes).
- **Forecast / Tender / ActivityLog** — models exist; **no routes, unused**.

Indexes are well-chosen (compound on status+createdAt, lead owner+status, month unique for Forecast). `autoIndex` disabled in production (good).

## 9. Authentication Flow

1. Admin POSTs `/api/admin-login` (Next) → backend `/api/auth/login`.
2. Backend: find user by email (legacy "username" comment; queries email only), bcrypt.compare, update lastLoginAt, `signSessionToken({id, role})` (JWT, 1d expiry).
3. Backend issues: session cookie (`__Host-aken_admin_session` in prod; httpOnly, secure, sameSite=lax) and CSRF cookie (`aken_csrf`, non-httpOnly, secure, lax).
4. Next route forwards cookies to browser — **but only the first Set-Cookie (session) is forwarded; CSRF cookie is dropped; session refresh via `/api/admin-session` forwards no cookies at all.**
5. Edge middleware (`middleware.ts`) allows `/admin/login`; otherwise requires presence of session cookie; does not verify signature (backend does on each API call; `/api/admin-session` used by the login page for redirects).
6. Admin pages then call `/api/admin-proxy/*` with the cookie; backend `requireAdminSession` verifies JWT + role.
7. Logout: backend clears cookies (CSRF cleared via direct `res.cookie(..., maxAge:0)`), Next forwards all clearing cookies via `getSetCookie()`. JWT itself is stateless — **not invalidated; replayable until expiry**. No logout button exists in any admin page.

## 10. Authorization Flow

- `requireAdminSession` → JWT verify + `decoded.role === "admin"`; else 403.
- `requireRole(["admin"])` applied to every admin route (sales role exists in model but has no usable endpoints — effectively admin-only system).
- Admin proxy allowlist restricts which backend routes the frontend can reach; `/auth` + `/bootstrap` blocked.
- Robots.txt disallows admin; `/api/admin-proxy` not listed but cookies required.

## 11. Third-party Integrations

- **Resend** (email) — `sendEmail.js`; requires `RESEND_API_KEY`.
- **WhatsApp** — generic webhook POST (`WHATSAPP_WEBHOOK_URL`) with Bearer token; includes a stub receiver endpoint (`/api/integrations/webhooks/whatsapp`) that only logs and ACKs. Meta/WhatsApp Business integration is **not** implemented (documented as future).
- **Google Analytics 4 + Google Ads** (frontend) — gtag bootstrap, page_view, custom events, conversion events.
- **Google Maps** embed (iframe, lazy-loaded).
- **YouTube** (lite embed) in ProjectVideos.
- **Google Search Console** verification token support.
- Not used: SMTP (nodemailer removed), Chart.js (only in dead components).

## 12. Build Process

- Frontend: `npm run build` → `prebuild` runs `security:env-check` (scans `.env*` + source for `NEXT_PUBLIC_` secret-key patterns and server-env usage in client files), then `next build` (Next 16, Turbopack default).
- Backend: `npm start` → `node server.js`; no build step; no `dev` script; no nodemon.
- TypeScript check: `tsconfig` strict; no CI run; `next build` performs type-checking.

## 13. Deployment Architecture

- **Vercel** (frontend): `BACKEND_API_URL` (server-side only) + `NEXT_PUBLIC_API_URL`. Cookie-domain constraint: `__Host-` cookies require no Domain attr; host-only cookies on `aken.firm.in` (documented in `authCookies.js`).
- **Render** (backend): `NODE_ENV=production`, `MONGO_URI`, `CORS_ORIGINS`, `JWT_SECRET`, `RESEND_API_KEY`, WhatsApp vars. `assertBackendEnvForStartup` hard-fails production boot on missing MONGO_URI / wildcard CORS.
- Manual dashboard-based deploys. No Docker, no CI.

## 14. Performance Overview

**Good:**
- Static marketing pages (default SSG/ISR), next/image with AVIF/WebP + long cache TTL, lazy-loaded maps/videos/images, `preload="metadata"` hero video, reduced-motion support, heap of `no-store` only where needed (admin), hero poster on mobile (`md:hidden`).

**Concerns:**
- `/api/leads` and `/api/quotations` return **unbounded collections** (frontend maps all of them).
- Admin dashboards issue 3–4 parallel fetches per load; aggregation pipelines are heavy but indexed.
- In-memory rate limiting (single instance only; documented).
- Missing `/public/projects/**` assets → broken media & 404 image loads.
- Chart.js unused but installed (tree-shaken in prod build).
- `generateQuotationPDF` runs synchronously inside the request handler (on app thread) — blocking.

## 15. Security Overview

**Strengths:** helmet (CSP none-default, frame-ancestors none, HSTS in prod, noSniff, etc.), CORS allowlist + origin error in error handler, CSRF middleware (double-submit cookie/header), rate limiters (API, login, lead create, exports, env-check, quotation), bcrypt(12), JWT in HttpOnly `__Host-` cookie, admin-password secrecy (no plaintext), constant-time compare for bootstrap/reset tokens, webhook Bearer auth with timing-safe compare, input sanitization (strip `<>`, control chars; length caps), payload size limit 100kb, `requestId` tracing, stdout JSON logs (no sensitive values in webhook logs), env leak prebuild scanner, public-proxy blocks localhost SSRF, admin-proxy blocks `/auth`/`/bootstrap` + allowlist, robots disallow admin, limited error leakage (generic messages to clients; stacks only in dev).

**Critical / High gaps:** see Executive Summary (CSRF chain broken → all admin writes fail; estimator fake-success; careers fake-submit; CSV injection; `lead-test.json` committed with PII; JWT not invalidated on logout; no captcha/honeypot on public lead form; `cors` configured with `origin:true` (reflect-all) with enforcement only via post-middleware — `corsOriginDelegate` is dead code).

## 16. UI Architecture

- Tailwind v4 utility classes; design tokens in `globals.css` (CSS vars: engineering blue `#0b4fb3`, steel grey, construction orange `#f97316`; dark-mode via prefers-color-scheme).
- Shared components: `TrackedLink`/`TrackedAnchor` (event tracking), `ProjectGallery` (lightbox + keyboard nav), `ProjectVideos`, `SmartEnquiryWizard` (5-step), `SiteHeader`/`SiteFooter`.
- Admin area: dark (black/gray-950) dashboard, repeated `MetricCard`, `BarList`, and `formatCurrency/formatPercent/formatDate/getStatusClass` helpers duplicated across 5 pages.
- Public pages consistently use black hero + orange/yellow CTA + white content sections. Mixed heading styles across pages (font-extrabold vs font-semibold; `bg-black` vs `bg-slate-950`) — inconsistent but intentional-looking.

## 17. State Management

- **No global store.** React `useState`/`useMemo`/`useCallback` per client page; server components render static data; URL search params for admin filters; localStorage for UTM attribution; cookies for session; backend DB is source of truth.

## 18. Routing

- App Router: `app/` pages; static marketing pages; dynamic `[slug]` blog; `blog/slug/page.tsx` is a **phantom static route** ("/blog/slug" library page) that pre-empts the dynamic segment for that literal path.
- API routes: `public/leads`, `admin-login`, `admin-session`, `admin-logout`, `admin-proxy/[...path]`.
- Middleware matcher: `["/admin/:path*"]` (edge-safe presence check).
- `next.config.mjs`: www→non-www canonical redirect, `/X`→`/` defensive redirect, empties ACAO header on pages.

## 19. Configuration Management

- Env: files gitignored; `.env.example`s present. Frontend validates public keys + runs prebuild scanner. Backend validates at boot (production fails hard on criticals) and exposes `/api/system/env-check` consumed by `/admin/system`.
- **Discrepancy:** `.env.example` + `envValidation.js` + `DEPLOYMENT_ENV_CHECKLIST.md` document `SMTP_*`/`EMAIL_USER`/`EMAIL_PASS`/`ADMIN_PASSWORD`/`ADMIN_AUTH_SECRET`, but the running code uses `RESEND_API_KEY` (email) and backend `JWT_SECRET` + Mongo `User` collection (auth). Frontend `.env.example` `ADMIN_USERNAME`/`ADMIN_PASSWORD`/`ADMIN_AUTH_SECRET` are legacy/unused.

## 20. Coding Standards

- Backend: CommonJS, `const` arrow functions, early-return error pattern via `sendError/sendSuccess`, per-route `try/catch` with typed error codes, sanitization helpers duplicated across route files.
- Frontend: TS strict, `"use client"` boundaries, path alias `@/*`, functional components, event-tracking abstraction, `bg-*-{black,orange,yellow,slate}` palette.
- Mixed JS/TS (page.js, utm.js, backend utils/analytics.ts), some 300–400-line client components (LeadsClient ~500 lines; SmartEnquiryWizard ~800 lines; services page ~700 lines) — above the 150-line guidance.
- No shared types between frontend/backend (duplicated types per admin page).

---

# PHASE 3 — ISSUE DETECTION

## 🔴 Critical Issues

| # | Issue | Location | Impact |
|---|---|---|---|
| C1 | **CSRF chain broken — all admin mutations return 403.** Backend sets session+CSRF cookies at login; `/api/admin-login` forwards only the first `Set-Cookie` (session) via `headers.get("set-cookie")`; `/api/admin-session` forwards none; no admin page sends `X-CSRF-Token`. Every protected POST/PUT (lead convert, quotation convert, status/owner updates, notes, project create/update, logout) fails `CSRF_INVALID`. | `aken-frontend/src/app/api/admin-login/route.ts`, `admin-session/route.ts`, `admin-proxy/[...path]/route.ts`, all `admin/*` clients; backend `middleware/csrf.js`, `utils/authCookies.js` | Admin write workflow 100% broken in deployed env |
| C2 | **Capabilities estimator lead capture always rejected but shows success.** Payload shape (`contact/project/estimate`) doesn't match `validateCreateLead` flat schema → backend 400; client catch-path displays "Estimate Sent! Our engineering team will also review..." — false confirmation; no lead ever created. | `aken-frontend/src/app/capabilities-estimation/page.tsx` `onSubmitLead`; backend `middleware/leadValidation.js` | Lead-magnet never captures; deceptive UX |
| C3 | **Careers form submits nothing.** Validation → success message only; no network call, no endpoint, no storage (not even local). Resumes/personal data silently discarded. | `aken-frontend/src/app/careers/CareersClient.tsx` `handleSubmit` | Broken business feature + false "Secure Intake" claims |
| C4 | **Quotation PDF attachment dropped.** `sendEmail` (Resend) doesn't map `attachments`; email says "attached quotation" but no attachment. `QUOTATION_GENERATE_PDF` effectively inert when combined with email. | `aken-backend/utils/sendEmail.js`, `routes/quotationRoutes.js` | Core quoting deliverable broken |

## 🟠 High Severity

| # | Issue | Location |
|---|---|---|
| H1 | **Missing project/media assets.** `/public/projects/**`, `/public/projects/videos/**`, `/hero-fabrication.*` referenced but absent → all gallery images & project videos 404; hero video silent-fails (poster OK). | `aken-frontend/public/*`, `services/page.tsx`, `projects/page.tsx` |
| H2 | **Email config contract mismatch.** Code needs `RESEND_API_KEY`; docs/validator/checklist say `SMTP_*`/`EMAIL_USER/EMAIL_PASS`. Env check can report email OK while email is dead; ops will misconfigure. | `.env.example`, `utils/envValidation.js`, `DEPLOYMENT_ENV_CHECKLIST.md`, `utils/sendEmail.js` |
| H3 | **CSV injection.** `escapeCsvValue` doesn't neutralize cells beginning `= + - @` (Excel formula execution) though admin-only. | `routes/exportRoutes.js` |
| H4 | **PII committed to public repo.** `lead-test.json` at root contains real phone/email/UTM. | root `lead-test.json` |
| H5 | **JWT not invalidated on logout.** Stateless token replayable until 1-day expiry; no token blocklist/rotation; no logout button in UI. | `routes/authRoutes.js`, `utils/authCookies.js` |
| H6 | **Partial-update totalSpent corruption.** `projectPayloadFromBody` recomputes `totalSpent` from partial payload only; updating one cost field zeroes other cost categories (because payload fields absent become 0 via `payload.materialCost || 0`). `findByIdAndUpdate` also bypasses `pre('save')` guard. | `routes/projectRoutes.js` |
| H7 | **No write path for project cost data.** `Material`, `LabourEntry`, `BOQ`, `Invoice` have no routes; margins/invoices can never be populated via UI/API → margin analytics show zeros/estimated-only. Admin Projects page is read-only (no create/edit forms). | `routes/*`, admin `projects/page.tsx` |
| H8 | **Unbounded list endpoints.** `/api/leads`, `/api/quotations` return all docs; no pagination/sorting caps on server. | `routes/leadRoutes.js`, `routes/quotationRoutes.js` |
| H9 | **Estimator reveals hidden price.** The internal budget range `₹X – ₹Y (hidden from user)` is rendered visibly in the sidebar, defeating lead gating and contradicting page copy ("No on-screen price display"). | `capabilities-estimation/page.tsx` |
| H10 | **`isAllowedPath`/proxy + CRLF/next sanitize fine, but `admin-login` route lacks its own rate limiting** — relies solely on backend limiter; if `BACKEND_API_URL` misconfigured the route falls back to `http://localhost:5000` (Vercel serverless) and hangs/fails with unhandled fetch rejection (un-caught `fetch` → 500 via thrown exception unhandled). | `app/api/admin-login/route.ts` |

## 🟡 Medium Severity

| # | Issue | Location |
|---|---|---|
| M1 | Dead code: `src/admin-proxy-middleware.ts` (never imported; duplicated logic superseded by `middleware.ts`). | frontend |
| M2 | Dead code: `aken-backend/utils/analytics.ts` (browser `window` TS file inside CJS backend; never required). | backend |
| M3 | Dead code: `KPICards`, `RevenueChart`, `SalesFunnel`, `StatusDonutChart` — unused and reference statuses `Won/Qualified/Lost` that don't exist in backend enum (`New/Contacted/Quoted/Closed`). | components |
| M4 | Unused models: `ActivityLog` (never referenced), `Forecast`, `Tender` (no routes). | models |
| M5 | Phantom route `/blog/slug` duplicates dynamic `[slug]`, exposing an unintended "Article Library" URL and confusing sitemap/SEO. | `app/blog/slug/page.tsx` |
| M6 | Unused blog content: `src/lib/blog-data/*.md` (full article with frontmatter) never imported; blog only renders 2 posts from `blog-data.ts`. | lib/blog-data |
| M7 | `/api/leads`, `/api/quotations`, `/api/projects/:id` etc. don't validate `ObjectId` → `CastError` → 500 instead of 400/404. | lead/project routes |
| M8 | Race: quotation→project & lead→project conversion uses find-then-create (two tabs can double-create). | `quotationRoutes.js`, lead flow in LeadsClient |
| M9 | Race/TOCTOU: least-loaded owner assignment not atomic. | `utils/ownerAssignment.js` |
| M10 | Notification idempotency guarded by read-check + `$set` (not atomic) — parallel retries could double-send. | leadEmail/WhatsApp notifications |
| M11 | PII logged: `console.log("Lead created:", lead)`, WhatsApp logs `to:` phone numbers, fallback URLs with message text stored in DB. | `leadRoutes.js`, `leadWhatsAppNotifications.js` |
| M12 | Login inputs have no `<label>` (placeholder only) — a11y. | `admin/login/page.tsx` |
| M13 | No "skip to content" link in layout — a11y. | `layout.tsx` |
| M14 | Sitemap missing routes: `/projects`, `/enquiry`, `/careers`, `/capabilities-estimation`. | `sitemap.ts` |
| M15 | `robots.ts` `host` field non-standard (harmless). | robots.ts |
| M16 | Admin pages have no logout button. | admin/* |
| M17 | Backend `package.json` `main: index.js` but no `index.js`; no `dev` script; no lint/test scripts. | backend package.json |
| M18 | Accidental nested git repo `aken-backend/aken-backend/.git`. | folder |
| M19 | Frontend `.env.example` documents legacy `ADMIN_USERNAME/ADMIN_PASSWORD/ADMIN_AUTH_SECRET` (unused by current backend auth). | frontend `.env.example` |
| M20 | `lib/adminAuth.ts` contains stale demo-auth code + unused helpers (base64url, hmac, safeCompare, TTL) — only `getAdminCookieName` is used. | lib/adminAuth.ts |
| M21 | SmartEnquiryWizard `console.log("Submitting enquiry:", payload)` logs PII to browser console. | component |
| M22 | No captcha/honeypot on public lead form (mitigated only by rate limit). | leadRoutes |
| M23 | `generateQuotationPDF` executes synchronously (blocking) in request path when enabled. | quotationRoutes |
| M24 | CSV export endpoint has no size/pagination guard — huge datasets → memory spike. | exportRoutes |
| M25 | `quotationNumber` indexed but not unique — duplicates possible. | Quotation model |
| M26 | Loose dev tooling: `{ }` stray empty JSX expressions, `next.config` `/X`→`/` rule (cosmetic leftovers). | admin pages, next.config |

## 🟢 Low / Code Smells / Tech Debt

| # | Issue |
|---|---|
| L1 | Duplication: `buildMonthTemplate`/`parseIntegerInRange`/`normalizeSource`/`sourceLabel`/`toTitleCase` duplicated across `leadRoutes.js` & `revenueRoutes.js`; `sanitizeText`/`toNumber`/`toPercentage`/`parseMoney` in 4+ files; `formatCurrency`/`formatPercent`/`formatDate`/`MetricCard` in 5 admin pages; `escapeHtml` in notifications. |
| L2 | One-file monoliths: `SmartEnquiryWizard.tsx` (~800 lines), `services/page.tsx` (~700), `LeadsClient.tsx` (~500), `capabilities-estimation/page.tsx` (~600). |
| L3 | Mixed naming/enum drift: dead chart components use `Won/Qualified/Lost` vs backend `Closed`; `LEAD_STATUS_ORDER` vs `LEAD_STATUS_VALUES` (same list). |
| L4 | `corsOriginDelegate` is defined but never passed to `cors()` — dead; CORS enforcement relies on a separate non-origin-aware middleware after headers emitted (works, but fragile + reflects ACAO on 403). |
| L5 | `createRequestId` fallback path unreachable on Node ≥18. |
| L6 | `sendError` logs 4xx as `warn` — noisy logs; no log levels filter. |
| L7 | `app.set("trust proxy", 1)` without documented proxy assumptions; rate limiter keyed on single proxy hop. |
| L8 | No `allowedHeaders` for `x-request-id` in CORS (admin proxy fine; direct API calls from browsers can't read it cross-origin). |
| L9 | Homepage counter animation via inline `<script dangerouslySetInnerHTML>` instead of a client component (acknowledged in HANDOFF). |
| L10 | README.md is the default create-next-app text; mentions Geist font that isn't used. |
| L11 | `jsconfig.json` redundant with `tsconfig.json` paths. |
| L12 | No OpenAPI/Swagger; no backend README; no API docs beyond code comments. |
| L13 | No tests anywhere (backend or frontend), no test runner configured. |
| L14 | `phase2-smart-project-enquiry.html` + docs (AKEN_REDESIGN_PLAN/CONTENT_SYSTEM/HANDOFF) describe large planned scope (10 service LPs, 20 guides, 20 blogs, industries page, quality page) — most not built; repo docs drift from shipped features. |
| L15 | Accessibility: admin `<th>` lack `scope`; some buttons lack `aria-label`; login placeholders only; color-only status chips. |
| L16 | Default `dark-mode` via `prefers-color-scheme` flips marketing pages to dark unexpectedly (design intent unclear) while most pages hard-code `bg-white text-gray-900` — inconsistent. |

## Security Vulnerabilities (consolidated)

1. (C1) CSRF protection effectively disables all admin writes — *functionality* + misconfiguration.
2. (H3) CSV formula injection (`=`, `+`, `-`, `@` cell prefix).
3. (H4) Committed PII (lead-test.json) on a public GitHub repo (`asak-coder/NEW-PROJECT`).
4. (H5) Stateless JWT not revocable on logout; no session store.
5. (M) Reflected ACAO header on blocked-origin 403s (defense-in-depth only).
6. (M) No brute-force limiter on `/api/bootstrap/admin` (only `/admin-reset` limited); empty-DB bootstrap is public by design — ensure first deploy protects `BOOTSTRAP_SECRET`.
7. (L) `helmet` CSP `formAction 'none'` would block native form posts if any are added later.
8. (L) Frontend pages have no CSP header set by Next (marketing site, static content — low risk).

## Performance Bottlenecks

- Unbounded `Lead.find()` / `Quotation.find()` list endpoints.
- Parallel heavy aggregations across 4 collections on every revenue dashboard load.
- Sync PDF generation in request path.
- Missing real media assets cause repeated 404/error-image network churn.
- No Redis-backed rate limiting (single-instance only).

## Potential Crashes / Error-Path Gaps

- `admin-login/route.ts` `fetch` not wrapped in try/catch → unhandled rejection if backend down (route throws).
- `admin-session/route.ts` has try/catch → OK.
- `admin-proxy/[...path]` `fetch` failures not caught → **unhandled rejection → 500 Vercel error** without envelope (client admin pages do `.json()` on non-JSON so they'd show "Unable to load" — acceptable but not graceful). Verify: `proxyRequest` has no try/catch → yes, unhandled → Vercel returns generic 500 (non-JSON) — admin pages catch.
- `Lead.findById(req.params.id)` on malformed id → CastError → 500.
- `sendEmail` throws when not configured inside request path in quotationRoutes (guarded by `isEmailConfigured()`).
- `getBackendUrl()` fallback to localhost in prod silently misdirects.

---

# PHASE 4 — QUALITY SCORING (0–100)

| Dimension | Score | Rationale |
|---|---|---|
| Architecture | 68 | Clean BFF/proxy, layered routes/models/utils, good separation; but split-brain auth, unbounded reads, unused models. |
| Security | 55 | Strong baseline (helmet, limits, validation, allowlist proxy) heavily undermined by broken CSRF chain, CSV injection, PII commit, non-revocable JWT. |
| Performance | 70 | Smart media defaults & static rendering; dragged by unbounded lists, sync PDF, missing assets. |
| Maintainability | 55 | Heavy duplication, dead code, monolithic client files, env-doc mismatch. |
| Scalability | 45 | No pagination, in-memory limits, synchronous PDF, single-instance assumptions. |
| Code Quality | 60 | Consistent error/label patterns & good naming generally; duplication and enum drift lower it. |
| Readability | 65 | Clear comments and structure; some 500–800-line components and mixed JS/TS. |
| Testing | 5 | Zero tests, no test framework configured anywhere. |
| Documentation | 55 | Rich planning docs (CONTENT_SYSTEM, HANDOFF, REDESIGN_PLAN) but they drift from actual code; README default; no API docs. |
| UI/UX | 68 | Consistent, professional B2B aesthetic; broken media, fake success states, missing admin create/edit workflows hurt trust. |
| Accessibility | 55 | Good focus-visible, reduced-motion, keyboard lightbox; missing labels, skip link, th scope, color-only signaling. |
| DevOps | 30 | Manual Vercel/Render deploys; no CI/CD, Docker, test gate, or staging; env prebuild scanner is a strong positive. |
| Database Design | 65 | Good indexes & validation; non-unique quotationNumber, unused collections, no TTL/retention. |
| **Overall Production Readiness** | **48** | Marketing site can ship; the operational loop (lead→quote→project) and several trust-critical features are broken. |

---

# PHASE 5 — IMPROVEMENT ROADMAP (prioritized)

All estimates assume 1 experienced full-stack dev.

### Priority 1 — Critical fixes
| Task | Complexity | Time | Risk | Impact |
|---|---|---|---|---|
| P1.1 Fix CSRF chain: forward all Set-Cookie (use `getSetCookie()`) in `admin-login` + `admin-session`; read `csrfToken` from session JSON in a shared client helper; attach `X-CSRF-Token` to all admin mutating fetches; OR relax CSRF to a per-session double-submit that actually works through the proxy. Add one end-to-end admin write test. | Med | 1–2 days | Low | Unblocks all admin write features |
| P1.2 Fix estimator payload → flat lead format (`name/company/phone/email/notes` + extra fields); send actual request; only show success on 2xx; implement server-side accept of the extra fields (already supported by model). Stop rendering the internal range (or remove "hidden" claim). | Low | 0.5–1 day | Low | Lead magnet works |
| P1.3 Wire Careers submission to a real endpoint (reuse lead endpoint or new multipart route with file storage + scan) — or disable the form + message honestly. | Med | 1–2 days | Med | Recruiting works |
| P1.4 Map `attachments` in Resend `sendEmail` (base64) or generate PDF only when actually attachable. | Low | 0.5 day | Low | Quotation PDF delivered |

### Priority 2 — Security improvements
| Task | Complexity | Time | Risk | Impact |
|---|---|---|---|---|
| P2.1 Remove `lead-test.json` (and purge from git history if already pushed). | Low | <1 h | Low | PII exposure fixed |
| P2.2 Neutralize CSV formula injection (prefix `'` for `= + - @` leading cells). | Low | 0.5 day | Low | Excel safety |
| P2.3 Invalidate sessions: add JWT `sid` + DB-backed session/TTL (or Redis) and check on protected routes; add logout button in admin. | Med | 2–3 days | Med | Real logout + revocation |
| P2.4 Add rate limiter to `/api/bootstrap/admin`; require `BOOTSTRAP_SECRET` always (drop empty-DB auto-allow). | Low | 0.5 day | Low | Hardens first-admin path |
| P2.5 Audit production logs: remove PII (lead object, phone numbers) from stdout; log truncated/hashed values. | Low | 1 day | Low | Privacy (DPDP-ready) |
| P2.6 Wrap `admin-login`/`admin-proxy` fetches in try/catch with `BackendUnavailable` envelopes; add hCaptcha/Turnstile to the public lead form behind a flag. | Med | 1–2 days | Low | Reliability + spam |

### Priority 3 — Performance optimization
| Task | Complexity | Time | Risk | Impact |
|---|---|---|---|---|
| P3.1 Add server-side pagination + filters to `/api/leads` & `/api/quotations`; update clients. | Med | 1–2 days | Low | Scales admin |
| P3.2 Move PDF generation off the request path (job queue / lazy `GET /api/quotations/:id/pdf`). | Med | 1 day | Low | No blocking |
| P3.3 Add real project media to `/public/projects` (WebP/MP4) and update HeroMedia sources. | Low | 1 day (assets) | Low | Fixes broken media + LCP signals |
| P3.4 Add Redis-backed rate-limit store (or document single-instance constraint in `.env.example`). | Med | 1 day | Low | Accurate limits |

### Priority 4 — Architecture improvements
| Task | Complexity | Time | Risk | Impact |
|---|---|---|---|---|
| P4.1 Create a shared `lib/format.ts` + `AdminMetricCard`/`PageHeader` and consolidate admin duplicates; extract `monthCtx.js` shared by lead/revenue routes. | Low | 1–2 days | Low | Maintainability |
| P4.2 Add `ObjectId` guard middleware for `:id` params (400 on malformed). | Low | 0.5 day | Low | Correct 4xx |
| P4.3 Make lead/quotation→project conversion atomic (idempotency key or unique index on `quotationId`/`leadId`). | Med | 1 day | Low | No duplicates |
| P4.4 Remove dead code: `admin-proxy-middleware.ts`, backend `utils/analytics.ts`, `KPICards/RevenueChart/SalesFunnel/StatusDonutChart`, `blog/slug` route, unused lib helpers; decide fate of `ActivityLog/Forecast/Tender` + `Material/LabourEntry/BOQ/Invoice` (either build CRUD or document as seeded). | Low–Med | 1–2 days | Low | Cleaner codebase |

### Priority 5 — Code refactoring
| Task | Complexity | Time | Risk | Impact |
|---|---|---|---|---|
| P5.1 Split `SmartEnquiryWizard` into step components; split `services/page.tsx` into data-driven service blocks. | Med | 2 days | Low | Readability |
| P5.2 Align enum vocabulary (single `LEAD_STATUS` constant file shared backend, mirrored in frontend types). | Low | 1 day | Low | Kills drift |
| P5.3 Fix `projectPayloadFromBody` totalSpent merge (load existing doc on update, merge category fields before recompute) and mirror guard in a `pre('findOneAndUpdate')` hook. | Med | 1 day | Med | Correct cost data |

### Priority 6 — UI improvements
| Task | Complexity | Time | Risk | Impact |
|---|---|---|---|---|
| P6.1 Add skip-to-content link; labels on login inputs; `scope` on admin `th`; aria-live on async admin messages (already partial). | Low | 0.5 day | Low | a11y |
| P6.2 Add logout button in header of admin pages. | Low | 0.5 day | Low | UX + security |
| P6.3 Unify dark-mode strategy (fixed light marketing or remove `prefers-color-scheme` flip). | Low | 0.5 day | Low | Consistency |
| P6.4 Replace fake successes with honest inline errors (estimator/careers) — ties to P1.2/P1.3. | Low | 0.5 day | Low | Trust |

### Priority 7 — Developer experience
| Task | Complexity | Time | Risk | Impact |
|---|---|---|---|---|
| P7.1 Backend: add `dev` script (node --watch), `lint` (eslint/prettier), `test` (vitest), fix `main` field. | Low | 0.5 day | Low | DX |
| P7.2 Sync docs: update `.env.example` (RESEND_API_KEY, remove SMTP/ADMIN_* legacy), `DEPLOYMENT_ENV_CHECKLIST.md`, backend README with run + curl examples. | Low | 0.5 day | Low | Onboarding |
| P7.3 Remove nested `aken-backend/aken-backend/.git`. | Low | <1 h | Low | Repo hygiene |

### Priority 8 — Testing
| Task | Complexity | Time | Risk | Impact |
|---|---|---|---|---|
| P8.1 Backend: vitest + supertest; cover lead validation, owner assignment, quotation math, margin calculator, auth, CSRF chain, CSV escaping. | Med | 2–3 days | Low | Baseline safety |
| P8.2 Frontend: add at least Playwright smoke test (home renders, enquiry wizard submits through proxy to a stubbed backend, admin login + one mutation). | Med | 2 days | Low | E2E proof |
| P8.3 Add `npm run typecheck` and run in prebuild/CI. | Low | 0.5 day | Low | Type safety gate |

### Priority 9 — Documentation
| Task | Complexity | Time | Risk | Impact |
|---|---|---|---|---|
| P9.1 Replace default frontend README with real run/deploy/env docs; add API reference (OpenAPI basics). | Low | 1 day | Low | Clarity |
| P9.2 Mark red-plan/CONTENT_SYSTEM items as backlog vs shipped to stop docs drift. | Low | 0.5 day | Low | Accuracy |

### Priority 10 — Future enhancements
| Task | Complexity | Time | Risk | Impact |
|---|---|---|---|---|
| P10.1 Build project cost tracking CRUD (Material/Labour/BOQ/Invoice) + margin updates; add tender/forecast modules. | High | 2–3 wks | Med | Full ERP-like ops |
| P10.2 Meta WhatsApp Business API integration replacing webhook stub (proper templates + delivery status). | High | 1–2 wks | Med | Real WA notifications |
| P10.3 Job queue (BullMQ + Redis) for notifications/PDF/email. | Med | 1 wk | Low | Reliability |
| P10.4 i18n (Hindi), DPDP data-retention workflows, lead enrichment, dashboard export to PDF. | Med | 1–2 wks | Low | Reach/compliance |
| P10.5 Serverside resize/optimize user uploads; antivirus scan hook. | Med | 3–5 days | Med | Careers/lead file flow |

---

# PHASE 6 — AI DEVELOPMENT PROMPT (single prompt for a new chat)

```
You are an experienced full-stack engineer working on the A K ENGINEERING project (an industrial EPC / PEB / steel-fabrication B2B site).

PROJECT SUMMARY:
- Two apps in one repo: `aken-frontend` (Next.js 16 App Router + React 19 + Tailwind CSS v4, TypeScript strict) deployed on Vercel; `aken-backend` (Express 4 CommonJS + Mongoose/MongoDB + JWT-cookie auth) deployed on Render. Browser talks only to the Vercel origin; Next.js route handlers proxy admin/public API calls to the Render backend.

CURRENT ARCHITECTURE:
- Public lead flow: `SmartEnquiryWizard` → `POST /api/public/leads` (Next) → `POST {BACKEND_API_URL}/api/leads` → `leadValidation.js` → `ownerAssignment.js` → `Lead.save()` → fire-and-forget email (Resend) + WhatsApp (generic webhook) notifications.
- Admin: Next `middleware.ts` checks session-cookie presence; `api/admin-proxy/[...path]` forwards cookie + optional `X-CSRF-Token` to allow-listed backend routes (`/system`, `/leads`, `/projects`, `/quotations`, `/revenue`, `/export`); backend enforces `requireAdminSession` (JWT role=admin) + double-submit CSRF cookie/header on all unsafe methods.
- Auth: Express `/api/auth/login` → bcrypt compare → JWT (1d) in `__Host-aken_admin_session` + `aken_csrf` cookie; Next `api/admin-login` copies Set-Cookie to the browser (currently only the first cookie — see bug list).
- DB models: User, Lead, Project, Quotation, Invoice, Material, LabourEntry, BOQ, Forecast, Tender, ActivityLog. Analytics via Mongo `$facet` pipelines.

TECH STACK (exact versions): next 16.1.6, react 19.2.3, tailwindcss ^4, chart.js ^4.5.1 (unused), express ^4.18.2, mongoose ^9.2.1, jsonwebtoken ^9.0.3, bcryptjs ^3.0.3, helmet ^8.1.0, express-rate-limit ^8.2.1, resend ^6.9.4, pdfkit ^0.17.2, morgan ^1.10.1, dotenv ^17.3.1, cookie-parser ^1.4.7, cors ^2.8.6.

CODING CONVENTIONS:
- Backend: CommonJS `require`, `const` arrow functions, per-route try/catch, error responses via `utils/apiResponse.js` `sendError/sendSuccess` with stable `{success, error:{code,message}}` shape and `requestId`.
- Frontend: functional components, `"use client"` where interactive, `@/*` path alias, all data via the existing route-handler proxies, tracking via `TrackedLink/TrackedAnchor` + `lib/analytics.ts`.
- Env: no `NEXT_PUBLIC_` secrets; backend secrets via `process.env`; `npm run security:env-check` must stay green.

FOLDER STRUCTURE:
- backend: `aken-backend/{middleware,models,routes,utils,controllers}/`
- frontend: `aken-frontend/src/{app,components,lib}/` (admin app pages under `src/app/admin/*`, API route handlers under `src/app/api/*`).

DESIGN PATTERNS: middleware chain validation→auth→CSRF→rate-limit; repo-style thin routes with fat utils; provider adapters for email (Resend) and WhatsApp (generic webhook); Next route-handler BFF proxy; analytics via aggregation pipelines; UTM attribution persisted to localStorage.

CURRENT DATABASE: MongoDB/Mongoose; models listed above; `autoIndex` disabled in production; compound indexes already defined.

CURRENT APIS: `/api/leads`, `/api/quotations`, `/api/projects`, `/api/revenue/overview`, `/api/export/:entity?format=csv`, `/api/auth/{login,logout,session}`, `/api/bootstrap/{admin,admin-reset}`, `/api/system/env-check`, `/api/integrations/webhooks/whatsapp(/health)`, plus Next handlers `/api/public/leads`, `/api/admin-login`, `/api/admin-session`, `/api/admin-logout`, `/api/admin-proxy/[...path]`.

CURRENT AUTHENTICATION: bcrypt + stateless JWT HttpOnly cookie (`__Host-aken_admin_session` in prod, `aken_admin_session` in dev) + CSRF double-submit (`aken_csrf` cookie vs `X-CSRF-Token` header). Edge middleware = presence-only check; backend = source of truth.

EXISTING UI FRAMEWORK: Tailwind CSS v4 via `@tailwindcss/postcss`, design tokens in `src/app/globals.css` (engineering blue #0b4fb3, steel grey, construction orange #f97316). Admin = dark (black/gray-950) dashboards with MetricCards and tables.

EXISTING STATE MANAGEMENT: local React state only (useState/useMemo/useCallback); no global store; URL search params for filters; localStorage for UTM.

EXISTING DEPLOYMENT METHOD: Vercel (frontend, env: BACKEND_API_URL, NEXT_PUBLIC_API_URL, GA/Ads IDs) + Render (backend, env: NODE_ENV=production, MONGO_URI, CORS_ORIGINS, JWT_SECRET, RESEND_API_KEY, WhatsApp vars). Manual deploys; no CI/CD/Docker.

TASKS — fix these verified defects in priority order, WITHOUT changing the overall architecture:
1. CSRF chain: forward ALL backend Set-Cookie headers from `/api/admin-login` and `/api/admin-session` to the browser (use `getSetCookie()`), and make admin clients read the `csrfToken` returned by `/api/admin-session` and send it as `X-CSRF-Token` on every unsafe admin-proxy request. Verify a full admin write (e.g., convert lead→project) returns 200.
2. Capabilities estimator: send a flat lead payload the backend accepts (name, company, phone, email, notes + serviceType/projectLocation/estimatedTonnage/projectType/timeline + attribution); treat any non-2xx as an error (no fake success); remove the visible internal price range (fully hide it).
3. Careers form: submit to a real backend endpoint (either extend `/api/leads` with an optional multipart resume upload, or a new `/api/careers` route with file size/type validation + secure storage); never show success without server confirmation.
4. Quotation PDF: make `sendEmail` pass attachments to Resend (base64) OR generate the PDF on a lazily-fetched `GET /api/quotations/:id/pdf`; fix the "attached quotation" email accordingly.
5. CSV export: neutralize CSV-injection cells (`= + - @` prefix with `'`).
6. Remove `lead-test.json` from the repo.
7. Correct env documentation: replace SMTP_*/EMAIL_* references with RESEND_API_KEY in `.env.example`, `envValidation.js` message text, and `DEPLOYMENT_ENV_CHECKLIST.md`; remove legacy ADMIN_PASSWORD/ADMIN_AUTH_SECRET references from the frontend `.env.example` and adminAuth helper.

Do NOT rewrite the entire project.
Preserve all existing functionality.
Modify only the necessary files.
Maintain backward compatibility.
Follow the existing coding style.
Do not introduce breaking changes.
Optimize performance.
Improve security.
Maintain responsiveness.
Preserve all business logic.
Refactor only where necessary.
Return complete modified files only.
```

---

# PHASE 7 — FINAL OUTPUT (sections 1–14)

1. **Executive Summary** — see §1 above: strong security-aware architecture with 6+ critical integration defects that break admin writes, the estimator lead-capture, careers intake, and quotation PDF delivery; plus config/doc drift, dead code, missing media, and zero tests. Overall production readiness ≈ 48/100.

2. **Complete Architecture Report** — PHASE 2 above (20 sections).

3. **Technology Stack** — PHASE 2 §2.

4. **Folder Structure** — PHASE 2 §3.

5. **Database Report** — PHASE 2 §8 + notes: models mostly unindexed-unused (Forecast/Tender/ActivityLog), no unique on quotationNumber, no TTL; indexes otherwise sound; `autoIndex` off in prod.

6. **API Report** — PHASE 2 §7 + findings H8, M7, C1, C2, C4.

7. **UI Report** — PHASE 2 §16 + findings H1, H9, M12–M16, L15–L16.

8. **Security Audit** — PHASE 3 security section.

9. **Performance Audit** — PHASE 3 performance section.

10. **Code Quality Audit** — PHASE 3 Low/Code-smells + dead-code section.

11. **Production Readiness Score** — **48/100** (breakdown in PHASE 4).

12. **Detailed Improvement Roadmap** — PHASE 5 (P1–P10 with complexity/time/risk/impact).

13. **AI Development Prompt** — PHASE 6.

14. **Final Recommendation**

   The marketing site is visually strong and technically modern; the operational backend loop is not yet production-safe. Before any further feature work:
   1. Ship P1 (fix CSRF chain → estimator → careers → PDF) — these are small, high-value, and unblock everything.
   2. Follow P2 security hardening (remove committed PII, CSV injection, session revocation, bootstrap hardening).
   3. Add a minimal automated test suite (P8) before touching analytics or auth again.
   4. Replace missing media assets (P3.3).
   5. Reconcile environment documentation (P7.2) so Render/Vercel are configured exactly as the code expects (`RESEND_API_KEY`).

   Do not attempt the P10 "ERP-like" scope (tenders, forecasts, cost-tracker CRUD, Meta WhatsApp) until P1–P5 land; the current foundation will not support it reliably.
