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


