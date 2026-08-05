-- ============================================================================
-- A K ENGINEERING - Supabase PostgreSQL Schema
-- Migration from MongoDB Atlas (Mongoose models) -> Supabase PostgreSQL
-- Phase 2 deliverable.
--
-- Conventions:
--   * UUID (uuid v4) primary keys. The backend repository layer serializes
--     the `id` column as `_id` so the existing API contract is unchanged.
--   * snake_case columns; repositories map to/from camelCase API fields.
--   * NUMERIC(14,2) for money; jsonb for free-form error detail payloads.
--   * CHECK constraints reproduce Mongoose enum + numeric bounds.
--   * Indexes reproduce every Mongoose index (see MIGRATION_REPORT.md §2.2).
--   * RLS enabled; default deny. The backend uses the service-role key
--     (bypasses RLS). anon/authenticated get nothing.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- enum helper: create enum-only via CHECK (keeps ALTER easy, mirrors Mongoose)
-- ----------------------------------------------------------------------------

-- ============================================================================
-- users (was: User.js)
-- ============================================================================
create table if not exists public.users (
  id              uuid primary key default gen_random_uuid(),
  name            text not null default '',
  email           text not null,
  password_hash   text not null,
  role            text not null default 'sales',
  last_login_at   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint users_email_lowercase check (email = lower(email)),
  constraint users_email_length check (char_length(email) between 1 and 254),
  constraint users_role check (role in ('admin', 'sales')),
  constraint users_name_length check (char_length(name) <= 120)
);

create unique index if not exists users_email_uq on public.users (email);
create index if not exists users_role_idx on public.users (role);

comment on table public.users is 'Admin/sales accounts (bcrypt password_hash, JWT cookie sessions). Supabase Auth intentionally not used - see MIGRATION_REPORT.md §6.';

-- ============================================================================
-- leads (was: Lead.js)
-- ============================================================================
create table if not exists public.leads (
  id                  uuid primary key default gen_random_uuid(),
  contact_person      text not null,
  email               text not null,
  company_name        text not null,
  phone               text not null,
  message             text not null,

  -- Smart enquiry wizard fields (optional)
  service_type        text,
  project_location    text,
  estimated_tonnage   numeric(14,2),
  project_type        text,
  timeline            text,

  -- Attribution
  utm_source          text,
  utm_medium          text,
  utm_campaign        text,
  utm_term            text,
  utm_content         text,
  gclid               text,
  fbclid              text,
  msclkid             text,
  landing_page        text,
  referrer_url        text,

  -- CRM fields
  status              text not null default 'New',
  owner               text not null default 'Unassigned',
  owner_id            uuid references public.users (id) on delete set null,
  owner_assigned_at   timestamptz,
  deal_value          numeric(14,2),
  probability         numeric(5,2) not null default 50,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint leads_contact_person_length check (char_length(contact_person) between 1 and 100),
  constraint leads_email_length check (char_length(email) between 1 and 150),
  constraint leads_company_name_length check (char_length(company_name) between 1 and 150),
  constraint leads_phone_length check (char_length(phone) between 7 and 20),
  constraint leads_message_length check (char_length(message) between 1 and 2000),
  constraint leads_service_type_length check (service_type is null or char_length(service_type) <= 200),
  constraint leads_project_location_length check (project_location is null or char_length(project_location) <= 200),
  constraint leads_project_type_length check (project_type is null or char_length(project_type) <= 80),
  constraint leads_timeline_length check (timeline is null or char_length(timeline) <= 80),
  constraint leads_utm_source_length check (utm_source is null or char_length(utm_source) <= 120),
  constraint leads_utm_medium_length check (utm_medium is null or char_length(utm_medium) <= 120),
  constraint leads_utm_campaign_length check (utm_campaign is null or char_length(utm_campaign) <= 120),
  constraint leads_utm_term_length check (utm_term is null or char_length(utm_term) <= 120),
  constraint leads_utm_content_length check (utm_content is null or char_length(utm_content) <= 120),
  constraint leads_gclid_length check (gclid is null or char_length(gclid) <= 200),
  constraint leads_fbclid_length check (fbclid is null or char_length(fbclid) <= 200),
  constraint leads_msclkid_length check (msclkid is null or char_length(msclkid) <= 200),
  constraint leads_landing_page_length check (landing_page is null or char_length(landing_page) <= 300),
  constraint leads_referrer_url_length check (referrer_url is null or char_length(referrer_url) <= 500),
  constraint leads_owner_length check (char_length(owner) <= 80),
  constraint leads_status check (status in ('New', 'Contacted', 'Quoted', 'Closed')),
  constraint leads_estimated_tonnage_non_negative check (estimated_tonnage is null or estimated_tonnage >= 0),
  constraint leads_deal_value_non_negative check (deal_value is null or deal_value >= 0),
  constraint leads_probability_range check (probability between 0 and 100)
);

