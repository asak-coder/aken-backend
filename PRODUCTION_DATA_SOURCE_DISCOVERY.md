# PRODUCTION DATA SOURCE DISCOVERY

**Date:** 2026-08-11
**Investigation type:** Read-only. No database, schema, environment, or deployment was modified.
**Investigating engineer:** Senior DevOps / DB Architecture / Production Recovery

---

## 1. Executive Summary

The application code has been **migrated from MongoDB to Supabase at the code level only**.
The production data itself was **never migrated**, and the only Supabase project ever
referenced by this repository is **empty** (zero tables, no migrations, no backups).

**Answer to "Where is the production data?"**

```
PRODUCTION DATA LOCATION UNKNOWN
```

The repository contains **no evidence** of a working MongoDB Atlas cluster, **no MongoDB
connection string anywhere in the repository or its git history**, and **no backup/export
of the production data**. The historical production database was MongoDB Atlas (connected
via a `MONGO_URI` environment variable set only in the Render dashboard, never committed),
and the Mongo→Supabase code migration shipped **without any data-migration step**. Whether
the production data still resides in MongoDB Atlas, was removed, or lives somewhere else
entirely **cannot be verified from this repository alone**.

The single most probable candidate, based on history, is **MongoDB Atlas** — but this is an
inference, not a verified fact. Verification requires a read-only look at the **Render backend
service environment variables** (which have always held `MONGO_URI`) — see §11.

---

## 2. Current Supabase Status

| Item | Finding |
|---|---|
| Project ref | `garrlnwamcwnypjrsfji` (project URL `https://garrlnwamcwnypjrsfji.supabase.co`) |
| Public schema tables | **Zero** (confirmed by dashboard and by PostgREST probes) |
| PostgREST OpenAPI root | Only `/` and `/rpc/rls_auto_enable` — no tables |
| `GET /rest/v1/quotations` etc. | `404 PGRST205 Could not find the table 'public.quotations' in the schema cache` (same for leads, projects, invoices, users) |
| Migrations | None |
| Backups | None |
| Schema application | `supabase/SCHEMA.sql` + `supabase/FUNCTIONS.sql` **have NOT been applied** — they exist only as files in the repo |
| What this means | The configured Supabase project is a fresh/empty project. No application data has ever been written to it. |

The backend preflight (`supabase/backups/phase1_preflight_backup.cjs`) is deliberately
designed to **abort without writing anything** when the required tables are missing. It
reports exactly what the dashboard reports: `quotations MISSING`, `invoices MISSING`,
`projects MISSING`, `leads MISSING`. That is expected, because the schema has never been applied.

---

## 3. Historical Database

**MongoDB (MongoDB Atlas) was the application's database from initial deployment until the
code-level migration.**

| Evidence | Source |
|---|---|
| Initial commit `47073d2` "feat: initial deployment of A K Engineering core platform" introduced `MONGO_URI` | `git log -S MONGO_URI` |
| Pre-migration `aken-backend/utils/db.js` used `mongoose.connect(mongoUri)` with `MONGO_URI`, `MONGO_CONNECT_TIMEOUT_MS`, `MONGO_SOCKET_TIMEOUT_MS`, `mongoose.set("autoIndex", ...)` | `git show 174e21e^:aken-backend/utils/db.js` |
| 12 Mongoose models (`models/*.js`: User, Lead, Project, Quotation, Invoice, Material, LabourEntry, BOQ, Forecast, Tender, ActivityLog) | repo scan + `MIGRATION_REPORT.md` |
| Dependency `mongoose ^9.2.1` in the pre-migration backend | `PROJECT_ANALYSIS_REPORT.md` §2 |
| `DEPLOYMENT_ENV_CHECKLIST.md` documents `MONGO_URI` as **required** on the Render backend | `DEPLOYMENT_ENV_CHECKLIST.md` |
| `PROJECT_ANALYSIS_REPORT.md` states "MongoDB (Atlas via `MONGO_URI`)" and "Render: `NODE_ENV=production`, `MONGO_URI`, ..." | `PROJECT_ANALYSIS_REPORT.md` §2/§13 |

