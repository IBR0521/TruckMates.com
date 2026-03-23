-- ============================================================================
-- GET DETAILED TRIGGER INFORMATION
-- ============================================================================
-- This shows exactly what makes the 2 triggers different
-- ============================================================================

SELECT 
  trigger_schema,
  trigger_name,
  event_object_schema,
  event_object_table,
  event_manipulation,  -- INSERT, UPDATE, DELETE
  action_timing,        -- BEFORE, AFTER, INSTEAD OF
  action_orientation,   -- ROW, STATEMENT
  action_statement,
  action_condition
FROM information_schema.triggers
WHERE trigger_name = 'route_linestring_trigger'
ORDER BY trigger_schema, event_object_table, event_manipulation, action_timing;


