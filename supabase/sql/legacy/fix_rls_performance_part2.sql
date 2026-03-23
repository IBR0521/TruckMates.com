-- ============================================================================
-- Fix RLS Performance Issues - Part 2
-- ============================================================================
-- Additional tables that need RLS performance fixes
-- Run this after fix_rls_performance.sql
--
-- NOTE: If you get an error "column company_id does not exist", it means
-- one of the tables in this migration doesn't have a company_id column.
-- Check which table is causing the issue by running sections individually.
-- ============================================================================

-- ============================================================================
-- ELD TABLES
-- ============================================================================

-- ELD_DEVICES
DROP POLICY IF EXISTS "Users can view ELD devices in their company" ON public.eld_devices;
DROP POLICY IF EXISTS "Users can insert ELD devices for mobile app" ON public.eld_devices;
DROP POLICY IF EXISTS "Users can update their own mobile ELD device" ON public.eld_devices;
DROP POLICY IF EXISTS "Managers can insert ELD devices for other providers" ON public.eld_devices;
DROP POLICY IF EXISTS "Managers can update ELD devices" ON public.eld_devices;
DROP POLICY IF EXISTS "Managers can delete ELD devices" ON public.eld_devices;

CREATE POLICY "Users can view ELD devices in their company"
  ON public.eld_devices FOR SELECT
  USING (company_id = (select get_user_company_id()));

CREATE POLICY "Users can insert ELD devices for mobile app"
  ON public.eld_devices FOR INSERT
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND provider = 'truckmates_mobile'
  );

CREATE POLICY "Users can update their own mobile ELD device"
  ON public.eld_devices FOR UPDATE
  USING (
    company_id = (select get_user_company_id())
    AND provider = 'truckmates_mobile'
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND provider = 'truckmates_mobile'
  );

CREATE POLICY "Managers can manage ELD devices"
  ON public.eld_devices FOR ALL
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ELD_LOGS
DROP POLICY IF EXISTS "Users can view ELD logs in their company" ON public.eld_logs;
DROP POLICY IF EXISTS "Users can insert ELD logs" ON public.eld_logs;

CREATE POLICY "Users can view ELD logs in their company"
  ON public.eld_logs FOR SELECT
  USING (company_id = (select get_user_company_id()));

CREATE POLICY "Users can insert ELD logs"
  ON public.eld_logs FOR INSERT
  WITH CHECK (company_id = (select get_user_company_id()));

-- ELD_LOCATIONS
DROP POLICY IF EXISTS "Users can view ELD locations in their company" ON public.eld_locations;
DROP POLICY IF EXISTS "Users can insert ELD locations" ON public.eld_locations;

CREATE POLICY "Users can view ELD locations in their company"
  ON public.eld_locations FOR SELECT
  USING (company_id = (select get_user_company_id()));

CREATE POLICY "Users can insert ELD locations"
  ON public.eld_locations FOR INSERT
  WITH CHECK (company_id = (select get_user_company_id()));

-- ELD_EVENTS
DROP POLICY IF EXISTS "Users can view ELD events in their company" ON public.eld_events;
DROP POLICY IF EXISTS "Users can insert ELD events" ON public.eld_events;
DROP POLICY IF EXISTS "Managers can update ELD events" ON public.eld_events;

CREATE POLICY "Users can view ELD events in their company"
  ON public.eld_events FOR SELECT
  USING (company_id = (select get_user_company_id()));

CREATE POLICY "Users can insert ELD events"
  ON public.eld_events FOR INSERT
  WITH CHECK (company_id = (select get_user_company_id()));

CREATE POLICY "Managers can update ELD events"
  ON public.eld_events FOR UPDATE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ELD_DRIVER_MAPPINGS
DROP POLICY IF EXISTS "Individuals can view their own driver mappings." ON public.eld_driver_mappings;
DROP POLICY IF EXISTS "Individuals can create driver mappings." ON public.eld_driver_mappings;
DROP POLICY IF EXISTS "Individuals can update their own driver mappings." ON public.eld_driver_mappings;
DROP POLICY IF EXISTS "Individuals can delete their own driver mappings." ON public.eld_driver_mappings;

