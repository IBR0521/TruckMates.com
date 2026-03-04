-- ============================================================================
-- Fix Unique Constraints to be Per-Company (Multi-Tenant Isolation)
-- ============================================================================
-- This migration changes global unique constraints to per-company constraints
-- Each company should be able to have their own "Truck-001", "LOAD-001", etc.
-- ============================================================================

-- ============================================================================
-- TRUCKS TABLE: Change truck_number from global unique to per-company unique
-- ============================================================================

-- Drop the global unique constraint on truck_number
ALTER TABLE public.trucks 
DROP CONSTRAINT IF EXISTS trucks_truck_number_key;

-- Drop any unique index on truck_number
DROP INDEX IF EXISTS trucks_truck_number_key;

-- CRITICAL: Clean up duplicate truck numbers within the same company first
-- Keep only the most recent truck record for each (company_id, truck_number) pair
DO $$
DECLARE
  dup_record RECORD;
  truck_id_to_keep UUID;
  truck_id_to_delete UUID;
BEGIN
  FOR dup_record IN
    SELECT company_id, truck_number, COUNT(*) as cnt, array_agg(id ORDER BY created_at DESC) as ids
    FROM public.trucks
    WHERE company_id IS NOT NULL AND truck_number IS NOT NULL
    GROUP BY company_id, truck_number
    HAVING COUNT(*) > 1
  LOOP
    truck_id_to_keep := dup_record.ids[1]; -- Keep the newest one
    
    -- For each duplicate truck (except the one we're keeping)
    FOR i IN 2..array_length(dup_record.ids, 1) LOOP
      truck_id_to_delete := dup_record.ids[i];
      
      -- Update foreign key references to point to the truck we're keeping
      -- 1. Update drivers.truck_id
      UPDATE public.drivers
      SET truck_id = truck_id_to_keep
      WHERE truck_id = truck_id_to_delete;
      
      -- 2. Update routes.truck_id
      UPDATE public.routes
      SET truck_id = truck_id_to_keep
      WHERE truck_id = truck_id_to_delete;
      
      -- 3. Update loads.truck_id
      UPDATE public.loads
      SET truck_id = truck_id_to_keep
      WHERE truck_id = truck_id_to_delete;
      
      -- 4. Update expenses.truck_id
      UPDATE public.expenses
      SET truck_id = truck_id_to_keep
      WHERE truck_id = truck_id_to_delete;
      
      -- 5. Update maintenance.truck_id
      UPDATE public.maintenance
      SET truck_id = truck_id_to_keep
      WHERE truck_id = truck_id_to_delete;
      
      -- 6. Update eld_devices.truck_id
      UPDATE public.eld_devices
      SET truck_id = truck_id_to_keep
      WHERE truck_id = truck_id_to_delete;
      
      -- 7. Update dvir.truck_id
      UPDATE public.dvir
      SET truck_id = truck_id_to_keep
      WHERE truck_id = truck_id_to_delete;
      
      -- 8. Update eld_logs.truck_id
      UPDATE public.eld_logs
      SET truck_id = truck_id_to_keep
      WHERE truck_id = truck_id_to_delete;
      
      -- Now safe to delete the duplicate truck
      DELETE FROM public.trucks
      WHERE id = truck_id_to_delete;
    END LOOP;
  END LOOP;
END $$;

-- Create per-company unique constraint (company_id, truck_number)
-- This allows each company to have their own "Truck-001"
CREATE UNIQUE INDEX IF NOT EXISTS idx_trucks_company_truck_number_unique 
ON public.trucks(company_id, truck_number)
WHERE company_id IS NOT NULL;

-- Add constraint name for easier management
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'trucks_company_truck_number_unique'
  ) THEN
    ALTER TABLE public.trucks
    ADD CONSTRAINT trucks_company_truck_number_unique 
    UNIQUE (company_id, truck_number);
  END IF;
END $$;

-- ============================================================================
-- LOADS TABLE: Change shipment_number from global unique to per-company unique
-- ============================================================================

-- Drop global unique constraint if it exists
ALTER TABLE public.loads 
DROP CONSTRAINT IF EXISTS loads_shipment_number_key;

DROP INDEX IF EXISTS loads_shipment_number_key;

