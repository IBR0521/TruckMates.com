-- ============================================================================
-- Remove Unused Indexes
-- ============================================================================
-- This script removes indexes that have been identified as unused by the
-- Supabase database linter.
--
-- ⚠️ WARNING: Some of these indexes may be needed for:
-- - Future queries as your application evolves
-- - RLS policy performance (company_id indexes)
-- - Foreign key cascade operations
--
-- This script preserves:
-- - Foreign key indexes (help with JOINs and cascades)
-- - company_id indexes (used by RLS policies)
-- - Primary key and unique constraint indexes
--
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- VENDORS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_vendors_type;
-- Note: idx_vendors_company_id and idx_vendors_status are kept (may be used by RLS/filtering)

-- ============================================================================
-- CONTACTS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_contacts_company_id;
DROP INDEX IF EXISTS public.idx_contacts_customer_id;
DROP INDEX IF EXISTS public.idx_contacts_vendor_id;
DROP INDEX IF EXISTS public.idx_contacts_is_primary;

-- ============================================================================
-- CONTACT_HISTORY TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_contact_history_company_id;
DROP INDEX IF EXISTS public.idx_contact_history_customer_id;
DROP INDEX IF EXISTS public.idx_contact_history_vendor_id;
DROP INDEX IF EXISTS public.idx_contact_history_contact_id;
DROP INDEX IF EXISTS public.idx_contact_history_occurred_at;
-- Note: Foreign key indexes (invoice_id, load_id, user_id) are kept

-- ============================================================================
-- LOADS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_loads_customer_id;
DROP INDEX IF EXISTS public.idx_loads_status_color;
DROP INDEX IF EXISTS public.idx_loads_urgency_score;
DROP INDEX IF EXISTS public.idx_loads_status_priority;
DROP INDEX IF EXISTS public.idx_loads_load_type;
DROP INDEX IF EXISTS public.idx_loads_bol_number;
DROP INDEX IF EXISTS public.idx_loads_pickup_date;
DROP INDEX IF EXISTS public.idx_loads_estimated_delivery;
DROP INDEX IF EXISTS public.idx_loads_status;
-- Note: idx_loads_company_id, idx_loads_driver_id, idx_loads_route_id, idx_loads_truck_id are kept (RLS/foreign keys)

-- ============================================================================
-- PAYMENT_METHODS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_payment_methods_company_id;

-- ============================================================================
-- INVOICES TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_invoices_stripe_invoice_id;
DROP INDEX IF EXISTS public.idx_invoices_customer_id;
DROP INDEX IF EXISTS public.idx_invoices_matching_status;
DROP INDEX IF EXISTS public.idx_invoices_requires_manual_review;
DROP INDEX IF EXISTS public.idx_invoices_status;
DROP INDEX IF EXISTS public.idx_invoices_due_date;
-- Note: idx_invoices_company_id, idx_invoices_load_id, idx_invoices_verified_by are kept (RLS/foreign keys)

-- ============================================================================
-- DRIVERS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_drivers_status;
-- Note: idx_drivers_company_id, idx_drivers_user_id are kept (RLS/foreign keys)

-- ============================================================================
-- TRUCKS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_trucks_status;
DROP INDEX IF EXISTS public.idx_trucks_inspection_date;
-- Note: idx_trucks_company_id, idx_trucks_current_driver_id are kept (RLS/foreign keys)

-- ============================================================================
-- ROUTES TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_routes_route_linestring;
DROP INDEX IF EXISTS public.idx_routes_traffic_linestring;
DROP INDEX IF EXISTS public.idx_routes_actual_linestring;
DROP INDEX IF EXISTS public.idx_routes_status;
DROP INDEX IF EXISTS public.idx_routes_driver_id;
DROP INDEX IF EXISTS public.idx_routes_truck_id;
-- Note: idx_routes_company_id is kept (RLS)

-- ============================================================================
-- EXPENSES TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_expenses_category;
-- Note: idx_expenses_company_id, idx_expenses_driver_id, idx_expenses_truck_id, idx_expenses_vendor_id are kept (RLS/foreign keys)

