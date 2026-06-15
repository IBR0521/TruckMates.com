-- Business & Tools settings columns (branding, contact, BOL template round-trip).

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS bol_template TEXT,
  ADD COLUMN IF NOT EXISTS invoice_email_template TEXT,
  ADD COLUMN IF NOT EXISTS company_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS company_name_display TEXT,
  ADD COLUMN IF NOT EXISTS company_tagline TEXT,
  ADD COLUMN IF NOT EXISTS company_website TEXT,
  ADD COLUMN IF NOT EXISTS company_primary_color TEXT DEFAULT '#3b82f6',
  ADD COLUMN IF NOT EXISTS company_secondary_color TEXT DEFAULT '#64748b',
  ADD COLUMN IF NOT EXISTS number_format TEXT DEFAULT '1,234.56',
  ADD COLUMN IF NOT EXISTS tax_id TEXT,
  ADD COLUMN IF NOT EXISTS license_number TEXT,
  ADD COLUMN IF NOT EXISTS mc_number TEXT,
  ADD COLUMN IF NOT EXISTS business_phone TEXT,
  ADD COLUMN IF NOT EXISTS business_email TEXT,
  ADD COLUMN IF NOT EXISTS business_address TEXT,
  ADD COLUMN IF NOT EXISTS business_city TEXT,
  ADD COLUMN IF NOT EXISTS business_state TEXT,
  ADD COLUMN IF NOT EXISTS business_zip TEXT,
  ADD COLUMN IF NOT EXISTS business_country TEXT DEFAULT 'United States';
