-- ============================================================================
-- A K ENGINEERING - PostgreSQL Database Audit: SQL Fixes
-- ----------------------------------------------------------------------------
-- Source         : supabase/DATABASE_AUDIT.md (findings P1..P22)
-- Type           : Idempotent, review-before-apply
-- Compatibility  : Supabase PostgreSQL 15+
--
-- IMPORTANT
--   * Read DATABASE_AUDIT.md first.
--   * Run each section in order. Data-prep statements are embedded as
--     comments directly above the constraint that depends on them.
--   * Sections §7 introduce CHECK constraints. If existing rows violate them,
--     the ALTER will FAIL - that is the correct behaviour. Run the commented
--     verification queries first, clean the data, then apply.
--   * §9/§10/§11 are documentation + app-layer notes, not executable DDL.
-- ============================================================================


-- ============================================================================
-- §1 - DROP redundant / unused indexes (P11, P13)
-- ----------------------------------------------------------------------------
-- P11: quotations_lead_idx (lead_id) is a leftmost prefix of
--      quotations_lead_created_idx (lead_id, created_at desc) - pure overhead.
-- P13: indexes with no supporting query today. Review before dropping:
--      * invoices_due_date_idx            - future AR-aging reports
--      * tenders_submission_date_idx      - tender deadline tracking
--      * tenders_tender_name_idx          - name search
--      * tenders_client_idx               - client search
--      * activity_logs_performed_by_idx   - future audit queries
--      * lead_email_notifications_admin_notified_idx
--      * lead_whatsapp_notifications_admin_notified_idx
--      Keep them if there is a roadmap query; otherwise drop.
-- ============================================================================

drop index if exists public.quotations_lead_idx;              -- P11 (safe: covered by quotations_lead_created_idx)

-- P13 - uncomment the ones you confirm are unused:
-- drop index if exists public.invoices_due_date_idx;
-- drop index if exists public.tenders_submission_date_idx;
-- drop index if exists public.tenders_tender_name_idx;
-- drop index if exists public.tenders_client_idx;
-- drop index if exists public.activity_logs_performed_by_idx;
-- drop index if exists public.lead_email_notifications_admin_notified_idx;
-- drop index if exists public.lead_whatsapp_notifications_admin_notified_idx;


-- ============================================================================
-- §2 - ADD missing indexes (P10)
-- ----------------------------------------------------------------------------
-- Real query shapes found in the backend:
--   * exports:   Lead.filter({ status })  .sort({createdAt:-1})
--                Lead.filter({ owner })   .sort({createdAt:-1})
--                Quotation/Project/Invoice .sort({createdAt:-1})
--   * projects:  GET /api/projects  WHERE status [+ site_status] ORDER BY created_at DESC
--   * revenue:   monthly facets on quotations/projects/invoices by created_at >= X
--   * recentLeads: LIMIT 10 ORDER BY created_at DESC (already covered)
-- ============================================================================

create index if not exists leads_status_created_idx
  on public.leads (status, created_at desc);

create index if not exists leads_owner_created_idx
  on public.leads (owner, created_at desc);

create index if not exists quotations_created_at_desc_idx
  on public.quotations (created_at desc);

create index if not exists projects_status_site_created_idx
  on public.projects (status, site_status, created_at desc);

create index if not exists projects_created_at_desc_idx
  on public.projects (created_at desc);

create index if not exists invoices_created_at_desc_idx
  on public.invoices (created_at desc);


-- ============================================================================
-- §3 - UNIQUE business document numbers (P2)
-- ----------------------------------------------------------------------------
-- quotationValidation.js and invoice creation may store '' for an empty
-- number. Normalize '' -> NULL first so the partial unique index only
-- constrains real numbers.
-- ============================================================================

-- DATA-PREP:
--   select quotation_number, count(*) from public.quotations
--     where quotation_number is not null group by quotation_number having count(*) > 1;
-- Resolve duplicates (rename or null them) BEFORE applying the index.
update public.quotations
set quotation_number = null
where quotation_number is not null and btrim(quotation_number) = '';

update public.invoices
set invoice_number = null
where invoice_number is not null and btrim(invoice_number) = '';

create unique index if not exists quotations_number_uq
  on public.quotations (quotation_number)
  where quotation_number is not null and btrim(quotation_number) <> '';

create unique index if not exists invoices_number_uq
  on public.invoices (invoice_number)
  where invoice_number is not null and btrim(invoice_number) <> '';

-- The old non-unique quotations_number_idx is now redundant for non-null
-- lookups (the partial unique index serves equality on non-null values).
-- Drop it to remove duplicate-maintenance overhead:
drop index if exists public.quotations_number_idx;