-- Users in the company can view driver mappings
CREATE POLICY "Individuals can view their own driver mappings."
  ON public.eld_driver_mappings FOR SELECT
  USING (company_id = (select get_user_company_id()));

-- Users in the company can create driver mappings
CREATE POLICY "Individuals can create driver mappings."
  ON public.eld_driver_mappings FOR INSERT
  WITH CHECK (company_id = (select get_user_company_id()));

-- Users in the company can update driver mappings
CREATE POLICY "Individuals can update their own driver mappings."
  ON public.eld_driver_mappings FOR UPDATE
  USING (company_id = (select get_user_company_id()))
  WITH CHECK (company_id = (select get_user_company_id()));

-- Users in the company can delete driver mappings
CREATE POLICY "Individuals can delete their own driver mappings."
  ON public.eld_driver_mappings FOR DELETE
  USING (company_id = (select get_user_company_id()));

-- ============================================================================
-- DVIR TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view DVIRs from their company" ON public.dvir;
DROP POLICY IF EXISTS "Users can insert DVIRs for their company" ON public.dvir;
DROP POLICY IF EXISTS "Users can update DVIRs from their company" ON public.dvir;
DROP POLICY IF EXISTS "Users can delete DVIRs from their company" ON public.dvir;

CREATE POLICY "Users can manage DVIRs in their company"
  ON public.dvir FOR ALL
  USING (company_id = (select get_user_company_id()))
  WITH CHECK (company_id = (select get_user_company_id()));

-- ============================================================================
-- GEOFENCES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view geofences from their company" ON public.geofences;
DROP POLICY IF EXISTS "Users can insert geofences for their company" ON public.geofences;
DROP POLICY IF EXISTS "Users can update geofences from their company" ON public.geofences;
DROP POLICY IF EXISTS "Users can delete geofences from their company" ON public.geofences;

CREATE POLICY "Users can manage geofences in their company"
  ON public.geofences FOR ALL
  USING (company_id = (select get_user_company_id()))
  WITH CHECK (company_id = (select get_user_company_id()));

-- ============================================================================
-- ZONE_VISITS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view zone visits from their company" ON public.zone_visits;
DROP POLICY IF EXISTS "Users can insert zone visits for their company" ON public.zone_visits;

CREATE POLICY "Users can manage zone visits in their company"
  ON public.zone_visits FOR ALL
  USING (company_id = (select get_user_company_id()))
  WITH CHECK (company_id = (select get_user_company_id()));

-- ============================================================================
-- ETA_UPDATES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view ETA updates from their company" ON public.eta_updates;
DROP POLICY IF EXISTS "Users can insert ETA updates for their company" ON public.eta_updates;

CREATE POLICY "Users can manage ETA updates in their company"
  ON public.eta_updates FOR ALL
  USING (company_id = (select get_user_company_id()))
  WITH CHECK (company_id = (select get_user_company_id()));

-- ============================================================================
-- ROUTE_STOPS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view route stops in their company" ON public.route_stops;
DROP POLICY IF EXISTS "Managers can insert route stops" ON public.route_stops;
DROP POLICY IF EXISTS "Managers can update route stops" ON public.route_stops;
DROP POLICY IF EXISTS "Managers can delete route stops" ON public.route_stops;

CREATE POLICY "Users can view route stops in their company"
  ON public.route_stops FOR SELECT
  USING (company_id = (select get_user_company_id()));

CREATE POLICY "Managers can manage route stops"
  ON public.route_stops FOR ALL
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- LOAD_DELIVERY_POINTS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view delivery points in their company" ON public.load_delivery_points;
DROP POLICY IF EXISTS "Managers can insert delivery points" ON public.load_delivery_points;
DROP POLICY IF EXISTS "Managers can update delivery points" ON public.load_delivery_points;
DROP POLICY IF EXISTS "Managers can delete delivery points" ON public.load_delivery_points;

