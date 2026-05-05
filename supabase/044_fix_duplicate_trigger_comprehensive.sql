-- ============================================================================
-- COMPREHENSIVE FIX FOR DUPLICATE TRIGGER
-- ============================================================================
-- This script thoroughly removes all instances and recreates cleanly
-- ============================================================================

-- Step 1: Show what we're dealing with
SELECT 
  'BEFORE FIX' as stage,
  trigger_schema,
  trigger_name,
  event_object_table,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_name = 'route_linestring_trigger'
ORDER BY trigger_schema, event_object_table;

-- Step 2: Drop from ALL possible locations
-- Drop from public schema
DROP TRIGGER IF EXISTS route_linestring_trigger ON public.routes CASCADE;

-- Drop from any other schemas (if they exist)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT DISTINCT trigger_schema, event_object_table
    FROM information_schema.triggers
    WHERE trigger_name = 'route_linestring_trigger'
      AND trigger_schema != 'public'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I CASCADE', 
      'route_linestring_trigger', r.trigger_schema, r.event_object_table);
  END LOOP;
END $$;

-- Step 3: Verify function exists before creating trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_schema = 'public' 
      AND routine_name = 'trigger_create_route_linestring'
  ) THEN
    RAISE EXCEPTION 'Function trigger_create_route_linestring does not exist!';
  END IF;
END $$;

-- Step 4: Recreate the trigger ONCE
CREATE TRIGGER route_linestring_trigger
  AFTER INSERT OR UPDATE OF waypoints, origin_coordinates, destination_coordinates
  ON public.routes
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_route_linestring();

-- Step 5: Verify result
SELECT 
  'AFTER FIX' as stage,
  trigger_schema,
  trigger_name,
  event_object_table,
  event_manipulation,
  CASE WHEN COUNT(*) OVER () = 1 THEN '✅ FIXED' ELSE '❌ STILL HAS ISSUES' END as status
FROM information_schema.triggers
WHERE trigger_name = 'route_linestring_trigger'
ORDER BY trigger_schema, event_object_table;

-- Final count check
SELECT 
  'FINAL VERIFICATION' as check_type,
  COUNT(*) as trigger_count,
  CASE WHEN COUNT(*) = 1 THEN '✅ SUCCESS' ELSE '❌ FAILED - ' || COUNT(*) || ' triggers found' END as status
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name = 'route_linestring_trigger';


