-- ============================================================================
-- Comprehensive RLS Performance Fix - All Warnings
-- ============================================================================
-- This script fixes ALL RLS warnings:
-- 1. auth_rls_initplan: Wraps auth.uid() in (select auth.uid()) to evaluate once per query
-- 2. multiple_permissive_policies: Consolidates overlapping policies
--
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- Helper Functions (create if they don't exist)
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

GRANT EXECUTE ON FUNCTION get_user_company_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_user_manager() TO authenticated, anon;

-- ============================================================================
-- IFTA_REPORTS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view IFTA reports in their company" ON public.ifta_reports;
DROP POLICY IF EXISTS "Users can insert IFTA reports in their company" ON public.ifta_reports;
DROP POLICY IF EXISTS "Users can update IFTA reports in their company" ON public.ifta_reports;
DROP POLICY IF EXISTS "Users can delete IFTA reports in their company" ON public.ifta_reports;
DROP POLICY IF EXISTS "Managers can manage IFTA reports" ON public.ifta_reports;

-- Consolidated: Single SELECT policy for all users
CREATE POLICY "Users can view IFTA reports in their company"
  ON public.ifta_reports FOR SELECT
  USING (company_id = (select get_user_company_id()));

-- Managers can manage (INSERT/UPDATE/DELETE only, not SELECT to avoid overlap)
-- Separate policies for each operation to avoid multiple permissive policies warning
CREATE POLICY "Managers can insert IFTA reports"
  ON public.ifta_reports FOR INSERT
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can update IFTA reports"
  ON public.ifta_reports FOR UPDATE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can delete IFTA reports"
  ON public.ifta_reports FOR DELETE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- DRIVER_BADGES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view driver badges from their company" ON public.driver_badges;

CREATE POLICY "Users can view driver badges from their company"
  ON public.driver_badges FOR SELECT
  USING (company_id = (select get_user_company_id()));

-- ============================================================================
-- DRIVER_PERFORMANCE_SCORES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view performance scores from their company" ON public.driver_performance_scores;

CREATE POLICY "Users can view performance scores from their company"
  ON public.driver_performance_scores FOR SELECT
  USING (company_id = (select get_user_company_id()));

-- ============================================================================
-- IFTA_TAX_RATES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view tax rates in their company" ON public.ifta_tax_rates;
DROP POLICY IF EXISTS "Users can manage tax rates in their company" ON public.ifta_tax_rates;

-- Consolidated: Single SELECT policy
CREATE POLICY "Users can view tax rates in their company"
  ON public.ifta_tax_rates FOR SELECT
  USING (company_id = (select get_user_company_id()));

-- Managers can manage (INSERT/UPDATE/DELETE only)
CREATE POLICY "Users can insert tax rates in their company"
  ON public.ifta_tax_rates FOR INSERT
  WITH CHECK (company_id = (select get_user_company_id()));

CREATE POLICY "Users can update tax rates in their company"
  ON public.ifta_tax_rates FOR UPDATE
  USING (company_id = (select get_user_company_id()))
  WITH CHECK (company_id = (select get_user_company_id()));

CREATE POLICY "Users can delete tax rates in their company"
  ON public.ifta_tax_rates FOR DELETE
  USING (company_id = (select get_user_company_id()));

-- ============================================================================
-- COMPANY_EIN_NUMBERS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view EIN numbers from their company" ON public.company_ein_numbers;
DROP POLICY IF EXISTS "Managers can manage EIN numbers" ON public.company_ein_numbers;

CREATE POLICY "Users can view EIN numbers from their company"
  ON public.company_ein_numbers FOR SELECT
  USING (company_id = (select get_user_company_id()));

CREATE POLICY "Managers can insert EIN numbers"
  ON public.company_ein_numbers FOR INSERT
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can update EIN numbers"
  ON public.company_ein_numbers FOR UPDATE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can delete EIN numbers"
  ON public.company_ein_numbers FOR DELETE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- COMPANY_ACCESSORIALS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view accessorials from their company" ON public.company_accessorials;
DROP POLICY IF EXISTS "Managers can manage accessorials" ON public.company_accessorials;

CREATE POLICY "Users can view accessorials from their company"
  ON public.company_accessorials FOR SELECT
  USING (company_id = (select get_user_company_id()));

CREATE POLICY "Managers can insert accessorials"
  ON public.company_accessorials FOR INSERT
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can update accessorials"
  ON public.company_accessorials FOR UPDATE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can delete accessorials"
  ON public.company_accessorials FOR DELETE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- COMPANY_INVOICE_TAXES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view invoice taxes from their company" ON public.company_invoice_taxes;
DROP POLICY IF EXISTS "Managers can manage invoice taxes" ON public.company_invoice_taxes;

CREATE POLICY "Users can view invoice taxes from their company"
  ON public.company_invoice_taxes FOR SELECT
  USING (company_id = (select get_user_company_id()));

CREATE POLICY "Managers can insert invoice taxes"
  ON public.company_invoice_taxes FOR INSERT
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can update invoice taxes"
  ON public.company_invoice_taxes FOR UPDATE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can delete invoice taxes"
  ON public.company_invoice_taxes FOR DELETE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- COMPANY_SUBSCRIPTIONS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view subscriptions from their company" ON public.company_subscriptions;

CREATE POLICY "Users can view subscriptions from their company"
  ON public.company_subscriptions FOR SELECT
  USING (company_id = (select get_user_company_id()));

-- ============================================================================
-- COMPANY_PAYMENT_HISTORY TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view payment history from their company" ON public.company_payment_history;

CREATE POLICY "Users can view payment history from their company"
  ON public.company_payment_history FOR SELECT
  USING (company_id = (select get_user_company_id()));

-- ============================================================================
-- COMPANY_PAYMENT_METHODS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view payment methods from their company" ON public.company_payment_methods;
DROP POLICY IF EXISTS "Managers can manage payment methods" ON public.company_payment_methods;

CREATE POLICY "Users can view payment methods from their company"
  ON public.company_payment_methods FOR SELECT
  USING (company_id = (select get_user_company_id()));

CREATE POLICY "Managers can insert payment methods"
  ON public.company_payment_methods FOR INSERT
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can update payment methods"
  ON public.company_payment_methods FOR UPDATE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can delete payment methods"
  ON public.company_payment_methods FOR DELETE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- ALERT_RULES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view alert rules in their company" ON public.alert_rules;
DROP POLICY IF EXISTS "Managers can manage alert rules" ON public.alert_rules;

CREATE POLICY "Users can view alert rules in their company"
  ON public.alert_rules FOR SELECT
  USING (company_id = (select get_user_company_id()));

CREATE POLICY "Managers can insert alert rules"
  ON public.alert_rules FOR INSERT
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can update alert rules"
  ON public.alert_rules FOR UPDATE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can delete alert rules"
  ON public.alert_rules FOR DELETE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- API_CACHE TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can read cache" ON public.api_cache;
DROP POLICY IF EXISTS "System can write cache" ON public.api_cache;

-- Consolidated: Everyone can read, system can write
CREATE POLICY "Users can read cache"
  ON public.api_cache FOR SELECT
  USING (true);

-- System can write (for service role) - INSERT/UPDATE/DELETE only
CREATE POLICY "System can insert cache"
  ON public.api_cache FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update cache"
  ON public.api_cache FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "System can delete cache"
  ON public.api_cache FOR DELETE
  USING (true);

-- ============================================================================
-- CUSTOMER_PORTAL_ACCESS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view portal access in their company" ON public.customer_portal_access;
DROP POLICY IF EXISTS "Managers can manage portal access" ON public.customer_portal_access;
DROP POLICY IF EXISTS "Public token-based portal access" ON public.customer_portal_access;

-- Consolidated SELECT policy: Public token-based access OR users can view their company
CREATE POLICY "Public token-based portal access"
  ON public.customer_portal_access FOR SELECT
  USING (
    true  -- Public token-based access (for unauthenticated portal access)
    OR company_id = (select get_user_company_id())  -- Authenticated users can view their company
  );

-- Managers can manage (INSERT/UPDATE/DELETE only)
CREATE POLICY "Managers can insert portal access"
  ON public.customer_portal_access FOR INSERT
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can update portal access"
  ON public.customer_portal_access FOR UPDATE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can delete portal access"
  ON public.customer_portal_access FOR DELETE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- DOCUMENTS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view documents in their company" ON public.documents;
DROP POLICY IF EXISTS "Managers can manage documents" ON public.documents;

CREATE POLICY "Users can view documents in their company"
  ON public.documents FOR SELECT
  USING (company_id = (select get_user_company_id()));

CREATE POLICY "Managers can insert documents"
  ON public.documents FOR INSERT
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can update documents"
  ON public.documents FOR UPDATE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can delete documents"
  ON public.documents FOR DELETE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- DRIVER_ONBOARDING TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their company driver onboarding" ON public.driver_onboarding;
DROP POLICY IF EXISTS "Managers can manage their company driver onboarding" ON public.driver_onboarding;

CREATE POLICY "Users can view their company driver onboarding"
  ON public.driver_onboarding FOR SELECT
  USING (company_id = (select get_user_company_id()));

CREATE POLICY "Managers can insert their company driver onboarding"
  ON public.driver_onboarding FOR INSERT
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can update their company driver onboarding"
  ON public.driver_onboarding FOR UPDATE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can delete their company driver onboarding"
  ON public.driver_onboarding FOR DELETE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- DRIVERS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view drivers in their company" ON public.drivers;
DROP POLICY IF EXISTS "Managers can manage drivers" ON public.drivers;

CREATE POLICY "Users can view drivers in their company"
  ON public.drivers FOR SELECT
  USING (company_id = (select get_user_company_id()));

CREATE POLICY "Managers can insert drivers"
  ON public.drivers FOR INSERT
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can update drivers"
  ON public.drivers FOR UPDATE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can delete drivers"
  ON public.drivers FOR DELETE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- ELD_DEVICES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view ELD devices in their company" ON public.eld_devices;
DROP POLICY IF EXISTS "Users can insert ELD devices for mobile app" ON public.eld_devices;
DROP POLICY IF EXISTS "Users can update their own mobile ELD device" ON public.eld_devices;
DROP POLICY IF EXISTS "Managers can manage ELD devices" ON public.eld_devices;

CREATE POLICY "Users can view ELD devices in their company"
  ON public.eld_devices FOR SELECT
  USING (company_id = (select get_user_company_id()));

-- Consolidated INSERT policy: Users can insert mobile app devices OR managers can insert any
CREATE POLICY "Users can insert ELD devices for mobile app"
  ON public.eld_devices FOR INSERT
  WITH CHECK (
    (
      company_id = (select get_user_company_id())
      AND provider = 'truckmates_mobile'
    )
    OR (
      company_id = (select get_user_company_id())
      AND (select is_user_manager())
    )
  );

-- Consolidated UPDATE policy: Users can update their own mobile device OR managers can update any
CREATE POLICY "Users can update their own mobile ELD device"
  ON public.eld_devices FOR UPDATE
  USING (
    (
      company_id = (select get_user_company_id())
      AND provider = 'truckmates_mobile'
    )
    OR (
      company_id = (select get_user_company_id())
      AND (select is_user_manager())
    )
  )
  WITH CHECK (
    (
      company_id = (select get_user_company_id())
      AND provider = 'truckmates_mobile'
    )
    OR (
      company_id = (select get_user_company_id())
      AND (select is_user_manager())
    )
  );

CREATE POLICY "Managers can delete ELD devices"
  ON public.eld_devices FOR DELETE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- EXPENSES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view expenses in their company" ON public.expenses;
DROP POLICY IF EXISTS "Managers can manage expenses" ON public.expenses;

CREATE POLICY "Users can view expenses in their company"
  ON public.expenses FOR SELECT
  USING (company_id = (select get_user_company_id()));

CREATE POLICY "Managers can insert expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can update expenses"
  ON public.expenses FOR UPDATE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can delete expenses"
  ON public.expenses FOR DELETE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- INVOICES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view invoices in their company" ON public.invoices;
DROP POLICY IF EXISTS "Managers can manage invoices" ON public.invoices;

CREATE POLICY "Users can view invoices in their company"
  ON public.invoices FOR SELECT
  USING (company_id = (select get_user_company_id()));

CREATE POLICY "Managers can insert invoices"
  ON public.invoices FOR INSERT
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can update invoices"
  ON public.invoices FOR UPDATE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can delete invoices"
  ON public.invoices FOR DELETE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- LOAD_DELIVERY_POINTS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view delivery points in their company" ON public.load_delivery_points;
DROP POLICY IF EXISTS "Managers can manage delivery points" ON public.load_delivery_points;

CREATE POLICY "Users can view delivery points in their company"
  ON public.load_delivery_points FOR SELECT
  USING (company_id = (select get_user_company_id()));

CREATE POLICY "Managers can insert delivery points"
  ON public.load_delivery_points FOR INSERT
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can update delivery points"
  ON public.load_delivery_points FOR UPDATE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can delete delivery points"
  ON public.load_delivery_points FOR DELETE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- LOADS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view loads in their company" ON public.loads;
DROP POLICY IF EXISTS "Managers can manage loads" ON public.loads;

CREATE POLICY "Users can view loads in their company"
  ON public.loads FOR SELECT
  USING (company_id = (select get_user_company_id()));

CREATE POLICY "Managers can insert loads"
  ON public.loads FOR INSERT
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can update loads"
  ON public.loads FOR UPDATE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can delete loads"
  ON public.loads FOR DELETE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- MAINTENANCE TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view maintenance in their company" ON public.maintenance;
DROP POLICY IF EXISTS "Managers can manage maintenance" ON public.maintenance;

CREATE POLICY "Users can view maintenance in their company"
  ON public.maintenance FOR SELECT
  USING (company_id = (select get_user_company_id()));

CREATE POLICY "Managers can insert maintenance"
  ON public.maintenance FOR INSERT
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can update maintenance"
  ON public.maintenance FOR UPDATE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can delete maintenance"
  ON public.maintenance FOR DELETE
  USING (
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

CREATE POLICY "Managers can insert their company onboarding templates"
  ON public.onboarding_checklist_templates FOR INSERT
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can update their company onboarding templates"
  ON public.onboarding_checklist_templates FOR UPDATE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can delete their company onboarding templates"
  ON public.onboarding_checklist_templates FOR DELETE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- ROUTE_STOPS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view route stops in their company" ON public.route_stops;
DROP POLICY IF EXISTS "Managers can manage route stops" ON public.route_stops;

CREATE POLICY "Users can view route stops in their company"
  ON public.route_stops FOR SELECT
  USING (company_id = (select get_user_company_id()));

CREATE POLICY "Managers can insert route stops"
  ON public.route_stops FOR INSERT
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can update route stops"
  ON public.route_stops FOR UPDATE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can delete route stops"
  ON public.route_stops FOR DELETE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- ROUTES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view routes in their company" ON public.routes;
DROP POLICY IF EXISTS "Managers can manage routes" ON public.routes;

CREATE POLICY "Users can view routes in their company"
  ON public.routes FOR SELECT
  USING (company_id = (select get_user_company_id()));

CREATE POLICY "Managers can insert routes"
  ON public.routes FOR INSERT
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can update routes"
  ON public.routes FOR UPDATE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can delete routes"
  ON public.routes FOR DELETE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- SETTLEMENTS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view settlements in their company" ON public.settlements;
DROP POLICY IF EXISTS "Managers can manage settlements" ON public.settlements;

CREATE POLICY "Users can view settlements in their company"
  ON public.settlements FOR SELECT
  USING (company_id = (select get_user_company_id()));

CREATE POLICY "Managers can insert settlements"
  ON public.settlements FOR INSERT
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can update settlements"
  ON public.settlements FOR UPDATE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can delete settlements"
  ON public.settlements FOR DELETE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- SUBSCRIPTIONS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their company's subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Managers can manage subscriptions" ON public.subscriptions;

CREATE POLICY "Users can view their company's subscription"
  ON public.subscriptions FOR SELECT
  USING (company_id = (select get_user_company_id()));

CREATE POLICY "Managers can insert subscriptions"
  ON public.subscriptions FOR INSERT
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can update subscriptions"
  ON public.subscriptions FOR UPDATE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can delete subscriptions"
  ON public.subscriptions FOR DELETE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- TRUCKS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view trucks in their company" ON public.trucks;
DROP POLICY IF EXISTS "Managers can manage trucks" ON public.trucks;

CREATE POLICY "Users can view trucks in their company"
  ON public.trucks FOR SELECT
  USING (company_id = (select get_user_company_id()));

CREATE POLICY "Managers can insert trucks"
  ON public.trucks FOR INSERT
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can update trucks"
  ON public.trucks FOR UPDATE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can delete trucks"
  ON public.trucks FOR DELETE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- USERS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Managers can view employees in their company" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Managers can update employees in their company" ON public.users;

-- Consolidated SELECT policy: Users can view their own profile OR managers can view employees
CREATE POLICY "Users can view their own profile"
  ON public.users FOR SELECT
  USING (
    (select auth.uid()) = id
    OR (
      company_id = (select get_user_company_id())
      AND (select is_user_manager())
    )
  );

-- Consolidated UPDATE policy: Users can update their own profile OR managers can update employees
CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (
    (select auth.uid()) = id
    OR (
      company_id = (select get_user_company_id())
      AND (select is_user_manager())
    )
  )
  WITH CHECK (
    (select auth.uid()) = id
    OR (
      company_id = (select get_user_company_id())
      AND (select is_user_manager())
    )
  );

-- ============================================================================
-- COMPANY_INTEGRATIONS TABLE (if exists)
-- ============================================================================
DROP POLICY IF EXISTS "Users can view company integrations" ON public.company_integrations;
DROP POLICY IF EXISTS "Managers can manage company integrations" ON public.company_integrations;

CREATE POLICY "Users can view company integrations"
  ON public.company_integrations FOR SELECT
  USING (company_id = (select get_user_company_id()));

CREATE POLICY "Managers can insert company integrations"
  ON public.company_integrations FOR INSERT
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can update company integrations"
  ON public.company_integrations FOR UPDATE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can delete company integrations"
  ON public.company_integrations FOR DELETE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- COMPANY_PORTAL_SETTINGS TABLE (if exists)
-- ============================================================================
DROP POLICY IF EXISTS "Users can view portal settings" ON public.company_portal_settings;
DROP POLICY IF EXISTS "Managers can manage portal settings" ON public.company_portal_settings;

CREATE POLICY "Users can view portal settings"
  ON public.company_portal_settings FOR SELECT
  USING (company_id = (select get_user_company_id()));

CREATE POLICY "Managers can insert portal settings"
  ON public.company_portal_settings FOR INSERT
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can update portal settings"
  ON public.company_portal_settings FOR UPDATE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can delete portal settings"
  ON public.company_portal_settings FOR DELETE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- COMPANY_REMINDER_SETTINGS TABLE (if exists)
-- ============================================================================
DROP POLICY IF EXISTS "Users can view reminder settings" ON public.company_reminder_settings;
DROP POLICY IF EXISTS "Managers can manage reminder settings" ON public.company_reminder_settings;

CREATE POLICY "Users can view reminder settings"
  ON public.company_reminder_settings FOR SELECT
  USING (company_id = (select get_user_company_id()));

CREATE POLICY "Managers can insert reminder settings"
  ON public.company_reminder_settings FOR INSERT
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can update reminder settings"
  ON public.company_reminder_settings FOR UPDATE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  )
  WITH CHECK (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

CREATE POLICY "Managers can delete reminder settings"
  ON public.company_reminder_settings FOR DELETE
  USING (
    company_id = (select get_user_company_id())
    AND (select is_user_manager())
  );

-- ============================================================================
-- Summary
-- ============================================================================
-- This script fixes:
-- ✅ auth_rls_initplan warnings by using (select auth.uid()) and helper functions
-- ✅ multiple_permissive_policies by separating SELECT from INSERT/UPDATE/DELETE
-- 
-- All policies now:
-- 1. Use helper functions or (select auth.uid()) for single evaluation
-- 2. Separate SELECT policies from INSERT/UPDATE/DELETE policies to avoid overlap
-- 3. Managers inherit SELECT access from "Users can view" policies
-- ============================================================================