CREATE POLICY "Users can view delivery points in their company"
  ON public.load_delivery_points FOR SELECT
  USING (company_id = (select get_user_company_id()));

CREATE POLICY "Managers can manage delivery points"
  ON public.load_delivery_points FOR ALL
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- ADDRESS_BOOK TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view address book from their company" ON public.address_book;
DROP POLICY IF EXISTS "Users can insert address book for their company" ON public.address_book;
DROP POLICY IF EXISTS "Users can update address book from their company" ON public.address_book;
DROP POLICY IF EXISTS "Users can delete address book from their company" ON public.address_book;

CREATE POLICY "Users can manage address book in their company"
  ON public.address_book FOR ALL
  USING (company_id = (select get_user_company_id()))
  WITH CHECK (company_id = (select get_user_company_id()));

-- ============================================================================
-- CONTACT_HISTORY TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view contact history in their company" ON public.contact_history;
DROP POLICY IF EXISTS "Users can insert contact history in their company" ON public.contact_history;
DROP POLICY IF EXISTS "Users can update contact history in their company" ON public.contact_history;
DROP POLICY IF EXISTS "Users can delete contact history in their company" ON public.contact_history;

CREATE POLICY "Users can manage contact history in their company"
  ON public.contact_history FOR ALL
  USING (company_id = (select get_user_company_id()))
  WITH CHECK (company_id = (select get_user_company_id()));

-- ============================================================================
-- NOTIFICATION_PREFERENCES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own notification preferences" ON public.notification_preferences;
DROP POLICY IF EXISTS "Users can update their own notification preferences" ON public.notification_preferences;
DROP POLICY IF EXISTS "Users can insert their own notification preferences" ON public.notification_preferences;

CREATE POLICY "Users can manage their own notification preferences"
  ON public.notification_preferences FOR ALL
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ============================================================================
-- WORK_ORDERS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view work orders in their company" ON public.work_orders;
DROP POLICY IF EXISTS "Users can insert work orders in their company" ON public.work_orders;
DROP POLICY IF EXISTS "Users can update work orders in their company" ON public.work_orders;
DROP POLICY IF EXISTS "Users can delete work orders in their company" ON public.work_orders;

CREATE POLICY "Users can manage work orders in their company"
  ON public.work_orders FOR ALL
  USING (company_id = (select get_user_company_id()))
  WITH CHECK (company_id = (select get_user_company_id()));

-- ============================================================================
-- MAINTENANCE_DOCUMENTS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view maintenance documents in their company" ON public.maintenance_documents;
DROP POLICY IF EXISTS "Users can insert maintenance documents in their company" ON public.maintenance_documents;
DROP POLICY IF EXISTS "Users can update maintenance documents in their company" ON public.maintenance_documents;
DROP POLICY IF EXISTS "Users can delete maintenance documents in their company" ON public.maintenance_documents;

CREATE POLICY "Users can manage maintenance documents in their company"
  ON public.maintenance_documents FOR ALL
  USING (company_id = (select get_user_company_id()))
  WITH CHECK (company_id = (select get_user_company_id()));

-- ============================================================================
-- PARTS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view parts in their company" ON public.parts;
DROP POLICY IF EXISTS "Users can insert parts in their company" ON public.parts;
DROP POLICY IF EXISTS "Users can update parts in their company" ON public.parts;
DROP POLICY IF EXISTS "Users can delete parts in their company" ON public.parts;

CREATE POLICY "Users can manage parts in their company"
  ON public.parts FOR ALL
  USING (company_id = (select get_user_company_id()))
  WITH CHECK (company_id = (select get_user_company_id()));

-- ============================================================================
-- PART_USAGE TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view part usage in their company" ON public.part_usage;
DROP POLICY IF EXISTS "Users can insert part usage in their company" ON public.part_usage;
DROP POLICY IF EXISTS "Users can update part usage in their company" ON public.part_usage;
DROP POLICY IF EXISTS "Users can delete part usage in their company" ON public.part_usage;

