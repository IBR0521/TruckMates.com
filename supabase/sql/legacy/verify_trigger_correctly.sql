-- ============================================================================
-- CORRECT TRIGGER VERIFICATION
-- ============================================================================
-- PostgreSQL creates separate entries for INSERT and UPDATE events
-- This is NORMAL behavior - one trigger definition = multiple entries
-- ============================================================================

-- Check trigger exists (should show 2 rows - one for INSERT, one for UPDATE)
SELECT 
  trigger_name,
  event_manipulation,  -- Should show 'INSERT' and 'UPDATE'
  event_object_table,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name = 'route_linestring_trigger'
ORDER BY event_manipulation;

-- Verify we have exactly 2 entries (INSERT + UPDATE) - this is CORRECT
SELECT 
  'TRIGGER VERIFICATION' as check_type,
  COUNT(*) as event_count,
  CASE 
    WHEN COUNT(*) = 2 THEN '✅ CORRECT - INSERT + UPDATE events'
    WHEN COUNT(*) = 1 THEN '⚠️ WARNING - Only one event type found'
    WHEN COUNT(*) = 0 THEN '❌ ERROR - Trigger not found'
    ELSE '❌ ERROR - Unexpected count: ' || COUNT(*)
  END as status,
  STRING_AGG(event_manipulation, ', ' ORDER BY event_manipulation) as events
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name = 'route_linestring_trigger';

-- Verify it's on the correct table
SELECT 
  'TABLE VERIFICATION' as check_type,
  COUNT(DISTINCT event_object_table) as table_count,
  STRING_AGG(DISTINCT event_object_table, ', ') as tables,
  CASE 
    WHEN COUNT(DISTINCT event_object_table) = 1 AND STRING_AGG(DISTINCT event_object_table, ', ') = 'routes' 
    THEN '✅ CORRECT - On routes table'
    ELSE '❌ ERROR - Wrong table(s)'
  END as status
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name = 'route_linestring_trigger';


