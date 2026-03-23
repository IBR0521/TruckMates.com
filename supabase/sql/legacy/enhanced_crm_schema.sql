    -- ============================================================================
    -- Enhanced CRM Schema - Logistics-Focused Relationship Management
    -- ============================================================================
    -- This migration enhances the CRM with:
    -- 1. Unified relationship types (shippers, brokers, vendors, etc.)
    -- 2. Performance metrics views (on-time rates, payment days, profitability)
    -- 3. Document management (W9, COI, MC certificates with expiration tracking)
    -- 4. Enhanced communication logging
    -- ============================================================================

    -- ============================================================================
    -- STEP 1: Add Unified Relationship Type
    -- ============================================================================

    -- Add relationship_type to customers (unified type for all relationships)
    ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS relationship_type TEXT;

    -- Update relationship_type based on customer_type (backward compatibility)
    -- Only map valid customer_type values, set invalid ones to 'other'
    UPDATE public.customers
    SET relationship_type = CASE
    WHEN customer_type IN ('shipper', 'broker', 'consignee', '3pl', 'other') THEN customer_type
    WHEN customer_type IS NULL THEN NULL
    ELSE 'other'  -- Map any invalid values to 'other'
    END
    WHERE relationship_type IS NULL;

    -- Add relationship_type to vendors
    ALTER TABLE public.vendors
    ADD COLUMN IF NOT EXISTS relationship_type TEXT;

    -- Update relationship_type based on vendor_type (backward compatibility)
    UPDATE public.vendors
    SET relationship_type = CASE
    WHEN vendor_type = 'maintenance' THEN 'vendor_repair'
    WHEN vendor_type = 'fuel' THEN 'vendor_fuel'
    WHEN vendor_type = 'parts' THEN 'vendor_parts'
    WHEN vendor_type IN ('supplier', 'other') THEN 'vendor_other'
    WHEN vendor_type IS NULL THEN NULL
    ELSE 'vendor_other'  -- Map any invalid values to 'vendor_other'
    END
    WHERE relationship_type IS NULL;

    -- Ensure all existing values are valid before adding constraint
    -- Fix any remaining invalid values
    UPDATE public.customers
    SET relationship_type = 'other'
    WHERE relationship_type IS NOT NULL 
    AND relationship_type NOT IN (
        'shipper', 'broker', 'consignee', '3pl', 
        'vendor_repair', 'vendor_insurance', 'vendor_fuel', 'vendor_parts', 'vendor_other',
        'other'
    );

    UPDATE public.vendors
    SET relationship_type = 'vendor_other'
    WHERE relationship_type IS NOT NULL 
    AND relationship_type NOT IN (
        'shipper', 'broker', 'consignee', '3pl',
        'vendor_repair', 'vendor_insurance', 'vendor_fuel', 'vendor_parts', 'vendor_other',
        'other'
    );

    -- Add check constraint for relationship_type
    ALTER TABLE public.customers
    DROP CONSTRAINT IF EXISTS customers_relationship_type_check;

    ALTER TABLE public.customers
    ADD CONSTRAINT customers_relationship_type_check
    CHECK (relationship_type IS NULL OR relationship_type IN (
    'shipper', 'broker', 'consignee', '3pl', 
    'vendor_repair', 'vendor_insurance', 'vendor_fuel', 'vendor_parts', 'vendor_other',
    'other'
    ));

    ALTER TABLE public.vendors
    DROP CONSTRAINT IF EXISTS vendors_relationship_type_check;

    ALTER TABLE public.vendors
    ADD CONSTRAINT vendors_relationship_type_check
    CHECK (relationship_type IS NULL OR relationship_type IN (
    'shipper', 'broker', 'consignee', '3pl',
    'vendor_repair', 'vendor_insurance', 'vendor_fuel', 'vendor_parts', 'vendor_other',
    'other'
    ));

    -- Add indexes for relationship_type
    CREATE INDEX IF NOT EXISTS idx_customers_relationship_type ON public.customers(relationship_type);
    CREATE INDEX IF NOT EXISTS idx_vendors_relationship_type ON public.vendors(relationship_type);

    -- ============================================================================
    -- STEP 2: Create CRM Documents Table
    -- ============================================================================

    CREATE TABLE IF NOT EXISTS public.crm_documents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    
    -- Link to customer or vendor
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
    
    -- Document Information
    document_type TEXT NOT NULL CHECK (document_type IN (
        'w9', 'coi', 'mc_certificate', 'insurance_policy', 
        'license', 'contract', 'other'
    )),
    name TEXT NOT NULL,
    description TEXT,
    
    -- Storage
    storage_url TEXT NOT NULL, -- Supabase Storage URL
    file_size INTEGER, -- Size in bytes
    mime_type TEXT, -- e.g., 'application/pdf', 'image/jpeg'
    
    -- Expiration Tracking
    expiration_date DATE,
    expiration_alert_sent BOOLEAN DEFAULT false,
    
    -- Metadata
    uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    -- Ensure document is linked to either customer or vendor
    CONSTRAINT crm_documents_customer_or_vendor_check CHECK (
        (customer_id IS NOT NULL AND vendor_id IS NULL) OR
        (customer_id IS NULL AND vendor_id IS NOT NULL)
    )
    );

    -- Indexes for CRM documents
    CREATE INDEX IF NOT EXISTS idx_crm_documents_company_id ON public.crm_documents(company_id);
    CREATE INDEX IF NOT EXISTS idx_crm_documents_customer_id ON public.crm_documents(customer_id);
    CREATE INDEX IF NOT EXISTS idx_crm_documents_vendor_id ON public.crm_documents(vendor_id);
    CREATE INDEX IF NOT EXISTS idx_crm_documents_document_type ON public.crm_documents(document_type);
    CREATE INDEX IF NOT EXISTS idx_crm_documents_expiration_date ON public.crm_documents(expiration_date);

    -- ============================================================================
    -- STEP 3: Enhance Contact History for Automated Logging
    -- ============================================================================

    -- Add fields for automated communication logging
    ALTER TABLE public.contact_history
    ADD COLUMN IF NOT EXISTS external_id TEXT, -- ID from email/SMS service
    ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual', -- 'manual', 'email', 'sms', 'webhook'
    ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb; -- Additional metadata from webhook

    -- Add index for external_id
    CREATE INDEX IF NOT EXISTS idx_contact_history_external_id ON public.contact_history(external_id);
    CREATE INDEX IF NOT EXISTS idx_contact_history_source ON public.contact_history(source);

    -- ============================================================================
    -- STEP 4: Create Performance Metrics Views
    -- ============================================================================