CREATE POLICY "Users can manage part usage in their company"
  ON public.part_usage FOR ALL
  USING (company_id = (select get_user_company_id()))
  WITH CHECK (company_id = (select get_user_company_id()));

-- ============================================================================
-- PART_ORDERS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view part orders in their company" ON public.part_orders;
DROP POLICY IF EXISTS "Users can insert part orders in their company" ON public.part_orders;
DROP POLICY IF EXISTS "Users can update part orders in their company" ON public.part_orders;
DROP POLICY IF EXISTS "Users can delete part orders in their company" ON public.part_orders;

CREATE POLICY "Users can manage part orders in their company"
  ON public.part_orders FOR ALL
  USING (company_id = (select get_user_company_id()))
  WITH CHECK (company_id = (select get_user_company_id()));

-- ============================================================================
-- FAULT_CODE_MAINTENANCE_RULES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view fault code rules in their company" ON public.fault_code_maintenance_rules;
DROP POLICY IF EXISTS "Users can insert fault code rules in their company" ON public.fault_code_maintenance_rules;
DROP POLICY IF EXISTS "Users can update fault code rules in their company" ON public.fault_code_maintenance_rules;
DROP POLICY IF EXISTS "Users can delete fault code rules in their company" ON public.fault_code_maintenance_rules;

CREATE POLICY "Users can manage fault code rules in their company"
  ON public.fault_code_maintenance_rules FOR ALL
  USING (company_id = (select get_user_company_id()))
  WITH CHECK (company_id = (select get_user_company_id()));

-- ============================================================================
-- BOL_TEMPLATES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view BOL templates in their company" ON public.bol_templates;
DROP POLICY IF EXISTS "Users can insert BOL templates in their company" ON public.bol_templates;
DROP POLICY IF EXISTS "Users can update BOL templates in their company" ON public.bol_templates;
DROP POLICY IF EXISTS "Users can delete BOL templates in their company" ON public.bol_templates;

CREATE POLICY "Users can manage BOL templates in their company"
  ON public.bol_templates FOR ALL
  USING (company_id = (select get_user_company_id()))
  WITH CHECK (company_id = (select get_user_company_id()));

-- ============================================================================
-- BOLS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view BOLs in their company" ON public.bols;
DROP POLICY IF EXISTS "Users can insert BOLs in their company" ON public.bols;
DROP POLICY IF EXISTS "Users can update BOLs in their company" ON public.bols;
DROP POLICY IF EXISTS "Users can delete BOLs in their company" ON public.bols;

CREATE POLICY "Users can manage BOLs in their company"
  ON public.bols FOR ALL
  USING (company_id = (select get_user_company_id()))
  WITH CHECK (company_id = (select get_user_company_id()));

-- ============================================================================
-- DRIVER_PAY_RULES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view pay rules in their company" ON public.driver_pay_rules;
DROP POLICY IF EXISTS "Users can insert pay rules in their company" ON public.driver_pay_rules;
DROP POLICY IF EXISTS "Users can update pay rules in their company" ON public.driver_pay_rules;
DROP POLICY IF EXISTS "Users can delete pay rules in their company" ON public.driver_pay_rules;

CREATE POLICY "Users can manage pay rules in their company"
  ON public.driver_pay_rules FOR ALL
  USING (company_id = (select get_user_company_id()))
  WITH CHECK (company_id = (select get_user_company_id()));

-- ============================================================================
-- FUEL_PURCHASES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view fuel purchases in their company" ON public.fuel_purchases;
DROP POLICY IF EXISTS "Users can insert fuel purchases in their company" ON public.fuel_purchases;
DROP POLICY IF EXISTS "Users can update fuel purchases in their company" ON public.fuel_purchases;
DROP POLICY IF EXISTS "Users can delete fuel purchases in their company" ON public.fuel_purchases;

CREATE POLICY "Users can manage fuel purchases in their company"
  ON public.fuel_purchases FOR ALL
  USING (company_id = (select get_user_company_id()))
  WITH CHECK (company_id = (select get_user_company_id()));

