-- ============================================================================
-- Shared production demo company (fixed UUID)
-- ----------------------------------------------------------------------------
-- Single persistent tenant for anonymous "Try demo" viewers. Matches
-- FALLBACK_PRODUCTION_DEMO_COMPANY_ID / DEMO_COMPANY_ID in the app unless
-- overridden. After insert, invokes populate_demo_data_for_company when that
-- function exists (typically from manual deploy of supabase/109_populate_demo_data_function.sql).
-- ============================================================================

INSERT INTO public.companies (
  id,
  name,
  email,
  phone,
  address,
  setup_complete,
  setup_completed_at,
  setup_data
)
VALUES (
  '10000000-0000-4000-a000-000000000001'::uuid,
  'Demo Logistics Company',
  'demo@truckmates.com',
  '+15555550100',
  '1234 Transportation Blvd, Dallas, TX 75201',
  true,
  NOW(),
  jsonb_build_object('is_demo', true)
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  phone = COALESCE(EXCLUDED.phone, public.companies.phone),
  address = COALESCE(EXCLUDED.address, public.companies.address),
  setup_complete = true,
  setup_completed_at = COALESCE(public.companies.setup_completed_at, EXCLUDED.setup_completed_at),
  setup_data =
    COALESCE(public.companies.setup_data, '{}'::jsonb)
    || jsonb_build_object('is_demo', true);

DO $seed$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    INNER JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'populate_demo_data_for_company'
  ) THEN
    PERFORM public.populate_demo_data_for_company('10000000-0000-4000-a000-000000000001'::uuid);
  END IF;
END
$seed$;
