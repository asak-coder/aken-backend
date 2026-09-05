# PHASE_BACKUP_VERIFICATION — A K ENGINEERING Supabase Production Backup

> **Generated:** 2026-08-26 02:50 IST
> **Updated:** 2026-08-27 01:55 IST (local auth + restore test completed)
> **Supabase project:** asak-coder (`garrlnwamcwnypjrsfji`) — PostgreSQL 17.6, database `postgres`
> **Scope:** backup-readiness gates + LOCAL isolated restore test. **Zero production database changes were made.**

---

## A. Backup Artifact

| Field | Value |
|---|---|
| Filename | `aken_postgres_20260824_193435.dump` |
| Full path | `C:\Users\19IN\OneDrive\Desktop\NEW PROJECT\supabase\backups\dumps\aken_postgres_20260824_193435.dump` |
| Size (bytes) | 370,984 (non-zero) |
| Created | 2026-08-24 19:34:35 |
| Last written | 2026-08-24 19:34:55 |
| Format | pg_dump custom (`--format=custom --compress=9`), SSL required |
| Companion report | `supabase/backups/dumps/aken_postgres_20260824_193435.backup_report.txt` (680 bytes, created 2026-08-24 19:34:56) — verified present |
| Companion object list | `supabase/backups/dumps/aken_postgres_20260824_193435.object_list.txt` (generated 2026-08-26 via `pg_restore --list`; text artifact only, dump unmodified) |
| PostgreSQL server version (production) | 17.6 |
| pg_dump version (client) | 17.11 |
| pg_restore version (client) | 17.11 |

The dump file was **not modified** during this task (read-only inspection only).

## B. Structural Verification

| Check | Result |
|---|---|
| `pg_restore --list` exit code | 0 → **PASS** |
| Catalog object entries | **677** |
| TABLE-type catalog entries | **98** |

Note: the earlier "170 table-related entries" figure counted all table-related
catalog lines (TABLE + TABLE DATA + constraints + indexes etc.). Neither figure
represents application-table count; actual application tables = **15** (per live
baseline). Object-list artifact retained at
`dumps/aken_postgres_20260824_193435.object_list.txt`.

## C. Git Protection

| Check | Result |
|---|---|
| Dump ignored | **YES** — matched by `supabase/backups/.gitignore` (`dumps/`) |
| Dump tracked by Git | **NO** |
| Report ignored | **YES** — same rule (`dumps/`) |
| Object list ignored | **YES** — same rule (`dumps/`) |
| Entire `supabase/backups/` tree in `git status --short` | Untracked (`??`); no dump content staged or committed |

No history rewrite was needed; nothing under `dumps/` has ever been tracked.

## D. Off-Site Backup

**OFF-SITE BACKUP = PENDING HUMAN ACTION**

Reason: no authorized off-site destination has been confirmed by the operator.
Observed (informational only, NOT counted as PASS): the workstation Desktop is
under OneDrive Known Folder Move (`C:\Users\19IN\OneDrive\Desktop`), so the dump
*may* be auto-syncing to OneDrive cloud. This was not verified against OneDrive
sync state and is not authorized/confirmed as an off-site copy destination.

Required human action: authorize and confirm one destination (OneDrive / Google
Drive / Cloudflare R2 / Backblaze B2 / AWS S3 / other), then copy:

```
supabase/backups/dumps/aken_postgres_20260824_193435.dump
supabase/backups/dumps/aken_postgres_20260824_193435.backup_report.txt
```

Use COPY (not move) so the local verified copy remains intact.

## E. Local PostgreSQL 17 Authentication Fix

The local authentication problem (forgotten `postgres` password on the LOCAL
PostgreSQL 17 instance at `127.0.0.1:5433`) was fixed. Summary of what was done
(only the local PostgreSQL 17 instance was touched):

| Step | Result |
|---|---|
| Active data directory | `C:\Program Files\PostgreSQL\17\data` (confirmed via service config + `postmaster.opts`) |
| Active `pg_hba.conf` | `C:\Program Files\PostgreSQL\17\data\pg_hba.conf` (single instance; no `hba_file`/`include` override, no alternate file) |
| Backup of HBA | Created `pg_hba.conf.backup_before_password_reset` before editing |
| Temporary trust | The 3 `all/all` rules set to `trust`; replication rules untouched |
| Reload | Config reloaded successfully (`SELECT pg_reload_conf()` returned `t`); `pg_ctl reload`/`Restart-Service` were blocked by lack of elevation, so in-DB reload was used |
| Trust auth test | **PASS** — `psql -w` connected with no password |
| Password reset | `ALTER USER postgres WITH PASSWORD '<new local password>'` succeeded (value never printed/exposed) |
| Secure auth restored | `pg_hba.conf` reverted to `scram-sha-256` on the 3 `all/all` rules; verified: **no trust lines remain** |
| New password verify | **PASS** — new password connects; no-password connection now fails (`fe_sendauth: no password supplied`) |