-- ============================================================================
-- §4 - ONE project per lead (P8)
-- ----------------------------------------------------------------------------
-- POST /api/projects/from-lead/:leadId performs findOne() then create() with
-- no transaction; two concurrent requests can create duplicate projects for
-- one lead. The partial unique index makes the second insert fail atomically.
-- ============================================================================

-- DATA-PREP:
--   select lead_id, count(*) from public.projects
--     where lead_id is not null group by lead_id having count(*) > 1;
-- Merge or remove duplicates BEFORE applying.
create unique index if not exists projects_lead_uq
  on public.projects (lead_id)
  where lead_id is not null;

-- projects_lead_idx (non-unique) is now redundant for non-null lead lookups.
-- It may be kept to also cover lead_id IS NULL scans and as FK documentation;
-- drop it only if you want to minimise index count:
-- drop index if exists public.projects_lead_idx;


-- ============================================================================
-- §5 - AUDIT TRAIL FK behaviour (P1, P3)
-- ----------------------------------------------------------------------------
-- Deleting a user/lead must NOT cascade-delete the audit trail. The table is
-- currently unused by any writer (verified 2026-08-06) so this is cheap to fix.
-- ============================================================================

alter table public.activity_logs
  drop constraint if exists activity_logs_lead_id_fkey,
  alter column lead_id drop not null,
  add constraint activity_logs_lead_id_fkey
    foreign key (lead_id) references public.leads (id) on delete set null;

alter table public.activity_logs
  drop constraint if exists activity_logs_performed_by_fkey,
  alter column performed_by drop not null,
  add constraint activity_logs_performed_by_fkey
    foreign key (performed_by) references public.users (id) on delete set null;


-- ============================================================================
-- §6 - updated_at triggers on notification tables (P4)
-- ----------------------------------------------------------------------------
-- Both 1:1 sub-tables expose updated_at but the SCHEMA.sql trigger loop omits
-- them, and the repository sub-table update path does not set it either.
-- ============================================================================

drop trigger if exists set_updated_at_lead_email_notifications
  on public.lead_email_notifications;
create trigger set_updated_at_lead_email_notifications
  before update on public.lead_email_notifications
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_lead_whatsapp_notifications
  on public.lead_whatsapp_notifications;
create trigger set_updated_at_lead_whatsapp_notifications
  before update on public.lead_whatsapp_notifications
  for each row execute function public.set_updated_at();


-- ============================================================================
-- §7 - DATA-PREP + CHECK constraints (P5, P6, P14, P20)
-- ----------------------------------------------------------------------------
-- Run the verification queries, clean data, THEN apply each constraint.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 7a. Quotation total integrity: total = subtotal + gst   (P5)
-- ----------------------------------------------------------------------------
-- VERIFY:
--   select id, subtotal, gst, total_amount
--   from public.quotations
--   where abs(total_amount - (subtotal + gst)) > 0.01;
-- Fix violators (recompute total) before applying:
alter table public.quotations
  add constraint quotations_total_integrity
  check (total_amount = subtotal + gst);

-- ----------------------------------------------------------------------------
-- 7b. Invoice paid <= amount   (P6)
-- ----------------------------------------------------------------------------
-- VERIFY:
--   select id from public.invoices where paid_amount > amount;
-- Fix violators before applying:
alter table public.invoices
  add constraint invoices_paid_amount_le_amount
  check (paid_amount <= amount);

-- ----------------------------------------------------------------------------
-- 7c. leads.email lowercase   (P14)
-- ----------------------------------------------------------------------------
-- Normalize first (leads.email has no unique index, so no dedupe collisions):
update public.leads
set email = lower(email)
where email <> lower(email);

alter table public.leads
  add constraint leads_email_lowercase check (email = lower(email));

-- ----------------------------------------------------------------------------
-- 7d. (OPTIONAL) leads.phone format   (P20)
-- ----------------------------------------------------------------------------
-- Applies to NEW rows only. Verify existing rows first:
--   select id, phone from public.leads
--   where phone !~ '^[0-9+\-\s()]{7,20}$';
-- Only apply if all historical rows conform:
-- alter table public.leads
--   add constraint leads_phone_format
--   check (phone ~ '^[0-9+\-\s()]{7,20}$');


-- ============================================================================
-- §8 - SECURITY hardening (P12)
-- ----------------------------------------------------------------------------
-- Functions/objects created BEFORE this script still hold default EXECUTE for
-- the PUBLIC pseudo-role (Postgres default). Revoke so only service_role and
-- owner can execute. NOTE: keep "revoke usage on schema public from public"
-- commented out unless you are certain no Supabase-managed path (dashboard,
-- anon key verification, future PostgREST keys) depends on schema access.
-- ============================================================================

revoke all on all functions in schema public from public;

