-- ============================================================================
-- Add Missing Cost and Notes Columns to Routes Table
-- ============================================================================
-- This migration adds columns that are referenced in routes.ts but missing
-- ============================================================================

-- Add cost estimation columns to routes table
ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS special_instructions TEXT,
  ADD COLUMN IF NOT EXISTS estimated_fuel_cost DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS estimated_toll_cost DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS total_estimated_cost DECIMAL(10, 2);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_routes_total_estimated_cost ON public.routes(total_estimated_cost) WHERE total_estimated_cost IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.routes.notes IS 'Additional notes or comments for the route';
COMMENT ON COLUMN public.routes.special_instructions IS 'Special instructions for drivers on this route';
COMMENT ON COLUMN public.routes.estimated_fuel_cost IS 'Estimated fuel cost for this route';
COMMENT ON COLUMN public.routes.estimated_toll_cost IS 'Estimated toll cost for this route';
COMMENT ON COLUMN public.routes.total_estimated_cost IS 'Total estimated cost (fuel + tolls + other) for this route';


