-- Accident / incident logging for compliance + FMCSA accident register export.

CREATE TABLE IF NOT EXISTS public.incidents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  incident_date DATE NOT NULL,
  location TEXT,
  type TEXT NOT NULL CHECK (type IN ('accident', 'citation', 'cargo_damage', 'near_miss')),
  dot_reportable BOOLEAN NOT NULL DEFAULT false,
  injuries BOOLEAN NOT NULL DEFAULT false,
  fatalities BOOLEAN NOT NULL DEFAULT false,
  hazardous_material_released BOOLEAN NOT NULL DEFAULT false,
  vehicles_involved INTEGER,
  description TEXT,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  truck_id UUID REFERENCES public.trucks(id) ON DELETE SET NULL,
  police_report_url TEXT,
  photos TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  claim_status TEXT DEFAULT 'open' CHECK (claim_status IN ('open', 'submitted', 'under_review', 'settled', 'denied', 'closed')),
  insurer_notified_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_incidents_company_id ON public.incidents(company_id);
CREATE INDEX IF NOT EXISTS idx_incidents_incident_date ON public.incidents(incident_date DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_type ON public.incidents(type);
CREATE INDEX IF NOT EXISTS idx_incidents_driver_id ON public.incidents(driver_id);
CREATE INDEX IF NOT EXISTS idx_incidents_truck_id ON public.incidents(truck_id);

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view incidents in their company" ON public.incidents;
CREATE POLICY "Users can view incidents in their company"
  ON public.incidents
  FOR SELECT
  USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert incidents in their company" ON public.incidents;
CREATE POLICY "Users can insert incidents in their company"
  ON public.incidents
  FOR INSERT
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update incidents in their company" ON public.incidents;
CREATE POLICY "Users can update incidents in their company"
  ON public.incidents
  FOR UPDATE
  USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete incidents in their company" ON public.incidents;
CREATE POLICY "Users can delete incidents in their company"
  ON public.incidents
  FOR DELETE
  USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

DROP TRIGGER IF EXISTS update_incidents_updated_at ON public.incidents;
CREATE TRIGGER update_incidents_updated_at
  BEFORE UPDATE ON public.incidents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
