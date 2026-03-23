-- Find tables from the migration that don't have company_id column
-- Run this to identify which table is causing the error

SELECT 
  t.table_name,
  CASE 
    WHEN c.column_name IS NULL THEN 'MISSING company_id'
    ELSE 'HAS company_id'
  END as status
FROM (
  SELECT unnest(ARRAY[
    'eld_devices', 'eld_logs', 'eld_locations', 'eld_events', 'eld_driver_mappings',
    'dvir', 'geofences', 'zone_visits', 'eta_updates', 'route_stops',
    'load_delivery_points', 'address_book', 'contact_history', 'notification_preferences',
    'work_orders', 'maintenance_documents', 'parts', 'part_usage', 'part_orders',
    'fault_code_maintenance_rules', 'bol_templates', 'bols', 'check_calls',
    'chat_threads', 'chat_messages', 'customer_portal_access', 'user_preferences',
    'driver_onboarding', 'onboarding_checklist_templates', 'feedback', 'webhooks',
    'webhook_deliveries', 'api_usage_log', 'api_cache', 'ai_knowledge_base',
    'ai_conversations', 'idle_time_sessions', 'detention_tracking', 'load_status_history',
    'invoice_verifications', 'maintenance_alert_notifications',
    'driver_pay_rules', 'fuel_purchases', 'ifta_state_breakdown', 'state_crossings'
  ]) as table_name
) t
LEFT JOIN information_schema.columns c 
  ON c.table_schema = 'public' 
  AND c.table_name = t.table_name 
  AND c.column_name = 'company_id'
WHERE c.column_name IS NULL
ORDER BY t.table_name;

