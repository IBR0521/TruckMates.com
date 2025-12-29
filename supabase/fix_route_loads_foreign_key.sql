-- Fix Foreign Key Constraint for routes and loads
-- This allows routes to be updated/deleted even when loads reference them
-- Run this in Supabase SQL Editor

-- Step 1: Drop the existing foreign key constraint
ALTER TABLE public.loads
DROP CONSTRAINT IF EXISTS loads_route_id_fkey;

-- Step 2: Recreate the foreign key with ON DELETE SET NULL
-- This means if a route is deleted, the load's route_id will be set to NULL (not deleted)
ALTER TABLE public.loads
ADD CONSTRAINT loads_route_id_fkey
FOREIGN KEY (route_id)
REFERENCES public.routes(id)
ON DELETE SET NULL
ON UPDATE CASCADE;

-- Step 3: Verify the constraint was created
SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule,
  rc.update_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'loads'
  AND kcu.column_name = 'route_id';
