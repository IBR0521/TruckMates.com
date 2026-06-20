-- Fix PUBLIC grant gap left by migration 251 PART 1b.
-- PART 1b revoked EXECUTE from anon only; these functions still inherited EXECUTE via PUBLIC.
-- PART 1a already revokes PUBLIC (verified in 251 lines 36–38) — no changes needed for 1a list.

-- ---------------------------------------------------------------------------
-- PART 1b fix: REVOKE PUBLIC, re-GRANT authenticated (same 20 names as migration 251)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  fn_name text;
  fn_names text[] := ARRAY[
    'assign_load_transactional',
    'auto_enable_platform_integrations',
    'auto_create_maintenance_reminders_from_schedule',
    'bump_ai_context_version',
    'calculate_remaining_hos',
    'create_invoice_transactional',
    'create_settlement_transactional',
    'get_conversation_history',
    'get_dvir_stats',
    'get_ifta_tax_rate',
    'get_ifta_tax_rates_for_quarter',
    'increment_ai_action_preference',
    'mark_all_notifications_read',
    'mark_notification_read',
    'populate_demo_data_for_company',
    'process_geofence_point',
    'send_pod_alert_notifications',
    'update_company_for_setup',
    'update_company_setup_complete',
    'upsert_ai_company_memory'
  ];
  r RECORD;
BEGIN
  FOREACH fn_name IN ARRAY fn_names
  LOOP
    FOR r IN
      SELECT p.oid::regprocedure AS func_sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn_name
    LOOP
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', r.func_sig);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.func_sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.func_sig);
    END LOOP;
  END LOOP;
END $$;
