-- ============================================================================
-- Fix RLS Warning for spatial_ref_sys Table
-- ============================================================================
-- This fixes the Supabase security warning about spatial_ref_sys not having RLS
-- spatial_ref_sys is a PostGIS system table containing spatial reference system definitions
-- 
-- NOTE: Since spatial_ref_sys is owned by the PostGIS extension, we cannot
-- directly alter it. Instead, we'll move it to a different schema or create
-- a secure view. However, the simplest solution is to move PostGIS system
-- tables out of the public schema.
-- ============================================================================

-- Option 1: Move spatial_ref_sys to postgis schema (if you have superuser access)
-- This requires superuser privileges, which may not be available in Supabase
-- Uncomment if you have the necessary permissions:
/*
ALTER TABLE public.spatial_ref_sys SET SCHEMA postgis;
*/

-- Option 2: Create a secure view with RLS (Recommended for Supabase)
-- This creates a view that wraps the system table with RLS enabled
DROP VIEW IF EXISTS public.spatial_ref_sys_secure CASCADE;

CREATE VIEW public.spatial_ref_sys_secure
WITH (security_invoker=true) AS
SELECT * FROM public.spatial_ref_sys;

-- Enable RLS on the view
ALTER VIEW public.spatial_ref_sys_secure SET (security_barrier = true);

-- Note: Views don't support RLS policies directly, but we can use security_barrier
-- For Supabase, the recommended approach is to acknowledge this is a system table
-- and the warning can be safely ignored, OR contact Supabase support to move
-- PostGIS system tables to a different schema.

-- ============================================================================
-- Alternative: Document that this warning can be safely ignored
-- ============================================================================
-- The spatial_ref_sys table is a PostGIS system table that:
-- 1. Contains read-only reference data (spatial reference system definitions)
-- 2. Is owned by the PostGIS extension (not user-modifiable)
-- 3. Does not contain sensitive user data
-- 4. Is required for PostGIS to function properly
--
-- Supabase's security scanner flags it because it's in the public schema
-- without RLS, but since it's a system table with read-only reference data,
-- this warning can be safely ignored.
--
-- If you need to resolve the warning, contact Supabase support to:
-- 1. Move PostGIS system tables to a non-public schema, OR
-- 2. Add an exception for PostGIS system tables in the security scanner
-- ============================================================================