create index if not exists leads_owner_status_idx on public.leads (owner_id, status);
create index if not exists leads_created_at_desc_idx on public.leads (created_at desc);
create index if not exists leads_utm_source_campaign_created_idx on public.leads (utm_source, utm_campaign, created_at desc);

comment on table public.leads is 'Website enquiries + CRM pipeline. Maps 1:1 to Mongoose Lead model.';

-- Notification sub-tables (were embedded sub-documents)
-- ----------------------------------------------------------------------------
create table if not exists public.lead_email_notifications (
  lead_id                  uuid primary key references public.leads (id) on delete cascade,
  admin_notified_at        timestamptz,
  client_acknowledged_at   timestamptz,
  last_attempt_at          timestamptz,
  attempt_count            integer not null default 0,
  last_error               text,
  last_error_details       jsonb,
  updated_at               timestamptz not null default now(),
  constraint lea_attempt_count_non_negative check (attempt_count >= 0),
  constraint lea_last_error_length check (last_error is null or char_length(last_error) <= 500)
);

create table if not exists public.lead_whatsapp_notifications (
  lead_id                  uuid primary key references public.leads (id) on delete cascade,
  admin_notified_at        timestamptz,
  client_acknowledged_at   timestamptz,
  last_attempt_at          timestamptz,
  attempt_count            integer not null default 0,
  last_error               text,
  last_error_details       jsonb,
  last_fallback_url        text,
  updated_at               timestamptz not null default now(),
  constraint lwa_attempt_count_non_negative check (attempt_count >= 0),
  constraint lwa_last_error_length check (last_error is null or char_length(last_error) <= 500),
  constraint lwa_last_fallback_url_length check (last_fallback_url is null or char_length(last_fallback_url) <= 500)
);

create index if not exists lead_email_notifications_admin_notified_idx
  on public.lead_email_notifications (admin_notified_at);

create index if not exists lead_whatsapp_notifications_admin_notified_idx
  on public.lead_whatsapp_notifications (admin_notified_at);

create table if not exists public.lead_notes (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads (id) on delete cascade,
  text        text not null,
  added_by    text not null,
  created_at  timestamptz not null default now(),
  constraint lead_notes_text_length check (char_length(text) <= 2000),
  constraint lead_notes_added_by_length check (char_length(added_by) <= 80)
);

create index if not exists lead_notes_lead_created_idx on public.lead_notes (lead_id, created_at desc);

-- ============================================================================
-- activity_logs (was: ActivityLog.js)
-- ============================================================================
create table if not exists public.activity_logs (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references public.leads (id) on delete cascade,
  action        text not null,
  performed_by  uuid not null references public.users (id) on delete cascade,
  created_at    timestamptz not null default now()
);

create index if not exists activity_logs_lead_idx on public.activity_logs (lead_id);
create index if not exists activity_logs_performed_by_idx on public.activity_logs (performed_by);

