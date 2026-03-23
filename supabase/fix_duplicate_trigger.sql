-- ============================================================================
-- FIX DUPLICATE TRIGGER
-- ============================================================================
-- This script fixes the duplicate route_linestring_trigger issue
-- ============================================================================

-- First, let's see what triggers exist
SELECT 
  trigger_name,
  event_object_table,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name = 'route_linestring_trigger'
ORDER BY trigger_name, event_object_table;

-- Drop all instances of the trigger (safe - we'll recreate it)
DROP TRIGGER IF EXISTS route_linestring_trigger ON public.routes;

-- Recreate the trigger (from realtime_eta.sql)
CREATE TRIGGER route_linestring_trigger
  AFTER INSERT OR UPDATE OF waypoints, origin_coordinates, destination_coordinates
  ON public.routes
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_route_linestring();

-- Verify only one trigger exists now
SELECT 
  'VERIFICATION' as check_type,
  COUNT(*) as trigger_count,
  CASE WHEN COUNT(*) = 1 THEN '✅ FIXED' ELSE '❌ STILL HAS ISSUES' END as status
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name = 'route_linestring_trigger';


