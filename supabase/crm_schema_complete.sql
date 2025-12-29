-- ============================================================================
-- CRM SCHEMA - Complete (Customers, Vendors, Contacts, Contact History)
-- ============================================================================
-- This is the ONLY CRM schema file you need to run.
-- It includes everything: tables, indexes, RLS policies, triggers, and functions.
--
-- IMPORTANT: Run DROP_CRM_TABLES.sql FIRST if you have existing CRM tables!
-- IMPORTANT: Make sure you've run the base schema.sql first (creates companies table)
-- ============================================================================

-- ============================================================================
-- STEP 1: Ensure Dependencies
-- ============================================================================

-- Enable UUID extension (needed for uuid_generate_v4())
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Verify companies table exists (required dependency)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'companies'
  ) THEN
    RAISE EXCEPTION 'The companies table does not exist. Please run the base schema.sql first!';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Drop Existing Tables (if they exist) and Create Fresh Tables
-- ============================================================================

-- Drop existing CRM tables first (CASCADE automatically drops triggers, policies, indexes)
DROP TABLE IF EXISTS public.contact_history CASCADE;
DROP TABLE IF EXISTS public.contacts CASCADE;
DROP TABLE IF EXISTS public.vendors CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;

-- Customers table
CREATE TABLE public.customers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  
  -- Basic Information
  name TEXT NOT NULL,
  company_name TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  
  -- Address Information
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  country TEXT DEFAULT 'USA',
  coordinates JSONB, -- { lat: number, lng: number }
  
  -- Business Information
  tax_id TEXT, -- Tax ID / EIN
  payment_terms TEXT DEFAULT 'Net 30', -- Payment terms
  credit_limit DECIMAL(10, 2),
  currency TEXT DEFAULT 'USD',
  
  -- Classification
  customer_type TEXT DEFAULT 'shipper', -- 'shipper', 'broker', 'consignee', '3pl', 'other'
  status TEXT DEFAULT 'active', -- 'active', 'inactive', 'prospect'
  priority TEXT DEFAULT 'normal', -- 'high', 'normal', 'low'
  
  -- Notes and Metadata
  notes TEXT,
  tags TEXT[], -- Array of tags for categorization
  custom_fields JSONB, -- Flexible custom fields
  
  -- Contact Information
  primary_contact_name TEXT,
  primary_contact_email TEXT,
  primary_contact_phone TEXT,
  
  -- Financial Summary (calculated fields, can be updated via triggers/functions)
  total_revenue DECIMAL(10, 2) DEFAULT 0,
  total_loads INTEGER DEFAULT 0,
  last_load_date DATE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  -- Unique constraint: customer name should be unique per company
  CONSTRAINT customers_company_name_unique UNIQUE(company_id, name)
);

-- Vendors table
CREATE TABLE public.vendors (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  
  -- Basic Information
  name TEXT NOT NULL,
  company_name TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  
  -- Address Information
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  country TEXT DEFAULT 'USA',
  coordinates JSONB,
  
  -- Business Information
  tax_id TEXT,
  payment_terms TEXT DEFAULT 'Net 30',
  currency TEXT DEFAULT 'USD',
  
  -- Classification
  vendor_type TEXT DEFAULT 'supplier', -- 'supplier', 'maintenance', 'fuel', 'parts', 'other'
  status TEXT DEFAULT 'active', -- 'active', 'inactive'
  priority TEXT DEFAULT 'normal',
  
  -- Notes and Metadata
  notes TEXT,
  tags TEXT[],
  custom_fields JSONB,
  
  -- Contact Information
  primary_contact_name TEXT,
  primary_contact_email TEXT,
  primary_contact_phone TEXT,
  
  -- Financial Summary
  total_spent DECIMAL(10, 2) DEFAULT 0,
  total_transactions INTEGER DEFAULT 0,
  last_transaction_date DATE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  CONSTRAINT vendors_company_name_unique UNIQUE(company_id, name)
);

