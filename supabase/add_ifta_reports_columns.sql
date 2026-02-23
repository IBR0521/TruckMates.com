-- Add missing columns to ifta_reports table
-- This migration adds the net_tax_due and other missing columns from the enhanced schema

-- Add period column if it doesn't exist (required by old schema)
ALTER TABLE public.ifta_reports
  ADD COLUMN IF NOT EXISTS period TEXT;

-- Update period for existing rows if it's null
-- Handle both TEXT and INTEGER quarter types
DO $$
BEGIN
  -- Check if quarter column is TEXT or INTEGER
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ifta_reports' 
    AND column_name = 'quarter'
    AND data_type = 'text'
  ) THEN
    -- Quarter is TEXT type ('Q1', 'Q2', etc.)
    UPDATE public.ifta_reports
    SET period = CASE 
      WHEN quarter = 'Q1' THEN 'Jan-Mar ' || year::text
      WHEN quarter = 'Q2' THEN 'Apr-Jun ' || year::text
      WHEN quarter = 'Q3' THEN 'Jul-Sep ' || year::text
      WHEN quarter = 'Q4' THEN 'Oct-Dec ' || year::text
      ELSE 'Unknown'
    END
    WHERE period IS NULL;
  ELSE
    -- Quarter is INTEGER type (1, 2, 3, 4)
    UPDATE public.ifta_reports
    SET period = CASE 
      WHEN quarter = 1 THEN 'Jan-Mar ' || year::text
      WHEN quarter = 2 THEN 'Apr-Jun ' || year::text
      WHEN quarter = 3 THEN 'Jul-Sep ' || year::text
      WHEN quarter = 4 THEN 'Oct-Dec ' || year::text
      ELSE 'Unknown'
    END
    WHERE period IS NULL;
  END IF;
END $$;

-- Add net_tax_due column if it doesn't exist
ALTER TABLE public.ifta_reports
  ADD COLUMN IF NOT EXISTS net_tax_due DECIMAL(10, 2) DEFAULT 0;

-- Add total_tax_due column if it doesn't exist (may be named tax_owed in old schema)
DO $$
BEGIN
  -- Check if total_tax_due exists, if not add it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ifta_reports' 
    AND column_name = 'total_tax_due'
  ) THEN
    ALTER TABLE public.ifta_reports
      ADD COLUMN total_tax_due DECIMAL(10, 2) DEFAULT 0;
    
    -- Copy data from tax_owed if it exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'ifta_reports' 
      AND column_name = 'tax_owed'
    ) THEN
      UPDATE public.ifta_reports
      SET total_tax_due = COALESCE(tax_owed, 0)
      WHERE total_tax_due = 0;
    END IF;
  END IF;
END $$;

-- Add total_tax_paid column if it doesn't exist
ALTER TABLE public.ifta_reports
  ADD COLUMN IF NOT EXISTS total_tax_paid DECIMAL(10, 2) DEFAULT 0;

-- Add total_gallons column if it doesn't exist (may be named fuel_purchased in old schema)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ifta_reports' 
    AND column_name = 'total_gallons'
  ) THEN
    ALTER TABLE public.ifta_reports
      ADD COLUMN total_gallons DECIMAL(12, 2) DEFAULT 0;
    
    -- Copy data from fuel_purchased if it exists (convert TEXT to DECIMAL)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'ifta_reports' 
      AND column_name = 'fuel_purchased'
    ) THEN
      UPDATE public.ifta_reports
      SET total_gallons = CASE 
        WHEN fuel_purchased ~ '^[0-9]+\.?[0-9]*$' THEN CAST(fuel_purchased AS DECIMAL(12, 2))
        ELSE 0
      END
      WHERE total_gallons = 0 AND fuel_purchased IS NOT NULL;
    END IF;
  END IF;
END $$;

-- Add submitted_at and approved_at if they don't exist
ALTER TABLE public.ifta_reports
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.ifta_reports
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

-- Update net_tax_due to be calculated if it's 0 or NULL
UPDATE public.ifta_reports
SET net_tax_due = COALESCE(total_tax_due, 0) - COALESCE(total_tax_paid, 0)
WHERE net_tax_due = 0 OR net_tax_due IS NULL;

-- Create index on net_tax_due for reporting
CREATE INDEX IF NOT EXISTS idx_ifta_reports_net_tax_due 
  ON public.ifta_reports(net_tax_due);