alter default privileges in schema public
  revoke execute on functions from public;

alter default privileges in schema public
  revoke all on tables from public;

alter default privileges in schema public
  revoke all on sequences from public;

-- Re-assert service_role after the revoke-above (belt and braces):
grant execute on all functions in schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- Optional - only if you are sure no anon/PostgREST access is ever needed:
-- revoke usage on schema public from public;
-- revoke all on all tables in schema public from public;
-- revoke all on all sequences in schema public from public;
-- grant usage on schema public to service_role;


-- ============================================================================
-- §9 - DOCUMENTATION / accepted design decisions (P7, P16, P17)
-- ----------------------------------------------------------------------------
-- P7  leads.owner / projects.project_owner denormalize users.name for display.
--     Accepted: the repository writes both at assignment time; a user rename
--     will not retroactively rename leads/projects. If sync is required later,
--     the clean approach is a view that COALESCEs over the users FK:
--
--     create or replace view public.v_lead_owner as
--       select l.id as lead_id,
--              l.owner as owner_snapshot,
--              coalesce(u.name, l.owner) as owner_current
--       from public.leads l
--       left join public.users u on u.id = l.owner_id;
--
-- P16 lead_notes.added_by stores 'system' or a user UUID as untyped text.
--     Accepted; document that any future FK should be a NEW nullable column:
--     alter table public.lead_notes
--       add column added_by_user_id uuid references public.users (id) on delete set null;
--
-- P17 forecasts.month is 'YYYY-MM' text and sorts correctly lexicographically.
--     Optional upgrade for date math:
--     alter table public.forecasts
--       add column month_date date generated always as
--         (to_date(left(month, 4) || '-' || right(month, 2) || '-01', 'YYYY-MM-DD')) stored;
--     create unique index if not exists forecasts_month_date_uq
--       on public.forecasts (month_date);
-- ============================================================================


-- ============================================================================
-- §10 - APP-LAYER changes (NOT SQL) - P9, P15, P18, P19
-- ----------------------------------------------------------------------------
-- These require backend code changes and are intentionally NOT applied here.
--
-- P9  Notification race: in aken-backend/models/createRepository.js,
--     applySubTableUpdates() and persistChildren() do fetch-then-insert for
--     the 1:1 notification rows. Two concurrent notification runs can both
--     INSERT and collide on the lead_id PK. Fix: use an upsert instead:
--       .upsert({ [fkColumn]: filterValue, ...patch },
--               { onConflict: fkColumn, ignoreDuplicates: false })
--     PostgREST upserts on the PK; this both inserts when missing and updates
--     when present - removing the race and the extra SELECT.
--
-- P15 Notes-length UX: POST /api/leads/:id/notes in leadRoutes.js should cap
--     text at 2000 chars and return 400, instead of letting the DB CHECK throw
--     a 500. Also add "position" to the read-path joins rowMap in
--     Quotation.js (the items join currently drops the position column that
--     persistChildren writes), so item order is preserved in API responses.
--
-- P18 Pagination: GET /api/leads and GET /api/quotations load the full table
--     with per-row joins. Adopt the page/limit pattern already used by
--     GET /api/projects (defaults 20, max 100) with the new
--     created_at desc indexes from §2.
--
-- P19 Note insert fan-out: persistChildren inserts lead_notes one INSERT at a
--     time (.single()). Batch with a single .insert([...]) call.
-- ============================================================================


-- ============================================================================
-- §11 - INTROSPECTION SQL (recommendations) - P21, P22
-- ----------------------------------------------------------------------------
--
-- 11a. Storage buckets - confirm no public/unlocked bucket exists (P22):
--   select id, name, public from storage.buckets order by name;
--   (Expected: none, or only locked private buckets.)
--
-- 11b. Index usage reality-check after §1/§2 - re-run in a few weeks:
--   select schemaname, relname, indexrelname, idx_scan, idx_tup_read, idx_tup_fetch
--   from pg_stat_user_indexes
--   where schemaname = 'public'
--   order by idx_scan asc
--   limit 30;
--
-- 11c. Statement-level baseline (requires pg_stat_statements, available in
--   the Supabase dashboard under Reports -> Query performance):
--   select calls, round(total_exec_time::numeric, 2) as total_ms,
--          round(mean_exec_time::numeric, 2) as mean_ms, query
--   from pg_stat_statements
--   where query ilike any (array['%leads%', '%quotations%', '%projects%', '%invoices%'])
--   order by total_exec_time desc
--   limit 20;
--
-- 11d. P21 analytics consolidation is a FUNCTIONS.sql refactor (single-pass
--   CTE with FILTER clauses). Out of scope for this DDL patch; see
--   DATABASE_AUDIT.md §3 recommendation 2.
-- ============================================================================
