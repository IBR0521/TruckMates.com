-- Engine diagnostics and fault-code telemetry from ELD providers.
CREATE TABLE IF NOT EXISTS public.eld_diagnostics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  eld_device_id UUID REFERENCES public.eld_devices(id) ON DELETE CASCADE NOT NULL,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  truck_id UUID REFERENCES public.trucks(id) ON DELETE SET NULL,
  diagnostic_type TEXT NOT NULL, -- engine_stat | status_data | fault_code
  metric_name TEXT,
  metric_value_num DOUBLE PRECISION,
  metric_value_text TEXT,
  metric_unit TEXT,
  fault_code TEXT,
  fault_code_category TEXT,
  severity TEXT,
  description TEXT,
  status TEXT,
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_eld_diagnostics_company_id
  ON public.eld_diagnostics(company_id);

CREATE INDEX IF NOT EXISTS idx_eld_diagnostics_device_id
  ON public.eld_diagnostics(eld_device_id);

CREATE INDEX IF NOT EXISTS idx_eld_diagnostics_driver_id
  ON public.eld_diagnostics(driver_id);

CREATE INDEX IF NOT EXISTS idx_eld_diagnostics_type
  ON public.eld_diagnostics(diagnostic_type);

CREATE INDEX IF NOT EXISTS idx_eld_diagnostics_fault_code
  ON public.eld_diagnostics(fault_code);

CREATE INDEX IF NOT EXISTS idx_eld_diagnostics_occurred_at
  ON public.eld_diagnostics(occurred_at DESC);

ALTER TABLE public.eld_diagnostics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view ELD diagnostics in their company" ON public.eld_diagnostics;
CREATE POLICY "Users can view ELD diagnostics in their company"
  ON public.eld_diagnostics FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "System can insert ELD diagnostics" ON public.eld_diagnostics;
CREATE POLICY "System can insert ELD diagnostics"
  ON public.eld_diagnostics FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "System can update ELD diagnostics" ON public.eld_diagnostics;
CREATE POLICY "System can update ELD diagnostics"
  ON public.eld_diagnostics FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

COMMENT ON TABLE public.eld_diagnostics IS
  'Normalized engine diagnostics and fault code telemetry from Samsara and Geotab.';
