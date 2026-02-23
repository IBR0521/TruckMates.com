-- Quick fix: Add company_type column to companies table
-- Run this in Supabase SQL Editor if you get "column company_type does not exist" error

ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS company_type TEXT DEFAULT NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_companies_company_type ON public.companies(company_type);

-- Add check constraint (optional)
ALTER TABLE public.companies
DROP CONSTRAINT IF EXISTS companies_company_type_check;

ALTER TABLE public.companies
ADD CONSTRAINT companies_company_type_check 
CHECK (company_type IS NULL OR company_type IN ('broker', 'carrier', 'both'));







