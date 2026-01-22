-- Add Company Types for Marketplace
-- This allows companies to be brokers (post loads), carriers (accept loads), both, or regular companies

-- Step 1: Add company_type field to companies table
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS company_type TEXT DEFAULT NULL; 
-- NULL = regular company (no marketplace access)
-- 'broker' = can post loads to marketplace
-- 'carrier' = can accept loads from marketplace  
-- 'both' = can post and accept loads

-- Step 2: Add index for performance
CREATE INDEX IF NOT EXISTS idx_companies_company_type ON public.companies(company_type);

-- Step 3: Add check constraint to ensure valid values
ALTER TABLE public.companies
DROP CONSTRAINT IF EXISTS companies_company_type_check;

ALTER TABLE public.companies
ADD CONSTRAINT companies_company_type_check 
CHECK (company_type IS NULL OR company_type IN ('broker', 'carrier', 'both'));

-- Step 4: Update existing companies to be regular companies by default (NULL)
-- This preserves existing functionality

-- Step 5: Add comments for documentation
COMMENT ON COLUMN public.companies.company_type IS 'Company type for marketplace: NULL = regular company, broker = post loads, carrier = accept loads, both = post and accept';