-- Customer Performance Metrics View
CREATE OR REPLACE VIEW public.crm_customer_performance AS
SELECT 
  c.company_id,
  c.id as customer_id,
  c.name,
  c.company_name,
  c.relationship_type,
  c.status,
  c.payment_terms,
    
    -- Load Metrics
    COUNT(DISTINCT l.id) as total_loads,
    COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'delivered') as completed_loads,
    COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'delivered' AND l.actual_delivery <= COALESCE(l.estimated_delivery, l.actual_delivery)) as on_time_deliveries,
    CASE 
        WHEN COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'delivered') > 0 
        THEN ROUND(
        (COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'delivered' AND l.actual_delivery <= COALESCE(l.estimated_delivery, l.actual_delivery))::DECIMAL / 
        COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'delivered')) * 100, 
        2
        )
        ELSE 0
    END as on_time_rate,
    
    -- Financial Metrics
    COALESCE(SUM(i.amount) FILTER (WHERE i.status = 'paid'), 0) as total_revenue,
    COALESCE(SUM(i.amount) FILTER (WHERE i.status = 'sent'), 0) as pending_revenue,
    COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'paid') as paid_invoices,
    COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'sent') as pending_invoices,
    
    -- Payment Performance
    -- Calculate average days from issue_date to updated_at when status is 'paid'
    -- If updated_at is not available, use due_date as fallback
    CASE 
        WHEN COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'paid') > 0
        THEN ROUND(
        AVG(EXTRACT(EPOCH FROM (
            COALESCE(i.updated_at, i.due_date::timestamp with time zone) - i.issue_date::timestamp with time zone
        )) / 86400) 
        FILTER (WHERE i.status = 'paid'), 
        1
        )
        ELSE NULL
    END as avg_payment_days,
    
    -- Activity Metrics
    MAX(l.load_date) as last_load_date,
    MAX(i.created_at) as last_invoice_date,
    
    -- Profitability Score (simplified - can be enhanced)
    CASE 
        WHEN COUNT(DISTINCT l.id) > 0 AND COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'paid') > 0
        THEN ROUND(
        (COALESCE(SUM(i.amount) FILTER (WHERE i.status = 'paid'), 0) / COUNT(DISTINCT l.id))::DECIMAL,
        2
        )
        ELSE 0
    END as revenue_per_load
    
    FROM public.customers c
    LEFT JOIN public.loads l ON l.customer_id = c.id
    LEFT JOIN public.invoices i ON (
    (i.customer_id IS NOT NULL AND i.customer_id = c.id)
    OR (i.customer_name IS NOT NULL AND i.customer_name = c.name)
    OR (i.customer_name IS NOT NULL AND c.company_name IS NOT NULL AND i.customer_name = c.company_name)
    )
    GROUP BY c.company_id, c.id, c.name, c.company_name, c.relationship_type, c.status, c.payment_terms;

    -- Vendor Performance Metrics View
    CREATE OR REPLACE VIEW public.crm_vendor_performance AS
    SELECT 
    v.company_id,
    v.id as vendor_id,
    v.name,
    v.company_name,
    v.relationship_type,
    v.status,
    
    -- Transaction Metrics
    COUNT(DISTINCT e.id) as total_expenses,
    COALESCE(SUM(e.amount), 0) as total_spent,
    AVG(e.amount) as avg_expense_amount,
    
    -- Activity Metrics
    MAX(e.date) as last_transaction_date,
    MIN(e.date) as first_transaction_date,
    
  -- Reliability Score (based on expense frequency)
  -- Calculate transactions per month: count / (days between first and last / 30)
  CASE 
    WHEN MAX(e.date) IS NOT NULL AND MIN(e.date) IS NOT NULL
    THEN ROUND(
      COUNT(DISTINCT e.id)::DECIMAL / 
      GREATEST((MAX(e.date) - MIN(e.date))::DECIMAL / 30.0, 1),
      2
    )
    ELSE 0
  END as transactions_per_month
  
    FROM public.vendors v
    LEFT JOIN public.expenses e ON e.vendor = v.name OR e.vendor_id = v.id
    GROUP BY v.company_id, v.id, v.name, v.company_name, v.relationship_type, v.status;

    -- ============================================================================
    -- STEP 5: Enable Row Level Security
    -- ============================================================================

    ALTER TABLE public.crm_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for CRM Documents
