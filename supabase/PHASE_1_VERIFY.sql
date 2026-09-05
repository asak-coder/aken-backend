-- ============================================================================
-- A K ENGINEERING — PHASE 1 POST-EXECUTION VERIFICATION
-- ============================================================================
-- Run AFTER PHASE_1_EXECUTE.sql has been executed successfully.
-- Every section must match its EXPECTED value.
-- ============================================================================

-- ── 1. Application tables = 15 ──────────────────────────────────────────────
SELECT count(*) AS table_count
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
-- EXPECTED: 15

-- ── 2. Application rows = 0 ─────────────────────────────────────────────────
SELECT
  'activity_logs' AS t, count(*) FROM public.activity_logs UNION ALL
  SELECT 'boq_entries', count(*) FROM public.boq_entries UNION ALL
  SELECT 'forecasts', count(*) FROM public.forecasts UNION ALL
  SELECT 'invoices', count(*) FROM public.invoices UNION ALL
  SELECT 'labour_entries', count(*) FROM public.labour_entries UNION ALL
  SELECT 'lead_email_notifications', count(*) FROM public.lead_email_notifications UNION ALL
  SELECT 'lead_notes', count(*) FROM public.lead_notes UNION ALL
  SELECT 'lead_whatsapp_notifications', count(*) FROM public.lead_whatsapp_notifications UNION ALL
  SELECT 'leads', count(*) FROM public.leads UNION ALL
  SELECT 'materials', count(*) FROM public.materials UNION ALL
  SELECT 'projects', count(*) FROM public.projects UNION ALL
  SELECT 'quotation_items', count(*) FROM public.quotation_items UNION ALL
  SELECT 'quotations', count(*) FROM public.quotations UNION ALL
  SELECT 'tenders', count(*) FROM public.tenders UNION ALL
  SELECT 'users', count(*) FROM public.users;
-- EXPECTED: all 0

-- ── 3. View = 1 ─────────────────────────────────────────────────────────────
SELECT count(*) AS view_count
FROM information_schema.views
WHERE table_schema = 'public';
-- EXPECTED: 1

-- ── 4. Index count = 52 ─────────────────────────────────────────────────────
-- Calculation: 47 (baseline) - 1 (§1 drop) + 6 (§2 create) = 52
SELECT count(*) AS index_count
FROM pg_indexes
WHERE schemaname = 'public';
-- EXPECTED: 52

-- ── 5. Unique index count = 17 (unchanged) ──────────────────────────────────
SELECT count(*) AS unique_index_count
FROM pg_indexes
WHERE schemaname = 'public' AND indexdef LIKE '%UNIQUE%';
-- EXPECTED: 17 (Phase 1 does not add/remove unique indexes)

-- ── 6. Foreign keys unchanged = 14 ──────────────────────────────────────────
SELECT count(*) AS fk_count
FROM information_schema.table_constraints
WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public';
-- EXPECTED: 14

-- ── 7. Trigger count = 12 (was 10, +2) ──────────────────────────────────────
SELECT count(*) AS trigger_count
FROM information_schema.triggers
WHERE trigger_schema = 'public';
-- EXPECTED: 12

-- ── 8. Notification triggers exist ───────────────────────────────────────────
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table IN ('lead_email_notifications', 'lead_whatsapp_notifications')
ORDER BY event_object_table;
-- EXPECTED: 2 rows (one per notification table)

-- ── 9. Dropped index no longer exists ────────────────────────────────────────
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public' AND indexname = 'quotations_lead_idx';
-- EXPECTED: 0 rows

-- ── 10. All six new indexes exist ────────────────────────────────────────────
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'leads_status_created_idx',
    'leads_owner_created_idx',
    'quotations_created_at_desc_idx',
    'projects_status_site_created_idx',
    'projects_created_at_desc_idx',
    'invoices_created_at_desc_idx'
  )
ORDER BY indexname;
-- EXPECTED: 6 rows

-- ── 11. Application RPC functions still exist ────────────────────────────────
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
ORDER BY routine_name;
-- EXPECTED: 12 functions (1 set_updated_at + 11 RPCs)

-- ── 12. RPC privileges: PUBLIC = false, service_role = true ──────────────────
SELECT grantee, privilege_type, count(*)
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND grantee IN ('PUBLIC', 'anon', 'authenticated', 'service_role')
GROUP BY grantee, privilege_type
ORDER BY grantee, privilege_type;
-- EXPECTED:
--   PUBLIC:           0 rows (was 12 rows for set_updated_at before §5)
--   anon:             0 rows
--   authenticated:    0 rows
--   service_role:     12 rows (EXECUTE on all functions)

-- ── 13. rls_auto_enable unchanged ────────────────────────────────────────────
SELECT proname FROM pg_proc WHERE proname = 'rls_auto_enable';
-- EXPECTED: 1 row

-- ── 14. ensure_rls unchanged ────────────────────────────────────────────────
SELECT proname FROM pg_proc WHERE proname = 'ensure_rls';
-- EXPECTED: 1 row

-- ── 15. quotations_number_idx still exists (Phase 2 drop) ───────────────────
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public' AND indexname = 'quotations_number_idx';
-- EXPECTED: 1 row (not dropped until Phase 2)

-- ── 16. activity_logs FKs still ON DELETE CASCADE (Phase 2 change) ──────────
SELECT tc.constraint_name, kcu.column_name, rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name = 'activity_logs' AND tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public';
-- EXPECTED: 2 rows with ON DELETE CASCADE

-- ── 17. No application data was inserted ────────────────────────────────────
SELECT count(*) AS total_rows
FROM (
  SELECT count(*) AS c FROM public.activity_logs UNION ALL
  SELECT count(*) FROM public.boq_entries UNION ALL
  SELECT count(*) FROM public.forecasts UNION ALL
  SELECT count(*) FROM public.invoices UNION ALL
  SELECT count(*) FROM public.labour_entries UNION ALL
  SELECT count(*) FROM public.lead_email_notifications UNION ALL
  SELECT count(*) FROM public.lead_notes UNION ALL
  SELECT count(*) FROM public.lead_whatsapp_notifications UNION ALL
  SELECT count(*) FROM public.leads UNION ALL
  SELECT count(*) FROM public.materials UNION ALL
  SELECT count(*) FROM public.projects UNION ALL
  SELECT count(*) FROM public.quotation_items UNION ALL
  SELECT count(*) FROM public.quotations UNION ALL
  SELECT count(*) FROM public.tenders UNION ALL
  SELECT count(*) FROM public.users
) sub;
-- EXPECTED: 0

-- ============================================================================
-- VERIFICATION COMPLETE
-- If all EXPECTED values match: PHASE 1 = PASS
-- If any mismatch: PHASE 1 = FAIL — document discrepancy
-- ============================================================================
