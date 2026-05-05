-- Account Setup Tracking Schema
-- Add setup completion tracking to companies table

-- Add setup tracking columns to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS setup_complete BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS setup_completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS setup_data JSONB DEFAULT '{}'::jsonb;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_companies_setup_complete ON public.companies(setup_complete);

-- Add comments for documentation
COMMENT ON COLUMN public.companies.setup_complete IS 'Whether the company has completed the initial setup wizard';
COMMENT ON COLUMN public.companies.setup_completed_at IS 'Timestamp when setup was completed';
COMMENT ON COLUMN public.companies.setup_data IS 'JSON data storing setup progress and preferences';

