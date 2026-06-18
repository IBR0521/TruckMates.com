-- Security hardening: revoke broad EXECUTE grants on internal/trigger/cron functions.
-- Verified against app/supabase.rpc() usage (2026-06-18). See scripts/verify-function-grant-rpc-safety.mjs
--
-- EXCEPTION (not in full-revoke list): auto_create_maintenance_reminders_from_schedule — still called
-- from app/actions/reminders-enhanced.ts via authenticated client; anon-only revoke below.

-- ---------------------------------------------------------------------------
-- PART 1a: Revoke EXECUTE from anon AND authenticated (trigger/cron/internal only)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  fn_name text;
  fn_names text[] := ARRAY[
    'trigger_auto_complete_maintenance_reminders',
    'trigger_auto_enable_integrations',
    'trigger_auto_generate_invoice_on_pod',
    'trigger_crm_document_expiration_alert',
    'trigger_insurance_expiration_alert',
    'trigger_send_pod_alerts',
    'check_hos_exceptions',
    'create_hos_exception_notifications',
    'notify_eld_telemetry_geofence_webhook',
    'handle_new_user',
    'apply_expired_trial_downgrades'
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
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', r.func_sig);
    END LOOP;
  END LOOP;
END $$;

-- Zero-arg overload of auto_create_maintenance_reminders_from_schedule (placeholder in 057; unused by RPC).
-- Parameterized version (uuid) remains callable by authenticated — see PART 1b.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS func_sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'auto_create_maintenance_reminders_from_schedule'
      AND pg_get_function_identity_arguments(p.oid) = ''
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', r.func_sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.func_sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', r.func_sig);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- PART 1b: Revoke EXECUTE from anon ONLY (authenticated app RPCs keep access)
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
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.func_sig);
    END LOOP;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- PART 2: Explicit search_path on flagged functions (pattern: migrations/076)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_eld_idle_sessions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

-- Large bodies: ALTER avoids re-pasting 800+ line definitions.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS func_sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'populate_demo_data_for_company',
        'create_work_order_from_maintenance'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', r.func_sig);
  END LOOP;
END $$;