-- Clean up duplicate shipment numbers within the same company
DO $$
DECLARE
  dup_record RECORD;
BEGIN
  FOR dup_record IN
    SELECT company_id, shipment_number, COUNT(*) as cnt, array_agg(id ORDER BY created_at DESC) as ids
    FROM public.loads
    WHERE company_id IS NOT NULL AND shipment_number IS NOT NULL
    GROUP BY company_id, shipment_number
    HAVING COUNT(*) > 1
  LOOP
    DELETE FROM public.loads
    WHERE company_id = dup_record.company_id
      AND shipment_number = dup_record.shipment_number
      AND id != dup_record.ids[1];
  END LOOP;
END $$;

-- Create per-company unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_loads_company_shipment_number_unique 
ON public.loads(company_id, shipment_number)
WHERE company_id IS NOT NULL AND shipment_number IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'loads_company_shipment_number_unique'
  ) THEN
    ALTER TABLE public.loads
    ADD CONSTRAINT loads_company_shipment_number_unique 
    UNIQUE (company_id, shipment_number);
  END IF;
END $$;

-- ============================================================================
-- INVOICES TABLE: Change invoice_number from global unique to per-company unique
-- ============================================================================

-- Drop global unique constraint if it exists
ALTER TABLE public.invoices 
DROP CONSTRAINT IF EXISTS invoices_invoice_number_key;

DROP INDEX IF EXISTS invoices_invoice_number_key;

-- Clean up duplicate invoice numbers within the same company
DO $$
DECLARE
  dup_record RECORD;
BEGIN
  FOR dup_record IN
    SELECT company_id, invoice_number, COUNT(*) as cnt, array_agg(id ORDER BY created_at DESC) as ids
    FROM public.invoices
    WHERE company_id IS NOT NULL AND invoice_number IS NOT NULL
    GROUP BY company_id, invoice_number
    HAVING COUNT(*) > 1
  LOOP
    DELETE FROM public.invoices
    WHERE company_id = dup_record.company_id
      AND invoice_number = dup_record.invoice_number
      AND id != dup_record.ids[1];
  END LOOP;
END $$;

-- Create per-company unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_company_invoice_number_unique 
ON public.invoices(company_id, invoice_number)
WHERE company_id IS NOT NULL AND invoice_number IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'invoices_company_invoice_number_unique'
  ) THEN
    ALTER TABLE public.invoices
    ADD CONSTRAINT invoices_company_invoice_number_unique 
    UNIQUE (company_id, invoice_number);
  END IF;
END $$;

-- ============================================================================
-- BOLS TABLE: Change bol_number from global unique to per-company unique
-- ============================================================================

-- Drop global unique constraint if it exists
ALTER TABLE public.bols 
DROP CONSTRAINT IF EXISTS bols_bol_number_key;

DROP INDEX IF EXISTS bols_bol_number_key;

-- Clean up duplicate BOL numbers within the same company
DO $$
DECLARE
  dup_record RECORD;
BEGIN
  FOR dup_record IN
    SELECT company_id, bol_number, COUNT(*) as cnt, array_agg(id ORDER BY created_at DESC) as ids
    FROM public.bols
    WHERE company_id IS NOT NULL AND bol_number IS NOT NULL
    GROUP BY company_id, bol_number
    HAVING COUNT(*) > 1
  LOOP
    DELETE FROM public.bols
    WHERE company_id = dup_record.company_id
      AND bol_number = dup_record.bol_number
      AND id != dup_record.ids[1];
  END LOOP;
END $$;

-- Create per-company unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_bols_company_bol_number_unique 
ON public.bols(company_id, bol_number)
WHERE company_id IS NOT NULL AND bol_number IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'bols_company_bol_number_unique'
  ) THEN
    ALTER TABLE public.bols
    ADD CONSTRAINT bols_company_bol_number_unique 
    UNIQUE (company_id, bol_number);
  END IF;
END $$;

-- ============================================================================
-- ELD_DEVICES TABLE: Change device_serial_number from global unique to per-company unique
-- ============================================================================

-- Drop global unique constraint if it exists
ALTER TABLE public.eld_devices 
DROP CONSTRAINT IF EXISTS eld_devices_device_serial_number_key;

DROP INDEX IF EXISTS eld_devices_device_serial_number_key;