-- ============================================================================
-- IFTA_STATE_BREAKDOWN TABLE
-- ============================================================================
-- Note: ifta_state_breakdown doesn't have company_id - it references ifta_reports which has company_id
DROP POLICY IF EXISTS "Users can view IFTA state breakdown in their company" ON public.ifta_state_breakdown;
DROP POLICY IF EXISTS "Users can insert IFTA state breakdown in their company" ON public.ifta_state_breakdown;
DROP POLICY IF EXISTS "Users can update IFTA state breakdown in their company" ON public.ifta_state_breakdown;
DROP POLICY IF EXISTS "Users can delete IFTA state breakdown in their company" ON public.ifta_state_breakdown;

CREATE POLICY "Users can manage IFTA state breakdown in their company"
  ON public.ifta_state_breakdown FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.ifta_reports
      WHERE id = ifta_state_breakdown.ifta_report_id
      AND company_id = (select get_user_company_id())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ifta_reports
      WHERE id = ifta_state_breakdown.ifta_report_id
      AND company_id = (select get_user_company_id())
    )
  );

-- ============================================================================
-- STATE_CROSSINGS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view state crossings in their company" ON public.state_crossings;
DROP POLICY IF EXISTS "Users can insert state crossings in their company" ON public.state_crossings;

CREATE POLICY "Users can manage state crossings in their company"
  ON public.state_crossings FOR ALL
  USING (company_id = (select get_user_company_id()))
  WITH CHECK (company_id = (select get_user_company_id()));

-- ============================================================================
-- CHECK_CALLS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view check calls in their company" ON public.check_calls;
DROP POLICY IF EXISTS "Users can create check calls" ON public.check_calls;
DROP POLICY IF EXISTS "Users can update check calls" ON public.check_calls;

CREATE POLICY "Users can manage check calls in their company"
  ON public.check_calls FOR ALL
  USING (company_id = (select get_user_company_id()))
  WITH CHECK (company_id = (select get_user_company_id()));

-- ============================================================================
-- CHAT TABLES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view chat threads they're in" ON public.chat_threads;
DROP POLICY IF EXISTS "Users can create chat threads" ON public.chat_threads;

-- Users can view threads they're participants in
CREATE POLICY "Users can view chat threads they're in"
  ON public.chat_threads FOR SELECT
  USING (
    company_id = (select get_user_company_id())
    AND (
      (select auth.uid())::text = ANY(SELECT jsonb_array_elements_text(participants))
      OR participants IS NULL
    )
  );

-- Users can create threads in their company
CREATE POLICY "Users can create chat threads"
  ON public.chat_threads FOR INSERT
  WITH CHECK (company_id = (select get_user_company_id()));

-- Users can update threads they're participants in
CREATE POLICY "Users can update chat threads"
  ON public.chat_threads FOR UPDATE
  USING (
    company_id = (select get_user_company_id())
    AND (
      (select auth.uid())::text = ANY(SELECT jsonb_array_elements_text(participants))
      OR participants IS NULL
    )
  )
  WITH CHECK (company_id = (select get_user_company_id()));

DROP POLICY IF EXISTS "Users can view messages in their threads" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.chat_messages;

-- Users can view messages in threads from their company
CREATE POLICY "Users can view messages in their threads"
  ON public.chat_messages FOR SELECT
  USING (
    company_id = (select get_user_company_id())
    AND EXISTS (
      SELECT 1 FROM public.chat_threads
      WHERE id = chat_messages.thread_id
      AND (
        (select auth.uid())::text = ANY(SELECT jsonb_array_elements_text(participants))
        OR participants IS NULL
      )
    )
  );

-- Users can send messages in threads from their company
CREATE POLICY "Users can send messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND sender_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.chat_threads
      WHERE id = chat_messages.thread_id
      AND company_id = (select get_user_company_id())
    )
  );

-- Users can update/delete their own messages
CREATE POLICY "Users can update their own messages"
  ON public.chat_messages FOR UPDATE
  USING (
    company_id = (select get_user_company_id())
    AND sender_id = (select auth.uid())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND sender_id = (select auth.uid())
  );

