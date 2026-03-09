-- ============================================================================
-- INVESTIGATE DUPLICATE TRIGGER
-- ============================================================================
-- This script investigates why there are 2 triggers
-- ============================================================================

-- Get detailed information about all triggers with this name
SELECT 
  trigger_schema,
  trigger_name,
  event_object_schema,
  event_object_table,
  event_manipulation,
  action_timing,
  action_statement,
  action_orientation
FROM information_schema.triggers
WHERE trigger_name = 'route_linestring_trigger'
ORDER BY trigger_schema, event_object_table;

-- Check if there are triggers in different schemas
SELECT 
  trigger_schema,
  COUNT(*) as trigger_count
FROM information_schema.triggers
WHERE trigger_name = 'route_linestring_trigger'
GROUP BY trigger_schema;

-- Check if there are triggers on different tables
SELECT 
  event_object_table,
  COUNT(*) as trigger_count
FROM information_schema.triggers
WHERE trigger_name = 'route_linestring_trigger'
GROUP BY event_object_table;