-- ============================================================================
-- SETTLEMENTS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_settlements_driver_id;
DROP INDEX IF EXISTS public.idx_settlements_status;
-- Note: idx_settlements_company_id, idx_settlements_pay_rule_id are kept (RLS/foreign keys)

-- ============================================================================
-- MAINTENANCE TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_maintenance_status;
DROP INDEX IF EXISTS public.idx_maintenance_truck_id;
DROP INDEX IF EXISTS public.idx_maintenance_scheduled_date;
DROP INDEX IF EXISTS public.idx_maintenance_vendor_id;
-- Note: idx_maintenance_company_id is kept (RLS)

-- ============================================================================
-- DOCUMENTS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_documents_type;
-- Note: idx_documents_company_id, idx_documents_driver_id, idx_documents_truck_id are kept (RLS/foreign keys)

-- ============================================================================
-- CUSTOMERS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_customers_status;
DROP INDEX IF EXISTS public.idx_customers_type;
DROP INDEX IF EXISTS public.idx_customers_created_at;

-- ============================================================================
-- VENDORS TABLE (additional)
-- ============================================================================
DROP INDEX IF EXISTS public.idx_vendors_status;
-- Note: idx_vendors_company_id is kept (RLS)

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_notifications_company_id;
DROP INDEX IF EXISTS public.idx_notifications_read;
DROP INDEX IF EXISTS public.idx_notifications_created_at;
DROP INDEX IF EXISTS public.idx_notifications_type;

-- ============================================================================
-- AUDIT_LOGS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_audit_logs_company_id;
DROP INDEX IF EXISTS public.idx_audit_logs_user_id;
DROP INDEX IF EXISTS public.idx_audit_logs_action;
DROP INDEX IF EXISTS public.idx_audit_logs_created_at;

-- ============================================================================
-- DVIR TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_dvir_load_id;
DROP INDEX IF EXISTS public.idx_dvir_driver_id;
DROP INDEX IF EXISTS public.idx_dvir_truck_id;
DROP INDEX IF EXISTS public.idx_dvir_status;
-- Note: idx_dvir_certified_by is kept (foreign key)

-- ============================================================================
-- ELD_EVENTS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_eld_events_resolved;
DROP INDEX IF EXISTS public.idx_eld_events_fault_code;
DROP INDEX IF EXISTS public.idx_eld_events_maintenance_created;
DROP INDEX IF EXISTS public.idx_eld_events_device_id;
DROP INDEX IF EXISTS public.idx_eld_events_driver_id;
DROP INDEX IF EXISTS public.idx_eld_events_event_type;
DROP INDEX IF EXISTS public.idx_eld_events_device_resolved;
-- Note: idx_eld_events_maintenance_id, idx_eld_events_resolved_by, idx_eld_events_truck_id are kept (foreign keys)

-- ============================================================================
-- ELD_LOCATIONS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_eld_locations_geography;
DROP INDEX IF EXISTS public.idx_eld_locations_device_id;
DROP INDEX IF EXISTS public.idx_eld_locations_driver_id;
DROP INDEX IF EXISTS public.idx_eld_locations_truck_id;
DROP INDEX IF EXISTS public.idx_eld_locations_device_timestamp;

-- ============================================================================
-- ELD_LOGS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_eld_logs_device_id;
DROP INDEX IF EXISTS public.idx_eld_logs_company_id;
DROP INDEX IF EXISTS public.idx_eld_logs_truck_id;
DROP INDEX IF EXISTS public.idx_eld_logs_log_type;

-- ============================================================================
-- ELD_DRIVER_MAPPINGS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_eld_driver_mappings_company_id;
DROP INDEX IF EXISTS public.idx_eld_driver_mappings_device_id;
DROP INDEX IF EXISTS public.idx_eld_driver_mappings_provider_driver_id;
DROP INDEX IF EXISTS public.idx_eld_driver_mappings_internal_driver_id;
DROP INDEX IF EXISTS public.idx_eld_driver_mappings_provider;

