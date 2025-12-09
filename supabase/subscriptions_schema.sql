-- Subscriptions Schema
-- This schema supports subscription management with Stripe integration

-- Subscription plans table
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE, -- 'simple', 'standard', 'premium'
  display_name TEXT NOT NULL, -- 'Simple', 'Standard', 'Premium'
  price_monthly DECIMAL(10, 2) NOT NULL, -- Price in USD
  price_yearly DECIMAL(10, 2), -- Optional yearly price
  stripe_price_id_monthly TEXT, -- Stripe Price ID for monthly
  stripe_price_id_yearly TEXT, -- Stripe Price ID for yearly
  max_users INTEGER, -- NULL = unlimited
  max_drivers INTEGER, -- NULL = unlimited
  max_vehicles INTEGER, -- NULL = unlimited
  features JSONB, -- Array of feature strings
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Subscriptions table - links companies to subscription plans
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL UNIQUE,
  plan_id UUID REFERENCES public.subscription_plans(id) NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'canceled', 'past_due', 'trialing', 'incomplete'
  stripe_subscription_id TEXT UNIQUE, -- Stripe subscription ID
  stripe_customer_id TEXT, -- Stripe customer ID
  stripe_price_id TEXT, -- Current Stripe price ID
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT false,
  canceled_at TIMESTAMP WITH TIME ZONE,
  trial_start TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Payment methods table - stores customer payment methods
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  stripe_payment_method_id TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL, -- 'card', 'bank_account', etc.
  is_default BOOLEAN DEFAULT false,
  card_brand TEXT, -- 'visa', 'mastercard', etc.
  card_last4 TEXT, -- Last 4 digits
  card_exp_month INTEGER,
  card_exp_year INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Invoices table - stores billing history
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  stripe_invoice_id TEXT UNIQUE,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'usd',
  status TEXT NOT NULL, -- 'paid', 'open', 'void', 'uncollectible'
  invoice_pdf TEXT, -- URL to invoice PDF
  hosted_invoice_url TEXT, -- URL to hosted invoice
  period_start TIMESTAMP WITH TIME ZONE,
  period_end TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Add stripe_invoice_id column to invoices if it doesn't exist (for existing tables)
DO $$ 
BEGIN
  -- Check if invoices table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'invoices'
  ) THEN
    -- Add column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'invoices' 
      AND column_name = 'stripe_invoice_id'
    ) THEN
      ALTER TABLE public.invoices ADD COLUMN stripe_invoice_id TEXT;
      -- Add unique constraint separately
      ALTER TABLE public.invoices ADD CONSTRAINT invoices_stripe_invoice_id_key UNIQUE (stripe_invoice_id);
    END IF;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_company_id ON public.subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON public.subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_company_id ON public.payment_methods(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON public.invoices(company_id);

-- Create index on stripe_invoice_id only if column exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'invoices' 
    AND column_name = 'stripe_invoice_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_invoices_stripe_invoice_id ON public.invoices(stripe_invoice_id);
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscription_plans (public read)
CREATE POLICY "Anyone can view active subscription plans"
  ON public.subscription_plans FOR SELECT
  USING (is_active = true);

-- RLS Policies for subscriptions
CREATE POLICY "Users can view their company's subscription"
  ON public.subscriptions FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Managers can insert subscriptions for their company"
  ON public.subscriptions FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'manager'
    )
  );

CREATE POLICY "Managers can update their company's subscription"
  ON public.subscriptions FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- RLS Policies for payment_methods
CREATE POLICY "Users can view their company's payment methods"
  ON public.payment_methods FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- RLS Policies for invoices
CREATE POLICY "Users can view their company's invoices"
  ON public.invoices FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_subscription_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION update_subscription_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_subscription_updated_at_column();

-- Insert default subscription plans (Updated competitive pricing)
INSERT INTO public.subscription_plans (name, display_name, price_monthly, max_users, max_drivers, max_vehicles, features) VALUES
  (
    'starter',
    'Starter',
    29.00,
    10,
    15,
    10,
    '["Up to 10 vehicles", "Up to 15 drivers", "Up to 10 employees", "Basic fleet tracking", "Driver management", "Route planning", "Load management", "Basic reports", "Invoice & expense tracking", "Maintenance scheduling", "Document storage", "Email notifications"]'::jsonb
  ),
  (
    'professional',
    'Professional',
    59.00,
    25,
    40,
    30,
    '["Up to 30 vehicles", "Up to 40 drivers", "Up to 25 employees", "ELD Service Integration", "Real-time GPS tracking", "Hours of Service (HOS) compliance", "IFTA reporting with ELD data", "Advanced analytics", "Route optimization", "Custom reports", "Priority email support"]'::jsonb
  ),
  (
    'enterprise',
    'Enterprise',
    99.00,
    NULL,
    NULL,
    NULL,
    '["Unlimited vehicles", "Unlimited drivers", "Unlimited employees", "Advanced ELD features", "AI-powered route optimization", "Custom integrations", "Advanced security features", "Dedicated account manager", "24/7 priority support", "Custom training"]'::jsonb
  )
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  price_monthly = EXCLUDED.price_monthly,
  max_users = EXCLUDED.max_users,
  max_drivers = EXCLUDED.max_drivers,
  max_vehicles = EXCLUDED.max_vehicles,
  features = EXCLUDED.features;

