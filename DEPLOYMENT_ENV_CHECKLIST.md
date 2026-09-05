# Deployment Environment Checklist (Vercel + Render)

> Status: **Supabase-only architecture.** MongoDB is NOT a runtime dependency.
> The production backend starts successfully WITHOUT any `MONGO_URI`/`MONGODB_URI`
> variable. Do NOT set any MongoDB connection string.

## 1) Render (Backend)

### Required (critical — startup validation hard-fails if missing/invalid)

- `NODE_ENV=production`
- `SUPABASE_URL=https://<project-ref>.supabase.co` — the Supabase project API URL. **Never expose this to the browser keys.**
- `SUPABASE_SERVICE_ROLE_KEY=<service_role_jwt>` — bypasses RLS, server-side ONLY. **Never expose to the browser.**
- `JWT_SECRET=<min-32-char-random>` — required for `/api/auth` login (admin session cookie signing).
- `CORS_ORIGINS=https://aken.firm.in,https://www.aken.firm.in` — required in production; wildcard `*` is rejected in production.

### Recommended (production)

- `FRONTEND_URL=https://aken.firm.in` — alternative/fallback single-origin for CORS.
- `COOKIE_DOMAIN=` — keep empty for host-only `__Host-` cookies.
- `BOOTSTRAP_ADMIN_EMAIL=admin@aken.firm.in`
- `BOOTSTRAP_SECRET=<random>` — allows safe first-admin creation on the fresh (0-user) DB.
- `QUOTATION_GENERATE_PDF=true` — default true.

### Notifications (optional; skipped gracefully if unset)

- `RESEND_API_KEY=<resend key>` — required to actually send lead-alert emails + quotation PDFs.
- `EMAIL_FROM="A K ENGINEERING" <contact@aken.firm.in>` (sender mailbox is hard-enforced to `contact@aken.firm.in` regardless).
- `LEAD_ALERT_EMAILS=contact@aken.firm.in`
- `WHATSAPP_WEBHOOK_URL=<url>`
- `WHATSAPP_WEBHOOK_TOKEN=<token>`
- `WHATSAPP_TIMEOUT_MS=8000`
- `WHATSAPP_ADMIN_RECIPIENTS=<E.164 or 10-digit IN numbers, comma-separated>`
- `WHATSAPP_SEND_CLIENT_ACK=false`
- `DEFAULT_COUNTRY_CODE=91`

### Security (keep disabled)

- `ENABLE_ADMIN_RESET=false` (default)
- `ADMIN_RESET_TOKEN=` (leave empty)

### DO NOT SET

- `MONGO_URI` / `MONGODB_URI` / `MONGODB_URL` / `MONGO_URL` / `MONGODB_CONNECTION_STRING` / `MONGO_CONNECTION_STRING` — **not used; required to be absent.**
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_SECURE` — **not used; email is sent via Resend.**

### Verification

- `GET /health` → returns `{ status, envReady, envWarnings }`.
- `GET /api/system/env-check` (admin session) → detailed diagnostics.

## 2) Vercel (Frontend)

### Public (safe to expose)

- `NEXT_PUBLIC_API_URL=https://your-render-backend.onrender.com` — public backend origin. Not a secret.
- `NEXT_PUBLIC_GA_ID=G-...` (optional)
- `NEXT_PUBLIC_GOOGLE_ADS_ID=AW-...` (optional)
- `NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL=...` (optional)
- `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=...` (optional)

### Server-only on Vercel (never `NEXT_PUBLIC_`)

- `BACKEND_API_URL=https://your-render-backend.onrender.com` — used by Next.js route handlers (`/api/admin-proxy/*`, `/api/admin-login`, `/api/admin-session`).
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_AUTH_SECRET` (>=32 chars)

> The production admin authentication lives in the **backend** (JWT cookie session + CSRF). The Vercel `ADMIN_*` values exist only as a legacy/dev fallback and are not the source of truth for the live admin flow.

### Never expose secrets

- Never prefix server secrets with `NEXT_PUBLIC_`.
- The `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `RESEND_API_KEY`, `WHATSAPP_WEBHOOK_TOKEN`, `BOOTSTRAP_SECRET` must exist **only** in Render (backend), never in Vercel frontend env.

## 3) Runtime Verification UI

After deploy:

1. Open `/admin/system`.
2. Check `Vercel Frontend Public Env` status.
3. Check `Render Backend Env` status.
4. Fix all `ERROR/INVALID` first, then `WARNING`.
