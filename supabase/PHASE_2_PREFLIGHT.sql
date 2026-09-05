-- ============================================================================
-- A K ENGINEERING — PHASE 2 PREFLIGHT / DATA-GATE VERIFICATION (READ-ONLY)
-- ============================================================================
-- This script is the gatekeeper between PHASE 1 (already executed/verified)
-- and PHASE 2 execution. It ONLY inspects. It NEVER repairs data.
--
-- ALLOWED:   SELECT, WITH (CTE), COUNT, GROUP BY, HAVING,
--            pg_proc / pg_namespace / pg_catalog / information_schema
--            inspection, has_function_privilege.
-- FORBIDDEN: INSERT, UPDATE, DELETE, TRUNCATE, DROP, CREATE INDEX /
--            CREATE UNIQUE INDEX, ALTER TABLE, ALTER FUNCTION,
--            CREATE FUNCTION, CREATE TRIGGER, DROP TRIGGER, GRANT, REVOKE.
--
-- PREREQUISITES (must ALL be true before running):
--   1. PHASE 1 executed and verified — supabase/PHASE_1_VERIFY.sql = PASS.
--   2. Pre-migration backup CONFIRMED available (physical backup + an
--      off-platform copy; see supabase/backups/README.md).
--   3. Run in Supabase Dashboard -> SQL Editor.
--
-- RESULT RULES:
--   * G1-G6 violation queries MUST return 0 rows.
--   * L1 MUST return both B2 RPCs with the EXACT signatures shown below.
--   * L2 MUST return email_execute = true and whatsapp_execute = true.
--   * The FINAL PREFLIGHT SUMMARY MUST show PASS for every gate.
--   * If ANY gate is FAIL: PHASE 2 EXECUTION MUST NOT BEGIN.
--     Report the violations for human review and STOP. No automated repair.
-- ============================================================================

-- ============================================================
-- PHASE 2 PREFLIGHT
-- ============================================================

-- ----------------------------------------------------------------------------
-- G1 — Duplicate quotation numbers
-- EXPECTED: 0 rows
-- Gate for: CREATE UNIQUE INDEX on quotations.quotation_number
-- If rows appear: report them, do NOT rename/delete/merge/NULL, STOP.
-- ----------------------------------------------------------------------------
SELECT quotation_number, COUNT(*) AS duplicate_count
FROM public.quotations
WHERE quotation_number IS NOT NULL
  AND btrim(quotation_number) <> ''
GROUP BY quotation_number
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, quotation_number;

-- ----------------------------------------------------------------------------
-- G2 — Duplicate invoice numbers
-- EXPECTED: 0 rows
-- Gate for: CREATE UNIQUE INDEX on invoices.invoice_number
-- If rows appear: report them, do NOT modify data, STOP.
-- ----------------------------------------------------------------------------
SELECT invoice_number, COUNT(*) AS duplicate_count
FROM public.invoices
WHERE invoice_number IS NOT NULL
  AND btrim(invoice_number) <> ''
GROUP BY invoice_number
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, invoice_number;

-- ----------------------------------------------------------------------------
-- G3 — Multiple projects per lead
-- EXPECTED: 0 rows
-- Gate for: CREATE UNIQUE INDEX on projects.lead_id (1:1 lead -> project)
-- If rows appear: report them, do NOT delete or merge projects, STOP.
-- ----------------------------------------------------------------------------
SELECT lead_id, COUNT(*) AS project_count
FROM public.projects
WHERE lead_id IS NOT NULL
GROUP BY lead_id
HAVING COUNT(*) > 1
ORDER BY project_count DESC, lead_id;

-- ----------------------------------------------------------------------------
-- G4 — Quotation total mismatches
-- EXPECTED: 0 rows  (0.01 tolerance on NUMERIC(14,2))
-- Gate for: CHECK constraint total_amount = subtotal + gst
-- If rows appear: report them, do NOT change amounts, STOP.
-- ----------------------------------------------------------------------------
SELECT id, subtotal, gst, total_amount
FROM public.quotations
WHERE ABS(total_amount - (subtotal + gst)) > 0.01
ORDER BY id;