-- ============================================================================
-- CUSTOMER_PORTAL_ACCESS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view portal access in their company" ON public.customer_portal_access;
DROP POLICY IF EXISTS "Public token-based portal access" ON public.customer_portal_access;
DROP POLICY IF EXISTS "Managers can create portal access" ON public.customer_portal_access;
DROP POLICY IF EXISTS "Managers can update portal access" ON public.customer_portal_access;
DROP POLICY IF EXISTS "Managers can delete portal access" ON public.customer_portal_access;
DROP POLICY IF EXISTS "Managers can manage portal access" ON public.customer_portal_access;

-- Users can view portal access in their company
CREATE POLICY "Users can view portal access in their company"
  ON public.customer_portal_access FOR SELECT
  USING (company_id = (select get_user_company_id()));

-- Public token-based access (for customer portal)
CREATE POLICY "Public token-based portal access"
  ON public.customer_portal_access FOR SELECT
  USING (access_token IS NOT NULL);

-- Managers can manage portal access
CREATE POLICY "Managers can manage portal access"
  ON public.customer_portal_access FOR ALL
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- USER_PREFERENCES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can update their own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can insert their own preferences" ON public.user_preferences;

CREATE POLICY "Users can manage their own preferences"
  ON public.user_preferences FOR ALL
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ============================================================================
-- DRIVER_ONBOARDING TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their company driver onboarding" ON public.driver_onboarding;
DROP POLICY IF EXISTS "Managers can manage their company driver onboarding" ON public.driver_onboarding;

CREATE POLICY "Users can view their company driver onboarding"
  ON public.driver_onboarding FOR SELECT
  USING (company_id = (select get_user_company_id()));

CREATE POLICY "Managers can manage their company driver onboarding"
  ON public.driver_onboarding FOR ALL
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- ONBOARDING_CHECKLIST_TEMPLATES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their company onboarding templates" ON public.onboarding_checklist_templates;
DROP POLICY IF EXISTS "Managers can manage their company onboarding templates" ON public.onboarding_checklist_templates;

CREATE POLICY "Users can view their company onboarding templates"
  ON public.onboarding_checklist_templates FOR SELECT
  USING (company_id = (select get_user_company_id()));

CREATE POLICY "Managers can manage their company onboarding templates"
  ON public.onboarding_checklist_templates FOR ALL
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- FEEDBACK TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users can insert their own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users can update their own feedback" ON public.feedback;

CREATE POLICY "Users can manage their own feedback"
  ON public.feedback FOR ALL
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ============================================================================
-- WEBHOOKS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view webhooks in their company" ON public.webhooks;
DROP POLICY IF EXISTS "Users can insert webhooks in their company" ON public.webhooks;
DROP POLICY IF EXISTS "Users can update webhooks in their company" ON public.webhooks;
DROP POLICY IF EXISTS "Users can delete webhooks in their company" ON public.webhooks;

CREATE POLICY "Users can manage webhooks in their company"
  ON public.webhooks FOR ALL
  USING (company_id = (select get_user_company_id()))
  WITH CHECK (company_id = (select get_user_company_id()));

-- ============================================================================
-- WEBHOOK_DELIVERIES TABLE
-- ============================================================================
-- Note: webhook_deliveries doesn't have company_id - it references webhooks which has company_id
DROP POLICY IF EXISTS "Users can view webhook deliveries in their company" ON public.webhook_deliveries;
DROP POLICY IF EXISTS "Users can insert webhook deliveries in their company" ON public.webhook_deliveries;
DROP POLICY IF EXISTS "Users can update webhook deliveries in their company" ON public.webhook_deliveries;

CREATE POLICY "Users can manage webhook deliveries in their company"
  ON public.webhook_deliveries FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.webhooks
      WHERE id = webhook_deliveries.webhook_id
      AND company_id = (select get_user_company_id())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.webhooks
      WHERE id = webhook_deliveries.webhook_id
      AND company_id = (select get_user_company_id())
    )
  );

