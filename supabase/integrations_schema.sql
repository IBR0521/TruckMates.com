-- Integration Settings Schema
-- This schema adds support for third-party integrations

-- Company Integrations table
CREATE TABLE IF NOT EXISTS public.company_integrations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  
  -- QuickBooks Integration
  quickbooks_enabled BOOLEAN DEFAULT false,
  quickbooks_api_key TEXT,
  quickbooks_api_secret TEXT,
  quickbooks_company_id TEXT,
  quickbooks_synced_at TIMESTAMP WITH TIME ZONE,
  
  -- Stripe Integration
  stripe_enabled BOOLEAN DEFAULT false,
  stripe_api_key TEXT,
  stripe_publishable_key TEXT,
  
  -- PayPal Integration
  paypal_enabled BOOLEAN DEFAULT false,
  paypal_client_id TEXT,
  paypal_client_secret TEXT,
  
  -- Google Maps Integration
  google_maps_enabled BOOLEAN DEFAULT false,
  google_maps_api_key TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  UNIQUE(company_id)
);

-- Filter Presets table
CREATE TABLE IF NOT EXISTS public.filter_presets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  page TEXT NOT NULL, -- 'loads', 'drivers', 'trucks', 'routes', etc.
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_company_integrations_company_id ON public.company_integrations(company_id);
CREATE INDEX IF NOT EXISTS idx_filter_presets_company_id ON public.filter_presets(company_id);
CREATE INDEX IF NOT EXISTS idx_filter_presets_user_id ON public.filter_presets(user_id);
CREATE INDEX IF NOT EXISTS idx_filter_presets_page ON public.filter_presets(page);

-- RLS Policies for company_integrations
ALTER TABLE public.company_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company integrations"
  ON public.company_integrations
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Managers can update their company integrations"
  ON public.company_integrations
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

CREATE POLICY "Managers can insert their company integrations"
  ON public.company_integrations
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- RLS Policies for filter_presets
ALTER TABLE public.filter_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company filter presets"
  ON public.filter_presets
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own filter presets"
  ON public.filter_presets
  FOR ALL
  USING (
    user_id = auth.uid() AND
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Add quickbooks_id and synced_at columns to invoices if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'quickbooks_id'
  ) THEN
    ALTER TABLE public.invoices ADD COLUMN quickbooks_id TEXT;
    ALTER TABLE public.invoices ADD COLUMN quickbooks_synced_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Add quickbooks_id and synced_at columns to expenses if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'expenses' AND column_name = 'quickbooks_id'
  ) THEN
    ALTER TABLE public.expenses ADD COLUMN quickbooks_id TEXT;
    ALTER TABLE public.expenses ADD COLUMN quickbooks_synced_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Add payment processing columns to invoices if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'stripe_payment_intent_id'
  ) THEN
    ALTER TABLE public.invoices ADD COLUMN stripe_payment_intent_id TEXT;
    ALTER TABLE public.invoices ADD COLUMN paypal_order_id TEXT;
    ALTER TABLE public.invoices ADD COLUMN paypal_capture_id TEXT;
  END IF;
END $$;