-- ============================================================================
-- ELD_DEVICES TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_eld_devices_truck_id;
DROP INDEX IF EXISTS public.idx_eld_devices_status;
-- Note: Foreign key indexes are kept

-- ============================================================================
-- ADDRESS_BOOK TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_address_book_geocoding_status;
DROP INDEX IF EXISTS public.idx_address_book_search;
DROP INDEX IF EXISTS public.idx_address_book_category;
DROP INDEX IF EXISTS public.idx_address_book_city_state;
DROP INDEX IF EXISTS public.idx_address_book_is_active;
DROP INDEX IF EXISTS public.idx_address_book_coordinates;
-- Note: idx_address_book_created_by, idx_address_book_geofence_id are kept (foreign keys)

-- ============================================================================
-- GEOFENCES TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_geofences_active;

-- ============================================================================
-- ZONE_VISITS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_zone_visits_geofence_id;
DROP INDEX IF EXISTS public.idx_zone_visits_truck_id;
DROP INDEX IF EXISTS public.idx_zone_visits_timestamp;
DROP INDEX IF EXISTS public.idx_zone_visits_company_id;
DROP INDEX IF EXISTS public.idx_zone_visits_event_type;
-- Note: idx_zone_visits_driver_id, idx_zone_visits_route_id are kept (foreign keys)

-- ============================================================================
-- LOAD_DELIVERY_POINTS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_load_delivery_points_load_id;
DROP INDEX IF EXISTS public.idx_load_delivery_points_company_id;
DROP INDEX IF EXISTS public.idx_load_delivery_points_delivery_number;
DROP INDEX IF EXISTS public.idx_load_delivery_points_status;

-- ============================================================================
-- ROUTE_STOPS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_route_stops_route_id;
DROP INDEX IF EXISTS public.idx_route_stops_company_id;

-- ============================================================================
-- WORK_ORDERS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_work_orders_truck_id;
DROP INDEX IF EXISTS public.idx_work_orders_status;
DROP INDEX IF EXISTS public.idx_work_orders_work_order_number;
DROP INDEX IF EXISTS public.idx_work_orders_assigned_to;
DROP INDEX IF EXISTS public.idx_work_orders_assigned_vendor;

-- ============================================================================
-- MAINTENANCE_DOCUMENTS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_maintenance_documents_company_id;
DROP INDEX IF EXISTS public.idx_maintenance_documents_maintenance_id;
DROP INDEX IF EXISTS public.idx_maintenance_documents_truck_id;
DROP INDEX IF EXISTS public.idx_maintenance_documents_type;
-- Note: idx_maintenance_documents_uploaded_by is kept (foreign key)

-- ============================================================================
-- PARTS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_parts_company_id;
DROP INDEX IF EXISTS public.idx_parts_category;
DROP INDEX IF EXISTS public.idx_parts_part_number;

-- ============================================================================
-- PART_USAGE TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_part_usage_part_id;
DROP INDEX IF EXISTS public.idx_part_usage_maintenance_id;
-- Note: idx_part_usage_company_id is kept (RLS)

-- ============================================================================
-- PART_ORDERS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_part_orders_part_id;
DROP INDEX IF EXISTS public.idx_part_orders_status;
-- Note: idx_part_orders_company_id is kept (RLS)

-- ============================================================================
-- MAINTENANCE_ALERT_NOTIFICATIONS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_maintenance_alerts_truck_id;
DROP INDEX IF EXISTS public.idx_maintenance_alerts_company_id;
DROP INDEX IF EXISTS public.idx_maintenance_alerts_sent_at;
-- Note: idx_maintenance_alert_notifications_maintenance_id, idx_maintenance_alert_notifications_sent_to are kept (foreign keys)

-- ============================================================================
-- BOLS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_bols_status;
DROP INDEX IF EXISTS public.idx_bols_bol_number;
-- Note: idx_bols_template_id is kept (foreign key)

