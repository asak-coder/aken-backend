# RENDER → SUPABASE PRODUCTION CONNECTION VERIFICATION

**Date:** 2026-08-12
**Type:** Read-only verification. Nothing was modified: no environment variables changed, no deployments triggered, no schema/data operations performed, no credentials printed.

---

## 0. HEADLINE

**Render's Supabase project reference cannot be verified from this workspace.**

- Render's environment-variable values live only in the Render dashboard. No Render API key, CLI session, `render.yaml`, or config-as-code artifact exists anywhere in the repository or git history, so the `SUPABASE_URL` value is not programmatically inspectable from here.
- The live production backend (`https://aken-backend-1.onrender.com`) did not respond to `GET /health` (DNS + TLS handshake succeed; HTTP request times out after 120 s with 0 bytes). This blocks the live env-based verification path.
- The only Supabase project reference present anywhere in the workspace is `garrlnwamcwnypjrsfji` (local gitignored `aken-backend/.env` + `.env.example` + `DATABASE_URL` host) — the known-empty project.

**Final classification: D — Render configuration cannot be verified.**

---

## 1. Render Database Configuration

| Variable | Reported status (Render) | Verified from this workspace |
|---|---|---|
| `SUPABASE_URL` | YES (set) | Cannot read the **value** — no Render access mechanism in repo. Placeholder deployment docs reference `your-render-backend.onrender.com` only. |
| `SUPABASE_SERVICE_ROLE_KEY` | YES (set) | Value not printed (never examined beyond presence assumption). Not required for classification. |
| `MONGO_URI` | NO | Consistent with repo: no `MONGO_URI` anywhere in code, `.env` (local), `.env.example`, or git history at HEAD. |
| `DATABASE_URL` | NO (not set on Render) | Local gitignored `.env` has a `DATABASE_URL` whose host is `db.garrlnwamcwnypjrsfji.supabase.co` — same empty project. Security note: this value, including its password, is committed to plaintext in the local `.env`; keep it out of git. |

Render service discovered: **`aken-backend-1.onrender.com`** — found as `NEXT_PUBLIC_API_URL`/`BACKEND_API_URL` in the **public** client bundle served by the live site (this value is public by design; it is not a secret).

---

## 2. Render Supabase Project Reference

**UNKNOWN — cannot be inspected from this workspace.**

Render env vars are dashboard-only. There is no API token, no render CLI configuration, and no blue/green-style config file in the repository. The deployed backend does not answer HTTP, so even its runtime environment cannot be observed.

---

## 3. Current Supabase Project Reference

| Item | Value |
|---|---|
| Project URL | `https://garrlnwamcwnypjrsfji.supabase.co` |
| Project reference | `garrlnwamcwnypjrsfji` |
| Source of reference | Local `aken-backend/.env` (`SUPABASE_URL` + `DATABASE_URL` host), `aken-backend/.env.example` documentation |
| In git history | **Never committed** — `git log --all -S garrlnwamcwnypjrsfji` returns nothing |

---

## 4. Do They Match?

**UNKNOWN.** Render's project reference is unverifiable (Section 2), so a comparison against `garrlnwamcwnypjrsfji` cannot be made. *If* Render's `SUPABASE_URL` points at `garrlnwamcwnypjrsfji`, the classification would be **B (empty project)**; if it points elsewhere, **C (different project)**. Neither case is confirmable from this workspace.

---

## 5. Current Supabase Table Status

| Item | Finding |
|---|---|
| Public-schema application tables | **ZERO** (leads, quotations, projects, invoices, users, etc. — all absent) |
| PostgREST probes | `404 PGRST205 Could not find the table 'public.<table>' in the schema cache` for every app table |
| Migrations | None |
| Backups | None |
| Schema application (`SCHEMA.sql` / `FUNCTIONS.sql` / `AUDIT_FIXES.sql`) | Never applied — files exist in repo only |
| Meaning | `garrlnwamcwnypjrsfji` is a fresh, empty project. No application data has ever been written to it. |

---

## 6. Backend Database Technology

**Supabase (PostgreSQL via PostgREST) — at the code level, confirmed.**

