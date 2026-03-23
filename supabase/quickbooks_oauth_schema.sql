-- QuickBooks OAuth Token Storage
-- Add OAuth token columns to company_integrations table

-- Add OAuth token columns if they don't exist
DO $$ 
BEGIN
  -- Add access token column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_integrations' AND column_name = 'quickbooks_access_token'
  ) THEN
    ALTER TABLE public.company_integrations 
    ADD COLUMN quickbooks_access_token TEXT;
  END IF;

  -- Add refresh token column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_integrations' AND column_name = 'quickbooks_refresh_token'
  ) THEN
    ALTER TABLE public.company_integrations 
    ADD COLUMN quickbooks_refresh_token TEXT;
  END IF;

  -- Add token expiry column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_integrations' AND column_name = 'quickbooks_token_expires_at'
  ) THEN
    ALTER TABLE public.company_integrations 
    ADD COLUMN quickbooks_token_expires_at TIMESTAMP WITH TIME ZONE;
  END IF;

  -- Add sandbox flag if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_integrations' AND column_name = 'quickbooks_sandbox'
  ) THEN
    ALTER TABLE public.company_integrations 
    ADD COLUMN quickbooks_sandbox BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN public.company_integrations.quickbooks_access_token IS 'OAuth 2.0 access token for QuickBooks API';
COMMENT ON COLUMN public.company_integrations.quickbooks_refresh_token IS 'OAuth 2.0 refresh token for QuickBooks API';
COMMENT ON COLUMN public.company_integrations.quickbooks_token_expires_at IS 'When the access token expires';
COMMENT ON COLUMN public.company_integrations.quickbooks_sandbox IS 'Whether using QuickBooks sandbox (true) or production (false)';

