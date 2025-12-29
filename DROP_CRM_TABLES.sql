-- Drop CRM tables to start fresh
-- Run this FIRST before running crm_schema_complete.sql
-- This script is safe to run even if tables don't exist

-- ============================================
-- STEP 1: Drop triggers first (only if tables exist)
-- ============================================
DO $$
BEGIN
  -- Drop invoice trigger only if invoices table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invoices') THEN
    DROP TRIGGER IF EXISTS update_customer_stats_on_invoice ON public.invoices;
  END IF;
  
  -- Drop customer triggers only if customers table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customers') THEN
    DROP TRIGGER IF EXISTS update_customers_updated_at ON public.customers;
  END IF;
  
  -- Drop vendor triggers only if vendors table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vendors') THEN
    DROP TRIGGER IF EXISTS update_vendors_updated_at ON public.vendors;
  END IF;
  
  -- Drop contact triggers only if contacts table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contacts') THEN
    DROP TRIGGER IF EXISTS update_contacts_updated_at ON public.contacts;
  END IF;
END $$;

-- ============================================
-- STEP 2: Drop functions
-- ============================================
DROP FUNCTION IF EXISTS update_customer_financial_summary() CASCADE;

-- ============================================
-- STEP 3: Drop foreign key constraints from other tables
-- ============================================
-- Drop foreign key constraints before dropping the tables they reference

-- Drop customer_id foreign keys
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
    AND table_name = 'loads' 
    AND constraint_name LIKE '%customer_id%'
  ) THEN
    ALTER TABLE public.loads DROP CONSTRAINT IF EXISTS loads_customer_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
    AND table_name = 'invoices' 
    AND constraint_name LIKE '%customer_id%'
  ) THEN
    ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_customer_id_fkey;
  END IF;

  -- Drop vendor_id foreign keys
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
    AND table_name = 'expenses' 
    AND constraint_name LIKE '%vendor_id%'
  ) THEN
    ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_vendor_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
    AND table_name = 'maintenance' 
    AND constraint_name LIKE '%vendor_id%'
  ) THEN
    ALTER TABLE public.maintenance DROP CONSTRAINT IF EXISTS maintenance_vendor_id_fkey;
  END IF;
END $$;

-- ============================================
-- STEP 4: Remove foreign key columns from other tables
-- ============================================
DO $$
BEGIN
  -- Remove customer_id from loads table if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'loads' 
    AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE public.loads DROP COLUMN customer_id;
  END IF;

  -- Remove customer_id from invoices table if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'invoices' 
    AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE public.invoices DROP COLUMN customer_id;
  END IF;

  -- Remove vendor_id from expenses table if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'expenses' 
    AND column_name = 'vendor_id'
  ) THEN
    ALTER TABLE public.expenses DROP COLUMN vendor_id;
  END IF;

  -- Remove vendor_id from maintenance table if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'maintenance' 
    AND column_name = 'vendor_id'
  ) THEN
    ALTER TABLE public.maintenance DROP COLUMN vendor_id;
  END IF;
END $$;

-- ============================================
-- STEP 5: Drop CRM tables in correct order
-- ============================================
-- CASCADE automatically drops triggers, policies, indexes, and dependent objects
-- Using IF EXISTS so it won't error if tables don't exist
DROP TABLE IF EXISTS public.contact_history CASCADE;
DROP TABLE IF EXISTS public.contacts CASCADE;
DROP TABLE IF EXISTS public.vendors CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;

