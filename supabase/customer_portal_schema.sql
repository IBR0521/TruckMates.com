-- Customer Portal Access Schema
-- This schema enables customer portal functionality
-- Run this in Supabase SQL Editor

-- ============================================
-- CUSTOMER PORTAL ACCESS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.customer_portal_access (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  
  -- Access Details
  access_token TEXT UNIQUE NOT NULL, -- Secure token for portal access
  portal_url TEXT, -- Custom portal URL if provided
  is_active BOOLEAN DEFAULT true,
  
  -- Permissions
  can_view_loads BOOLEAN DEFAULT true,
  can_view_location BOOLEAN DEFAULT false, -- Real-time driver location
  can_download_documents BOOLEAN DEFAULT true,
  can_view_invoices BOOLEAN DEFAULT true,
  can_submit_loads BOOLEAN DEFAULT false,
  
  -- Settings
  email_notifications BOOLEAN DEFAULT true,
  sms_notifications BOOLEAN DEFAULT false,
  
  -- Expiration
  expires_at TIMESTAMP WITH TIME ZONE,
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  access_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_customer_portal_access_company_id ON public.customer_portal_access(company_id);
CREATE INDEX IF NOT EXISTS idx_customer_portal_access_customer_id ON public.customer_portal_access(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_portal_access_token ON public.customer_portal_access(access_token);
CREATE INDEX IF NOT EXISTS idx_customer_portal_access_active ON public.customer_portal_access(is_active);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE public.customer_portal_access ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view portal access for customers in their company
DROP POLICY IF EXISTS "Users can view portal access in their company" ON public.customer_portal_access;
CREATE POLICY "Users can view portal access in their company" ON public.customer_portal_access
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Policy: Managers can create portal access
DROP POLICY IF EXISTS "Managers can create portal access" ON public.customer_portal_access;
CREATE POLICY "Managers can create portal access" ON public.customer_portal_access
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Policy: Managers can update portal access
DROP POLICY IF EXISTS "Managers can update portal access" ON public.customer_portal_access;
CREATE POLICY "Managers can update portal access" ON public.customer_portal_access
  FOR UPDATE USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Policy: Managers can delete portal access
DROP POLICY IF EXISTS "Managers can delete portal access" ON public.customer_portal_access;
CREATE POLICY "Managers can delete portal access" ON public.customer_portal_access
  FOR DELETE USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Policy: Public access for token-based portal access (no auth required)
-- This allows customers to access their portal using the token
DROP POLICY IF EXISTS "Public token-based portal access" ON public.customer_portal_access;
CREATE POLICY "Public token-based portal access" ON public.customer_portal_access
  FOR SELECT USING (
    is_active = true AND
    (expires_at IS NULL OR expires_at > NOW())
  );

-- ============================================
-- TRIGGERS
-- ============================================
-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_customer_portal_access_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_customer_portal_access_updated_at ON public.customer_portal_access;
CREATE TRIGGER trigger_update_customer_portal_access_updated_at
  BEFORE UPDATE ON public.customer_portal_access
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_portal_access_updated_at();