**Critical caveat:** No `mongodb+srv://...` (or any Mongo) connection string exists anywhere in
the repository, including git history. `MONGO_URI` was always a **Render dashboard environment
variable** — never committed. Therefore the exact Mongo cluster, database name, and credentials
are **not discoverable from this repository**.

---

## 4. Current Application Database Configuration

| Config source | Finding |
|---|---|
| `aken-backend/.env` (local, gitignored) | Contains `SUPABASE_URL=https://garrlnwamcwnypjrsfji.supabase.co`, `SUPABASE_SERVICE_ROLE_KEY=<masked>`, and a `DATABASE_URL=postgresql://postgres:<masked>@db.garrlnwamcwnypjrsfji.supabase.co:5432/postgres` |
| `aken-backend/.env.example` | Documents `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, optional `DATABASE_URL` (Postgres direct). No `MONGO_URI`. |
| `aken-backend/utils/db.js` (current) | Supabase-only: requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, performs a `users` table health-check against PostgREST |
| `aken-backend/utils/supabaseClient.js` | `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)` service-role client |
| `aken-backend/utils/envValidation.js` | Production startup **fails hard** if `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are missing or invalid |
| `aken-backend/server.js` | Comment: "connectToDatabase() has been removed because Supabase handles connections differently" |
| `models/createRepository.js` | Mongoose-compatible repository layer over Supabase PostgREST |
| Backend dependency | `@supabase/supabase-js ^2.109.0`; **no `mongoose` dependency remains** |
| `DATABASE_URL` note | The only `DATABASE_URL` found points at the **same** Supabase project (`db.garrlnwamcwnypjrsfji.supabase.co`). Note: `supabase/backups/README.md` (2026-08-09) recorded the `.env` `DATABASE_URL` as *not* a Supabase host at that time — the `.env` has since been updated to a Supabase host. Both point to the same empty project. |

**Conclusion:** The code now expects Supabase. But the expected Supabase project is empty, so
the application currently has **no writable data layer in place** — no tables exist for the
repositories to read or write.

---

## 5. Deployment Database Configuration

| Layer | Platform | Status / evidence |
|---|---|---|
| Frontend | **Vercel** | **Confirmed live** at `https://aken.firm.in` (browser check 2026-08-11). `next.config.mjs` canonicalizes `www` → non-www. |
| Backend | **Render** (documented) | `DEPLOYMENT_ENV_CHECKLIST.md` + `PROJECT_ANALYSIS_REPORT.md` both specify Render for the Express backend. **No Render service URL, env var list, or dashboard output is committed anywhere in the repo.** |
| DB expected by deployed backend | **Unknown from repo** | The deployed backend's environment is configured in the Render dashboard only. The repo cannot show whether Render currently has `MONGO_URI`, `SUPABASE_URL`, both, or neither. |
| Docker / CI / GitHub Actions | None | No `Dockerfile`, no `docker-compose.yml`, no `.github/workflows` anywhere. `PROJECT_ANALYSIS_REPORT.md` confirms "No Docker, no CI/CD, no `.github/workflows`." |
| Frontend→backend prod URL | Unknown | `aken-frontend/.env.local` (dev only) points to `localhost:5000`. No production `BACKEND_API_URL` value is committed. The live site renders but upstream API reachability was not asserted. |

**Key uncertainty:** Because Render's environment variables are not visible from the repo, we
cannot confirm whether the *deployed* backend still points at MongoDB, already points at the
empty Supabase project, or points at a different Supabase project.

---

## 6. Git History Findings

| Commit | Date | Relevance |
|---|---|---|
| `47073d2` "feat: initial deployment of A K Engineering core platform" | earlier | Introduced `MONGO_URI` (Mongo-era backend) |
| `174e21e` "Migrate database from MongoDB to Supabase" | 2026-08-05 | **Code-level migration only.** Changed `utils/db.js`, `utils/envValidation.js`, added `utils/supabaseClient.js` + 1026-line `models/createRepository.js`, added `supabase/SCHEMA.sql` + `supabase/FUNCTIONS.sql`, added `MIGRATION_REPORT.md`. **No data-migration scripts, no seed data, no JSON/BSON exports, no `.env` change, no Supabase credentials committed.** |
| `5261fdc` "Add Supabase agent skills config" | — | Added `.agents/skills/` docs only |
| `faa8dcd` "Remove old MongoDB connectToDatabase logic" | 2026-08-05 (HEAD) | Removed the remaining Mongo connection code |