DROP POLICY IF EXISTS "Users can view CRM documents in their company" ON public.crm_documents;
DROP POLICY IF EXISTS "Users can insert CRM documents in their company" ON public.crm_documents;
DROP POLICY IF EXISTS "Users can update CRM documents in their company" ON public.crm_documents;
DROP POLICY IF EXISTS "Users can delete CRM documents in their company" ON public.crm_documents;

CREATE POLICY "Users can view CRM documents in their company"
  ON public.crm_documents FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert CRM documents in their company"
  ON public.crm_documents FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update CRM documents in their company"
  ON public.crm_documents FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete CRM documents in their company"
  ON public.crm_documents FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

    -- ============================================================================
    -- STEP 6: Create Functions
    -- ============================================================================

    -- Function to get expiring documents
    CREATE OR REPLACE FUNCTION get_expiring_crm_documents(days_ahead INTEGER DEFAULT 30)
    RETURNS TABLE (
    id UUID,
    company_id UUID,
    customer_id UUID,
    vendor_id UUID,
    document_type TEXT,
    name TEXT,
    expiration_date DATE,
    days_until_expiration INTEGER,
    customer_name TEXT,
    vendor_name TEXT
    ) AS $$
    BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.company_id,
        d.customer_id,
        d.vendor_id,
        d.document_type,
        d.name,
        d.expiration_date,
        (d.expiration_date - CURRENT_DATE)::INTEGER as days_until_expiration,
        c.name as customer_name,
        v.name as vendor_name
    FROM public.crm_documents d
    LEFT JOIN public.customers c ON c.id = d.customer_id
    LEFT JOIN public.vendors v ON v.id = d.vendor_id
    WHERE d.expiration_date IS NOT NULL
        AND d.expiration_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + (days_ahead || ' days')::INTERVAL)
        AND d.company_id IN (
        SELECT company_id FROM public.users WHERE id = auth.uid()
        )
    ORDER BY d.expiration_date ASC;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    -- Function to update updated_at timestamp
    CREATE OR REPLACE FUNCTION update_crm_documents_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- Trigger for updated_at
    DROP TRIGGER IF EXISTS trigger_update_crm_documents_updated_at ON public.crm_documents;
    CREATE TRIGGER trigger_update_crm_documents_updated_at
    BEFORE UPDATE ON public.crm_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_crm_documents_updated_at();

    -- ============================================================================
    -- STEP 7: Add Comments for Documentation
    -- ============================================================================

    COMMENT ON COLUMN public.customers.relationship_type IS 'Unified relationship type: shipper, broker, consignee, 3pl, vendor_repair, vendor_insurance, vendor_fuel, vendor_parts, vendor_other, other';
    COMMENT ON COLUMN public.vendors.relationship_type IS 'Unified relationship type: shipper, broker, consignee, 3pl, vendor_repair, vendor_insurance, vendor_fuel, vendor_parts, vendor_other, other';
    COMMENT ON TABLE public.crm_documents IS 'CRM document management for W9, COI, MC certificates, insurance policies, etc. with expiration tracking';
    COMMENT ON VIEW public.crm_customer_performance IS 'Real-time customer performance metrics: on-time rates, payment days, revenue, profitability';
    COMMENT ON VIEW public.crm_vendor_performance IS 'Real-time vendor performance metrics: spending, transaction frequency, reliability';

