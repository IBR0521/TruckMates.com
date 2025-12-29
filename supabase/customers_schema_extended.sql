-- Extended Customers Schema to match TruckLogics
-- Add missing fields for mailing/physical addresses and social media

ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS mailing_address_line1 TEXT,
ADD COLUMN IF NOT EXISTS mailing_address_line2 TEXT,
ADD COLUMN IF NOT EXISTS mailing_city TEXT,
ADD COLUMN IF NOT EXISTS mailing_state TEXT,
ADD COLUMN IF NOT EXISTS mailing_zip TEXT,
ADD COLUMN IF NOT EXISTS mailing_country TEXT DEFAULT 'USA',
ADD COLUMN IF NOT EXISTS physical_address_line1 TEXT,
ADD COLUMN IF NOT EXISTS physical_address_line2 TEXT,
ADD COLUMN IF NOT EXISTS physical_city TEXT,
ADD COLUMN IF NOT EXISTS physical_state TEXT,
ADD COLUMN IF NOT EXISTS physical_zip TEXT,
ADD COLUMN IF NOT EXISTS physical_country TEXT DEFAULT 'USA',
ADD COLUMN IF NOT EXISTS facebook_url TEXT,
ADD COLUMN IF NOT EXISTS twitter_url TEXT,
ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
ADD COLUMN IF NOT EXISTS instagram_url TEXT,
ADD COLUMN IF NOT EXISTS terms TEXT; -- Terms and conditions

