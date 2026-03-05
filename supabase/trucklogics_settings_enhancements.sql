-- TruckLogics Settings Enhancements
-- This migration adds all missing features from TruckLogics analysis

-- ============================================
-- 1. EIN GENERATOR SYSTEM
-- ============================================
CREATE TABLE IF NOT EXISTS public.company_ein_numbers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  ein_number TEXT NOT NULL UNIQUE, -- 9-digit EIN format: XX-XXXXXXX
  generated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_company_ein_numbers_company_id ON public.company_ein_numbers(company_id);
CREATE INDEX IF NOT EXISTS idx_company_ein_numbers_ein_number ON public.company_ein_numbers(ein_number);

ALTER TABLE public.company_ein_numbers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view EIN numbers from their company" ON public.company_ein_numbers;
CREATE POLICY "Users can view EIN numbers from their company"
  ON public.company_ein_numbers FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Managers can manage EIN numbers" ON public.company_ein_numbers;
CREATE POLICY "Managers can manage EIN numbers"
  ON public.company_ein_numbers FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Function to generate a unique EIN number
CREATE OR REPLACE FUNCTION generate_ein_number()
RETURNS TEXT AS $$
DECLARE
  new_ein TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    -- Generate EIN: XX-XXXXXXX format (9 digits total)
    -- First 2 digits: 10-99 (business prefix)
    -- Last 7 digits: 0000001-9999999
    new_ein := LPAD(FLOOR(RANDOM() * 90 + 10)::TEXT, 2, '0') || '-' || 
               LPAD(FLOOR(RANDOM() * 9999999 + 1)::TEXT, 7, '0');
    
    -- Check if EIN already exists
    SELECT EXISTS(SELECT 1 FROM public.company_ein_numbers WHERE ein_number = new_ein) INTO exists_check;
    
    -- If unique, exit loop
    EXIT WHEN NOT exists_check;
  END LOOP;
  
  RETURN new_ein;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. ACCESSORIALS MANAGEMENT
