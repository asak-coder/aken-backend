-- ============================================================================
-- A K ENGINEERING — PHASE 1 AUDIT FIXES EXECUTION
-- ============================================================================
-- Target:  Supabase project garrlnwamcwnypjrsfji
-- Database: postgres
-- Role:    postgres (Dashboard SQL Editor)
-- Scope:   Phase 1 ONLY — safe online changes, no behavior change
-- ============================================================================
-- INSTRUCTIONS:
--   1. Open Supabase Dashboard → SQL Editor
--   2. Paste and execute each section IN ORDER
--   3. Each section is independent and can be executed separately
--   4. If ANY section fails, STOP and capture the error
--   5. After all sections, run PHASE_1_VERIFY.sql
-- ============================================================================
-- Source: FINAL_PRE_AUDIT_FIXES_RECONCILIATION.md §16 Phase 1
-- Cross-checked against: supabase/AUDIT_FIXES.sql
-- ============================================================================


-- ============================================================================
-- §1 — DROP redundant quotation index (P11)
-- ============================================================================
-- quotations_lead_idx is a leftmost prefix of quotations_lead_created_idx
-- Drop reduces write overhead with zero read impact.

DROP INDEX IF EXISTS public.quotations_lead_idx;

-- EXPECTED: DROP INDEX (0 rows)


-- ============================================================================
-- §2 — CREATE six missing indexes (P10)
-- ============================================================================
-- All 6 are pure query accelerators for confirmed backend paths.
-- On zero-row tables: sub-second creation.

-- §2.1 Export: leads filtered by status, sorted by created_at desc
CREATE INDEX IF NOT EXISTS leads_status_created_idx
  ON public.leads (status, created_at DESC);

-- §2.2 Export: leads filtered by owner, sorted by created_at desc
CREATE INDEX IF NOT EXISTS leads_owner_created_idx
  ON public.leads (owner, created_at DESC);

-- §2.3 Revenue facets: quotations by created_at desc
CREATE INDEX IF NOT EXISTS quotations_created_at_desc_idx
  ON public.quotations (created_at DESC);

-- §2.4 Projects list: filter by status + site_status, sort by created_at desc
CREATE INDEX IF NOT EXISTS projects_status_site_created_idx
  ON public.projects (status, site_status, created_at DESC);

-- §2.5 Revenue facets: projects by created_at desc
CREATE INDEX IF NOT EXISTS projects_created_at_desc_idx
  ON public.projects (created_at DESC);

-- §2.6 Revenue facets: invoices by created_at desc
CREATE INDEX IF NOT EXISTS invoices_created_at_desc_idx
  ON public.invoices (created_at DESC);

-- EXPECTED: CREATE INDEX (6 times)


-- ============================================================================
-- §3 — Data preparation UPDATEs (zero rows affected)
-- ============================================================================
-- Normalize empty strings to NULL before unique index creation.
-- These are no-ops on a zero-row database but required for correctness.

-- §3.1 Normalize quotation numbers
UPDATE public.quotations
SET quotation_number = NULL
WHERE quotation_number IS NOT NULL AND btrim(quotation_number) = '';

-- §3.2 Normalize invoice numbers
UPDATE public.invoices
SET invoice_number = NULL
WHERE invoice_number IS NOT NULL AND btrim(invoice_number) = '';

-- §3.3 Normalize lead emails to lowercase
UPDATE public.leads
SET email = lower(email)
WHERE email <> lower(email);

-- EXPECTED: UPDATE 0 for all three (zero-row database)


-- ============================================================================
-- §4 — CREATE two notification updated_at triggers (P4)
-- ============================================================================
-- Defense-in-depth: B2 RPC already writes updated_at = now(), but these
-- triggers ensure consistency for any direct SQL access.

-- §4.1 lead_email_notifications trigger
DROP TRIGGER IF EXISTS set_updated_at_lead_email_notifications
  ON public.lead_email_notifications;
CREATE TRIGGER set_updated_at_lead_email_notifications
  BEFORE UPDATE ON public.lead_email_notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- §4.2 lead_whatsapp_notifications trigger
DROP TRIGGER IF EXISTS set_updated_at_lead_whatsapp_notifications
  ON public.lead_whatsapp_notifications;
CREATE TRIGGER set_updated_at_lead_whatsapp_notifications
  BEFORE UPDATE ON public.lead_whatsapp_notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- EXPECTED: CREATE TRIGGER (2 times)
-- Post-Phase 1 trigger count: 12 (was 10, +2)


-- ============================================================================
-- §5 — Security privilege hardening (P12)
-- ============================================================================
-- Strip default PUBLIC EXECUTE from set_updated_at() and future objects.
-- Re-assert service_role access.

-- §5.1 Revoke all function EXECUTE from PUBLIC (strips set_updated_at default)
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

-- §5.2 Prevent future functions from gaining PUBLIC EXECUTE
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- §5.3 Prevent future tables from gaining PUBLIC ALL
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC;

-- §5.4 Prevent future sequences from gaining PUBLIC ALL
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM PUBLIC;

-- §5.5 Re-assert service_role EXECUTE on all functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- §5.6 Re-assert service_role ALL on all tables
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- §5.7 Re-assert service_role ALL on all sequences
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- NOTE: REVOKE USAGE ON SCHEMA public FROM PUBLIC is intentionally OMITTED
--       per SQL_VALIDATION_PLAN condition — Supabase dashboard, PostgREST,
--       and future key setups need schema USAGE.

-- EXPECTED: 7 privilege statements execute without error


-- ============================================================================
-- PHASE 1 COMPLETE
-- ============================================================================
-- Total statements executed: 13
--   §1: 1 DROP INDEX
--   §2: 6 CREATE INDEX
--   §3: 3 UPDATE (zero rows)
--   §4: 2 CREATE TRIGGER
--   §5: 7 privilege changes
--
-- Next: Run PHASE_1_VERIFY.sql for post-execution verification
-- DO NOT execute Phase 2 without separate approval.
-- ============================================================================
