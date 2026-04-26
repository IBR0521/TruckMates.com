ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS dot_number TEXT;

CREATE TABLE IF NOT EXISTS public.csa_scores (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  dot_number TEXT NOT NULL,
  snapshot_month DATE NOT NULL,
  unsafe_driving NUMERIC(5,2),
  hours_of_service NUMERIC(5,2),
  driver_fitness NUMERIC(5,2),
  controlled_substances NUMERIC(5,2),
  vehicle_maintenance NUMERIC(5,2),
  hazardous_materials NUMERIC(5,2),
  crash_indicator NUMERIC(5,2),
  source_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  CONSTRAINT csa_scores_company_month_unique UNIQUE (company_id, snapshot_month)
);

CREATE INDEX IF NOT EXISTS idx_csa_scores_company_month ON public.csa_scores (company_id, snapshot_month DESC);
CREATE INDEX IF NOT EXISTS idx_csa_scores_dot_month ON public.csa_scores (dot_number, snapshot_month DESC);

ALTER TABLE public.csa_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view csa scores in their company" ON public.csa_scores;
CREATE POLICY "Users can view csa scores in their company"
  ON public.csa_scores
  FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert csa scores in their company" ON public.csa_scores;
CREATE POLICY "Users can insert csa scores in their company"
  ON public.csa_scores
  FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update csa scores in their company" ON public.csa_scores;
CREATE POLICY "Users can update csa scores in their company"
  ON public.csa_scores
  FOR UPDATE
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete csa scores in their company" ON public.csa_scores;
CREATE POLICY "Users can delete csa scores in their company"
  ON public.csa_scores
  FOR DELETE
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP TRIGGER IF EXISTS update_csa_scores_updated_at ON public.csa_scores;
CREATE TRIGGER update_csa_scores_updated_at
  BEFORE UPDATE ON public.csa_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