Other specific findings:

- **`git log --all -S "MONGO_URI"`** → commits `47073d2` and `174e21e` only (introduced, then removed).
- **`git log --all -S "garrlnwamcwnypjrsfji"`** → **no commits**. The Supabase project ref was
  **never committed**. It exists only in the local gitignored `aken-backend/.env`.
- **`git log --all` (full history)** → 30 commits, no tag, no release, no data-migration commit anywhere.
- **Branches:** single branch `main` → `origin/main`. No feature branches, no staging/production branches.
- **Tags:** none.
- **Remotes:** single origin `https://github.com/asak-coder/aken-backend.git`.
- **The Supabase schema was never committed-applied:** SCHEMA.sql exists in the tree but the
  target project has zero tables, and no `supabase db push`/SQL-Editor application is evidenced
  anywhere.
- **No Mongo data snapshot** was ever committed. There is no `mongodump`, no `mongoexport`,
  no BSON, no `.dump`, no data `.sql` in the history.

---

## 7. Database Candidates (Source Matrix)

| Candidate | Evidence | Production? | Data Present? | Confidence |
|---|---|---|---|---|
| **Current Supabase project** `garrlnwamcwnypjrsfji` | Only Supabase ref in repo; `.env` points here; PostgREST + dashboard show zero tables; no migrations/backups | Expected production target | **No** (empty) | **HIGH** — it is **not** the data location |
| **Other Supabase projects** | Repo scan (68 files, 111 matches) found **no other** `*.supabase.co` reference | — | — | **HIGH** — none exist in any repo artifact |
| **MongoDB Atlas** | Historical DB per git + docs; `MONGO_URI` required in Render checklist; migration shipped without data step | Was production; unverifiable current state | **Cannot verify** — no connection string, no credentials in repo, no read-only probe possible | **MEDIUM** — most probable, but unverifiable from repo |
| **Local PostgreSQL** | None found; no docker-compose, no local PG config | No | No | HIGH — no evidence |
| **Render PostgreSQL** | No evidence anywhere (no render PG host/URL, no DATABASE_URL to a Render host) | No | No | HIGH — no evidence |
| **Docker PostgreSQL** | No Dockerfile, no compose file, no docker volume | No | No | HIGH — no evidence |
| **Database backup (BSON/dump/backup dirs)** | `supabase/backups/` contains only scripts + README; **no data files** (backup aborted because tables missing). No `.bson/.dump/.backup/.sql` data dumps in repo or history | — | **No** | HIGH |
| **JSON/CSV export** | Only `lead-test.json` (a single hand-written test payload with PII, not a DB export) | No | No | HIGH — not production data |
| **Other discovered source** | None | — | — | — |

---

## 8. Data Artifacts (filenames + purpose only)

| Artifact | Purpose |
|---|---|
| `supabase/backups/phase1_preflight_backup.cjs` | Read-only snapshot **script** — aborts if tables missing; never produced output because the project is empty |
| `supabase/backups/verify_backup.cjs` | Verification script for the above |
| `supabase/backups/GRANTS_BASELINE_readonly.sql` | Read-only privilege-capture SQL (to be run manually in SQL Editor) |
| `supabase/backups/README.md` | Explains the kit and the "backup verification required" status |
| `supabase/SCHEMA.sql` / `supabase/FUNCTIONS.sql` / `supabase/AUDIT_FIXES.sql` | **DDL definitions, not data.** Never applied. |
| `lead-test.json` | Single test lead payload (contains real phone/email PII) — **not** a database export |
| `phase2-smart-project-enquiry.html` | Static frontend prototype — no data |
| Any `*.bson`, `*.dump`, `*.backup`, `*.csv`, `*.sql` data dumps | **None exist** in the repo or git history |

---

## 9. Evidence (Consolidated)

