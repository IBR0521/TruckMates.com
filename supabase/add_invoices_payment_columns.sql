-- ============================================================================
-- Add Missing Payment Tracking Columns to Invoices Table
-- ============================================================================
-- This migration adds payment tracking columns that are referenced in the
-- application code but missing from the database schema.
-- ============================================================================

-- Add payment tracking columns to invoices table
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_date DATE,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5, 4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10, 2);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_invoices_paid_date ON public.invoices(paid_date) WHERE paid_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_payment_method ON public.invoices(payment_method) WHERE payment_method IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_status_paid_date ON public.invoices(status, paid_date) WHERE status = 'paid';

-- Add comments for documentation
COMMENT ON COLUMN public.invoices.notes IS 'Additional notes or comments for the invoice';
COMMENT ON COLUMN public.invoices.paid_amount IS 'Amount that has been paid towards this invoice (for partial payments)';
COMMENT ON COLUMN public.invoices.paid_date IS 'Date when the invoice was paid';
COMMENT ON COLUMN public.invoices.payment_method IS 'Method used to pay the invoice (e.g., "credit_card", "bank_transfer", "check", "cash")';
COMMENT ON COLUMN public.invoices.tax_amount IS 'Total tax amount calculated for the invoice';
COMMENT ON COLUMN public.invoices.tax_rate IS 'Tax rate applied to the invoice (as decimal, e.g., 0.0825 for 8.25%)';
COMMENT ON COLUMN public.invoices.subtotal IS 'Subtotal amount before tax and other charges';