-- ============================================================================
-- quotations (was: Quotation.js) + quotation_items (was: embedded items[])
-- ============================================================================
create table if not exists public.quotations (
  id                uuid primary key default gen_random_uuid(),
  lead_id           uuid references public.leads (id) on delete set null,
  quotation_number  text,
  subtotal          numeric(14,2) not null default 0,
  gst               numeric(14,2) not null default 0,
  total_amount      numeric(14,2) not null default 0,
  status            text not null default 'Draft',
  valid_till        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint quotations_number_length check (quotation_number is null or char_length(quotation_number) <= 64),
  constraint quotations_subtotal_non_negative check (subtotal >= 0),
  constraint quotations_gst_non_negative check (gst >= 0),
  constraint quotations_total_non_negative check (total_amount >= 0),
  constraint quotations_status check (status in ('Draft', 'Sent', 'Approved', 'Rejected'))
);

create index if not exists quotations_lead_idx on public.quotations (lead_id);
create index if not exists quotations_number_idx on public.quotations (quotation_number);
create index if not exists quotations_status_created_idx on public.quotations (status, created_at desc);
create index if not exists quotations_lead_created_idx on public.quotations (lead_id, created_at desc);
create index if not exists quotations_valid_till_idx on public.quotations (valid_till);

create table if not exists public.quotation_items (
  id            uuid primary key default gen_random_uuid(),
  quotation_id  uuid not null references public.quotations (id) on delete cascade,
  description   text not null,
  quantity      numeric(14,4) not null,
  rate          numeric(14,2) not null,
  amount        numeric(14,2) not null,
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  constraint quotation_items_description_length check (char_length(description) <= 500),
  constraint quotation_items_quantity_positive check (quantity > 0),
  constraint quotation_items_rate_non_negative check (rate >= 0),
  constraint quotation_items_amount_non_negative check (amount >= 0)
);

create index if not exists quotation_items_quotation_idx on public.quotation_items (quotation_id, position);

-- ============================================================================
-- projects (was: Project.js)
-- ============================================================================
create table if not exists public.projects (
  id                   uuid primary key default gen_random_uuid(),
  quotation_id         uuid references public.quotations (id) on delete set null,
  lead_id              uuid references public.leads (id) on delete set null,
  project_name         text not null,
  client_name          text not null,
  project_owner        text not null default 'Unassigned',
  project_value        numeric(14,2) not null,
  start_date           timestamptz,
  expected_completion  timestamptz,
  status               text not null default 'Planning',
  progress_percentage  numeric(5,2) not null default 0,
  budget_allocated     numeric(14,2) not null default 0,
  budget_spent         numeric(14,2) not null default 0,
  site_status          text not null default 'Not Started',
  material_cost        numeric(14,2) not null default 0,
  labour_cost          numeric(14,2) not null default 0,
  equipment_cost       numeric(14,2) not null default 0,
  other_cost           numeric(14,2) not null default 0,
  daily_expense        numeric(14,2) not null default 0,
  total_spent          numeric(14,2) not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint projects_name_length check (char_length(project_name) between 1 and 180),
  constraint projects_client_name_length check (char_length(client_name) between 1 and 180),
  constraint projects_owner_length check (char_length(project_owner) <= 80),
  constraint projects_value_non_negative check (project_value >= 0),
  constraint projects_status check (status in ('Planning', 'In Progress', 'Completed')),
  constraint projects_progress_range check (progress_percentage between 0 and 100),
  constraint projects_budget_allocated_non_negative check (budget_allocated >= 0),
  constraint projects_budget_spent_non_negative check (budget_spent >= 0),
  constraint projects_site_status check (site_status in ('Not Started', 'Foundation', 'Structure', 'Cladding', 'Finishing', 'Completed')),
  constraint projects_material_cost_non_negative check (material_cost >= 0),
  constraint projects_labour_cost_non_negative check (labour_cost >= 0),
  constraint projects_equipment_cost_non_negative check (equipment_cost >= 0),
  constraint projects_other_cost_non_negative check (other_cost >= 0),
  constraint projects_daily_expense_non_negative check (daily_expense >= 0),
  constraint projects_total_spent_non_negative check (total_spent >= 0)
);

create index if not exists projects_quotation_idx on public.projects (quotation_id);
create index if not exists projects_lead_idx on public.projects (lead_id);
create index if not exists projects_status_site_status_idx on public.projects (status, site_status);