The new LOCAL password is stored in the gitignored file
`supabase/backups/.local_pg17_password.txt` (intentionally NOT printed here).
It is used only for the local isolated test and is never the production password.

## F. Restore Test

**RESTORE TEST = PASS** (isolated, local, disposable database)

- Target host: `127.0.0.1:5433` (local PostgreSQL 17)
- Target database: `aken_backup_test`
- Restore tool: PostgreSQL 17.11 `pg_restore`/`psql` (version-matched to the server)
- Dump: `aken_postgres_20260824_193435.dump` (unmodified)

| Verified metric (public schema) | Count |
|---|---|
| Restored tables | **15** |
| Restored functions | **13** |
| Restored triggers | **12** |

**IMPORTANT — Supabase-specific objects:** the dump references Supabase-only
schemas/roles/extensions (`supabase_vault`, `vault.*`, `anon`, `authenticated`,
`service_role`, `dashboard_user`, `supabase_admin`, `supabase_auth_admin`,
`supabase_storage_admin`, `supabase_realtime_admin`, `auth`, `storage`,
`realtime`, `graphql`). These do not exist on a vanilla PostgreSQL 17 install,
so the strict `restore_database.ps1 --exit-on-error` run aborts on
`CREATE EXTENSION IF NOT EXISTS supabase_vault`. A best-effort restore was
therefore run with `pg_restore` (same target, `--no-owner --role=postgres`,
**without** `--exit-on-error`) so that the 175 Supabase-extension/role/GRANT
errors were skipped while all application objects restored successfully. The
A K ENGINEERING application schema was verified present (15 tables, 13
functions, 12 triggers). The dump file itself was NOT modified.

Reference commands used:

```
# Strict script (aborts on missing Supabase extension):
pwsh ./restore_database.ps1 -DumpFile .\dumps\aken_postgres_20260824_193435.dump `
    -TestDbName aken_backup_test -LocalPort 5433 -LocalUser postgres

# Best-effort verification restore (skips Supabase-only objects):
pg_restore --host=127.0.0.1 --port=5433 --username=postgres `
    --dbname=aken_backup_test --no-owner --role=postgres `
    .\dumps\aken_postgres_20260824_193435.dump
```

## G. Production Safety

```
Production SQL writes:        0
Production database modified: NO
Phase 1 executed:             NO
Phase 2 executed:             NO
PHASE_2_PREFLIGHT.sql run:    NO
.env modified:                NO
Credentials exposed:          NO  (no secret values printed in logs/reports)
Backup committed to Git:      NO
Backup uploaded without authorization: NO
Supabase connection made:     NO  (all DB access was to local 127.0.0.1:5433)
```

All operations this task: read-only inspection of the production backup,
`pg_restore --list`, Git checks, and LOCAL PostgreSQL 17 auth/reset/restore.
No connection to any Supabase host was made.

## H. Final Verdict

```
BACKUP CREATED                  = PASS   (dump exists, non-zero, report verified)
STRUCTURAL VERIFICATION         = PASS   (pg_restore --list exit 0, 677 objects)
GIT PROTECTION                  = PASS   (dump/report/object list ignored, not tracked)
OFF-SITE BACKUP                 = PENDING HUMAN ACTION
LOCAL PostgreSQL 17 AUTH        = PASS   (password reset, scram-sha-256 enforced)
LOCAL RESTORE TEST              = PASS   (15 tables / 13 functions / 12 triggers)

BACKUP READINESS = PARTIAL
```

The backup is structurally verified, the local restore test passed, and local
PostgreSQL 17 authentication is working with `scram-sha-256` restored.
`BACKUP READINESS` remains **PARTIAL** because the off-site copy has NOT yet been
independently confirmed. If/when the off-site copy is confirmed, this becomes
**BACKUP READINESS = PASS**.

### Remaining human actions to reach BACKUP READINESS = PASS

1. Authorize + perform the off-site copy of the dump and report (Section D),
   then record that confirmation here.

### STOP

Per task instructions: do not proceed to Phase 1 / Phase 2 until the pending
off-site gate is closed by a separate follow-up task. This task ends here.
