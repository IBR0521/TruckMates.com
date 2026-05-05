-- ============================================================================
-- Security linter hardening pass
-- Fixes:
-- 1) function_search_path_mutable
-- 2) rls_policy_always_true
-- Documents:
-- 3) extension_in_public
-- 4) auth_leaked_password_protection
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: Replace permissive "always true" system write policies
-- ============================================================================

-- api_cache (handle both historical naming styles)
DROP POLICY IF EXISTS "System can write cache" ON public.api_cache;
DROP POLICY IF EXISTS "System can insert cache" ON public.api_cache;
DROP POLICY IF EXISTS "System can update cache" ON public.api_cache;
DROP POLICY IF EXISTS "System can delete cache" ON public.api_cache;

CREATE POLICY "System can insert cache"
  ON public.api_cache FOR INSERT
  TO service_role
  WITH CHECK ((auth.role() = 'service_role'));

CREATE POLICY "System can update cache"
  ON public.api_cache FOR UPDATE
  TO service_role
  USING ((auth.role() = 'service_role'))
  WITH CHECK ((auth.role() = 'service_role'));

CREATE POLICY "System can delete cache"
  ON public.api_cache FOR DELETE
  TO service_role
  USING ((auth.role() = 'service_role'));

-- api_usage_log
DROP POLICY IF EXISTS "System can write usage logs" ON public.api_usage_log;

CREATE POLICY "System can write usage logs"
  ON public.api_usage_log FOR INSERT
  TO service_role
  WITH CHECK ((auth.role() = 'service_role'));

-- api_key_usage
DROP POLICY IF EXISTS "System can insert API key usage" ON public.api_key_usage;

CREATE POLICY "System can insert API key usage"
  ON public.api_key_usage FOR INSERT
  TO service_role
  WITH CHECK ((auth.role() = 'service_role'));

-- load_status_history
DROP POLICY IF EXISTS "System can insert load status history" ON public.load_status_history;

CREATE POLICY "System can insert load status history"
  ON public.load_status_history FOR INSERT
  TO service_role
  WITH CHECK ((auth.role() = 'service_role'));

-- notifications
DROP POLICY IF EXISTS "System can insert notifications for users" ON public.notifications;

CREATE POLICY "System can insert notifications for users"
  ON public.notifications FOR INSERT
  TO service_role
  WITH CHECK ((auth.role() = 'service_role'));

-- ============================================================================
-- PART 2: Set fixed search_path for mutable functions in public schema
-- ============================================================================
-- Applies to SQL/PLpgSQL functions that do not already define search_path.
-- Uses ALTER FUNCTION to preserve existing function bodies.

DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS function_name,
      p.oid AS function_oid,
      pg_get_function_identity_arguments(p.oid) AS identity_args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_language l ON l.oid = p.prolang
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND l.lanname IN ('sql', 'plpgsql')
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(COALESCE(p.proconfig, ARRAY[]::TEXT[])) AS cfg
        WHERE cfg LIKE 'search_path=%'
      )
  LOOP
    BEGIN
      EXECUTE FORMAT(
        'ALTER FUNCTION %I.%I(%s) SET search_path = pg_catalog, public, extensions',
        fn.schema_name,
        fn.function_name,
        fn.identity_args
      );
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE
          'Could not set search_path for %.%(%) - %',
          fn.schema_name,
          fn.function_name,
          fn.identity_args,
          SQLERRM;
    END;
  END LOOP;
END $$;

COMMIT;

-- ============================================================================
-- Remaining warnings requiring non-SQL changes
-- ============================================================================
-- extension_in_public (postgis, vector):
--   Supabase commonly provisions these in public; moving can break integrations.
--   If you choose to move them, plan a dedicated migration and compatibility test.
--
-- auth_leaked_password_protection:
--   Enable in Supabase Dashboard:
--   Authentication -> Settings -> Password Security -> Leaked password protection.
-- ============================================================================