comment on table public.projects is 'Execution projects. total_spent/progress guards replicated from Mongoose Project.pre("save") in the repository layer.';

-- ============================================================================
-- boq_entries (was: BOQ.js)
-- ============================================================================
create table if not exists public.boq_entries (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  description  text not null,
  boq_qty      numeric(14,4) not null,
  boq_rate     numeric(14,2) not null,
  actual_qty   numeric(14,4) not null default 0,
  actual_cost  numeric(14,2) not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint boq_description_length check (char_length(description) <= 500),
  constraint boq_qty_non_negative check (boq_qty >= 0),
  constraint boq_rate_non_negative check (boq_rate >= 0),
  constraint boq_actual_qty_non_negative check (actual_qty >= 0),
  constraint boq_actual_cost_non_negative check (actual_cost >= 0)
);

create index if not exists boq_project_created_idx on public.boq_entries (project_id, created_at desc);

-- ============================================================================
-- materials (was: Material.js)
-- ============================================================================
create table if not exists public.materials (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects (id) on delete cascade,
  material_name text not null,
  planned_qty   numeric(14,4) not null default 0,
  ordered_qty   numeric(14,4) not null default 0,
  received_qty  numeric(14,4) not null default 0,
  used_qty      numeric(14,4) not null default 0,
  rate          numeric(14,2) not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint materials_name_length check (char_length(material_name) between 1 and 180),
  constraint materials_planned_qty_non_negative check (planned_qty >= 0),
  constraint materials_ordered_qty_non_negative check (ordered_qty >= 0),
  constraint materials_received_qty_non_negative check (received_qty >= 0),
  constraint materials_used_qty_non_negative check (used_qty >= 0),
  constraint materials_rate_non_negative check (rate >= 0)
);

create index if not exists materials_project_created_idx on public.materials (project_id, created_at desc);
create index if not exists materials_project_name_idx on public.materials (project_id, material_name);

-- ============================================================================
-- labour_entries (was: LabourEntry.js)
-- ============================================================================
create table if not exists public.labour_entries (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects (id) on delete cascade,
  role             text not null,
  workers          numeric(10,2) not null default 0,
  working_days     numeric(10,2) not null default 0,
  total_cost       numeric(14,2) not null default 0,
  output_quantity  numeric(14,4) not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint labour_role_length check (char_length(role) between 1 and 120),
  constraint labour_workers_non_negative check (workers >= 0),
  constraint labour_working_days_non_negative check (working_days >= 0),
  constraint labour_total_cost_non_negative check (total_cost >= 0),
  constraint labour_output_quantity_non_negative check (output_quantity >= 0)
);

create index if not exists labour_project_created_idx on public.labour_entries (project_id, created_at desc);
create index if not exists labour_project_role_idx on public.labour_entries (project_id, role);

-- ============================================================================
-- invoices (was: Invoice.js)
-- ============================================================================
create table if not exists public.invoices (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects (id) on delete cascade,
  invoice_number  text,
  amount          numeric(14,2) not null,
  paid_amount     numeric(14,2) not null default 0,
  due_date        timestamptz,
  status          text not null default 'Pending',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint invoices_number_length check (invoice_number is null or char_length(invoice_number) <= 64),
  constraint invoices_amount_non_negative check (amount >= 0),
  constraint invoices_paid_amount_non_negative check (paid_amount >= 0),
  constraint invoices_status check (status in ('Pending', 'Partially Paid', 'Paid'))
);

create index if not exists invoices_project_created_idx on public.invoices (project_id, created_at desc);
create index if not exists invoices_status_created_idx on public.invoices (status, created_at desc);
create index if not exists invoices_due_date_idx on public.invoices (due_date);

-- ============================================================================
-- forecasts (was: Forecast.js)
-- ============================================================================
create table if not exists public.forecasts (
  id                 uuid primary key default gen_random_uuid(),
  month              text not null,
  projected_revenue  numeric(14,2) not null default 0,
  confirmed_revenue  numeric(14,2) not null default 0,
  cash_inflow        numeric(14,2) not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint forecasts_month_format check (month ~ '^\d{4}-\d{2}$'),
  constraint forecasts_projected_revenue_non_negative check (projected_revenue >= 0),
  constraint forecasts_confirmed_revenue_non_negative check (confirmed_revenue >= 0),
  constraint forecasts_cash_inflow_non_negative check (cash_inflow >= 0)
);