- `aken-backend/utils/supabaseClient.js`: service-role client via `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`.
- `aken-backend/utils/db.js`: Supabase-only connectivity check (whitelist `users` table probe); no Mongo.
- `aken-backend/utils/envValidation.js`: production startup **hard-fails** if `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are missing/invalid.
- `aken-backend/server.js`: "connectToDatabase() has been removed because Supabase handles connections differently".
- `aken-backend/package.json`: `@supabase/supabase-js ^2.109.0`; **no `mongoose`** dependency.
- Git history: commit `174e21e` "Migrate database from MongoDB to Supabase"; HEAD `faa8dcd` "Remove old MongoDB connectToDatabase logic" (note: `faa8dcd` is **local-only**, ahead of `origin/main` — the deployed service may be running `5261fdc` or earlier, which already contains the Supabase migration).

**No active production code path requires MongoDB.** The only "mongo" matches in the codebase are explanatory comments in model files ("was: Mongoose X model").

---

## 7. Historical MongoDB Status

- MongoDB Atlas was the database from initial deployment (`47073d2`) through the code-level migration (`174e21e`).
- `MONGO_URI` was always a **Render dashboard-only** variable — no Mongo connection string exists anywhere in the repository or full git history.
- Render currently reports `MONGO_URI: NO`.
- The Mongo→Supabase migration (commit `174e21e`) was **code-only**: no data-export/import step ran, no backup was taken, and the target Supabase project is empty.

---

## 8. Production Data Location Status

**UNKNOWN — not determinable from this workspace.**

Verified negatives:
- Not in `garrlnwamcwnypjrsfji` (zero tables, no migrations/backups).
- Not in any repo artifact (no dumps, exports, BSON, seed files, or data SQL anywhere in history).
- Not in any other Supabase project referenced by code (no other `*.supabase.co` ref exists in the repo).

Open hypotheses (hypotheses only — none confirmed):
1. The data migration never happened — production data still resides in MongoDB Atlas.
2. Production environment was recently changed (e.g. `MONGO_URI` removed, `SUPABASE_URL` added at/after the code migration).
3. Old production data existed in MongoDB but the cluster/database is no longer reachable or was decommissioned.
4. The old Render environment was different (different service, different env vars).
5. A different database/project was used previously (unverifiable — no evidence of any other DB reference exists).
6. The application is currently configured incorrectly — it points at Supabase while the data layer that actually holds data is elsewhere.

---

## 9. Confidence Level

| Statement | Confidence |
|---|---|
| `garrlnwamcwnypjrsfji` does not contain production data | Very high |
| No other Supabase project reference exists anywhere in repo/history | Very high |
| Backend code expects Supabase and has no active Mongo path | Very high |
| Mongo→Supabase migration was code-only; no data step ran | Very high |
| MongoDB Atlas was the historical production database | High |
| Render's `SUPABASE_URL` value (and therefore its project ref) | **Not verifiable from this workspace** |
| Production data remains in MongoDB Atlas | Medium — plausible hypothesis, unverified |
| Exact production data location | **Unknown** |

---

## 10. Exact Next Action (read-only, no writes)

**Step 1 — Inspect the Render dashboard (the single step that resolves everything):**
1. Open Render dashboard → the **aken-backend-1** web service (the one deployed from the `asak-coder/aken-backend` repo).
2. Open **Environment → Reveal Config Vars**.
3. Read only the `SUPABASE_URL` value and record **just the hostname** (e.g. `https://<project-ref>.supabase.co`). This is not a secret — safe to note the ref.
4. Do **not** reveal or copy `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, or any other key value.
5. Compare the ref from Step 3 with `garrlnwamcwnypjrsfji`.

**Classification outcome of Step 1:**
- Ref equals `garrlnwamcwnypjrsfji` → **B — Render points to the known empty Supabase project**.
- Ref is different → **C — Render points to another Supabase project** → next: inspect *that* project's Tables / Migrations / Backups for production data.
- `SUPABASE_URL` is actually absent/invalid despite the earlier report → re-check Render; the backend may be failing startup env validation.

**Step 2 (optional, if a Mongo cluster is believed to hold data):** A strictly read-only connection to the Atlas cluster requires credentials that exist only in the Render dashboard or Atlas console — they are not in this workspace. Perform this only with an already-configured read-only user and `readPreference=secondary`; run `show dbs` + per-collection `count()` on `leads`, `quotations`, `projects`, `invoices`, `users`. No writes, no deletes, no migrations.

**Step 3 (only if the backend is reachable again):** Once `aken-backend-1.onrender.com` answers, re-run `GET /health` (read-only, no auth, returns `envReady` + `envWarnings` only). The admin-protected `GET /api/system/env-check` would reveal the backend's *effective* Supabase URL check status, but requires an admin session — do not create test credentials.

Do **not** yet: apply `SCHEMA.sql`, run migrations, create tables, rotate credentials, redeploy, or restart production. All of those belong to a separately approved write-phase after the true data location is confirmed.

---

## Appendix — Live Health Check Attempt (Task 5)

| Item | Result |
|---|---|
| Backend URL discovered | `https://aken-backend-1.onrender.com` (from public client bundle on `aken.firm.in`) |
| DNS | Resolves (CNAME → Cloudflare-fronted Render origin; A `216.24.57.15` / `216.24.57.7`) |
| TLS | Handshake succeeds (HTTP/1.1 negotiated) |
| `GET /health` | **No HTTP response** — timed out at 120 s, 0 bytes received (three attempts: 15 s, 90 s, 120 s) |
| HTTP status | None obtained |
| `envReady` | Unknown |
| Environment warnings | Unknown |
| Interpretation | Consistent with a Render free-tier instance spun down after inactivity (cold start not completing within window), or a crash-looping/crashed instance. Not an authentication/naming failure because TLS completed. |

No secrets were printed at any point during this investigation.