-- ----------------------------------------------------------------------------
-- G5 — Invoice overpayments
-- EXPECTED: 0 rows
-- Gate for: CHECK constraint paid_amount <= amount
-- If rows appear: report them, do NOT modify payment data, STOP.
-- ----------------------------------------------------------------------------
SELECT id, amount, paid_amount
FROM public.invoices
WHERE paid_amount > amount
ORDER BY id;

-- ----------------------------------------------------------------------------
-- G6 — Invalid lead email casing
-- EXPECTED: 0 rows  (email must equal lower(email))
-- Gate for: CHECK constraint email = lower(email) on public.leads
-- VERIFICATION-ONLY gate: the lowercase UPDATE is NOT part of this preflight.
-- If rows appear: report them, do NOT update, STOP.
-- ----------------------------------------------------------------------------
SELECT id, email
FROM public.leads
WHERE email <> lower(email)
ORDER BY id;

-- ============================================================
-- L1 — B2 RPC existence/signatures
-- ============================================================

-- EXPECTED (2 rows, EXACT signatures):
--   upsert_lead_email_notification
--     (uuid, timestamptz, boolean, timestamptz, boolean, timestamptz,
--      boolean, int, text, boolean, jsonb, boolean)
--   upsert_lead_whatsapp_notification
--     (uuid, timestamptz, boolean, timestamptz, boolean, timestamptz,
--      boolean, int, text, boolean, jsonb, boolean, text, boolean)
-- NOTE: pg_get_function_identity_arguments returns canonical PostgreSQL type
--       names, so the `int` argument is rendered as `integer`. This is the
--       SAME signature. The final summary normalizes `integer` -> `int`.
-- If 0 rows, or any signature differs: L1 = FAIL, STOP.

SELECT
    p.proname,
    pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n
    ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
      'upsert_lead_email_notification',
      'upsert_lead_whatsapp_notification'
  )
ORDER BY p.proname;

-- ============================================================
-- L2 — B2 service_role EXECUTE privileges
-- ============================================================

-- EXPECTED: email_execute = true
SELECT has_function_privilege(
    'service_role',
    'public.upsert_lead_email_notification(uuid,timestamptz,boolean,timestamptz,boolean,timestamptz,boolean,int,text,boolean,jsonb,boolean)',
    'execute'
) AS email_execute;

-- EXPECTED: whatsapp_execute = true
SELECT has_function_privilege(
    'service_role',
    'public.upsert_lead_whatsapp_notification(uuid,timestamptz,boolean,timestamptz,boolean,timestamptz,boolean,int,text,boolean,jsonb,boolean,text,boolean)',
    'execute'
) AS whatsapp_execute;

-- ============================================================
-- FINAL PREFLIGHT SUMMARY
-- ============================================================

