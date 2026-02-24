-- ============================================================================
-- Final Fix for spatial_ref_sys RLS Warning
-- ============================================================================
-- Since we cannot alter the PostGIS-owned table directly, we'll restrict
-- access by revoking privileges from PostgREST roles (anon/authenticated)
-- ============================================================================

-- Method 1: Revoke access from PostgREST roles (Recommended)
-- This prevents the table from being accessible via the API
-- This is the safest approach for a system table that clients don't need

-- Revoke all privileges from anon role (used by PostgREST for unauthenticated requests)
REVOKE ALL ON TABLE public.spatial_ref_sys FROM anon;

-- Revoke all privileges from authenticated role (used by PostgREST for authenticated requests)
REVOKE ALL ON TABLE public.spatial_ref_sys FROM authenticated;

-- Revoke all privileges from service_role (if you want to be extra safe)
-- Note: service_role typically needs access, so only revoke if you're sure
-- REVOKE ALL ON TABLE public.spatial_ref_sys FROM service_role;

-- Grant SELECT only to postgres role (for internal operations)
-- This allows PostGIS functions to work, but blocks API access
GRANT SELECT ON TABLE public.spatial_ref_sys TO postgres;

-- Method 2: If clients need spatial reference data, create a view with limited access
-- This creates a read-only view that can have RLS enabled
DROP VIEW IF EXISTS public.spatial_ref_sys_public CASCADE;

CREATE VIEW public.spatial_ref_sys_public AS
SELECT 
  srid,
  auth_name,
  auth_srid,
  srtext,
  proj4text
FROM public.spatial_ref_sys
WHERE srid IN (
  -- Only expose commonly used SRIDs (WGS84, Web Mercator, etc.)
  4326,  -- WGS 84 (most common)
  3857,  -- Web Mercator
  4269,  -- NAD83
  4267   -- NAD27
);

-- Grant SELECT on the view to anon and authenticated roles
GRANT SELECT ON public.spatial_ref_sys_public TO anon;
GRANT SELECT ON public.spatial_ref_sys_public TO authenticated;

-- Note: If you need all SRIDs accessible, use this instead:
-- CREATE VIEW public.spatial_ref_sys_public AS SELECT * FROM public.spatial_ref_sys;
-- GRANT SELECT ON public.spatial_ref_sys_public TO anon, authenticated;

-- ============================================================================
-- Verification
-- ============================================================================
-- Check privileges on the table:
-- SELECT grantee, privilege_type 
-- FROM information_schema.role_table_grants 
-- WHERE table_schema = 'public' AND table_name = 'spatial_ref_sys';
--
-- Should show: Only postgres role has access (no anon, no authenticated)
--
-- Test API access (should fail):
-- curl -H "apikey: YOUR_ANON_KEY" \
--      -H "Authorization: Bearer YOUR_ANON_KEY" \
--      https://YOUR_PROJECT.supabase.co/rest/v1/spatial_ref_sys
-- Should return: 403 Forbidden or similar
-- ============================================================================

