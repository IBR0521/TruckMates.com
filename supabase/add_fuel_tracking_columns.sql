-- ============================================================================
-- Add Fuel Tracking Columns to Expenses Table
-- ============================================================================
-- This migration adds gallons and price_per_gallon columns to track real fuel data
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Add gallons column (DECIMAL for precision)
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS gallons DECIMAL(10, 2);

-- Add price_per_gallon column (DECIMAL for precision)
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS price_per_gallon DECIMAL(10, 2);

-- Add comment for documentation
COMMENT ON COLUMN public.expenses.gallons IS 'Number of gallons purchased (for fuel expenses)';
COMMENT ON COLUMN public.expenses.price_per_gallon IS 'Price per gallon at time of purchase (for fuel expenses)';