-- Contacts table - for multiple contacts per customer/vendor
CREATE TABLE public.contacts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  
  -- Link to customer or vendor (one of these should be set)
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
  
  -- Contact Information
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  title TEXT, -- Job title
  email TEXT,
  phone TEXT,
  mobile TEXT,
  fax TEXT,
  
  -- Communication Preferences
  preferred_contact_method TEXT DEFAULT 'email', -- 'email', 'phone', 'sms', 'mail'
  send_notifications BOOLEAN DEFAULT true,
  send_invoices BOOLEAN DEFAULT false,
  
  -- Relationship
  is_primary BOOLEAN DEFAULT false, -- Primary contact
  role TEXT, -- 'billing', 'dispatch', 'operations', 'owner', 'other'
  
  -- Notes
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  -- Ensure contact is linked to either customer or vendor
  CONSTRAINT contacts_customer_or_vendor_check CHECK (
    (customer_id IS NOT NULL AND vendor_id IS NULL) OR
    (customer_id IS NULL AND vendor_id IS NOT NULL)
  )
);

-- Customer/Vendor Communication History
CREATE TABLE public.contact_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  
  -- Link to customer, vendor, or contact
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  
  -- Communication Details
  type TEXT NOT NULL, -- 'email', 'phone', 'sms', 'meeting', 'note', 'invoice_sent', 'payment_received'
  subject TEXT,
  message TEXT,
  direction TEXT DEFAULT 'outbound', -- 'inbound', 'outbound'
  
  -- Related Entities
  load_id UUID REFERENCES public.loads(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  
  -- Metadata
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- User who created the entry
  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  -- Files/Attachments
  attachments JSONB, -- Array of file URLs
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  CONSTRAINT contact_history_customer_or_vendor_check CHECK (
    (customer_id IS NOT NULL AND vendor_id IS NULL) OR
    (customer_id IS NULL AND vendor_id IS NOT NULL)
  )
);

-- ============================================================================
-- STEP 3: Create Indexes
-- ============================================================================

-- Customers indexes
CREATE INDEX idx_customers_company_id ON public.customers(company_id);
CREATE INDEX idx_customers_status ON public.customers(status);
CREATE INDEX idx_customers_type ON public.customers(customer_type);
CREATE INDEX idx_customers_created_at ON public.customers(created_at);

-- Vendors indexes
CREATE INDEX idx_vendors_company_id ON public.vendors(company_id);
CREATE INDEX idx_vendors_status ON public.vendors(status);
CREATE INDEX idx_vendors_type ON public.vendors(vendor_type);

-- Contacts indexes
CREATE INDEX idx_contacts_company_id ON public.contacts(company_id);
CREATE INDEX idx_contacts_customer_id ON public.contacts(customer_id);
CREATE INDEX idx_contacts_vendor_id ON public.contacts(vendor_id);
CREATE INDEX idx_contacts_is_primary ON public.contacts(is_primary);

-- Contact history indexes
CREATE INDEX idx_contact_history_company_id ON public.contact_history(company_id);
CREATE INDEX idx_contact_history_customer_id ON public.contact_history(customer_id);
CREATE INDEX idx_contact_history_vendor_id ON public.contact_history(vendor_id);
CREATE INDEX idx_contact_history_contact_id ON public.contact_history(contact_id);
CREATE INDEX idx_contact_history_occurred_at ON public.contact_history(occurred_at);

-- ============================================================================
-- STEP 4: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_history ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: Create RLS Policies
-- ============================================================================

-- RLS Policies for customers
CREATE POLICY "Users can view customers in their company"
  ON public.customers FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert customers in their company"
  ON public.customers FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update customers in their company"
  ON public.customers FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete customers in their company"
  ON public.customers FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- RLS Policies for vendors
CREATE POLICY "Users can view vendors in their company"
  ON public.vendors FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert vendors in their company"
  ON public.vendors FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update vendors in their company"
  ON public.vendors FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete vendors in their company"
  ON public.vendors FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- RLS Policies for contacts
CREATE POLICY "Users can view contacts in their company"
  ON public.contacts FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert contacts in their company"
  ON public.contacts FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update contacts in their company"
  ON public.contacts FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete contacts in their company"
  ON public.contacts FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- RLS Policies for contact_history