-- Each gate is recomputed INDEPENDENTLY using the same predicate shown above
-- (no gate silently borrows another gate's result).
-- OVERALL = PASS only when G1-G6 AND L1 AND L2 are ALL PASS.

WITH gate_results AS (
  SELECT 'G1' AS gate,
         CASE WHEN NOT EXISTS (
                SELECT 1
                FROM (
                  SELECT quotation_number
                  FROM public.quotations
                  WHERE quotation_number IS NOT NULL
                    AND btrim(quotation_number) <> ''
                  GROUP BY quotation_number
                  HAVING COUNT(*) > 1
                ) g1_dups
              ) THEN 'PASS' ELSE 'FAIL' END AS status
  UNION ALL
  SELECT 'G2',
         CASE WHEN NOT EXISTS (
                SELECT 1
                FROM (
                  SELECT invoice_number
                  FROM public.invoices
                  WHERE invoice_number IS NOT NULL
                    AND btrim(invoice_number) <> ''
                  GROUP BY invoice_number
                  HAVING COUNT(*) > 1
                ) g2_dups
              ) THEN 'PASS' ELSE 'FAIL' END
  UNION ALL
  SELECT 'G3',
         CASE WHEN NOT EXISTS (
                SELECT 1
                FROM (
                  SELECT lead_id
                  FROM public.projects
                  WHERE lead_id IS NOT NULL
                  GROUP BY lead_id
                  HAVING COUNT(*) > 1
                ) g3_dups
              ) THEN 'PASS' ELSE 'FAIL' END
  UNION ALL
  SELECT 'G4',
         CASE WHEN NOT EXISTS (
                SELECT 1 FROM public.quotations
                WHERE ABS(total_amount - (subtotal + gst)) > 0.01
              ) THEN 'PASS' ELSE 'FAIL' END
  UNION ALL
  SELECT 'G5',
         CASE WHEN NOT EXISTS (
                SELECT 1 FROM public.invoices
                WHERE paid_amount > amount
              ) THEN 'PASS' ELSE 'FAIL' END
  UNION ALL
  SELECT 'G6',
         CASE WHEN NOT EXISTS (
                SELECT 1 FROM public.leads
                WHERE email <> lower(email)
              ) THEN 'PASS' ELSE 'FAIL' END
  UNION ALL
  SELECT 'L1',
         CASE WHEN
           (SELECT count(*)
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname = 'upsert_lead_email_notification'
              AND replace(pg_get_function_identity_arguments(p.oid), 'integer', 'int') =
                'uuid,timestamptz,boolean,timestamptz,boolean,timestamptz,boolean,int,text,boolean,jsonb,boolean') = 1
           AND
           (SELECT count(*)
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname = 'upsert_lead_whatsapp_notification'
              AND replace(pg_get_function_identity_arguments(p.oid), 'integer', 'int') =
                'uuid,timestamptz,boolean,timestamptz,boolean,timestamptz,boolean,int,text,boolean,jsonb,boolean,text,boolean') = 1
           THEN 'PASS' ELSE 'FAIL' END
  UNION ALL
  SELECT 'L2',
         CASE WHEN
           (SELECT has_function_privilege('service_role', p.oid, 'execute')
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname = 'upsert_lead_email_notification'
              AND replace(pg_get_function_identity_arguments(p.oid), 'integer', 'int') =
                'uuid,timestamptz,boolean,timestamptz,boolean,timestamptz,boolean,int,text,boolean,jsonb,boolean')
           AND
           (SELECT has_function_privilege('service_role', p.oid, 'execute')
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname = 'upsert_lead_whatsapp_notification'
              AND replace(pg_get_function_identity_arguments(p.oid), 'integer', 'int') =
                'uuid,timestamptz,boolean,timestamptz,boolean,timestamptz,boolean,int,text,boolean,jsonb,boolean,text,boolean')
           THEN 'PASS' ELSE 'FAIL' END
)
SELECT gate, status
FROM gate_results
UNION ALL
SELECT 'OVERALL',
       CASE WHEN (SELECT count(*) FROM gate_results WHERE status = 'FAIL') = 0
            THEN 'PHASE 2 PREFLIGHT = PASS'
            ELSE 'PHASE 2 PREFLIGHT = FAIL - STOP'
       END
ORDER BY gate;

-- ============================================================================
-- PREFLIGHT COMPLETE
-- ============================================================================
-- ACTION:
--   ALL gates PASS  -> Phase 2 execution MAY be scheduled as a SEPARATE step,
--                      following the documented deployment order, with the
--                      pre-migration backup still confirmed available.
--   ANY gate FAIL   -> Phase 2 execution MUST NOT begin. Report the violation
--                      rows for human review. This script never repairs data.
-- ============================================================================
