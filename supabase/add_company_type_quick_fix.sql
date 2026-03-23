-- Quick fix: Add company_type column to companies table
-- Run this in Supabase SQL Editor to fix the immediate error

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'companies' 
    AND column_name = 'company_type'
  ) THEN
    ALTER TABLE public.companies ADD COLUMN company_type TEXT DEFAULT NULL;
    RAISE NOTICE 'Added company_type column to companies table';
  ELSE
    RAISE NOTICE 'company_type column already exists';
  END IF;
END $$;