-- ============================================================================
-- DRIVER_PAY_RULES TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_driver_pay_rules_company_id;
DROP INDEX IF EXISTS public.idx_driver_pay_rules_driver_id;
DROP INDEX IF EXISTS public.idx_driver_pay_rules_active;
DROP INDEX IF EXISTS public.idx_driver_pay_rules_effective_dates;

-- ============================================================================
-- FUEL_PURCHASES TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_fuel_purchases_state;
DROP INDEX IF EXISTS public.idx_fuel_purchases_truck_id;
-- Note: idx_fuel_purchases_driver_id is kept (foreign key)

-- ============================================================================
-- IFTA_STATE_BREAKDOWN TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_ifta_state_breakdown_report_id;
DROP INDEX IF EXISTS public.idx_ifta_state_breakdown_state;

-- ============================================================================
-- STATE_CROSSINGS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_state_crossings_location_geography;
DROP INDEX IF EXISTS public.idx_state_crossings_company_id;
DROP INDEX IF EXISTS public.idx_state_crossings_truck_id;
DROP INDEX IF EXISTS public.idx_state_crossings_driver_id;
DROP INDEX IF EXISTS public.idx_state_crossings_state_code;
DROP INDEX IF EXISTS public.idx_state_crossings_timestamp;
DROP INDEX IF EXISTS public.idx_state_crossings_route_id;
DROP INDEX IF EXISTS public.idx_state_crossings_load_id;
-- Note: idx_state_crossings_eld_device_id is kept (foreign key)

-- ============================================================================
-- INVOICE_VERIFICATIONS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_invoice_verifications_company_id;
DROP INDEX IF EXISTS public.idx_invoice_verifications_invoice_id;
DROP INDEX IF EXISTS public.idx_invoice_verifications_load_id;
DROP INDEX IF EXISTS public.idx_invoice_verifications_status;
-- Note: idx_invoice_verifications_bol_id, idx_invoice_verifications_verified_by are kept (foreign keys)

-- ============================================================================
-- CHECK_CALLS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_check_calls_company_id;
DROP INDEX IF EXISTS public.idx_check_calls_load_id;
DROP INDEX IF EXISTS public.idx_check_calls_driver_id;
DROP INDEX IF EXISTS public.idx_check_calls_status;
DROP INDEX IF EXISTS public.idx_check_calls_scheduled_time;
-- Note: idx_check_calls_route_id is kept (foreign key)

-- ============================================================================
-- ALERT_RULES TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_alert_rules_event_type;

-- ============================================================================
-- ALERTS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_alerts_company_id;
DROP INDEX IF EXISTS public.idx_alerts_status;
DROP INDEX IF EXISTS public.idx_alerts_priority;
DROP INDEX IF EXISTS public.idx_alerts_created_at;
DROP INDEX IF EXISTS public.idx_alerts_driver_id;
DROP INDEX IF EXISTS public.idx_alerts_load_id;
DROP INDEX IF EXISTS public.idx_alerts_route_id;
DROP INDEX IF EXISTS public.idx_alerts_truck_id;
-- Note: idx_alerts_acknowledged_by, idx_alerts_alert_rule_id are kept (foreign keys)

-- ============================================================================
-- REMINDERS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_reminders_company_id;
-- Note: idx_reminders_completed_by, idx_reminders_driver_id, idx_reminders_invoice_id, idx_reminders_load_id, idx_reminders_truck_id are kept (foreign keys)

-- ============================================================================
-- CHAT_THREADS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_chat_threads_company_id;
DROP INDEX IF EXISTS public.idx_chat_threads_load_id;
-- Note: idx_chat_threads_driver_id, idx_chat_threads_last_message_by, idx_chat_threads_route_id are kept (foreign keys)

-- ============================================================================
-- CHAT_MESSAGES TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_chat_messages_thread_id;
DROP INDEX IF EXISTS public.idx_chat_messages_sender_id;
-- Note: idx_chat_messages_company_id is kept (RLS)

