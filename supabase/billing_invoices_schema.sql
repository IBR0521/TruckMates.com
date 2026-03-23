-- Billing Invoices Schema
-- This schema creates a separate table for Stripe subscription billing invoices
-- to prevent data corruption with freight invoices (TMS invoices)

-- Billing invoices table - stores Stripe subscription billing invoices separately from freight invoices
CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  stripe_invoice_id TEXT UNIQUE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'usd' NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- 'paid', 'open', 'void', 'uncollectible'
  invoice_pdf TEXT, -- URL to invoice PDF
  hosted_invoice_url TEXT, -- URL to hosted invoice
  period_start TIMESTAMP WITH TIME ZONE,
  period_end TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_billing_invoices_company_id ON public.billing_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_subscription_id ON public.billing_invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_stripe_invoice_id ON public.billing_invoices(stripe_invoice_id);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_status ON public.billing_invoices(status);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_created_at ON public.billing_invoices(created_at);

-- Enable Row Level Security
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies for billing_invoices
-- Users can view their company's billing invoices
CREATE POLICY "Users can view their company's billing invoices"
  ON public.billing_invoices FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Service role can insert/update (for webhooks)
-- Note: Webhooks use service role client, so they bypass RLS
-- But we still define policies for regular user access

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_billing_invoices_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER update_billing_invoices_updated_at 
  BEFORE UPDATE ON public.billing_invoices
  FOR EACH ROW 
  EXECUTE FUNCTION update_billing_invoices_updated_at_column();

-- Add comment to table
COMMENT ON TABLE public.billing_invoices IS 'Stores Stripe subscription billing invoices separately from freight invoices to prevent data corruption';
COMMENT ON COLUMN public.billing_invoices.stripe_invoice_id IS 'Unique Stripe invoice ID - used for upsert conflict resolution';

