-- ============================================================================
-- PHASE 1 PREFLIGHT VERIFICATION
-- Run ALL of these in Supabase Dashboard SQL Editor BEFORE Phase 1 execution.
-- Each section returns the expected pre-execution baseline.
-- ============================================================================

-- ── 1. Project identity ──────────────────────────────────────────────────────
SELECT current_database(), current_user, version();

-- EXPECTED: postgres database, postgres user, PostgreSQL 15+

-- ── 2. Application table count = 15 ──────────────────────────────────────────
SELECT count(*) AS table_count
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- EXPECTED: 15

-- ── 3. Application table names ───────────────────────────────────────────────
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- EXPECTED (15 tables):
-- activity_logs, boq_entries, forecasts, invoices, labour_entries,
-- lead_email_notifications, lead_notes, lead_whatsapp_notifications, leads,
-- materials, projects, quotation_items, quotations, tenders, users

-- ── 4. View count = 1 ───────────────────────────────────────────────────────
SELECT count(*) AS view_count
FROM information_schema.views
WHERE table_schema = 'public';

-- EXPECTED: 1 (v_lead_overview)

-- ── 5. Row count = 0 across all tables ───────────────────────────────────────
-- Run individually per table; all must be 0
SELECT
  'activity_logs' AS t, count(*) FROM public.activity_logs
UNION ALL SELECT 'boq_entries', count(*) FROM public.boq_entries
UNION ALL SELECT 'forecasts', count(*) FROM public.forecasts
UNION ALL SELECT 'invoices', count(*) FROM public.invoices
UNION ALL SELECT 'labour_entries', count(*) FROM public.labour_entries
UNION ALL SELECT 'lead_email_notifications', count(*) FROM public.lead_email_notifications
UNION ALL SELECT 'lead_notes', count(*) FROM public.lead_notes
UNION ALL SELECT 'lead_whatsapp_notifications', count(*) FROM public.lead_whatsapp_notifications
UNION ALL SELECT 'leads', count(*) FROM public.leads
UNION ALL SELECT 'materials', count(*) FROM public.materials
UNION ALL SELECT 'projects', count(*) FROM public.projects
UNION ALL SELECT 'quotation_items', count(*) FROM public.quotation_items
UNION ALL SELECT 'quotations', count(*) FROM public.quotations
UNION ALL SELECT 'tenders', count(*) FROM public.tenders
UNION ALL SELECT 'users', count(*) FROM public.users;

-- EXPECTED: all 0

-- ── 6. Index count = 47 ──────────────────────────────────────────────────────
SELECT count(*) AS index_count
FROM pg_indexes
WHERE schemaname = 'public';

-- EXPECTED: 47

-- ── 7. Unique index count = 17 ──────────────────────────────────────────────
SELECT count(*) AS unique_index_count
FROM pg_indexes
WHERE schemaname = 'public' AND indexdef LIKE '%UNIQUE%';

-- EXPECTED: 17

-- ── 8. Trigger count = 10 ────────────────────────────────────────────────────
SELECT count(*) AS trigger_count
FROM information_schema.triggers
WHERE trigger_schema = 'public';

-- EXPECTED: 10 (all set_updated_at triggers)

-- ── 9. Trigger details ───────────────────────────────────────────────────────
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- EXPECTED: 10 triggers, one per table (users, leads, quotations, projects,
--           boq_entries, materials, labour_entries, invoices, forecasts, tenders)

-- ── 10. No notification triggers exist yet ───────────────────────────────────
SELECT trigger_name
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table IN ('lead_email_notifications', 'lead_whatsapp_notifications');

-- EXPECTED: 0 rows (these triggers will be created in Phase 1 §6)

-- ── 11. Function count = 12 ──────────────────────────────────────────────────
SELECT count(*) AS function_count
FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION';

-- EXPECTED: 12 (1 set_updated_at + 11 RPCs)

-- ── 12. RPC function names and privileges ────────────────────────────────────
SELECT
  r.routine_name,
  r.security_type,
  rp.grantee,
  rp.privilege_type
FROM information_schema.routines r
LEFT JOIN information_schema.routine_privileges rp
  ON r.routine_name = rp.routine_name
  AND r.routine_schema = rp.routine_schema
WHERE r.routine_schema = 'public'
  AND r.routine_type = 'FUNCTION'
ORDER BY r.routine_name, rp.grantee;

-- EXPECTED: 12 functions; 11 RPCs have service_role EXECUTE only;
--           set_updated_at has PUBLIC EXECUTE (will be revoked in Phase 1 §8)

-- ── 13. quotations_lead_idx exists (will be dropped) ─────────────────────────
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public' AND indexname = 'quotations_lead_idx';

-- EXPECTED: 1 row (will be dropped in Phase 1 §1)

-- ── 14. quotations_number_idx exists (will be dropped in Phase 2) ────────────
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public' AND indexname = 'quotations_number_idx';

-- EXPECTED: 1 row (dropped in Phase 2, not Phase 1)

-- ── 15. activity_logs FK constraints (will be modified in Phase 2) ───────────
SELECT
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS ref_table,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name = 'activity_logs'
  AND tc.constraint_type = 'FOREIGN KEY';

-- EXPECTED: 2 FKs with ON DELETE CASCADE (will be changed to SET NULL in Phase 2)

-- ── 16. activity_logs lead_id and performed_by NOT NULL ──────────────────────
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'activity_logs'
  AND column_name IN ('lead_id', 'performed_by');

-- EXPECTED: both NOT NULL (will be changed to nullable in Phase 2)

-- ── 17. set_updated_at function exists ───────────────────────────────────────
SELECT proname
FROM pg_proc
WHERE proname = 'set_updated_at';

-- EXPECTED: 1 row

-- ── 18. rls_auto_enable exists ───────────────────────────────────────────────
SELECT proname
FROM pg_proc
WHERE proname = 'rls_auto_enable';

-- EXPECTED: 1 row

-- ── 19. ensure_rls exists ───────────────────────────────────────────────────
SELECT proname
FROM pg_proc
WHERE proname = 'ensure_rls';

-- EXPECTED: 1 row

-- ============================================================================
-- PREFLIGHT COMPLETE
-- Verify all EXPECTED values match before proceeding to Phase 1 execution.
-- If any count differs, STOP and investigate before executing Phase 1.
-- ============================================================================
