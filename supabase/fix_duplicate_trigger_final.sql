-- ============================================================================
-- FINAL FIX FOR DUPLICATE TRIGGER
-- ============================================================================
-- This script uses pg_trigger system catalog for more control
-- ============================================================================

-- Step 1: Show current state
SELECT 
  'BEFORE' as stage,
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgenabled as enabled
FROM pg_trigger
WHERE tgname = 'route_linestring_trigger';

-- Step 2: Drop ALL instances using pg_trigger (more reliable)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT oid, tgname, tgrelid::regclass as table_name
    FROM pg_trigger
    WHERE tgname = 'route_linestring_trigger'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s CASCADE', r.tgname, r.table_name);
    RAISE NOTICE 'Dropped trigger % on table %', r.tgname, r.table_name;
  END LOOP;
END $$;

-- Step 3: Verify all are gone
SELECT 
  'AFTER DROP' as stage,
  COUNT(*) as remaining_triggers
FROM pg_trigger
WHERE tgname = 'route_linestring_trigger';

-- Step 4: Verify function exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
      AND p.proname = 'trigger_create_route_linestring'
  ) THEN
    RAISE EXCEPTION 'Function trigger_create_route_linestring does not exist!';
  END IF;
END $$;

-- Step 5: Create trigger ONCE
CREATE TRIGGER route_linestring_trigger
  AFTER INSERT OR UPDATE OF waypoints, origin_coordinates, destination_coordinates
  ON public.routes
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_route_linestring();

-- Step 6: Final verification
SELECT 
  'FINAL' as stage,
  COUNT(*) as trigger_count,
  CASE WHEN COUNT(*) = 1 THEN '✅ SUCCESS' ELSE '❌ FAILED - ' || COUNT(*) || ' triggers found' END as status
FROM pg_trigger
WHERE tgname = 'route_linestring_trigger';

-- Also verify via information_schema
SELECT 
  'INFO_SCHEMA_CHECK' as check_type,
  COUNT(*) as trigger_count,
  CASE WHEN COUNT(*) = 1 THEN '✅ SUCCESS' ELSE '❌ FAILED' END as status
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name = 'route_linestring_trigger';


