-- ============================================
-- BUG-066 FIX: Marketplace ratings constraints
-- ============================================
-- Add CHECK constraint requiring at least one of load_id or marketplace_load_id
-- This prevents brokers from rating carriers they have never transacted with
-- ============================================
-- NOTE: This migration requires marketplace_ratings_schema.sql to be run first
-- If the tables don't exist, run marketplace_ratings_schema.sql first
-- ============================================

-- Check if broker_ratings table exists before adding constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'broker_ratings'
  ) THEN
    -- Add CHECK constraint to broker_ratings
    ALTER TABLE public.broker_ratings
      DROP CONSTRAINT IF EXISTS broker_ratings_require_load;

    ALTER TABLE public.broker_ratings
      ADD CONSTRAINT broker_ratings_require_load
      CHECK (load_id IS NOT NULL OR marketplace_load_id IS NOT NULL);
    
    RAISE NOTICE 'Added CHECK constraint to broker_ratings';
  ELSE
    RAISE WARNING 'broker_ratings table does not exist. Please run marketplace_ratings_schema.sql first.';
  END IF;
END $$;

-- Check if carrier_ratings table exists before adding constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'carrier_ratings'
  ) THEN
    -- Add CHECK constraint to carrier_ratings
    ALTER TABLE public.carrier_ratings
      DROP CONSTRAINT IF EXISTS carrier_ratings_require_load;

    ALTER TABLE public.carrier_ratings
      ADD CONSTRAINT carrier_ratings_require_load
      CHECK (load_id IS NOT NULL OR marketplace_load_id IS NOT NULL);
    
    RAISE NOTICE 'Added CHECK constraint to carrier_ratings';
  ELSE
    RAISE WARNING 'carrier_ratings table does not exist. Please run marketplace_ratings_schema.sql first.';
  END IF;
END $$;

-- Note: RLS WITH CHECK validation is handled in the application layer
-- (app/actions/marketplace.ts) to verify the load actually connects both companies

