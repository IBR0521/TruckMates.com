-- ============================================================================
-- DVIR (Driver Vehicle Inspection Report) Schema
-- ============================================================================
-- Run this in Supabase SQL Editor
-- ============================================================================

-- DVIR table
CREATE TABLE IF NOT EXISTS public.dvir (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  driver_id UUID REFERENCES public.drivers(id) NOT NULL,
  truck_id UUID REFERENCES public.trucks(id) NOT NULL,
  inspection_type TEXT NOT NULL DEFAULT 'pre_trip', -- 'pre_trip', 'post_trip', 'on_road'
  inspection_date DATE NOT NULL,
  inspection_time TIME,
  location TEXT,
  mileage INTEGER,
  odometer_reading INTEGER,
  
  -- Inspection results
  status TEXT DEFAULT 'pending', -- 'pending', 'passed', 'failed', 'defects_corrected'
  defects_found BOOLEAN DEFAULT false,
  safe_to_operate BOOLEAN DEFAULT true,
  
  -- Driver signature
  driver_signature TEXT, -- Base64 encoded signature or URL
  driver_signature_date TIMESTAMP WITH TIME ZONE,
  
  -- Defects/Issues (stored as JSONB for flexibility)
  defects JSONB, -- Array of defect objects: [{component: string, description: string, severity: string, corrected: boolean}]
  
  -- Notes
  notes TEXT,
  corrective_action TEXT,
  
  -- Certification
  certified BOOLEAN DEFAULT false,
  certified_by UUID REFERENCES public.users(id),
  certified_date TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_dvir_company_id ON public.dvir(company_id);
CREATE INDEX IF NOT EXISTS idx_dvir_driver_id ON public.dvir(driver_id);
CREATE INDEX IF NOT EXISTS idx_dvir_truck_id ON public.dvir(truck_id);
CREATE INDEX IF NOT EXISTS idx_dvir_inspection_date ON public.dvir(inspection_date);
CREATE INDEX IF NOT EXISTS idx_dvir_status ON public.dvir(status);

-- Enable RLS (Row Level Security)
ALTER TABLE public.dvir ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see DVIRs from their company
CREATE POLICY "Users can view DVIRs from their company"
  ON public.dvir
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- RLS Policy: Users can insert DVIRs for their company
CREATE POLICY "Users can insert DVIRs for their company"
  ON public.dvir
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- RLS Policy: Users can update DVIRs from their company
CREATE POLICY "Users can update DVIRs from their company"
  ON public.dvir
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- RLS Policy: Users can delete DVIRs from their company
CREATE POLICY "Users can delete DVIRs from their company"
  ON public.dvir
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Add comments for documentation
COMMENT ON TABLE public.dvir IS 'Driver Vehicle Inspection Reports (DVIR) for compliance and safety tracking';
COMMENT ON COLUMN public.dvir.inspection_type IS 'Type of inspection: pre_trip, post_trip, or on_road';
COMMENT ON COLUMN public.dvir.defects IS 'JSONB array of defects found during inspection';
COMMENT ON COLUMN public.dvir.driver_signature IS 'Driver signature (Base64 or URL)';