CREATE POLICY "Users can view contact history in their company"
  ON public.contact_history FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert contact history in their company"
  ON public.contact_history FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update contact history in their company"
  ON public.contact_history FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete contact history in their company"
  ON public.contact_history FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- ============================================================================
-- STEP 6: Create Helper Functions
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update customer financial summary
-- This function updates customer stats when invoices are created/updated
CREATE OR REPLACE FUNCTION update_customer_financial_summary()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_id UUID;
BEGIN
  -- Only run if invoices table exists and has the expected columns
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Try to find customer by name (if customer_name column exists in invoices)
    IF NEW.customer_name IS NOT NULL AND NEW.company_id IS NOT NULL THEN
      -- Find customer by matching name and company
      SELECT id INTO v_customer_id
      FROM public.customers
      WHERE name = NEW.customer_name 
      AND company_id = NEW.company_id
      LIMIT 1;
      
      -- If customer found, update stats based on invoices only
      IF v_customer_id IS NOT NULL THEN
        UPDATE public.customers
        SET 
          total_revenue = COALESCE((
            SELECT SUM(amount) 
            FROM public.invoices 
            WHERE customer_name = customers.name 
            AND company_id = customers.company_id
            AND status = 'paid'
          ), 0),
          total_loads = COALESCE((
            SELECT COUNT(DISTINCT load_id)
            FROM public.invoices 
            WHERE customer_name = customers.name 
            AND company_id = customers.company_id
            AND load_id IS NOT NULL
          ), 0),
          last_load_date = (
            SELECT MAX(l.load_date)
            FROM public.invoices i
            JOIN public.loads l ON l.id = i.load_id
            WHERE i.customer_name = customers.name 
            AND i.company_id = customers.company_id
          )
        WHERE id = v_customer_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 7: Create Triggers
-- ============================================================================

-- Triggers for updated_at on CRM tables
CREATE TRIGGER update_customers_updated_at 
  BEFORE UPDATE ON public.customers
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vendors_updated_at 
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at 
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update customer stats when invoices change (only if invoices table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'invoices'
  ) THEN
    DROP TRIGGER IF EXISTS update_customer_stats_on_invoice ON public.invoices;
    CREATE TRIGGER update_customer_stats_on_invoice
      AFTER INSERT OR UPDATE ON public.invoices
      FOR EACH ROW
      EXECUTE FUNCTION update_customer_financial_summary();
  END IF;
END $$;

-- ============================================================================
-- STEP 8: Add Foreign Key Columns to Existing Tables (Optional)
-- ============================================================================
-- These add customer_id/vendor_id references to other tables if they exist
-- This is optional - the platform works without these foreign keys

-- Add customer_id reference to loads table (if it doesn't exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'loads'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'loads' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE public.loads ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;
    CREATE INDEX idx_loads_customer_id ON public.loads(customer_id);
  END IF;
END $$;

-- Add customer_id reference to invoices table (if it doesn't exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'invoices'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE public.invoices ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;
    CREATE INDEX idx_invoices_customer_id ON public.invoices(customer_id);
  END IF;
END $$;

-- Add vendor_id reference to expenses table (if it doesn't exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'expenses'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name = 'vendor_id'
  ) THEN
    ALTER TABLE public.expenses ADD COLUMN vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL;
    CREATE INDEX idx_expenses_vendor_id ON public.expenses(vendor_id);
  END IF;
END $$;

-- Add vendor_id reference to maintenance table (if it doesn't exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'maintenance'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'maintenance' AND column_name = 'vendor_id'
  ) THEN
    ALTER TABLE public.maintenance ADD COLUMN vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL;
    CREATE INDEX idx_maintenance_vendor_id ON public.maintenance(vendor_id);
  END IF;
END $$;

-- ============================================================================
-- DONE! 
-- ============================================================================
-- Your CRM schema is now complete with:
-- ✅ 4 tables (customers, vendors, contacts, contact_history)
-- ✅ All indexes for performance
-- ✅ Row Level Security enabled
-- ✅ RLS policies for data access control
-- ✅ Triggers for automatic timestamp updates
-- ✅ Helper functions for financial summaries
-- ✅ Optional foreign key links to other tables

