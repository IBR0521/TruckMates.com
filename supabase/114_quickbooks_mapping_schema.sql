-- QuickBooks minimal mapping settings
-- Adds columns to store default Income account and Item IDs for invoice sync

DO $$
BEGIN
  -- Default Income Account ID used when creating invoices in QuickBooks
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_integrations' AND column_name = 'quickbooks_default_income_account_id'
  ) THEN
    ALTER TABLE public.company_integrations
      ADD COLUMN quickbooks_default_income_account_id TEXT;
  END IF;

  -- Default Service Item ID used when creating invoices in QuickBooks
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_integrations' AND column_name = 'quickbooks_default_item_id'
  ) THEN
    ALTER TABLE public.company_integrations
      ADD COLUMN quickbooks_default_item_id TEXT;
  END IF;
END $$;

