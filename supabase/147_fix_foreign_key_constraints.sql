-- Fix Foreign Key Constraints to Allow Updates/Deletes
-- This fixes the issue where you can't update/delete routes that have loads referencing them
-- Run this in Supabase SQL Editor

-- Fix 1: loads.route_id foreign key
-- Drop existing constraint
ALTER TABLE public.loads
DROP CONSTRAINT IF EXISTS loads_route_id_fkey;

-- Recreate with ON DELETE SET NULL (if route is deleted, load's route_id becomes NULL)
ALTER TABLE public.loads
ADD CONSTRAINT loads_route_id_fkey
FOREIGN KEY (route_id)
REFERENCES public.routes(id)
ON DELETE SET NULL
ON UPDATE CASCADE;

-- Fix 2: loads.driver_id foreign key (for consistency)
ALTER TABLE public.loads
DROP CONSTRAINT IF EXISTS loads_driver_id_fkey;

ALTER TABLE public.loads
ADD CONSTRAINT loads_driver_id_fkey
FOREIGN KEY (driver_id)
REFERENCES public.drivers(id)
ON DELETE SET NULL
ON UPDATE CASCADE;

-- Fix 3: loads.truck_id foreign key (for consistency)
ALTER TABLE public.loads
DROP CONSTRAINT IF EXISTS loads_truck_id_fkey;

ALTER TABLE public.loads
ADD CONSTRAINT loads_truck_id_fkey
FOREIGN KEY (truck_id)
REFERENCES public.trucks(id)
ON DELETE SET NULL
ON UPDATE CASCADE;

-- Fix 4: routes.driver_id foreign key
ALTER TABLE public.routes
DROP CONSTRAINT IF EXISTS routes_driver_id_fkey;

ALTER TABLE public.routes
ADD CONSTRAINT routes_driver_id_fkey
FOREIGN KEY (driver_id)
REFERENCES public.drivers(id)
ON DELETE SET NULL
ON UPDATE CASCADE;

-- Fix 5: routes.truck_id foreign key
ALTER TABLE public.routes
DROP CONSTRAINT IF EXISTS routes_truck_id_fkey;

ALTER TABLE public.routes
ADD CONSTRAINT routes_truck_id_fkey
FOREIGN KEY (truck_id)
REFERENCES public.trucks(id)
ON DELETE SET NULL
ON UPDATE CASCADE;

-- Fix 6: invoices.load_id foreign key
ALTER TABLE public.invoices
DROP CONSTRAINT IF EXISTS invoices_load_id_fkey;

ALTER TABLE public.invoices
ADD CONSTRAINT invoices_load_id_fkey
FOREIGN KEY (load_id)
REFERENCES public.loads(id)
ON DELETE SET NULL
ON UPDATE CASCADE;

-- Fix 7: expenses.driver_id foreign key
ALTER TABLE public.expenses
DROP CONSTRAINT IF EXISTS expenses_driver_id_fkey;

ALTER TABLE public.expenses
ADD CONSTRAINT expenses_driver_id_fkey
FOREIGN KEY (driver_id)
REFERENCES public.drivers(id)
ON DELETE SET NULL
ON UPDATE CASCADE;

-- Fix 8: expenses.truck_id foreign key
ALTER TABLE public.expenses
DROP CONSTRAINT IF EXISTS expenses_truck_id_fkey;

ALTER TABLE public.expenses
ADD CONSTRAINT expenses_truck_id_fkey
FOREIGN KEY (truck_id)
REFERENCES public.trucks(id)
ON DELETE SET NULL
ON UPDATE CASCADE;

-- Fix 9: trucks.current_driver_id foreign key
ALTER TABLE public.trucks
DROP CONSTRAINT IF EXISTS trucks_current_driver_id_fkey;

ALTER TABLE public.trucks
ADD CONSTRAINT trucks_current_driver_id_fkey
FOREIGN KEY (current_driver_id)
REFERENCES public.drivers(id)
ON DELETE SET NULL
ON UPDATE CASCADE;

-- Verify all constraints were updated
SELECT 
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
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
  AND tc.table_schema = 'public'
  AND (
    tc.table_name IN ('loads', 'routes', 'invoices', 'expenses', 'trucks')
    OR kcu.column_name LIKE '%_id'
  )
ORDER BY tc.table_name, kcu.column_name;
