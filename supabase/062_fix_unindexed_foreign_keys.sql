-- ============================================================================
-- Fix Unindexed Foreign Keys
-- ============================================================================
-- This script adds indexes for all foreign key columns that are missing indexes.
-- Foreign keys without indexes can cause performance issues, especially for:
-- - DELETE operations on referenced tables (cascade checks)
-- - JOIN operations
-- - Foreign key constraint checks
--
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- ADDRESS_BOOK TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_address_book_created_by ON public.address_book(created_by);
CREATE INDEX IF NOT EXISTS idx_address_book_geofence_id ON public.address_book(geofence_id);

-- ============================================================================
-- AI_CONVERSATIONS TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_ai_conversations_company_id ON public.ai_conversations(company_id);

-- ============================================================================
-- AI_KNOWLEDGE_BASE TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_base_company_id ON public.ai_knowledge_base(company_id);

-- ============================================================================
-- ALERTS TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged_by ON public.alerts(acknowledged_by);
CREATE INDEX IF NOT EXISTS idx_alerts_alert_rule_id ON public.alerts(alert_rule_id);
CREATE INDEX IF NOT EXISTS idx_alerts_driver_id ON public.alerts(driver_id);
CREATE INDEX IF NOT EXISTS idx_alerts_load_id ON public.alerts(load_id);
CREATE INDEX IF NOT EXISTS idx_alerts_route_id ON public.alerts(route_id);
CREATE INDEX IF NOT EXISTS idx_alerts_truck_id ON public.alerts(truck_id);

-- ============================================================================
-- BOLS TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_bols_template_id ON public.bols(template_id);

-- ============================================================================
-- CHAT_MESSAGES TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_chat_messages_company_id ON public.chat_messages(company_id);

