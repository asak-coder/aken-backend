# Deployment Environment Checklist (Vercel + Render)

## 1) Render (Backend)
Set these in Render service environment:

- `NODE_ENV=production`
- `MONGO_URI=...` (required)
- `CORS_ORIGINS=https://aken.firm.in,https://www.aken.firm.in` (required in production)
- `FRONTEND_URL=https://aken.firm.in` (recommended fallback)
- `JWT_SECRET=...` (required if `/api/auth` login is used)

Optional but recommended:

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`
- `EMAIL_FROM`, `LEAD_ALERT_EMAILS`
- `WHATSAPP_WEBHOOK_URL`, `WHATSAPP_WEBHOOK_TOKEN`
- `WHATSAPP_ADMIN_RECIPIENTS`, `WHATSAPP_SEND_CLIENT_ACK`
- `QUOTATION_GENERATE_PDF=true`

Verification endpoint:

- `GET /api/system/env-check`

Health endpoint:

- `GET /health` returns `envReady` and `envWarnings`.

## 2) Vercel (Frontend)
Set these in Vercel project environment:

- `NEXT_PUBLIC_API_URL=https://your-render-backend.onrender.com`
- `NEXT_PUBLIC_GA_ID=G-...`
- `NEXT_PUBLIC_GOOGLE_ADS_ID=AW-...`
- `NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL=...`
- `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=...`

Server-only on Vercel:

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_AUTH_SECRET`

Never expose secrets with `NEXT_PUBLIC_` prefix.

## 3) Runtime Verification UI
After deploy:

1. Open `/admin/system`.
2. Check `Vercel Frontend Public Env` status.
3. Check `Render Backend Env` status.
4. Fix all `ERROR/INVALID` first, then `WARNING`.

