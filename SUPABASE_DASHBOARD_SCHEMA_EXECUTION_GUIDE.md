# SUPABASE DASHBOARD SCHEMA EXECUTION GUIDE

**File audited:** `supabase/SCHEMA.sql` (read in full, line-by-line)
**Target:** Supabase Dashboard → SQL Editor → Primary database → `postgres` role
**Verdict:** **DASHBOARD SCHEMA READY**

---

## 1. Can SCHEMA.sql be pasted directly into the Supabase SQL Editor?

**Yes — paste the entire file verbatim into the SQL Editor and run it as ONE script.**

The file was reviewed statement-by-statement. Every construct is plain, supported PostgreSQL
that the Dashboard SQL Editor executes natively. The Editor runs as the `postgres` role, which
has full DDL rights on the `public` schema, so no `owner` or `search_path` preamble is needed.

### Statement inventory (verified)

| Construct | Count / Detail | Dashboard support |
|---|---|---|
| `create extension if not exists "pgcrypto"` | 1 — pgcrypto is on Supabase's approved extension list | ✅ |
| `create table if not exists public.*` | 15 tables | ✅ |
| `create [unique] index if not exists` | 32 indexes | ✅ |
| `create or replace function ... plpgsql` (`set_updated_at`) | 1 — uses `$$ ... $$` dollar-quoting | ✅ |
| `do $$ ... $$` block (dynamic trigger create/drop) | 1 — valid PL/pgSQL, multi-statement `execute` inside `format()` | ✅ |
| `alter table ... enable row level security` | 15 tables | ✅ |
| `revoke` / `grant` (anon, authenticated, service_role) | 3 revoke + 4 grant statements | ✅ |
| `create or replace view public.v_lead_overview` | 1 view | ✅ |
| `comment on` | 3 comments | ✅ |
| CHECK constraints (incl. regex `~` for `forecasts.month`) | 88 constraints | ✅ |

### Explicitly checked and NOT present (nothing to strip)

- ❌ No psql-only commands (`\c`, `\connect`, `\d`, `\dt`, `\copy`, `\i`, `\ir`, `\o`, `\q`, `\echo` ...)
- ❌ No shell commands, `\!`, or OS-level directives
- ❌ No `SET` / `RESET` session commands
- ❌ No `BEGIN` / `COMMIT` / `ROLLBACK` / `SAVEPOINT`
- ❌ No `CREATE EXTENSION` beyond pgcrypto
- ❌ No `CREATE TYPE`/`CREATE SCHEMA`/`CREATE ROLE` (nothing that requires superuser beyond pgcrypto)
- ❌ No `OWNER TO`, `\g`, `COPY`, `\timing`, or client meta-commands of any kind
- ❌ No multi-line string hazards — all function/DO bodies are dollar-quoted, and no single-quoted
  string spans a dollar-to-dollar boundary

## 2. Lines that must NOT be pasted

**None.** The entire file — from the header comment through the final `-- Seed: no data...` comment —
is safe to paste as-is. There is no line to exclude, comment out, or reorder.

## 3. One script or sections?

**Execute as one script.** Paste the full file and click **Run**.

- Object creation order in the file is already dependency-correct (parents before children):
  `users` → `leads` → notification/notes/log tables → `quotations` → `quotation_items` →
  `projects` → `boq_entries`/`materials`/`labour_entries`/`invoices` → `forecasts`/`tenders` →
  trigger function → trigger wiring → RLS → grants → view.
- Every DDL uses `if not exists` / `create or replace`, so the script is **idempotent**.
  If a run fails mid-way, correct the issue and safely re-run the whole script.

> ⚠️ **Not atomic:** the SQL Editor commits each statement individually. A failure part-way through
> leaves earlier statements applied. This is safe here only because the script is idempotent —
> re-running completes whatever was missed and no-ops whatever already exists. Since the database
> is currently empty, this is a non-issue on first execution.

## 4. Section order (reference only — not required)

If you prefer to run in smaller batches, keep this exact order. Each batch is still fully
pasta-able verbatim; you are only splitting the same file.

1. **Extensions** — `create extension if not exists "pgcrypto";`
2. **Base/reference tables** — `users`
3. **Leads + lead child tables** — `leads`, `lead_email_notifications`, `lead_whatsapp_notifications`, `lead_notes`, `activity_logs` (with their indexes)
4. **Quotations** — `quotations`, `quotation_items` (with indexes)
5. **Projects + related tables** — `projects`, `boq_entries`, `materials`, `labour_entries`, `invoices` (with indexes)
6. **Standalone tables** — `forecasts`, `tenders`
7. **Trigger function + wiring** — `set_updated_at()` function then the `do $$ ... $$` block
8. **RLS** — all 15 `alter table ... enable row level security`
9. **Grants** — the 3 `revoke` + 4 `grant` statements
10. **View** — `create or replace view public.v_lead_overview`

