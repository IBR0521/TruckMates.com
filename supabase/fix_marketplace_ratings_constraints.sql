-- ============================================
-- BUG-066 FIX: Marketplace ratings constraints
-- ============================================
-- Add CHECK constraint requiring at least one of load_id or marketplace_load_id
-- This prevents brokers from rating carriers they have never transacted with
-- ============================================

-- Add CHECK constraint to broker_ratings
ALTER TABLE public.broker_ratings
  DROP CONSTRAINT IF EXISTS broker_ratings_require_load;

ALTER TABLE public.broker_ratings
  ADD CONSTRAINT broker_ratings_require_load
  CHECK (load_id IS NOT NULL OR marketplace_load_id IS NOT NULL);

-- Add CHECK constraint to carrier_ratings
ALTER TABLE public.carrier_ratings
  DROP CONSTRAINT IF EXISTS carrier_ratings_require_load;

ALTER TABLE public.carrier_ratings
  ADD CONSTRAINT carrier_ratings_require_load
  CHECK (load_id IS NOT NULL OR marketplace_load_id IS NOT NULL);

-- Note: RLS WITH CHECK validation is handled in the application layer
-- (app/actions/marketplace.ts) to verify the load actually connects both companies

