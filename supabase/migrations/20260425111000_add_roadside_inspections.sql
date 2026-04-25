-- Roadside inspection tracking (DOT/FMCSA CSA awareness).

CREATE TABLE IF NOT EXISTS public.roadside_inspections (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  inspection_date DATE NOT NULL,
  location TEXT,
  inspector_name TEXT,
  level TEXT NOT NULL CHECK (level IN ('I', 'II', 'III', 'IV', 'V', 'VI')),
  violations JSONB NOT NULL DEFAULT '[]'::jsonb,
  out_of_service BOOLEAN NOT NULL DEFAULT false,
  out_of_service_cleared_date DATE,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  truck_id UUID REFERENCES public.trucks(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_roadside_inspections_company_id
  ON public.roadside_inspections (company_id);
CREATE INDEX IF NOT EXISTS idx_roadside_inspections_inspection_date
  ON public.roadside_inspections (inspection_date DESC);
CREATE INDEX IF NOT EXISTS idx_roadside_inspections_driver_id
  ON public.roadside_inspections (driver_id);
CREATE INDEX IF NOT EXISTS idx_roadside_inspections_truck_id
  ON public.roadside_inspections (truck_id);

ALTER TABLE public.roadside_inspections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view roadside inspections in their company" ON public.roadside_inspections;
CREATE POLICY "Users can view roadside inspections in their company"
  ON public.roadside_inspections
  FOR SELECT
  USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert roadside inspections in their company" ON public.roadside_inspections;
CREATE POLICY "Users can insert roadside inspections in their company"
  ON public.roadside_inspections
  FOR INSERT
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update roadside inspections in their company" ON public.roadside_inspections;
CREATE POLICY "Users can update roadside inspections in their company"
  ON public.roadside_inspections
  FOR UPDATE
  USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete roadside inspections in their company" ON public.roadside_inspections;
CREATE POLICY "Users can delete roadside inspections in their company"
  ON public.roadside_inspections
  FOR DELETE
  USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

DROP TRIGGER IF EXISTS update_roadside_inspections_updated_at ON public.roadside_inspections;
CREATE TRIGGER update_roadside_inspections_updated_at
  BEFORE UPDATE ON public.roadside_inspections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