## 5. Expected successful result

After a green "Success" run, the following exist in the `public` schema:

| Object | Expected |
|---|---|
| Tables | **15** — `users`, `leads`, `lead_email_notifications`, `lead_whatsapp_notifications`, `lead_notes`, `activity_logs`, `quotations`, `quotation_items`, `projects`, `boq_entries`, `materials`, `labour_entries`, `invoices`, `forecasts`, `tenders` |
| Indexes | **32** (2 unique: `users_email_uq`, `forecasts_month_uq`) |
| View | **1** — `v_lead_overview` |
| Function | **1** — `public.set_updated_at()` (returns trigger) |
| Triggers | **10** — `set_updated_at_*` on: users, leads, quotations, projects, boq_entries, materials, labour_entries, invoices, forecasts, tenders |
| RLS enabled | **15 tables**, **0 policies** (deny-by-default; service_role bypasses RLS) |
| Grants | `service_role` = ALL on tables/functions/sequences in `public`; `anon`/`authenticated` = revoked |
| Data | 0 rows — no seed data (admin user is created later via the bootstrap endpoint / migrate script) |

## 6. Post-execution verification queries

Paste these into the SQL Editor after the schema run. Expect the counts/values below.

```sql
-- 6.1 All 15 tables exist
select tablename
from pg_tables
where schemaname = 'public'
order by tablename;
-- Expect: activity_logs, boq_entries, forecasts, invoices, labour_entries, lead_email_notifications,
--         lead_notes, lead_whatsapp_notifications, leads, materials, projects, quotation_items,
--         quotations, tenders, users  (15 rows)

-- 6.2 Index count = 32 (of which 2 are unique)
select count(*) as index_count,
       count(*) filter (where indexdef ilike '%unique%') as unique_index_count
from pg_indexes
where schemaname = 'public';
-- Expect: index_count = 32, unique_index_count = 2

-- 6.3 View exists and is queryable (empty table -> 0 rows, no error)
select count(*) as lead_count from public.v_lead_overview;
-- Expect: lead_count = 0

-- 6.4 Trigger function exists
select proname
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname = 'set_updated_at';
-- Expect: 1 row: set_updated_at

-- 6.5 All 10 triggers wired
select event_object_table, trigger_name
from information_schema.triggers
where trigger_schema = 'public'
order by event_object_table;
-- Expect: 10 rows, trigger_name = set_updated_at_<table>

-- 6.6 RLS enabled on all 15 tables, 0 policies (deny-by-default)
select count(*) as tables_with_rls
from pg_class c
where c.relnamespace = 'public'::regnamespace
  and c.relkind = 'r'
  and c.relrowsecurity;

select count(*) as policy_count from pg_policies where schemaname = 'public';
-- Expect: tables_with_rls = 15, policy_count = 0

-- 6.7 service_role has been granted privileges
select grantee, count(*) as granted_count
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee = 'service_role'
group by grantee;
-- Expect: 1 row, service_role, granted_count = 15

-- 6.8 Foreign-key graph is intact (14 FKs: leads=1, lead_email_notifications=1,
--     lead_whatsapp_notifications=1, lead_notes=1, activity_logs=2, quotations=1,
--     quotation_items=1, projects=2, boq_entries=1, materials=1, labour_entries=1, invoices=1)
select count(*) as fk_count
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.constraint_schema = kcu.constraint_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.constraint_schema = 'public';
-- Expect: fk_count = 14

-- 6.9 CHECK constraints present (enum + bounds guards)
select count(*) as check_count
from information_schema.check_constraints
where constraint_schema = 'public';
-- Expect: 88 checks
```

### If any verification query returns unexpectedly

Because the whole script is idempotent (`if not exists`, `create or replace`), the safe recovery
step is: fix the reported statement and **re-run the full SCHEMA.sql**. It will skip everything
already created and apply only what is missing. No manual cleanup is required in an empty database.

---

### Notes / non-blocking observations

- **Default privileges (future tables):** Supabase's project defaults auto-grant `anon`/`authenticated`
  privileges on *newly created* tables in `public` after this script runs. The `revoke` statements
  here apply to the 15 tables that exist at execution time. If you later create additional tables
  that must stay private from `anon`/`authenticated`, re-run the same `revoke ... from anon, authenticated`
  statements after creating them.
- **RLS = strict deny:** There are intentionally zero policies. The backend connects with the
  service-role key (bypasses RLS). `anon` and `authenticated` can neither select nor mutate anything —
  this matches the required pre-migration access model.
- **pgcrypto:** Already present in all Supabase projects by default; `if not exists` makes this a no-op
  either way. `gen_random_uuid()` is additionally built-in on the PG 15+ runtime Supabase uses.

**FINAL VERDICT: DASHBOARD SCHEMA READY**
