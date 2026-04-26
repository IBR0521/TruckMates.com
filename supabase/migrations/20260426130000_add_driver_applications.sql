CREATE TABLE IF NOT EXISTS public.driver_applications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  applicant_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  cdl_number TEXT,
  cdl_state TEXT,
  cdl_class TEXT,
  endorsements TEXT[] DEFAULT '{}',
  years_experience NUMERIC(5,2),
  stage TEXT NOT NULL DEFAULT 'applied' CHECK (stage IN ('applied', 'screening', 'interview', 'offer', 'hired', 'rejected')),
  applied_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  converted_driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  converted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_driver_applications_company_id
  ON public.driver_applications (company_id);
CREATE INDEX IF NOT EXISTS idx_driver_applications_stage
  ON public.driver_applications (stage);
CREATE INDEX IF NOT EXISTS idx_driver_applications_applied_date
  ON public.driver_applications (applied_date DESC);

ALTER TABLE public.driver_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view driver applications in their company" ON public.driver_applications;
CREATE POLICY "Users can view driver applications in their company"
  ON public.driver_applications
  FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert driver applications in their company" ON public.driver_applications;
CREATE POLICY "Users can insert driver applications in their company"
  ON public.driver_applications
  FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update driver applications in their company" ON public.driver_applications;
CREATE POLICY "Users can update driver applications in their company"
  ON public.driver_applications
  FOR UPDATE
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete driver applications in their company" ON public.driver_applications;
CREATE POLICY "Users can delete driver applications in their company"
  ON public.driver_applications
  FOR DELETE
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP TRIGGER IF EXISTS update_driver_applications_updated_at ON public.driver_applications;
CREATE TRIGGER update_driver_applications_updated_at
  BEFORE UPDATE ON public.driver_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