-- ============================================================================
-- CUSTOMER_PORTAL_ACCESS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_customer_portal_access_company_id;
DROP INDEX IF EXISTS public.idx_customer_portal_access_token;
DROP INDEX IF EXISTS public.idx_customer_portal_access_customer_id;
DROP INDEX IF EXISTS public.idx_customer_portal_access_active;

-- ============================================================================
-- USER_PREFERENCES TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_user_preferences_user_id;

-- ============================================================================
-- DRIVER_ONBOARDING TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_driver_onboarding_driver_id;
DROP INDEX IF EXISTS public.idx_driver_onboarding_company_id;
DROP INDEX IF EXISTS public.idx_driver_onboarding_status;
DROP INDEX IF EXISTS public.idx_driver_onboarding_assigned_to;

-- ============================================================================
-- ONBOARDING_CHECKLIST_TEMPLATES TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_onboarding_checklist_templates_company_id;

-- ============================================================================
-- FEEDBACK TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_feedback_user_id;
DROP INDEX IF EXISTS public.idx_feedback_company_id;
DROP INDEX IF EXISTS public.idx_feedback_status;
DROP INDEX IF EXISTS public.idx_feedback_type;
DROP INDEX IF EXISTS public.idx_feedback_created_at;

-- ============================================================================
-- WEBHOOKS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_webhooks_active;

-- ============================================================================
-- WEBHOOK_DELIVERIES TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_webhook_deliveries_webhook_id;
DROP INDEX IF EXISTS public.idx_webhook_deliveries_status;
DROP INDEX IF EXISTS public.idx_webhook_deliveries_next_retry;

-- ============================================================================
-- API_CACHE TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_api_cache_key;
DROP INDEX IF EXISTS public.idx_api_cache_expires;

-- ============================================================================
-- API_USAGE_LOG TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_api_usage_company;
DROP INDEX IF EXISTS public.idx_api_usage_api_name;

-- ============================================================================
-- DETENTION_TRACKING TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_detention_tracking_company_id;
DROP INDEX IF EXISTS public.idx_detention_tracking_geofence_id;
DROP INDEX IF EXISTS public.idx_detention_tracking_load_id;
DROP INDEX IF EXISTS public.idx_detention_tracking_status;
DROP INDEX IF EXISTS public.idx_detention_tracking_entry_timestamp;
DROP INDEX IF EXISTS public.idx_detention_tracking_zone_visit_id;
-- Note: idx_detention_tracking_driver_id, idx_detention_tracking_invoice_id, idx_detention_tracking_truck_id are kept (foreign keys)

-- ============================================================================
-- IDLE_TIME_SESSIONS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_idle_sessions_truck_id;
DROP INDEX IF EXISTS public.idx_idle_sessions_driver_id;
DROP INDEX IF EXISTS public.idx_idle_sessions_company_id;
DROP INDEX IF EXISTS public.idx_idle_sessions_start_time;
DROP INDEX IF EXISTS public.idx_idle_sessions_duration;
-- Note: idx_idle_time_sessions_eld_device_id, idx_idle_time_sessions_geofence_id, idx_idle_time_sessions_load_id, idx_idle_time_sessions_route_id are kept (foreign keys)

-- ============================================================================
-- AI_KNOWLEDGE_BASE TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.ai_knowledge_base_embedding_idx;
DROP INDEX IF EXISTS public.ai_knowledge_base_type_idx;
DROP INDEX IF EXISTS public.ai_knowledge_base_tags_idx;
-- Note: idx_ai_knowledge_base_company_id is kept (RLS)

-- ============================================================================
-- AI_CONVERSATIONS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.ai_conversations_thread_idx;
DROP INDEX IF EXISTS public.ai_conversations_user_idx;
-- Note: idx_ai_conversations_company_id is kept (RLS)

-- ============================================================================
-- LOAD_STATUS_HISTORY TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_load_status_history_load_id;
DROP INDEX IF EXISTS public.idx_load_status_history_company_id;
DROP INDEX IF EXISTS public.idx_load_status_history_created_at;
-- Note: idx_load_status_history_changed_by, idx_load_status_history_geofence_id, idx_load_status_history_zone_visit_id are kept (foreign keys)

