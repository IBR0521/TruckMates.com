-- ============================================
-- DATABASE SETUP FOR TRUCKMATES PLATFORM
-- ============================================
-- Copy and paste the sections below into Supabase SQL Editor
-- Run them ONE AT A TIME in the order shown
-- ============================================

-- ============================================
-- SECTION 1: CRM SCHEMA
-- ============================================
-- Copy everything below this line until "END OF CRM SCHEMA"
-- Paste into Supabase SQL Editor and click "Run"
-- ============================================

-- CRM Schema (Customers, Vendors, Contacts)
-- This schema extends the platform with comprehensive customer and vendor management

-- Customers table
CREATE TABLE IF NOT EXISTS public.customers (
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
CREATE TABLE IF NOT EXISTS public.vendors (
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
CREATE TABLE IF NOT EXISTS public.contacts (
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
CREATE TABLE IF NOT EXISTS public.contact_history (
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

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON public.customers(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_status ON public.customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_type ON public.customers(customer_type);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON public.customers(created_at);

CREATE INDEX IF NOT EXISTS idx_vendors_company_id ON public.vendors(company_id);
CREATE INDEX IF NOT EXISTS idx_vendors_status ON public.vendors(status);
CREATE INDEX IF NOT EXISTS idx_vendors_type ON public.vendors(vendor_type);

CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON public.contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_customer_id ON public.contacts(customer_id);
CREATE INDEX IF NOT EXISTS idx_contacts_vendor_id ON public.contacts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_contacts_is_primary ON public.contacts(is_primary);

CREATE INDEX IF NOT EXISTS idx_contact_history_company_id ON public.contact_history(company_id);
CREATE INDEX IF NOT EXISTS idx_contact_history_customer_id ON public.contact_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_contact_history_vendor_id ON public.contact_history(vendor_id);
CREATE INDEX IF NOT EXISTS idx_contact_history_contact_id ON public.contact_history(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_history_occurred_at ON public.contact_history(occurred_at);

-- Enable Row Level Security
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_history ENABLE ROW LEVEL SECURITY;

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

-- Update triggers for updated_at
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

-- Function to update customer financial summary
CREATE OR REPLACE FUNCTION update_customer_financial_summary()
RETURNS TRIGGER AS $$
BEGIN
  -- Update customer stats when invoice is created/updated
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.customers
    SET 
      total_revenue = COALESCE((
        SELECT SUM(amount) 
        FROM public.invoices 
        WHERE customer_name = customers.name 
        AND company_id = customers.company_id
        AND status = 'paid'
      ), 0),
      total_loads = (
        SELECT COUNT(*) 
        FROM public.loads 
        WHERE company_name = customers.name 
        AND company_id = customers.company_id
      ),
      last_load_date = (
        SELECT MAX(load_date) 
        FROM public.loads 
        WHERE company_name = customers.name 
        AND company_id = customers.company_id
      )
    WHERE id = (
      SELECT id FROM public.customers 
      WHERE name = NEW.customer_name 
      AND company_id = NEW.company_id
      LIMIT 1
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update customer stats when invoices change
CREATE TRIGGER update_customer_stats_on_invoice
  AFTER INSERT OR UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_financial_summary();

-- Add customer_id reference to loads table (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'loads' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE public.loads ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_loads_customer_id ON public.loads(customer_id);
  END IF;
END $$;

-- Add customer_id reference to invoices table (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE public.invoices ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON public.invoices(customer_id);
  END IF;
END $$;

-- Add vendor_id reference to expenses table (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'expenses' AND column_name = 'vendor_id'
  ) THEN
    ALTER TABLE public.expenses ADD COLUMN vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_expenses_vendor_id ON public.expenses(vendor_id);
  END IF;
END $$;

-- Add vendor_id reference to maintenance table (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'maintenance' AND column_name = 'vendor_id'
  ) THEN
    ALTER TABLE public.maintenance ADD COLUMN vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_maintenance_vendor_id ON public.maintenance(vendor_id);
  END IF;
END $$;

-- ============================================
-- END OF CRM SCHEMA
-- ============================================
-- After running the above, copy and run the BOL Schema below
-- ============================================

-- ============================================
-- SECTION 2: BOL SCHEMA
-- ============================================
-- Copy everything below this line
-- Paste into Supabase SQL Editor (in a NEW query) and click "Run"
-- ============================================

-- BOL (Bill of Lading) Schema
-- This schema extends the platform with digital BOL and e-signature capabilities

-- BOL Templates table
CREATE TABLE IF NOT EXISTS public.bol_templates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  
  -- Template Information
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  
  -- Template Content
  template_html TEXT, -- HTML template for BOL
  template_fields JSONB, -- Array of field definitions
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  CONSTRAINT bol_templates_company_name_unique UNIQUE(company_id, name)
);

-- BOLs (Bill of Lading) table
CREATE TABLE IF NOT EXISTS public.bols (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  load_id UUID REFERENCES public.loads(id) ON DELETE CASCADE NOT NULL,
  
  -- BOL Information
  bol_number TEXT NOT NULL UNIQUE,
  template_id UUID REFERENCES public.bol_templates(id) ON DELETE SET NULL,
  
  -- Shipper Information
  shipper_name TEXT NOT NULL,
  shipper_address TEXT,
  shipper_city TEXT,
  shipper_state TEXT,
  shipper_zip TEXT,
  shipper_phone TEXT,
  shipper_email TEXT,
  
  -- Consignee Information
  consignee_name TEXT NOT NULL,
  consignee_address TEXT,
  consignee_city TEXT,
  consignee_state TEXT,
  consignee_zip TEXT,
  consignee_phone TEXT,
  consignee_email TEXT,
  
  -- Carrier Information
  carrier_name TEXT,
  carrier_mc_number TEXT,
  carrier_dot_number TEXT,
  
  -- Load Details
  pickup_date DATE,
  delivery_date DATE,
  freight_charges DECIMAL(10, 2),
  payment_terms TEXT,
  special_instructions TEXT,
  
  -- Signatures
  shipper_signature JSONB, -- { signature_url, signed_by, signed_at, ip_address }
  driver_signature JSONB, -- { signature_url, signed_by, signed_at, ip_address }
  consignee_signature JSONB, -- { signature_url, signed_by, signed_at, ip_address }
  
  -- Proof of Delivery
  pod_photos JSONB, -- Array of photo URLs
  pod_notes TEXT,
  pod_received_by TEXT,
  pod_received_date DATE,
  pod_delivery_condition TEXT, -- 'good', 'damaged', 'short', 'refused'
  
  -- Status
  status TEXT DEFAULT 'draft', -- 'draft', 'sent', 'signed', 'delivered', 'completed'
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  CONSTRAINT bols_load_id_unique UNIQUE(load_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bol_templates_company_id ON public.bol_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_bols_company_id ON public.bols(company_id);
CREATE INDEX IF NOT EXISTS idx_bols_load_id ON public.bols(load_id);
CREATE INDEX IF NOT EXISTS idx_bols_status ON public.bols(status);
CREATE INDEX IF NOT EXISTS idx_bols_bol_number ON public.bols(bol_number);

-- Enable Row Level Security
ALTER TABLE public.bol_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bols ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bol_templates
CREATE POLICY "Users can view BOL templates in their company"
  ON public.bol_templates FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert BOL templates in their company"
  ON public.bol_templates FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update BOL templates in their company"
  ON public.bol_templates FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete BOL templates in their company"
  ON public.bol_templates FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- RLS Policies for bols
CREATE POLICY "Users can view BOLs in their company"
  ON public.bols FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert BOLs in their company"
  ON public.bols FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update BOLs in their company"
  ON public.bols FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete BOLs in their company"
  ON public.bols FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Update triggers
CREATE TRIGGER update_bol_templates_updated_at 
  BEFORE UPDATE ON public.bol_templates
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bols_updated_at 
  BEFORE UPDATE ON public.bols
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- END OF BOL SCHEMA
-- ============================================
-- ✅ You're all set! Both schemas are now installed.
-- ============================================


