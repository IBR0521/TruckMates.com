-- ============================================================================
-- Fix RLS Warning for spatial_ref_sys Table
-- ============================================================================
-- This fixes the Supabase security warning about spatial_ref_sys not having RLS
-- spatial_ref_sys is a PostGIS system table containing spatial reference system definitions
-- ============================================================================

-- Enable RLS on spatial_ref_sys table
ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows read access to all users
-- This is safe because spatial_ref_sys is a read-only system table with reference data
CREATE POLICY "Allow read access to spatial_ref_sys for all users"
ON public.spatial_ref_sys
FOR SELECT
TO public
USING (true);

-- Optional: Add a comment explaining why this is safe
COMMENT ON TABLE public.spatial_ref_sys IS 
'PostGIS system table containing spatial reference system definitions. Read-only reference data. RLS enabled with public read access.';

-- ============================================================================
-- Verification
-- ============================================================================
-- After running this, verify RLS is enabled:
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' AND tablename = 'spatial_ref_sys';
-- 
-- Should return: rowsecurity = true
-- ============================================================================