-- Create per-company unique constraint
-- Note: Serial numbers should still be globally unique for hardware tracking
-- But we'll allow per-company for demo/test devices
CREATE UNIQUE INDEX IF NOT EXISTS idx_eld_devices_company_serial_unique 
ON public.eld_devices(company_id, device_serial_number)
WHERE company_id IS NOT NULL AND device_serial_number IS NOT NULL;

-- ============================================================================
-- DRIVERS TABLE: Change license_number from global unique to per-company unique
-- ============================================================================

-- Drop global unique constraint if it exists
ALTER TABLE public.drivers 
DROP CONSTRAINT IF EXISTS drivers_license_number_key;

DROP INDEX IF EXISTS drivers_license_number_key;

-- CRITICAL: Clean up duplicate license numbers within the same company first
-- Keep only the most recent driver record for each (company_id, license_number) pair
DO $$
DECLARE
  dup_record RECORD;
  driver_id_to_keep UUID;
  driver_id_to_delete UUID;
BEGIN
  -- Find and delete duplicate license numbers within the same company
  FOR dup_record IN
    SELECT company_id, license_number, COUNT(*) as cnt, array_agg(id ORDER BY created_at DESC) as ids
    FROM public.drivers
    WHERE company_id IS NOT NULL AND license_number IS NOT NULL
    GROUP BY company_id, license_number
    HAVING COUNT(*) > 1
  LOOP
    driver_id_to_keep := dup_record.ids[1]; -- Keep the newest one
    
    -- For each duplicate driver (except the one we're keeping)
    FOR i IN 2..array_length(dup_record.ids, 1) LOOP
      driver_id_to_delete := dup_record.ids[i];
      
      -- Update foreign key references to point to the driver we're keeping
      -- 1. Update trucks.current_driver_id
      UPDATE public.trucks
      SET current_driver_id = driver_id_to_keep
      WHERE current_driver_id = driver_id_to_delete;
      
      -- 2. Update routes.driver_id
      UPDATE public.routes
      SET driver_id = driver_id_to_keep
      WHERE driver_id = driver_id_to_delete;
      
      -- 3. Update loads.driver_id
      UPDATE public.loads
      SET driver_id = driver_id_to_keep
      WHERE driver_id = driver_id_to_delete;
      
      -- 4. Update expenses.driver_id
      UPDATE public.expenses
      SET driver_id = driver_id_to_keep
      WHERE driver_id = driver_id_to_delete;
      
      -- 5. Update dvir.driver_id
      UPDATE public.dvir
      SET driver_id = driver_id_to_keep
      WHERE driver_id = driver_id_to_delete;
      
      -- 6. Update eld_logs.driver_id
      UPDATE public.eld_logs
      SET driver_id = driver_id_to_keep
      WHERE driver_id = driver_id_to_delete;
      
      -- 7. Update settlements.driver_id
      UPDATE public.settlements
      SET driver_id = driver_id_to_keep
      WHERE driver_id = driver_id_to_delete;
      
      -- Now safe to delete the duplicate driver
      DELETE FROM public.drivers
      WHERE id = driver_id_to_delete;
    END LOOP;
  END LOOP;
END $$;

-- Create per-company unique constraint
-- Each company can have their own driver with the same license number
-- (though in reality licenses are unique, this allows flexibility)
CREATE UNIQUE INDEX IF NOT EXISTS idx_drivers_company_license_unique 
ON public.drivers(company_id, license_number)
WHERE company_id IS NOT NULL AND license_number IS NOT NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON CONSTRAINT trucks_company_truck_number_unique ON public.trucks IS 
  'Truck numbers must be unique per company, allowing multiple companies to use the same truck number';

COMMENT ON CONSTRAINT loads_company_shipment_number_unique ON public.loads IS 
  'Shipment numbers must be unique per company, allowing multiple companies to use the same shipment number';

COMMENT ON CONSTRAINT invoices_company_invoice_number_unique ON public.invoices IS 
  'Invoice numbers must be unique per company, allowing multiple companies to use the same invoice number';

COMMENT ON CONSTRAINT bols_company_bol_number_unique ON public.bols IS 
  'BOL numbers must be unique per company, allowing multiple companies to use the same BOL number';

