-- Ensure `loads.customer_id` relationship exists for PostgREST schema cache
-- Fixes: "Could not find a relationship between 'loads' and 'customer_id' in the schema cache"
--
-- This migration is safe to run multiple times:
-- - Adds `customer_id` column if missing
-- - Adds FK constraint if missing
-- - Adds index if missing

BEGIN;

-- 1) Ensure the column exists
ALTER TABLE public.loads
ADD COLUMN IF NOT EXISTS customer_id uuid;

-- 2) Clean up any orphaned customer_id values that don't exist in customers
--    (otherwise adding the FK will fail with 23503)
UPDATE public.loads l
SET customer_id = NULL
WHERE customer_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.id = l.customer_id
  );

-- 3) Add/restore the FK relationship (only if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'loads_customer_id_fkey'
  ) THEN
    ALTER TABLE public.loads
    ADD CONSTRAINT loads_customer_id_fkey
    FOREIGN KEY (customer_id)
    REFERENCES public.customers(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- 4) Index for performance
CREATE INDEX IF NOT EXISTS idx_loads_customer_id ON public.loads(customer_id);

COMMIT;