-- ============================================
CREATE TABLE IF NOT EXISTS public.company_accessorials (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  
  -- Accessorial Details
  name TEXT NOT NULL, -- e.g., "Lumper Fee", "Detention", "Layover"
  code TEXT, -- Short code for quick reference
  description TEXT,
  
  -- Pricing
  default_amount DECIMAL(10, 2),
  charge_type TEXT DEFAULT 'flat', -- 'flat', 'per_hour', 'per_day', 'percentage'
  is_taxable BOOLEAN DEFAULT false,
  
  -- Settings
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false, -- Auto-apply to new loads
  category TEXT, -- 'pickup', 'delivery', 'transit', 'other'
  
  -- Display
  display_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  UNIQUE(company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_company_accessorials_company_id ON public.company_accessorials(company_id);
CREATE INDEX IF NOT EXISTS idx_company_accessorials_is_active ON public.company_accessorials(is_active);

ALTER TABLE public.company_accessorials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view accessorials from their company" ON public.company_accessorials;
CREATE POLICY "Users can view accessorials from their company"
  ON public.company_accessorials FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Managers can manage accessorials" ON public.company_accessorials;
CREATE POLICY "Managers can manage accessorials"
  ON public.company_accessorials FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- ============================================
-- 3. INVOICE TAX MANAGEMENT
-- ============================================
CREATE TABLE IF NOT EXISTS public.company_invoice_taxes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  
  -- Tax Details
  name TEXT NOT NULL, -- e.g., "Sales Tax", "State Tax", "Local Tax"
  rate DECIMAL(5, 4) NOT NULL, -- Percentage (e.g., 0.0825 for 8.25%)
  tax_type TEXT DEFAULT 'percentage', -- 'percentage', 'fixed'
  is_default BOOLEAN DEFAULT false,
  
  -- Settings
  is_active BOOLEAN DEFAULT true,
  applies_to TEXT DEFAULT 'all', -- 'all', 'specific_states', 'specific_customers'
  state_codes JSONB DEFAULT '[]'::jsonb, -- Array of state codes if applies_to = 'specific_states'
  customer_ids JSONB DEFAULT '[]'::jsonb, -- Array of customer IDs if applies_to = 'specific_customers'
  
  -- Display
  display_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  UNIQUE(company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_company_invoice_taxes_company_id ON public.company_invoice_taxes(company_id);
CREATE INDEX IF NOT EXISTS idx_company_invoice_taxes_is_active ON public.company_invoice_taxes(is_active);

ALTER TABLE public.company_invoice_taxes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view invoice taxes from their company" ON public.company_invoice_taxes;
CREATE POLICY "Users can view invoice taxes from their company"
  ON public.company_invoice_taxes FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Managers can manage invoice taxes" ON public.company_invoice_taxes;
CREATE POLICY "Managers can manage invoice taxes"
  ON public.company_invoice_taxes FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- ============================================
-- 4. SUBSCRIPTION & PAYMENT HISTORY
-- ============================================
CREATE TABLE IF NOT EXISTS public.company_subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Subscription Details
  plan_name TEXT NOT NULL, -- 'basic', 'professional', 'enterprise'
  plan_display_name TEXT,
  status TEXT DEFAULT 'active', -- 'active', 'cancelled', 'expired', 'trial'
  
  -- Billing
  billing_cycle TEXT DEFAULT 'monthly', -- 'monthly', 'yearly'
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  
  -- Dates
  start_date DATE NOT NULL,
  end_date DATE,
  trial_end_date DATE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  
  -- Payment Method
  payment_method_id TEXT, -- Reference to stored payment method
  auto_renew BOOLEAN DEFAULT true,
  
  -- Features
  features JSONB DEFAULT '{}'::jsonb, -- Plan features
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.company_payment_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  subscription_id UUID REFERENCES public.company_subscriptions(id) ON DELETE SET NULL,
  
  -- Payment Details
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  payment_method TEXT, -- 'card', 'ach', 'wire', 'check'
  payment_method_last4 TEXT, -- Last 4 digits of card/account
  transaction_id TEXT, -- External payment processor transaction ID
  
  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'refunded'
  status_message TEXT,
  
  -- Dates
  payment_date DATE NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE,
  
  -- Invoice/Receipt
  invoice_number TEXT,
  receipt_url TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.company_payment_methods (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  
  -- Payment Method Details
  type TEXT NOT NULL, -- 'card', 'ach', 'wire', 'check'
  is_default BOOLEAN DEFAULT false,
  
  -- Card Details (if type = 'card')
  card_brand TEXT, -- 'visa', 'mastercard', 'amex', etc.
  card_last4 TEXT,
  card_exp_month INTEGER,
  card_exp_year INTEGER,
  cardholder_name TEXT,
  
  -- ACH Details (if type = 'ach')
  bank_name TEXT,
  account_type TEXT, -- 'checking', 'savings'
  account_last4 TEXT,
  routing_number TEXT,
  
  -- External Reference
  external_id TEXT, -- Payment processor ID (Stripe, etc.)
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_company_subscriptions_company_id ON public.company_subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_company_subscriptions_status ON public.company_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_company_payment_history_company_id ON public.company_payment_history(company_id);
CREATE INDEX IF NOT EXISTS idx_company_payment_history_payment_date ON public.company_payment_history(payment_date);
CREATE INDEX IF NOT EXISTS idx_company_payment_methods_company_id ON public.company_payment_methods(company_id);

ALTER TABLE public.company_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view subscriptions from their company" ON public.company_subscriptions;
CREATE POLICY "Users can view subscriptions from their company"
  ON public.company_subscriptions FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view payment history from their company" ON public.company_payment_history;
CREATE POLICY "Users can view payment history from their company"
  ON public.company_payment_history FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view payment methods from their company" ON public.company_payment_methods;
CREATE POLICY "Users can view payment methods from their company"
  ON public.company_payment_methods FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Managers can manage payment methods" ON public.company_payment_methods;
CREATE POLICY "Managers can manage payment methods"
  ON public.company_payment_methods FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- ============================================
-- 5. UPDATE COMPANY_SETTINGS TABLE
-- ============================================
-- Add new columns to company_settings if they don't exist
DO $$ 
BEGIN
  -- Business Information Fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'owner_name') THEN
    ALTER TABLE public.company_settings ADD COLUMN owner_name TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'dba_name') THEN
    ALTER TABLE public.company_settings ADD COLUMN dba_name TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'ein_number') THEN
    ALTER TABLE public.company_settings ADD COLUMN ein_number TEXT;
  END IF;
  
  -- Load Settings Enhancements
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'load_charge_type') THEN
    ALTER TABLE public.company_settings ADD COLUMN load_charge_type TEXT DEFAULT 'per-mile'; -- 'flat-fee', 'per-mile', 'per-ton', 'per-hundred', 'per-bushel', 'per-kilogram'
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'miles_calculation_method') THEN
    ALTER TABLE public.company_settings ADD COLUMN miles_calculation_method TEXT DEFAULT 'google-maps'; -- 'manual', 'google-maps', 'promiles'
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'fuel_surcharge_method') THEN
    ALTER TABLE public.company_settings ADD COLUMN fuel_surcharge_method TEXT DEFAULT 'percentage'; -- 'none', 'flat-fee', 'percentage', 'per-mile'
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'fuel_surcharge_flat_amount') THEN
    ALTER TABLE public.company_settings ADD COLUMN fuel_surcharge_flat_amount DECIMAL(10, 2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'fuel_surcharge_per_mile') THEN
    ALTER TABLE public.company_settings ADD COLUMN fuel_surcharge_per_mile DECIMAL(10, 4);
  END IF;
  
  -- Dispatch Settings Enhancements
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'check_call_notify_customer') THEN
    ALTER TABLE public.company_settings ADD COLUMN check_call_notify_customer BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'check_call_notify_broker') THEN
    ALTER TABLE public.company_settings ADD COLUMN check_call_notify_broker BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'check_call_notify_on_trip_start') THEN
    ALTER TABLE public.company_settings ADD COLUMN check_call_notify_on_trip_start BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'check_call_notify_at_shipper') THEN
    ALTER TABLE public.company_settings ADD COLUMN check_call_notify_at_shipper BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'check_call_notify_pickup_completed') THEN
    ALTER TABLE public.company_settings ADD COLUMN check_call_notify_pickup_completed BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'check_call_notify_enroute') THEN
    ALTER TABLE public.company_settings ADD COLUMN check_call_notify_enroute BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'check_call_notify_at_consignee') THEN
    ALTER TABLE public.company_settings ADD COLUMN check_call_notify_at_consignee BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'check_call_notify_dropoff_completed') THEN
    ALTER TABLE public.company_settings ADD COLUMN check_call_notify_dropoff_completed BOOLEAN DEFAULT false;
  END IF;
  
  -- Invoice Settings
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'default_payment_terms') THEN
    ALTER TABLE public.company_settings ADD COLUMN default_payment_terms TEXT DEFAULT 'Due on Receipt';
  ELSE
    -- Update existing default if it's 'Net 30' to 'Due on Receipt'
    UPDATE public.company_settings 
    SET default_payment_terms = 'Due on Receipt' 
    WHERE default_payment_terms = 'Net 30';
  END IF;
END $$;

-- ============================================
-- TRIGGERS
-- ============================================
DROP TRIGGER IF EXISTS update_company_ein_numbers_updated_at ON public.company_ein_numbers;
CREATE TRIGGER update_company_ein_numbers_updated_at
  BEFORE UPDATE ON public.company_ein_numbers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_company_accessorials_updated_at ON public.company_accessorials;
CREATE TRIGGER update_company_accessorials_updated_at
  BEFORE UPDATE ON public.company_accessorials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_company_invoice_taxes_updated_at ON public.company_invoice_taxes;
CREATE TRIGGER update_company_invoice_taxes_updated_at
  BEFORE UPDATE ON public.company_invoice_taxes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_company_subscriptions_updated_at ON public.company_subscriptions;
CREATE TRIGGER update_company_subscriptions_updated_at
  BEFORE UPDATE ON public.company_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_company_payment_history_updated_at ON public.company_payment_history;
CREATE TRIGGER update_company_payment_history_updated_at
  BEFORE UPDATE ON public.company_payment_history
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_company_payment_methods_updated_at ON public.company_payment_methods;
CREATE TRIGGER update_company_payment_methods_updated_at
  BEFORE UPDATE ON public.company_payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();









