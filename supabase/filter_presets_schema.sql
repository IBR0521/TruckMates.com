-- Filter Presets Schema
-- Allows users to save and reuse filter configurations

CREATE TABLE IF NOT EXISTS public.filter_presets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Preset Details
  name TEXT NOT NULL,
  page TEXT NOT NULL, -- 'loads', 'drivers', 'trucks', 'routes', etc.
  filters JSONB NOT NULL DEFAULT '{}'::jsonb, -- Filter configuration
  
  -- Default Preset
  is_default BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_filter_presets_company_id ON public.filter_presets(company_id);
CREATE INDEX IF NOT EXISTS idx_filter_presets_user_id ON public.filter_presets(user_id);
CREATE INDEX IF NOT EXISTS idx_filter_presets_page ON public.filter_presets(page);
CREATE INDEX IF NOT EXISTS idx_filter_presets_is_default ON public.filter_presets(is_default);

-- Row Level Security
ALTER TABLE public.filter_presets ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view filter presets in their company" ON public.filter_presets;
CREATE POLICY "Users can view filter presets in their company"
  ON public.filter_presets FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create filter presets" ON public.filter_presets;
CREATE POLICY "Users can create filter presets"
  ON public.filter_presets FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can update their own filter presets" ON public.filter_presets;
CREATE POLICY "Users can update their own filter presets"
  ON public.filter_presets FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can delete their own filter presets" ON public.filter_presets;
CREATE POLICY "Users can delete their own filter presets"
  ON public.filter_presets FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
    AND user_id = auth.uid()
  );

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS update_filter_presets_updated_at ON public.filter_presets;
CREATE TRIGGER update_filter_presets_updated_at
  BEFORE UPDATE ON public.filter_presets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Ensure only one default preset per page per company
CREATE OR REPLACE FUNCTION ensure_single_default_preset()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.filter_presets
    SET is_default = false
    WHERE company_id = NEW.company_id
      AND page = NEW.page
      AND is_default = true
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_single_default_preset_trigger ON public.filter_presets;
CREATE TRIGGER ensure_single_default_preset_trigger
  BEFORE INSERT OR UPDATE ON public.filter_presets
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_preset();

