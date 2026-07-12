-- F14: lock the transactional money / load-assignment RPCs to service_role only.
--
-- These functions are SECURITY DEFINER (bypass RLS) and insert `company_id := p_company_id`
-- straight from a caller-supplied argument with no auth.uid() check. Migrations 251/255 revoked
-- `anon`/PUBLIC but GRANTed EXECUTE to `authenticated` — and PostgREST exposes every
-- authenticated-executable function at /rest/v1/rpc/<name>. So any logged-in user could call
-- them directly with a forged p_company_id (cross-tenant write) or bypass the app-layer auth,
-- RBAC, plan limits, credit gates and tax resolution on their own company (privilege bypass).
--
-- The only legitimate callers are server actions using the service-role (admin) client, which
-- perform auth + RBAC BEFORE invoking the RPC (see app/actions/accounting.ts, dispatches.ts,
-- auto-invoice.ts — all now call these via the admin client). Revoke from everyone else.

DO $$
DECLARE
  fn_name text;
  fn_names text[] := ARRAY[
    'create_invoice_transactional',
    'create_settlement_transactional',
    'assign_load_transactional'
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
      -- Revoking PUBLIC also removes the implicit grant service_role inherits, so re-grant it explicitly.
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', r.func_sig);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.func_sig);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', r.func_sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.func_sig);
    END LOOP;
  END LOOP;
END $$;
