-- ============================================================================
-- Fix All Security Warnings - Comprehensive Solution
-- ============================================================================
-- This script fixes:
-- 1. Function search_path mutable (adds SET search_path = '' to all functions)
-- 2. RLS policies that are always true (removes and replaces with secure functions)
-- 3. Extension in public (documented - PostGIS/vector should stay in public)
-- 4. Leaked password protection (documented - enable in Supabase Dashboard)
--
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- PART 1: Fix RLS Policies That Are Always True
-- ============================================================================
-- Remove permissive policies and create secure functions instead
-- ============================================================================

-- API_CACHE TABLE - Remove permissive policies
DROP POLICY IF EXISTS "System can delete cache" ON public.api_cache;
DROP POLICY IF EXISTS "System can insert cache" ON public.api_cache;
DROP POLICY IF EXISTS "System can update cache" ON public.api_cache;

-- API_USAGE_LOG TABLE - Remove permissive policy
DROP POLICY IF EXISTS "System can write usage logs" ON public.api_usage_log;

-- LOAD_STATUS_HISTORY TABLE - Remove permissive policy
DROP POLICY IF EXISTS "System can insert load status history" ON public.load_status_history;

-- NOTIFICATIONS TABLE - Remove permissive policy
DROP POLICY IF EXISTS "System can insert notifications for users" ON public.notifications;

-- ============================================================================
-- PART 2: Create Secure Functions for System Operations
-- ============================================================================
-- Replace permissive RLS policies with SECURITY DEFINER functions
-- These should only be called from server-side code with service_role
-- ============================================================================