1. **Historical DB = MongoDB Atlas.** Pre-migration `utils/db.js` (from `git show 174e21e^`) is pure Mongoose/MONGO_URI; `DEPLOYMENT_ENV_CHECKLIST.md` requires `MONGO_URI` on Render; `PROJECT_ANALYSIS_REPORT.md` documents MongoDB+Render as the production stack.
2. **Migration was code-only.** Commit `174e21e` adds SQL files + repository/adapter code + a migration *report* whose own checklist shows **Phase 7 "data migration" unchecked** (Phases 2–10 all `[ ]`). No export/import script was ever written.
3. **Supabase project is empty.** Dashboard (zero tables, no migrations, no backups) + two independent PostgREST probes (404 PGRST205 on every app table) + the backup kit's own preflight abort message.
4. **Only one Supabase project ref exists**, and it was never committed to git — local `.env` only.
5. **No Mongo connection string exists anywhere** in the repo or full git history. Mongo credentials lived only in the Render dashboard.
6. **No production data artifacts exist** in the repo: no dumps, no exports, no seed files, no backup data directories.
7. **No Docker/CI/CD** — deployment is manual Vercel (frontend, confirmed live) + Render (backend, not observable from repo).
8. The `.env`'s `DATABASE_URL` also points at the empty Supabase project, not at Mongo or another host.

---

## 10. Confidence Level

| Statement | Confidence |
|---|---|
| Supabase project `garrlnwamcwnypjrsfji` does **not** contain production data | Very high |
| No other Supabase project is referenced anywhere in the repo | Very high |
| The Mongo→Supabase migration was completed **only at the code level**; no data migration ran | Very high |
| MongoDB Atlas was the historical production database | High |
| Production data may still live in MongoDB Atlas | **Medium — hypothesis, not verified** |
| Exact location of production data is confirmed | **None — unknown** |

Overall: the data location **cannot yet be determined** from repository evidence alone.

---

## 11. Exact Next Action (read-only, no writes)

1. **Inspect the Render backend service** (Dashboard → the A K ENGINEERING backend service →
   Environment → *Reveal Config Vars*). Read-only:
   - Does it still have `MONGO_URI`? Record only the host/database name portion (the host
     reveals which Atlas cluster was used). Do **not** print the password.
   - Does it have `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`? If so, which project ref?
   - This single step answers: *what database does the deployed production backend actually use?*
2. If `MONGO_URI` exists: optionally perform a **strictly read-only** connection to that Atlas
   cluster (read-only user or `readPreference=secondary`) and run `show dbs` + `db.<coll>.count()`
   on `leads`, `quotations`, `projects`, `invoices`, `users`. **Do not write, delete, or migrate.**
3. If no Mongo URI exists and the Render backend already points at Supabase, check the **Supabase
   dashboard → Database → Backups / Migrations** for the *correct* production project (the one the
   Render service points at). It may be a **different project** than `garrlnwamcwnypjrsfji`.
4. Only after the true source is confirmed should schema application and a data-migration plan be
   discussed — as a separate, explicitly approved write-phase.

---

## 12. Things That MUST NOT Be Done Yet

- ❌ Create tables, run `SCHEMA.sql`, `FUNCTIONS.sql`, or `AUDIT_FIXES.sql` anywhere.
- ❌ Migrate, copy, transform, or seed any data.
- ❌ Delete or alter anything in any database (Mongo or Postgres).
- ❌ Change production environment variables (Render/Vercel/Supabase).
- ❌ Rotate or reset credentials (Supabase keys, Mongo passwords, JWT, SMTP, WhatsApp, Resend).
- ❌ Connect to MongoDB with write privileges (if a connection is made later, it must be
  strictly read-only with credentials that are already configured).
- ❌ Expose any secret: `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` password, `JWT_SECRET`,
  `MONGO_URI` password, `RESEND_API_KEY`, WhatsApp credentials, SMTP credentials.

---

## Final Classification

**E — Production data location cannot yet be determined.**

Most probable hypothesis (unverified): **B — production data still exists in MongoDB Atlas**,
based on: (a) MongoDB was the production database until the code migration, (b) no data
migration ever ran, and (c) the target Supabase project is empty. Confirming or refuting B
requires read-only access to the Render backend's environment variables — which are not
visible from this repository.

**Bottom line:** The production data is **not** in `garrlnwamcwnypjrsfji` (empty), is **not**
in any backup or export inside this repository (none exist), and is **not** in any other
Supabase project referenced by the code (none exist). Everything else is unverified, and the
repository alone is insufficient to name the true source.