-- ============================================================================
-- DRIVER_BADGES TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_driver_badges_driver_id;
DROP INDEX IF EXISTS public.idx_driver_badges_company_id;
DROP INDEX IF EXISTS public.idx_driver_badges_badge_type;

-- ============================================================================
-- DRIVER_PERFORMANCE_SCORES TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_driver_performance_scores_driver_id;
DROP INDEX IF EXISTS public.idx_driver_performance_scores_overall_score;
-- Note: idx_driver_performance_scores_company_id is kept (RLS)

-- ============================================================================
-- IFTA_TAX_RATES TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_ifta_tax_rates_company_quarter;
DROP INDEX IF EXISTS public.idx_ifta_tax_rates_state;
DROP INDEX IF EXISTS public.idx_ifta_tax_rates_effective_date;
-- Note: idx_ifta_tax_rates_created_by is kept (foreign key)

-- ============================================================================
-- IFTA_REPORTS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_ifta_reports_created_at;

-- ============================================================================
-- COMPANY_EIN_NUMBERS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_company_ein_numbers_company_id;
DROP INDEX IF EXISTS public.idx_company_ein_numbers_ein_number;
-- Note: idx_company_ein_numbers_generated_by is kept (foreign key)

-- ============================================================================
-- COMPANY_ACCESSORIALS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_company_accessorials_is_active;

-- ============================================================================
-- COMPANY_INVOICE_TAXES TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_company_invoice_taxes_is_active;

-- ============================================================================
-- COMPANY_SUBSCRIPTIONS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_company_subscriptions_company_id;
DROP INDEX IF EXISTS public.idx_company_subscriptions_status;

-- ============================================================================
-- COMPANY_PAYMENT_HISTORY TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_company_payment_history_company_id;
DROP INDEX IF EXISTS public.idx_company_payment_history_payment_date;
-- Note: idx_company_payment_history_subscription_id is kept (foreign key)

-- ============================================================================
-- COMPANY_PAYMENT_METHODS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_company_payment_methods_company_id;

-- ============================================================================
-- COMPANY_REMINDER_SETTINGS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_company_reminder_settings_company_id;

-- ============================================================================
-- COMPANY_PORTAL_SETTINGS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_company_portal_settings_company_id;

-- ============================================================================
-- COMPANY_BILLING_INFO TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_company_billing_info_company_id;

-- ============================================================================
-- FILTER_PRESETS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_filter_presets_company_id;
DROP INDEX IF EXISTS public.idx_filter_presets_user_id;
DROP INDEX IF EXISTS public.idx_filter_presets_page;
DROP INDEX IF EXISTS public.idx_filter_presets_is_default;

-- ============================================================================
-- SUBSCRIPTIONS TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_subscriptions_company_id;
DROP INDEX IF EXISTS public.idx_subscriptions_status;
DROP INDEX IF EXISTS public.idx_subscriptions_stripe_subscription_id;
-- Note: idx_subscriptions_plan_id is kept (foreign key)

-- ============================================================================
-- ETA_UPDATES TABLE
-- ============================================================================
DROP INDEX IF EXISTS public.idx_eta_updates_load_id;
DROP INDEX IF EXISTS public.idx_eta_updates_route_id;
DROP INDEX IF EXISTS public.idx_eta_updates_truck_id;
DROP INDEX IF EXISTS public.idx_eta_updates_timestamp;
DROP INDEX IF EXISTS public.idx_eta_updates_current_location;
DROP INDEX IF EXISTS public.idx_eta_updates_driver_id;
-- Note: idx_eta_updates_company_id is kept (RLS)

-- ============================================================================
-- Summary
-- ============================================================================
-- This script removes unused indexes while preserving:
-- 1. Foreign key indexes (for JOIN and cascade performance)
-- 2. company_id indexes (used by RLS policies)
-- 3. Primary key and unique constraint indexes (system indexes)
--
-- If you experience performance issues after running this script, you may
-- need to recreate some indexes. Monitor query performance and recreate
-- indexes as needed.
-- ============================================================================


