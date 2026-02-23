-- ============================================================================
-- Fix RLS Performance Issues
-- ============================================================================
-- This migration fixes two types of performance issues:
-- 1. auth_rls_initplan: Replaces auth.uid() with (select auth.uid()) to evaluate once per query
-- 2. multiple_permissive_policies: Consolidates duplicate policies where possible
--
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- Helper function to get user's company_id (evaluated once per query)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1;
$$;

-- ============================================================================
-- Helper function to check if user is manager (evaluated once per query)
-- ============================================================================
CREATE OR REPLACE FUNCTION is_user_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = (SELECT auth.uid()) 
    AND role = 'manager'
    AND company_id IS NOT NULL
  );
$$;

-- ============================================================================
-- COMPANIES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their company" ON public.companies;
CREATE POLICY "Users can view their company"
  ON public.companies FOR SELECT
  USING (id = (select get_user_company_id()));

DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;
CREATE POLICY "Authenticated users can create companies"
  ON public.companies FOR INSERT
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Managers can update their company" ON public.companies;
CREATE POLICY "Managers can update their company"
  ON public.companies FOR UPDATE
  USING (
    id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- USERS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
CREATE POLICY "Users can view their own profile"
  ON public.users FOR SELECT
  USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Managers can view employees in their company" ON public.users;
CREATE POLICY "Managers can view employees in their company"
  ON public.users FOR SELECT
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

DROP POLICY IF EXISTS "Managers can update employees in their company" ON public.users;
CREATE POLICY "Managers can update employees in their company"
  ON public.users FOR UPDATE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

DROP POLICY IF EXISTS "Managers can delete employees from their company" ON public.users;
CREATE POLICY "Managers can delete employees from their company"
  ON public.users FOR DELETE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- DRIVERS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view drivers in their company" ON public.drivers;
CREATE POLICY "Users can view drivers in their company"
  ON public.drivers FOR SELECT
  USING (company_id = (select get_user_company_id()));

DROP POLICY IF EXISTS "Managers can insert drivers" ON public.drivers;
DROP POLICY IF EXISTS "Managers can update drivers" ON public.drivers;
DROP POLICY IF EXISTS "Managers can delete drivers" ON public.drivers;
-- Consolidated into single policy
CREATE POLICY "Managers can manage drivers"
  ON public.drivers FOR ALL
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- TRUCKS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view trucks in their company" ON public.trucks;
CREATE POLICY "Users can view trucks in their company"
  ON public.trucks FOR SELECT
  USING (company_id = (select get_user_company_id()));

DROP POLICY IF EXISTS "Managers can manage trucks" ON public.trucks;
CREATE POLICY "Managers can manage trucks"
  ON public.trucks FOR ALL
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- ROUTES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view routes in their company" ON public.routes;
CREATE POLICY "Users can view routes in their company"
  ON public.routes FOR SELECT
  USING (company_id = (select get_user_company_id()));

DROP POLICY IF EXISTS "Managers can manage routes" ON public.routes;
CREATE POLICY "Managers can manage routes"
  ON public.routes FOR ALL
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- LOADS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view loads in their company" ON public.loads;
CREATE POLICY "Users can view loads in their company"
  ON public.loads FOR SELECT
  USING (company_id = (select get_user_company_id()));

DROP POLICY IF EXISTS "Managers can manage loads" ON public.loads;
CREATE POLICY "Managers can manage loads"
  ON public.loads FOR ALL
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- INVOICES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view invoices in their company" ON public.invoices;
DROP POLICY IF EXISTS "Users can view their company's invoices" ON public.invoices;
-- Consolidated into single policy
CREATE POLICY "Users can view invoices in their company"
  ON public.invoices FOR SELECT
  USING (company_id = (select get_user_company_id()));

DROP POLICY IF EXISTS "Managers can manage invoices" ON public.invoices;
CREATE POLICY "Managers can manage invoices"
  ON public.invoices FOR ALL
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- EXPENSES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view expenses in their company" ON public.expenses;
CREATE POLICY "Users can view expenses in their company"
  ON public.expenses FOR SELECT
  USING (company_id = (select get_user_company_id()));

DROP POLICY IF EXISTS "Managers can manage expenses" ON public.expenses;
CREATE POLICY "Managers can manage expenses"
  ON public.expenses FOR ALL
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- SETTLEMENTS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view settlements in their company" ON public.settlements;
CREATE POLICY "Users can view settlements in their company"
  ON public.settlements FOR SELECT
  USING (company_id = (select get_user_company_id()));

DROP POLICY IF EXISTS "Managers can manage settlements" ON public.settlements;
CREATE POLICY "Managers can manage settlements"
  ON public.settlements FOR ALL
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- MAINTENANCE TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view maintenance in their company" ON public.maintenance;
CREATE POLICY "Users can view maintenance in their company"
  ON public.maintenance FOR SELECT
  USING (company_id = (select get_user_company_id()));

DROP POLICY IF EXISTS "Managers can manage maintenance" ON public.maintenance;
CREATE POLICY "Managers can manage maintenance"
  ON public.maintenance FOR ALL
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- IFTA_REPORTS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view IFTA reports in their company" ON public.ifta_reports;
DROP POLICY IF EXISTS "Users can insert IFTA reports in their company" ON public.ifta_reports;
DROP POLICY IF EXISTS "Users can update IFTA reports in their company" ON public.ifta_reports;
DROP POLICY IF EXISTS "Users can delete IFTA reports in their company" ON public.ifta_reports;
DROP POLICY IF EXISTS "Managers can manage IFTA reports" ON public.ifta_reports;
-- Consolidated: Users can view, Managers can manage
CREATE POLICY "Users can view IFTA reports in their company"
  ON public.ifta_reports FOR SELECT
  USING (company_id = (select get_user_company_id()));

CREATE POLICY "Managers can manage IFTA reports"
  ON public.ifta_reports FOR ALL
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- DOCUMENTS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view documents in their company" ON public.documents;
CREATE POLICY "Users can view documents in their company"
  ON public.documents FOR SELECT
  USING (company_id = (select get_user_company_id()));

DROP POLICY IF EXISTS "Managers can manage documents" ON public.documents;
CREATE POLICY "Managers can manage documents"
  ON public.documents FOR ALL
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- CUSTOMERS TABLE (from CRM schema)
-- ============================================================================
DROP POLICY IF EXISTS "Users can view customers in their company" ON public.customers;
DROP POLICY IF EXISTS "Users can insert customers in their company" ON public.customers;
DROP POLICY IF EXISTS "Users can update customers in their company" ON public.customers;
DROP POLICY IF EXISTS "Users can delete customers in their company" ON public.customers;
-- Consolidated: Users can manage customers
CREATE POLICY "Users can manage customers in their company"
  ON public.customers FOR ALL
  USING (company_id = (select get_user_company_id()))
  WITH CHECK (company_id = (select get_user_company_id()));

-- ============================================================================
-- VENDORS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view vendors in their company" ON public.vendors;
DROP POLICY IF EXISTS "Users can insert vendors in their company" ON public.vendors;
DROP POLICY IF EXISTS "Users can update vendors in their company" ON public.vendors;
DROP POLICY IF EXISTS "Users can delete vendors in their company" ON public.vendors;
-- Consolidated
CREATE POLICY "Users can manage vendors in their company"
  ON public.vendors FOR ALL
  USING (company_id = (select get_user_company_id()))
  WITH CHECK (company_id = (select get_user_company_id()));

-- ============================================================================
-- CONTACTS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view contacts in their company" ON public.contacts;
DROP POLICY IF EXISTS "Users can insert contacts in their company" ON public.contacts;
DROP POLICY IF EXISTS "Users can update contacts in their company" ON public.contacts;
DROP POLICY IF EXISTS "Users can delete contacts in their company" ON public.contacts;
-- Consolidated
CREATE POLICY "Users can manage contacts in their company"
  ON public.contacts FOR ALL
  USING (company_id = (select get_user_company_id()))
  WITH CHECK (company_id = (select get_user_company_id()));

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ============================================================================
-- ALERT_RULES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view alert rules in their company" ON public.alert_rules;
CREATE POLICY "Users can view alert rules in their company"
  ON public.alert_rules FOR SELECT
  USING (company_id = (select get_user_company_id()));

DROP POLICY IF EXISTS "Managers can manage alert rules" ON public.alert_rules;
CREATE POLICY "Managers can manage alert rules"
  ON public.alert_rules FOR ALL
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- ALERTS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view alerts in their company" ON public.alerts;
CREATE POLICY "Users can view alerts in their company"
  ON public.alerts FOR SELECT
  USING (company_id = (select get_user_company_id()));

DROP POLICY IF EXISTS "Users can update their alerts" ON public.alerts;
CREATE POLICY "Users can update their alerts"
  ON public.alerts FOR UPDATE
  USING (company_id = (select get_user_company_id()))
  WITH CHECK (company_id = (select get_user_company_id()));

-- ============================================================================
-- REMINDERS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view reminders in their company" ON public.reminders;
DROP POLICY IF EXISTS "Users can manage reminders" ON public.reminders;
-- Consolidated
CREATE POLICY "Users can manage reminders in their company"
  ON public.reminders FOR ALL
  USING (company_id = (select get_user_company_id()))
  WITH CHECK (company_id = (select get_user_company_id()));

-- ============================================================================
-- COMPANY_SETTINGS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view company settings" ON public.company_settings;
CREATE POLICY "Users can view company settings"
  ON public.company_settings FOR SELECT
  USING (company_id = (select get_user_company_id()));

DROP POLICY IF EXISTS "Managers can update company settings" ON public.company_settings;
CREATE POLICY "Managers can update company settings"
  ON public.company_settings FOR UPDATE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- COMPANY_INTEGRATIONS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view company integrations" ON public.company_integrations;
CREATE POLICY "Users can view company integrations"
  ON public.company_integrations FOR SELECT
  USING (company_id = (select get_user_company_id()));

DROP POLICY IF EXISTS "Managers can manage company integrations" ON public.company_integrations;
CREATE POLICY "Managers can manage company integrations"
  ON public.company_integrations FOR ALL
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- COMPANY_BILLING_INFO TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Managers can view billing info" ON public.company_billing_info;
DROP POLICY IF EXISTS "Managers can manage billing info" ON public.company_billing_info;
-- Consolidated
CREATE POLICY "Managers can manage billing info"
  ON public.company_billing_info FOR ALL
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- COMPANY_PORTAL_SETTINGS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view portal settings" ON public.company_portal_settings;
CREATE POLICY "Users can view portal settings"
  ON public.company_portal_settings FOR SELECT
  USING (company_id = (select get_user_company_id()));

DROP POLICY IF EXISTS "Managers can manage portal settings" ON public.company_portal_settings;
CREATE POLICY "Managers can manage portal settings"
  ON public.company_portal_settings FOR ALL
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- COMPANY_REMINDER_SETTINGS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view reminder settings" ON public.company_reminder_settings;
CREATE POLICY "Users can view reminder settings"
  ON public.company_reminder_settings FOR SELECT
  USING (company_id = (select get_user_company_id()));

DROP POLICY IF EXISTS "Managers can manage reminder settings" ON public.company_reminder_settings;
CREATE POLICY "Managers can manage reminder settings"
  ON public.company_reminder_settings FOR ALL
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- SUBSCRIPTIONS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their company's subscription" ON public.subscriptions;
CREATE POLICY "Users can view their company's subscription"
  ON public.subscriptions FOR SELECT
  USING (company_id = (select get_user_company_id()));

DROP POLICY IF EXISTS "Managers can insert subscriptions for their company" ON public.subscriptions;
DROP POLICY IF EXISTS "Managers can update their company's subscription" ON public.subscriptions;
-- Consolidated
CREATE POLICY "Managers can manage subscriptions"
  ON public.subscriptions FOR ALL
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- PAYMENT_METHODS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their company's payment methods" ON public.payment_methods;
CREATE POLICY "Users can view their company's payment methods"
  ON public.payment_methods FOR SELECT
  USING (company_id = (select get_user_company_id()));

-- ============================================================================
-- FILTER_PRESETS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view filter presets in their company" ON public.filter_presets;
DROP POLICY IF EXISTS "Users can create filter presets" ON public.filter_presets;
DROP POLICY IF EXISTS "Users can update their own filter presets" ON public.filter_presets;
DROP POLICY IF EXISTS "Users can delete their own filter presets" ON public.filter_presets;

-- Users can view all filter presets in their company
CREATE POLICY "Users can view filter presets in their company"
  ON public.filter_presets FOR SELECT
  USING (company_id = (select get_user_company_id()));

-- Users can manage their own filter presets
CREATE POLICY "Users can manage their own filter presets"
  ON public.filter_presets FOR ALL
  USING (
    company_id = (select get_user_company_id())
    AND user_id = (select auth.uid())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND user_id = (select auth.uid())
  );

-- ============================================================================
-- AUDIT_LOGS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view audit logs for their company" ON public.audit_logs;
CREATE POLICY "Users can view audit logs for their company"
  ON public.audit_logs FOR SELECT
  USING (company_id = (select get_user_company_id()));

DROP POLICY IF EXISTS "Users can insert audit logs for their company" ON public.audit_logs;
CREATE POLICY "Users can insert audit logs for their company"
  ON public.audit_logs FOR INSERT
  WITH CHECK (company_id = (select get_user_company_id()));

-- ============================================================================
-- Additional tables that need fixing (from other schema files)
-- These should be applied after running their respective schema files
-- ============================================================================

-- Note: This migration fixes the most common patterns.
-- For tables created in other migration files, apply the same pattern:
-- Replace: auth.uid() -> (select auth.uid())
-- Replace: SELECT company_id FROM users WHERE id = auth.uid() 
--      -> (select get_user_company_id())
-- Replace: role = 'manager' AND id = auth.uid()
--      -> (select is_user_manager())

-- ============================================================================
-- Grant execute permissions on helper functions
-- ============================================================================
GRANT EXECUTE ON FUNCTION get_user_company_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_user_manager() TO authenticated, anon;

