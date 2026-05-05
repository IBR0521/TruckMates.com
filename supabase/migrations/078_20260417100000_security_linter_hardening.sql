-- Security linter hardening migration
-- Addresses:
-- 1) function_search_path_mutable
-- 2) permissive RLS policies (always true) on system-write tables
--
-- Note: leaked password protection must be enabled in Supabase Dashboard
-- (Authentication -> Password Security), not via SQL.

BEGIN;

-- Tighten permissive system-write policies to service_role only.
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

DROP POLICY IF EXISTS "System can write usage logs" ON public.api_usage_log;
CREATE POLICY "System can write usage logs"
  ON public.api_usage_log FOR INSERT
  TO service_role
  WITH CHECK ((auth.role() = 'service_role'));

DROP POLICY IF EXISTS "System can insert API key usage" ON public.api_key_usage;
CREATE POLICY "System can insert API key usage"
  ON public.api_key_usage FOR INSERT
  TO service_role
  WITH CHECK ((auth.role() = 'service_role'));

DROP POLICY IF EXISTS "System can insert load status history" ON public.load_status_history;
CREATE POLICY "System can insert load status history"
  ON public.load_status_history FOR INSERT
  TO service_role
  WITH CHECK ((auth.role() = 'service_role'));

DROP POLICY IF EXISTS "System can insert notifications for users" ON public.notifications;
CREATE POLICY "System can insert notifications for users"
  ON public.notifications FOR INSERT
  TO service_role
  WITH CHECK ((auth.role() = 'service_role'));

-- Apply fixed search_path to mutable public SQL/PLpgSQL functions.
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