-- ============================================================================
-- API_USAGE_LOG TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can read their company usage" ON public.api_usage_log;
DROP POLICY IF EXISTS "System can write usage logs" ON public.api_usage_log;

CREATE POLICY "Users can read their company usage"
  ON public.api_usage_log FOR SELECT
  USING (company_id = (select get_user_company_id()));

CREATE POLICY "System can write usage logs"
  ON public.api_usage_log FOR INSERT
  WITH CHECK (true); -- System-level insert, no RLS check needed

-- ============================================================================
-- API_CACHE TABLE
-- ============================================================================
-- Note: api_cache table does NOT have company_id column - it's a shared cache
DROP POLICY IF EXISTS "Users can read cache" ON public.api_cache;
DROP POLICY IF EXISTS "System can write cache" ON public.api_cache;

-- Cache is readable by all authenticated users (for shared caching)
CREATE POLICY "Users can read cache"
  ON public.api_cache FOR SELECT
  USING (true);

-- Only system can write to cache (via server actions)
CREATE POLICY "System can write cache"
  ON public.api_cache FOR ALL
  USING (false); -- Server actions bypass RLS

-- ============================================================================
-- AI_KNOWLEDGE_BASE TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view knowledge for their company" ON public.ai_knowledge_base;
DROP POLICY IF EXISTS "Users can insert knowledge for their company" ON public.ai_knowledge_base;

CREATE POLICY "Users can manage knowledge for their company"
  ON public.ai_knowledge_base FOR ALL
  USING (
    company_id = (select get_user_company_id())
    OR company_id IS NULL -- Public knowledge
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    OR company_id IS NULL
  );

-- ============================================================================
-- AI_CONVERSATIONS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "Users can insert their conversations" ON public.ai_conversations;

CREATE POLICY "Users can manage their conversations"
  ON public.ai_conversations FOR ALL
  USING (
    user_id = (select auth.uid())
    AND company_id = (select get_user_company_id())
  )
  WITH CHECK (
    user_id = (select auth.uid())
    AND company_id = (select get_user_company_id())
  );

-- ============================================================================
-- IDLE_TIME_SESSIONS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view idle time sessions from their company" ON public.idle_time_sessions;

CREATE POLICY "Users can view idle time sessions from their company"
  ON public.idle_time_sessions FOR SELECT
  USING (company_id = (select get_user_company_id()));

-- ============================================================================
-- DETENTION_TRACKING TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view detention records from their company" ON public.detention_tracking;
DROP POLICY IF EXISTS "Users can insert detention records for their company" ON public.detention_tracking;
DROP POLICY IF EXISTS "Users can update detention records from their company" ON public.detention_tracking;

CREATE POLICY "Users can manage detention records in their company"
  ON public.detention_tracking FOR ALL
  USING (company_id = (select get_user_company_id()))
  WITH CHECK (company_id = (select get_user_company_id()));

-- ============================================================================
-- LOAD_STATUS_HISTORY TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view load status history from their company" ON public.load_status_history;

CREATE POLICY "Users can view load status history from their company"
  ON public.load_status_history FOR SELECT
  USING (company_id = (select get_user_company_id()));

-- ============================================================================
-- INVOICE_VERIFICATIONS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view invoice verifications in their company" ON public.invoice_verifications;
DROP POLICY IF EXISTS "Users can insert invoice verifications in their company" ON public.invoice_verifications;
DROP POLICY IF EXISTS "Users can update invoice verifications in their company" ON public.invoice_verifications;

CREATE POLICY "Users can manage invoice verifications in their company"
  ON public.invoice_verifications FOR ALL
  USING (company_id = (select get_user_company_id()))
  WITH CHECK (company_id = (select get_user_company_id()));

-- ============================================================================
-- MAINTENANCE_ALERT_NOTIFICATIONS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view maintenance alerts from their company" ON public.maintenance_alert_notifications;

CREATE POLICY "Users can view maintenance alerts from their company"
  ON public.maintenance_alert_notifications FOR SELECT
  USING (company_id = (select get_user_company_id()));