-- ============================================================================
-- CHAT_THREADS TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_chat_threads_driver_id ON public.chat_threads(driver_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_last_message_by ON public.chat_threads(last_message_by);
CREATE INDEX IF NOT EXISTS idx_chat_threads_route_id ON public.chat_threads(route_id);

-- ============================================================================
-- CHECK_CALLS TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_check_calls_route_id ON public.check_calls(route_id);

-- ============================================================================
-- COMPANY_EIN_NUMBERS TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_company_ein_numbers_generated_by ON public.company_ein_numbers(generated_by);

-- ============================================================================
-- COMPANY_PAYMENT_HISTORY TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_company_payment_history_subscription_id ON public.company_payment_history(subscription_id);

-- ============================================================================
-- CONTACT_HISTORY TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_contact_history_invoice_id ON public.contact_history(invoice_id);
CREATE INDEX IF NOT EXISTS idx_contact_history_load_id ON public.contact_history(load_id);
CREATE INDEX IF NOT EXISTS idx_contact_history_user_id ON public.contact_history(user_id);

-- ============================================================================
-- DETENTION_TRACKING TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_detention_tracking_driver_id ON public.detention_tracking(driver_id);
CREATE INDEX IF NOT EXISTS idx_detention_tracking_invoice_id ON public.detention_tracking(invoice_id);
CREATE INDEX IF NOT EXISTS idx_detention_tracking_truck_id ON public.detention_tracking(truck_id);

-- ============================================================================
-- DOCUMENTS TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_documents_driver_id ON public.documents(driver_id);
CREATE INDEX IF NOT EXISTS idx_documents_truck_id ON public.documents(truck_id);

-- ============================================================================
-- DRIVER_PERFORMANCE_SCORES TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_driver_performance_scores_company_id ON public.driver_performance_scores(company_id);

-- ============================================================================
-- DVIR TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_dvir_certified_by ON public.dvir(certified_by);

-- ============================================================================
-- ELD_EVENTS TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_eld_events_maintenance_id ON public.eld_events(maintenance_id);
CREATE INDEX IF NOT EXISTS idx_eld_events_resolved_by ON public.eld_events(resolved_by);
CREATE INDEX IF NOT EXISTS idx_eld_events_truck_id ON public.eld_events(truck_id);

-- ============================================================================
-- ETA_UPDATES TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_eta_updates_company_id ON public.eta_updates(company_id);
CREATE INDEX IF NOT EXISTS idx_eta_updates_driver_id ON public.eta_updates(driver_id);

-- ============================================================================
-- EXPENSES TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_expenses_driver_id ON public.expenses(driver_id);
CREATE INDEX IF NOT EXISTS idx_expenses_truck_id ON public.expenses(truck_id);

-- ============================================================================
-- FUEL_PURCHASES TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_fuel_purchases_driver_id ON public.fuel_purchases(driver_id);

-- ============================================================================
-- IDLE_TIME_SESSIONS TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_idle_time_sessions_eld_device_id ON public.idle_time_sessions(eld_device_id);
CREATE INDEX IF NOT EXISTS idx_idle_time_sessions_geofence_id ON public.idle_time_sessions(geofence_id);
CREATE INDEX IF NOT EXISTS idx_idle_time_sessions_load_id ON public.idle_time_sessions(load_id);
CREATE INDEX IF NOT EXISTS idx_idle_time_sessions_route_id ON public.idle_time_sessions(route_id);

-- ============================================================================
-- IFTA_TAX_RATES TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_ifta_tax_rates_created_by ON public.ifta_tax_rates(created_by);

-- ============================================================================
-- INVOICE_VERIFICATIONS TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_invoice_verifications_bol_id ON public.invoice_verifications(bol_id);
CREATE INDEX IF NOT EXISTS idx_invoice_verifications_verified_by ON public.invoice_verifications(verified_by);

-- ============================================================================
-- INVOICES TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_invoices_load_id ON public.invoices(load_id);
CREATE INDEX IF NOT EXISTS idx_invoices_verified_by ON public.invoices(verified_by);

-- ============================================================================
-- LOAD_STATUS_HISTORY TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_load_status_history_changed_by ON public.load_status_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_load_status_history_geofence_id ON public.load_status_history(geofence_id);
CREATE INDEX IF NOT EXISTS idx_load_status_history_zone_visit_id ON public.load_status_history(zone_visit_id);

-- ============================================================================
-- LOADS TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_loads_driver_id ON public.loads(driver_id);
CREATE INDEX IF NOT EXISTS idx_loads_route_id ON public.loads(route_id);
CREATE INDEX IF NOT EXISTS idx_loads_truck_id ON public.loads(truck_id);

-- ============================================================================
-- MAINTENANCE_ALERT_NOTIFICATIONS TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_maintenance_alert_notifications_maintenance_id ON public.maintenance_alert_notifications(maintenance_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_alert_notifications_sent_to ON public.maintenance_alert_notifications(sent_to);

-- ============================================================================
-- MAINTENANCE_DOCUMENTS TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_maintenance_documents_uploaded_by ON public.maintenance_documents(uploaded_by);

-- ============================================================================
-- PART_ORDERS TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_part_orders_company_id ON public.part_orders(company_id);

-- ============================================================================
-- PART_USAGE TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_part_usage_company_id ON public.part_usage(company_id);

-- ============================================================================
-- REMINDERS TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_reminders_completed_by ON public.reminders(completed_by);
CREATE INDEX IF NOT EXISTS idx_reminders_driver_id ON public.reminders(driver_id);
CREATE INDEX IF NOT EXISTS idx_reminders_invoice_id ON public.reminders(invoice_id);
CREATE INDEX IF NOT EXISTS idx_reminders_load_id ON public.reminders(load_id);
CREATE INDEX IF NOT EXISTS idx_reminders_truck_id ON public.reminders(truck_id);

-- ============================================================================
-- SETTLEMENTS TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_settlements_pay_rule_id ON public.settlements(pay_rule_id);

-- ============================================================================
-- STATE_CROSSINGS TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_state_crossings_eld_device_id ON public.state_crossings(eld_device_id);

-- ============================================================================
-- SUBSCRIPTIONS TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON public.subscriptions(plan_id);

-- ============================================================================
-- TRUCKS TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_trucks_current_driver_id ON public.trucks(current_driver_id);

-- ============================================================================
-- ZONE_VISITS TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_zone_visits_driver_id ON public.zone_visits(driver_id);
CREATE INDEX IF NOT EXISTS idx_zone_visits_route_id ON public.zone_visits(route_id);

-- ============================================================================
-- Summary
-- ============================================================================
-- This script adds indexes for all foreign key columns that were missing indexes.
-- These indexes will improve:
-- - DELETE performance (cascade checks)
-- - JOIN performance
-- - Foreign key constraint validation
-- ============================================================================


