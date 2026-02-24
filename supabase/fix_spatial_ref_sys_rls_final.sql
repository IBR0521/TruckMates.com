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

-- Method 2: Remove any existing views we may have created (optional cleanup)
-- If you created a view earlier, remove it to avoid SECURITY DEFINER warnings
DROP VIEW IF EXISTS public.spatial_ref_sys_public CASCADE;
DROP VIEW IF EXISTS public.spatial_ref_sys_view CASCADE;
DROP VIEW IF EXISTS public.spatial_ref_sys_secure CASCADE;

-- ============================================================================
-- IMPORTANT NOTE ABOUT THE WARNING
-- ============================================================================
-- After running this script, the security scanner may STILL show the warning
-- "Table public.spatial_ref_sys is public, but RLS has not been enabled."
--
-- This is EXPECTED and can be SAFELY IGNORED because:
--
-- 1. We have REVOKED all access from anon/authenticated roles
--    - The table is NOT accessible via PostgREST API
--    - Clients cannot read or modify the table
--
-- 2. We CANNOT enable RLS on the table because:
--    - It's owned by the PostGIS extension (not your user)
--    - You'll get "must be owner" error if you try
--
-- 3. The security scanner checks for RLS, but doesn't check for revoked privileges
--    - This is a limitation of the scanner
--    - The table is actually secure (no API access)
--
-- 4. To fully resolve the warning, you would need to:
--    - Contact Supabase support to move the table to a different schema, OR
--    - Have them add an exception for PostGIS system tables
--
-- The table is secure - the warning is a false positive after revoking access.
-- ============================================================================

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