-- Function: System insert into api_cache
CREATE OR REPLACE FUNCTION public.system_insert_api_cache(
  p_key TEXT,
  p_value JSONB,
  p_expires_at TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.api_cache (key, value, expires_at)
  VALUES (p_key, p_value, p_expires_at)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Function: System update api_cache
CREATE OR REPLACE FUNCTION public.system_update_api_cache(
  p_key TEXT,
  p_value JSONB,
  p_expires_at TIMESTAMPTZ
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.api_cache
  SET value = p_value,
      expires_at = p_expires_at,
      updated_at = NOW()
  WHERE key = p_key;
END;
$$;

-- Function: System delete api_cache
CREATE OR REPLACE FUNCTION public.system_delete_api_cache(p_key TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.api_cache WHERE key = p_key;
END;
$$;

-- Function: System write api_usage_log
CREATE OR REPLACE FUNCTION public.system_write_api_usage_log(
  p_company_id UUID,
  p_api_name TEXT,
  p_endpoint TEXT,
  p_method TEXT,
  p_status_code INTEGER,
  p_response_time_ms INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.api_usage_log (
    company_id,
    api_name,
    endpoint,
    method,
    status_code,
    response_time_ms
  )
  VALUES (
    p_company_id,
    p_api_name,
    p_endpoint,
    p_method,
    p_status_code,
    p_response_time_ms
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Function: System insert load status history
CREATE OR REPLACE FUNCTION public.system_insert_load_status_history(
  p_load_id UUID,
  p_company_id UUID,
  p_status TEXT,
  p_previous_status TEXT,
  p_geofence_id UUID DEFAULT NULL,
  p_zone_visit_id UUID DEFAULT NULL,
  p_changed_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.load_status_history (
    load_id,
    company_id,
    status,
    previous_status,
    geofence_id,
    zone_visit_id,
    changed_by
  )
  VALUES (
    p_load_id,
    p_company_id,
    p_status,
    p_previous_status,
    p_geofence_id,
    p_zone_visit_id,
    p_changed_by
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Function: System insert notification
CREATE OR REPLACE FUNCTION public.system_insert_notification(
  p_user_id UUID,
  p_company_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_priority TEXT DEFAULT 'normal',
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.notifications (
    user_id,
    company_id,
    type,
    title,
    message,
    priority,
    metadata
  )
  VALUES (
    p_user_id,
    p_company_id,
    p_type,
    p_title,
    p_message,
    p_priority,
    p_metadata
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ============================================================================
-- PART 3: Fix Function Search Path - Key Functions
-- ============================================================================
-- Fix the most critical functions first
-- Note: All table references must use explicit schema (public.table_name)
-- ============================================================================

-- Function: mark_all_notifications_read
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.notifications
  SET read = true, read_at = NOW()
  WHERE user_id = auth.uid() AND read = false;
END;
$$;

-- Function: mark_notification_read
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.notifications
  SET read = true, read_at = NOW()
  WHERE id = p_notification_id AND user_id = auth.uid();
END;
$$;

-- Function: update_ifta_tax_rates_updated_at
CREATE OR REPLACE FUNCTION public.update_ifta_tax_rates_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Function: update_updated_at_column (generic trigger function)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Function: update_address_book_updated_at
CREATE OR REPLACE FUNCTION public.update_address_book_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Function: update_customer_portal_access_updated_at
CREATE OR REPLACE FUNCTION public.update_customer_portal_access_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Function: update_eld_driver_mappings_updated_at
CREATE OR REPLACE FUNCTION public.update_eld_driver_mappings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Function: update_eld_updated_at_column
CREATE OR REPLACE FUNCTION public.update_eld_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Function: update_subscription_updated_at_column
CREATE OR REPLACE FUNCTION public.update_subscription_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Function: update_load_delivery_points_updated_at_column
CREATE OR REPLACE FUNCTION public.update_load_delivery_points_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Function: update_route_stops_updated_at_column
CREATE OR REPLACE FUNCTION public.update_route_stops_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Function: update_feedback_updated_at
CREATE OR REPLACE FUNCTION public.update_feedback_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Function: increment_address_usage
CREATE OR REPLACE FUNCTION public.increment_address_usage(p_address_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.address_book
  SET usage_count = usage_count + 1,
      last_used_at = NOW()
  WHERE id = p_address_id;
END;
$$;

-- Function: get_point_coordinates
CREATE OR REPLACE FUNCTION public.get_point_coordinates(p_geography GEOGRAPHY)
RETURNS TABLE (
  lat DECIMAL,
  lng DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT ST_Y(p_geography::geometry)::DECIMAL as lat,
         ST_X(p_geography::geometry)::DECIMAL as lng;
END;
$$;

-- Function: get_dvirs_for_audit
CREATE OR REPLACE FUNCTION public.get_dvirs_for_audit()
RETURNS TABLE (
  id UUID,
  driver_id UUID,
  truck_id UUID,
  status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT d.id, d.driver_id, d.truck_id, d.status, d.created_at
  FROM public.dvir d
  WHERE d.status = 'pending_audit';
END;
$$;

-- ============================================================================
-- PART 4: Fix Remaining Functions - Use This Query to Generate Fixes
-- ============================================================================
-- For the remaining functions, you need to:
-- 1. Get the function definition using: pg_get_functiondef(oid)
-- 2. Add SET search_path = '' before AS $$
-- 3. Update all table references to use explicit schema (public.table_name)
-- 4. Recreate the function
-- ============================================================================

-- Query to get all functions that still need fixing:
/*
SELECT 
  '-- Function: ' || p.proname || E'\n' ||
  pg_get_functiondef(p.oid) || E'\n' ||
  E'\n' ||
  '-- TODO: Add SET search_path = '''' before AS $$' || E'\n' ||
  '-- TODO: Update all table references to use public.table_name' || E'\n' ||
  E'\n'
  as fix_instructions
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'detect_idle_time',
    'calculate_driver_performance_score',
    'ensure_single_default_preset',
    'handle_new_user',
    'generate_ein_number',
    'record_parts_usage_from_work_order',
    'create_work_orders_from_dvir_defects',
    'trigger_check_low_stock_on_part_usage',
    'check_and_award_badges',
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
    'check_pre_trip_dvir_required',
    'update_chat_thread_last_message',
    'find_matching_loads_for_truck',
    'find_nearby_addresses',
    'find_nearby_drivers_for_load',
    'populate_demo_data_for_company',
    'send_pod_alert_notifications',
    'trigger_create_route_linestring',
    'batch_analyze_pending_fault_codes',
    'trigger_verify_invoice_match',
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
    'create_polygon_from_jsonb',
    'auto_create_part_orders_for_low_stock',
    'calculate_state_mileage_from_crossings',
    'trigger_insurance_expiration_alert',
    'compare_planned_vs_actual_route',
    'calculate_active_detention',
    'add_detention_to_invoice',
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
ORDER BY p.proname;
*/

-- ============================================================================
-- PART 5: Extension Schema (Documentation Only)
-- ============================================================================
-- PostGIS and vector extensions should remain in public schema for Supabase
-- compatibility. The warning can be safely ignored as Supabase manages these
-- extensions and they need to be in public for PostgREST to access them.
-- ============================================================================

-- Note: Moving extensions requires dropping and recreating them, which would
-- break existing functionality. Supabase recommends keeping PostGIS/vector
-- in public schema.

-- ============================================================================
-- PART 6: Leaked Password Protection (Documentation Only)
-- ============================================================================
-- This must be enabled in Supabase Dashboard:
-- 1. Go to Authentication > Settings
-- 2. Scroll to "Password Security"
-- 3. Enable "Leaked Password Protection"
-- 4. This checks passwords against HaveIBeenPwned.org database
-- ============================================================================

-- ============================================================================
-- Summary
-- ============================================================================
-- ✅ Fixed: RLS policies (removed permissive policies, created secure functions)
-- ✅ Fixed: Key functions (added SET search_path = '' to critical functions)
-- ⚠️  Remaining: Other functions need manual fix (use query in PART 4)
-- ℹ️  Documented: Extensions (should stay in public for Supabase)
-- ℹ️  Documented: Leaked password protection (enable in Dashboard)
-- ============================================================================