create unique index if not exists forecasts_month_uq on public.forecasts (month);

-- ============================================================================
-- tenders (was: Tender.js)
-- ============================================================================
create table if not exists public.tenders (
  id               uuid primary key default gen_random_uuid(),
  tender_name      text not null,
  client           text not null,
  estimated_value  numeric(14,2) not null default 0,
  submission_date  timestamptz,
  status           text not null default 'Preparing',
  probability      numeric(5,2) not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint tenders_name_length check (char_length(tender_name) between 1 and 200),
  constraint tenders_client_length check (char_length(client) between 1 and 200),
  constraint tenders_estimated_value_non_negative check (estimated_value >= 0),
  constraint tenders_status check (status in ('Preparing', 'Submitted', 'Under Review', 'Won', 'Lost')),
  constraint tenders_probability_range check (probability between 0 and 100)
);

create index if not exists tenders_tender_name_idx on public.tenders (tender_name);
create index if not exists tenders_client_idx on public.tenders (client);
create index if not exists tenders_status_created_idx on public.tenders (status, created_at desc);
create index if not exists tenders_submission_date_idx on public.tenders (submission_date);

-- ============================================================================
-- updated_at trigger (all tables with updated_at)
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'users', 'leads', 'quotations', 'projects', 'boq_entries',
    'materials', 'labour_entries', 'invoices', 'forecasts', 'tenders'
  ]
  loop
    execute format(
      'drop trigger if exists %I on %I; create trigger %I before update on %I for each row execute function public.set_updated_at();',
      'set_updated_at_' || t, t, 'set_updated_at_' || t, t
    );
  end loop;
end;
$$;

-- ============================================================================
-- Row Level Security
-- ----------------------------------------------------------------------------
-- The backend connects with the Supabase *service role* key, which bypasses
-- RLS. All policies below are therefore deny-by-default; no anon or
-- authenticated role is granted rows. This matches the pre-migration posture
-- where ALL data access went through the Express API + admin session.
-- ============================================================================
alter table public.users enable row level security;
alter table public.leads enable row level security;
alter table public.lead_email_notifications enable row level security;
alter table public.lead_whatsapp_notifications enable row level security;
alter table public.lead_notes enable row level security;
alter table public.activity_logs enable row level security;
alter table public.quotations enable row level security;
alter table public.quotation_items enable row level security;
alter table public.projects enable row level security;
alter table public.boq_entries enable row level security;
alter table public.materials enable row level security;
alter table public.labour_entries enable row level security;
alter table public.invoices enable row level security;
alter table public.forecasts enable row level security;
alter table public.tenders enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all functions in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- ============================================================================
-- Optional convenience view: lead list with joined notification status
-- (not required by the backend, kept for Supabase dashboard / analytics reads)
-- ============================================================================
create or replace view public.v_lead_overview as
select
  l.id,
  l.contact_person,
  l.company_name,
  l.email,
  l.phone,
  l.status,
  l.owner,
  l.owner_id,
  l.deal_value,
  l.probability,
  l.utm_source,
  l.utm_campaign,
  l.created_at,
  e.admin_notified_at  as email_admin_notified_at,
  e.attempt_count      as email_attempt_count,
  w.admin_notified_at  as whatsapp_admin_notified_at,
  w.attempt_count      as whatsapp_attempt_count,
  coalesce(n.note_count, 0) as note_count
from public.leads l
left join public.lead_email_notifications e on e.lead_id = l.id
left join public.lead_whatsapp_notifications w on w.lead_id = l.id
left join (
  select lead_id, count(*) as note_count
  from public.lead_notes
  group by lead_id
) n on n.lead_id = l.id;

-- Seed: no data. Use scripts/migrate (Phase 7) or the bootstrap endpoint
-- to create the first admin user.
