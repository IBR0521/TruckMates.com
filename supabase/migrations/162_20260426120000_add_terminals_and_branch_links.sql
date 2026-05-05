-- Multi-terminal / branch management for single-company multi-location operations.

CREATE TABLE IF NOT EXISTS public.terminals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  CONSTRAINT terminals_company_name_unique UNIQUE (company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_terminals_company_id
  ON public.terminals (company_id);

ALTER TABLE public.terminals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view terminals in their company" ON public.terminals;
CREATE POLICY "Users can view terminals in their company"
  ON public.terminals
  FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert terminals in their company" ON public.terminals;
CREATE POLICY "Users can insert terminals in their company"
  ON public.terminals
  FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update terminals in their company" ON public.terminals;
CREATE POLICY "Users can update terminals in their company"
  ON public.terminals
  FOR UPDATE
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete terminals in their company" ON public.terminals;
CREATE POLICY "Users can delete terminals in their company"
  ON public.terminals
  FOR DELETE
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP TRIGGER IF EXISTS update_terminals_updated_at ON public.terminals;
CREATE TRIGGER update_terminals_updated_at
  BEFORE UPDATE ON public.terminals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.trucks
  ADD COLUMN IF NOT EXISTS terminal_id UUID REFERENCES public.terminals(id) ON DELETE SET NULL;

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS terminal_id UUID REFERENCES public.terminals(id) ON DELETE SET NULL;

ALTER TABLE public.loads
  ADD COLUMN IF NOT EXISTS terminal_id UUID REFERENCES public.terminals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trucks_terminal_id ON public.trucks (terminal_id);
CREATE INDEX IF NOT EXISTS idx_drivers_terminal_id ON public.drivers (terminal_id);
CREATE INDEX IF NOT EXISTS idx_loads_terminal_id ON public.loads (terminal_id);
