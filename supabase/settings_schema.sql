-- Settings Schema for TruckMates
-- This schema adds tables for all settings features

-- ============================================
-- 1. COMPANY INTEGRATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS public.company_integrations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- QuickBooks Integration
  quickbooks_enabled BOOLEAN DEFAULT false,
  quickbooks_api_key TEXT,
  quickbooks_company_id TEXT,
  quickbooks_sandbox BOOLEAN DEFAULT true,
  
  -- Stripe Integration
  stripe_enabled BOOLEAN DEFAULT false,
  stripe_api_key TEXT,
  stripe_webhook_secret TEXT,
  
  -- PayPal Integration
  paypal_enabled BOOLEAN DEFAULT false,
  paypal_client_id TEXT,
  paypal_client_secret TEXT,
  paypal_mode TEXT DEFAULT 'sandbox', -- 'sandbox' or 'live'
  
  -- Google Maps Integration
  google_maps_enabled BOOLEAN DEFAULT false,
  google_maps_api_key TEXT,
  
  -- Other Integrations
  custom_integrations JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ============================================
-- 2. COMPANY REMINDER SETTINGS
-- ============================================
CREATE TABLE IF NOT EXISTS public.company_reminder_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Notification Channels
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  
  -- Reminder Types
  maintenance_reminders BOOLEAN DEFAULT true,
  license_expiry_reminders BOOLEAN DEFAULT true,
  insurance_expiry_reminders BOOLEAN DEFAULT true,
  invoice_reminders BOOLEAN DEFAULT true,
  load_reminders BOOLEAN DEFAULT true,
  route_reminders BOOLEAN DEFAULT true,
  
  -- Timing
  days_before_reminder INTEGER DEFAULT 7,
  reminder_frequency TEXT DEFAULT 'daily', -- 'daily', 'weekly', 'custom'
  
  -- Advanced Settings
  reminder_rules JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ============================================
-- 3. COMPANY PORTAL SETTINGS
-- ============================================
CREATE TABLE IF NOT EXISTS public.company_portal_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Portal Status
  enabled BOOLEAN DEFAULT true,
  custom_url TEXT, -- Custom portal URL slug
  
  -- Portal Features
  allow_customer_login BOOLEAN DEFAULT true,
  allow_load_tracking BOOLEAN DEFAULT true,
  allow_invoice_viewing BOOLEAN DEFAULT true,
  allow_document_download BOOLEAN DEFAULT true,
  allow_load_submission BOOLEAN DEFAULT false,
  
  -- Portal URL (auto-generated if custom_url is set)
  portal_url TEXT,
  
  -- Security
  require_authentication BOOLEAN DEFAULT true,
  session_timeout_minutes INTEGER DEFAULT 60,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ============================================
-- 4. COMPANY BILLING INFO
-- ============================================
CREATE TABLE IF NOT EXISTS public.company_billing_info (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Billing Contact
  billing_company_name TEXT,
  billing_email TEXT,
  billing_phone TEXT,
  billing_address TEXT,
  
  -- Tax Information
  tax_id TEXT,
  tax_exempt BOOLEAN DEFAULT false,
  
  -- Payment Method
  payment_method TEXT DEFAULT 'card', -- 'card', 'ach', 'wire', 'check'
  payment_terms TEXT DEFAULT 'Net 30',
  
  -- Additional Info
  billing_notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_company_integrations_company_id ON public.company_integrations(company_id);
CREATE INDEX IF NOT EXISTS idx_company_reminder_settings_company_id ON public.company_reminder_settings(company_id);
CREATE INDEX IF NOT EXISTS idx_company_portal_settings_company_id ON public.company_portal_settings(company_id);
CREATE INDEX IF NOT EXISTS idx_company_billing_info_company_id ON public.company_billing_info(company_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.company_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_reminder_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_portal_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_billing_info ENABLE ROW LEVEL SECURITY;

-- Company Integrations Policies
DROP POLICY IF EXISTS "Users can view company integrations" ON public.company_integrations;
CREATE POLICY "Users can view company integrations"
  ON public.company_integrations FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Managers can manage company integrations" ON public.company_integrations;
CREATE POLICY "Managers can manage company integrations"
  ON public.company_integrations FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Company Reminder Settings Policies
DROP POLICY IF EXISTS "Users can view reminder settings" ON public.company_reminder_settings;
CREATE POLICY "Users can view reminder settings"
  ON public.company_reminder_settings FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Managers can manage reminder settings" ON public.company_reminder_settings;
CREATE POLICY "Managers can manage reminder settings"
  ON public.company_reminder_settings FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Company Portal Settings Policies
DROP POLICY IF EXISTS "Users can view portal settings" ON public.company_portal_settings;
CREATE POLICY "Users can view portal settings"
  ON public.company_portal_settings FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Managers can manage portal settings" ON public.company_portal_settings;
CREATE POLICY "Managers can manage portal settings"
  ON public.company_portal_settings FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Company Billing Info Policies
DROP POLICY IF EXISTS "Managers can view billing info" ON public.company_billing_info;
CREATE POLICY "Managers can view billing info"
  ON public.company_billing_info FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'manager'
    )
  );

DROP POLICY IF EXISTS "Managers can manage billing info" ON public.company_billing_info;
CREATE POLICY "Managers can manage billing info"
  ON public.company_billing_info FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- ============================================
-- TRIGGERS
-- ============================================
DROP TRIGGER IF EXISTS update_company_integrations_updated_at ON public.company_integrations;
CREATE TRIGGER update_company_integrations_updated_at
  BEFORE UPDATE ON public.company_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_company_reminder_settings_updated_at ON public.company_reminder_settings;
CREATE TRIGGER update_company_reminder_settings_updated_at
  BEFORE UPDATE ON public.company_reminder_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_company_portal_settings_updated_at ON public.company_portal_settings;
CREATE TRIGGER update_company_portal_settings_updated_at
  BEFORE UPDATE ON public.company_portal_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_company_billing_info_updated_at ON public.company_billing_info;
CREATE TRIGGER update_company_billing_info_updated_at
  BEFORE UPDATE ON public.company_billing_info
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

