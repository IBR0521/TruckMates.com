-- Add Load Relationship Type field to loads table
-- This categorizes loads by business relationship: customer, carrier, broker, or yard move
-- Run this in Supabase SQL Editor

ALTER TABLE public.loads
  ADD COLUMN IF NOT EXISTS load_relationship_type TEXT DEFAULT 'customer',
  -- Add constraint to ensure valid values
  ADD CONSTRAINT IF NOT EXISTS check_load_relationship_type 
    CHECK (load_relationship_type IN ('customer', 'carrier', 'broker', 'yard_move'));

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_loads_relationship_type ON public.loads(load_relationship_type);

-- Add comment for documentation
COMMENT ON COLUMN public.loads.load_relationship_type IS 
  'Business relationship type: customer (direct customer), carrier (subcontracted from another carrier), broker (arranged through freight broker), yard_move (internal movement with no revenue)';

