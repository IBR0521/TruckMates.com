-- ============================================================================
-- Fix Function Search Path - Generate Fix Statements
-- ============================================================================
-- This script generates SQL statements to fix all functions with mutable search_path
-- Run the generated output to fix all functions
-- ============================================================================

-- Query to generate CREATE OR REPLACE statements with SET search_path = ''
-- Copy the output and run it to fix all functions

SELECT 
  '-- Fixing: ' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' || E'\n' ||
  '-- Original definition:' || E'\n' ||
  '-- ' || replace(pg_get_functiondef(p.oid), E'\n', E'\n-- ') || E'\n' ||
  E'\n' ||
  '-- TODO: Manually recreate this function with SET search_path = ''''' || E'\n' ||
  '-- Update all table references to use explicit schema (e.g., public.table_name)' || E'\n' ||
  E'\n'
  as fix_instructions
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'mark_all_notifications_read',
    'detect_idle_time',
    'update_ifta_tax_rates_updated_at',
    'calculate_driver_performance_score',
    'ensure_single_default_preset',
    'handle_new_user',
    'generate_ein_number',
    'record_parts_usage_from_work_order',
    'get_dvirs_for_audit',
    'create_work_orders_from_dvir_defects',
    'trigger_check_low_stock_on_part_usage',
    'check_and_award_badges',
    'update_eld_driver_mappings_updated_at',
    'sync_document_to_maintenance',
    'trigger_reverify_invoice_on_bol',
    'calculate_idle_fuel_cost',
    'check_and_send_maintenance_alerts',
    'find_matching_trucks_for_load',
    'calculate_distance_postgis',
    'check_and_reserve_parts',
    'calculate_load_urgency_score',
    'update_customer_financial_summary',
    'match_knowledge_base',
    'update_eld_location_geography',
    'mark_notification_read',
    'check_pre_trip_dvir_required',
    'update_customer_portal_access_updated_at',
    'update_chat_thread_last_message',
    'find_matching_loads_for_truck',
    'update_address_book_updated_at',
    'find_nearby_addresses',
    'find_nearby_drivers_for_load',
    'populate_demo_data_for_company',
    'send_pod_alert_notifications',
    'trigger_create_route_linestring',
    'update_eld_updated_at_column',
    'batch_analyze_pending_fault_codes',
    'trigger_verify_invoice_match',
    'get_point_coordinates',
    'analyze_fault_code_and_create_maintenance',
    'calculate_realtime_eta',
    'trigger_create_work_orders_on_dvir_defects',
    'get_active_pay_rule',
    'update_load_status_color',
    'detect_state_crossing',
    'build_actual_route',
    'create_route_linestring',
    'verify_invoice_three_way_match',
    'get_ifta_tax_rate',
    'trigger_crm_document_expiration_alert',
    'auto_create_maintenance_reminders_from_schedule',
    'create_work_order_from_maintenance',
    'trigger_send_pod_alerts',
    'trigger_auto_generate_invoice_on_pod',
    'trigger_auto_complete_maintenance_reminders',
    'trigger_auto_update_load_status',
    'get_ifta_tax_rates_for_quarter',
    'update_traffic_aware_route',
    'update_updated_at_column',
    'create_polygon_from_jsonb',
    'update_subscription_updated_at_column',
    'increment_address_usage',
    'auto_create_part_orders_for_low_stock',
    'calculate_state_mileage_from_crossings',
    'trigger_insurance_expiration_alert',
    'compare_planned_vs_actual_route',
    'update_load_delivery_points_updated_at_column',
    'calculate_active_detention',
    'add_detention_to_invoice',
    'update_feedback_updated_at',
    'is_point_in_geofence',
    'generate_work_order_number',
    'find_backhaul_opportunities',
    'create_company_settings',
    'finalize_detention_on_exit',
    'get_conversation_history',
    'find_locations_within_radius',
    'remove_document_from_maintenance',
    'auto_update_load_status_from_geofence',
    'calculate_enhanced_eta_with_hos',
    'update_route_eta',
    'calculate_remaining_hos',
    'complete_work_order',
    'trigger_analyze_fault_code_on_event',
    'update_route_stops_updated_at_column',
    'get_load_pickup_coordinates',
    'check_low_stock_for_maintenance_parts',
    'calculate_gross_pay_from_rule',
    'create_detention_record',
    'auto_create_address_geofence'
  )
ORDER BY p.proname;

-- ============================================================================
-- Alternative: Use this DO block to automatically fix functions
-- This extracts function definitions and modifies them
-- ============================================================================

DO $$
DECLARE
  func_record RECORD;
  func_def TEXT;
  modified_def TEXT;
BEGIN
  FOR func_record IN
    SELECT 
      p.oid,
      p.proname as func_name,
      pg_get_function_identity_arguments(p.oid) as func_args,
      pg_get_functiondef(p.oid) as func_def
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'mark_all_notifications_read',
        'detect_idle_time',
        'update_ifta_tax_rates_updated_at',
        'calculate_driver_performance_score',
        'ensure_single_default_preset',
        'handle_new_user',
        'generate_ein_number',
        'record_parts_usage_from_work_order',
        'get_dvirs_for_audit',
        'create_work_orders_from_dvir_defects',
        'trigger_check_low_stock_on_part_usage',
        'check_and_award_badges',
        'update_eld_driver_mappings_updated_at',
        'sync_document_to_maintenance',
        'trigger_reverify_invoice_on_bol',
        'calculate_idle_fuel_cost',
        'check_and_send_maintenance_alerts',
        'find_matching_trucks_for_load',
        'calculate_distance_postgis',
        'check_and_reserve_parts',
        'calculate_load_urgency_score',
        'update_customer_financial_summary',
        'match_knowledge_base',
        'update_eld_location_geography',
        'mark_notification_read',
        'check_pre_trip_dvir_required',
        'update_customer_portal_access_updated_at',
        'update_chat_thread_last_message',
        'find_matching_loads_for_truck',
        'update_address_book_updated_at',
        'find_nearby_addresses',
        'find_nearby_drivers_for_load',
        'populate_demo_data_for_company',
        'send_pod_alert_notifications',
        'trigger_create_route_linestring',
        'update_eld_updated_at_column',
        'batch_analyze_pending_fault_codes',
        'trigger_verify_invoice_match',
        'get_point_coordinates',
        'analyze_fault_code_and_create_maintenance',
        'calculate_realtime_eta',
        'trigger_create_work_orders_on_dvir_defects',
        'get_active_pay_rule',
        'update_load_status_color',
        'detect_state_crossing',
        'build_actual_route',
        'create_route_linestring',
        'verify_invoice_three_way_match',
        'get_ifta_tax_rate',
        'trigger_crm_document_expiration_alert',
        'auto_create_maintenance_reminders_from_schedule',
        'create_work_order_from_maintenance',
        'trigger_send_pod_alerts',
        'trigger_auto_generate_invoice_on_pod',
        'trigger_auto_complete_maintenance_reminders',
        'trigger_auto_update_load_status',
        'get_ifta_tax_rates_for_quarter',
        'update_traffic_aware_route',
        'update_updated_at_column',
        'create_polygon_from_jsonb',
        'update_subscription_updated_at_column',
        'increment_address_usage',
        'auto_create_part_orders_for_low_stock',
        'calculate_state_mileage_from_crossings',
        'trigger_insurance_expiration_alert',
        'compare_planned_vs_actual_route',
        'update_load_delivery_points_updated_at_column',
        'calculate_active_detention',
        'add_detention_to_invoice',
        'update_feedback_updated_at',
        'is_point_in_geofence',
        'generate_work_order_number',
        'find_backhaul_opportunities',
        'create_company_settings',
        'finalize_detention_on_exit',
        'get_conversation_history',
        'find_locations_within_radius',
        'remove_document_from_maintenance',
        'auto_update_load_status_from_geofence',
        'calculate_enhanced_eta_with_hos',
        'update_route_eta',
        'calculate_remaining_hos',
        'complete_work_order',
        'trigger_analyze_fault_code_on_event',
        'update_route_stops_updated_at_column',
        'get_load_pickup_coordinates',
        'check_low_stock_for_maintenance_parts',
        'calculate_gross_pay_from_rule',
        'create_detention_record',
        'auto_create_address_geofence'
      )
      -- Exclude functions that already have search_path set
      AND NOT EXISTS (
        SELECT 1
        FROM pg_proc p2
        WHERE p2.oid = p.oid
          AND p2.proconfig IS NOT NULL
          AND array_to_string(p2.proconfig, ',') LIKE '%search_path%'
      )
  LOOP
    -- Extract function definition
    func_def := func_record.func_def;
    
    -- Modify to add SET search_path = '' before AS $$
    -- Find the position of "AS $$" or "LANGUAGE"
    modified_def := regexp_replace(
      func_def,
      '(LANGUAGE\s+\w+)\s*(SECURITY\s+\w+\s*)?(AS\s+\$\$)',
      '\1 \2SET search_path = '''' \3',
      'i'
    );
    
    -- If no LANGUAGE found, try different pattern
    IF modified_def = func_def THEN
      modified_def := regexp_replace(
        func_def,
        '(SECURITY\s+\w+\s*)?(AS\s+\$\$)',
        '\1SET search_path = '''' \2',
        'i'
      );
    END IF;
    
    -- Output the modified function (for manual review)
    RAISE NOTICE 'Function: %', func_record.func_name;
    RAISE NOTICE 'Modified definition: %', substring(modified_def, 1, 200);
  END LOOP;
END $$;


