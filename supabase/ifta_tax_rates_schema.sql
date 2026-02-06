-- IFTA Tax Rates Management Schema
-- Allows quarterly tax rate updates for accurate IFTA reporting

CREATE TABLE IF NOT EXISTS public.ifta_tax_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  state_code TEXT NOT NULL, -- Two-letter state code (e.g., 'CA', 'TX')
  state_name TEXT NOT NULL, -- Full state name
  quarter INTEGER NOT NULL CHECK (quarter >= 1 AND quarter <= 4),
  year INTEGER NOT NULL,
  tax_rate_per_gallon DECIMAL(10, 4) NOT NULL, -- Tax rate in dollars per gallon
  effective_date DATE NOT NULL, -- When this rate becomes effective
  end_date DATE, -- When this rate expires (NULL if current)
  notes TEXT, -- Optional notes about rate changes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  UNIQUE(company_id, state_code, quarter, year)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_ifta_tax_rates_company_quarter 
  ON public.ifta_tax_rates(company_id, year, quarter);

CREATE INDEX IF NOT EXISTS idx_ifta_tax_rates_state 
  ON public.ifta_tax_rates(state_code);

CREATE INDEX IF NOT EXISTS idx_ifta_tax_rates_effective_date 
  ON public.ifta_tax_rates(effective_date, end_date);

-- Function to get current tax rate for a state and quarter
CREATE OR REPLACE FUNCTION public.get_ifta_tax_rate(
  p_company_id UUID,
  p_state_code TEXT,
  p_quarter INTEGER,
  p_year INTEGER
)
RETURNS DECIMAL(10, 4) AS $$
DECLARE
  v_rate DECIMAL(10, 4);
BEGIN
  SELECT tax_rate_per_gallon INTO v_rate
  FROM public.ifta_tax_rates
  WHERE company_id = p_company_id
    AND state_code = UPPER(p_state_code)
    AND quarter = p_quarter
    AND year = p_year
  ORDER BY created_at DESC
  LIMIT 1;

  -- If no company-specific rate, return NULL (will use default)
  RETURN COALESCE(v_rate, NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all tax rates for a quarter
CREATE OR REPLACE FUNCTION public.get_ifta_tax_rates_for_quarter(
  p_company_id UUID,
  p_quarter INTEGER,
  p_year INTEGER
)
RETURNS TABLE (
  state_code TEXT,
  state_name TEXT,
  tax_rate_per_gallon DECIMAL(10, 4)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ir.state_code,
    ir.state_name,
    ir.tax_rate_per_gallon
  FROM public.ifta_tax_rates ir
  WHERE ir.company_id = p_company_id
    AND ir.quarter = p_quarter
    AND ir.year = p_year
  ORDER BY ir.state_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies
ALTER TABLE public.ifta_tax_rates ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view tax rates for their company
CREATE POLICY "Users can view tax rates in their company"
  ON public.ifta_tax_rates
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Policy: Managers can insert/update/delete tax rates for their company
CREATE POLICY "Managers can manage tax rates in their company"
  ON public.ifta_tax_rates
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_ifta_tax_rates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ifta_tax_rates_updated_at
  BEFORE UPDATE ON public.ifta_tax_rates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ifta_tax_rates_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ifta_tax_rates TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ifta_tax_rate(UUID, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ifta_tax_rates_for_quarter(UUID, INTEGER, INTEGER) TO authenticated;

-- Insert default tax rates for all US states (Q1 2024 as baseline)
-- These can be updated quarterly by managers
DO $$
DECLARE
  v_company_id UUID;
  v_default_rates RECORD;
BEGIN
  -- Get all companies
  FOR v_company_id IN SELECT id FROM public.companies LOOP
    -- Default tax rates (per gallon) - Q1 2024 baseline
    FOR v_default_rates IN
      SELECT * FROM (VALUES
        ('AL', 'Alabama', 0.19),
        ('AK', 'Alaska', 0.08),
        ('AZ', 'Arizona', 0.19),
        ('AR', 'Arkansas', 0.22),
        ('CA', 'California', 0.36),
        ('CO', 'Colorado', 0.21),
        ('CT', 'Connecticut', 0.35),
        ('DE', 'Delaware', 0.22),
        ('FL', 'Florida', 0.20),
        ('GA', 'Georgia', 0.19),
        ('HI', 'Hawaii', 0.16),
        ('ID', 'Idaho', 0.25),
        ('IL', 'Illinois', 0.38),
        ('IN', 'Indiana', 0.33),
        ('IA', 'Iowa', 0.24),
        ('KS', 'Kansas', 0.24),
        ('KY', 'Kentucky', 0.26),
        ('LA', 'Louisiana', 0.20),
        ('ME', 'Maine', 0.30),
        ('MD', 'Maryland', 0.27),
        ('MA', 'Massachusetts', 0.24),
        ('MI', 'Michigan', 0.19),
        ('MN', 'Minnesota', 0.28),
        ('MS', 'Mississippi', 0.18),
        ('MO', 'Missouri', 0.17),
        ('MT', 'Montana', 0.27),
        ('NE', 'Nebraska', 0.25),
        ('NV', 'Nevada', 0.23),
        ('NH', 'New Hampshire', 0.23),
        ('NJ', 'New Jersey', 0.31),
        ('NM', 'New Mexico', 0.17),
        ('NY', 'New York', 0.33),
        ('NC', 'North Carolina', 0.24),
        ('ND', 'North Dakota', 0.23),
        ('OH', 'Ohio', 0.28),
        ('OK', 'Oklahoma', 0.20),
        ('OR', 'Oregon', 0.18),
        ('PA', 'Pennsylvania', 0.32),
        ('RI', 'Rhode Island', 0.34),
        ('SC', 'South Carolina', 0.16),
        ('SD', 'South Dakota', 0.24),
        ('TN', 'Tennessee', 0.20),
        ('TX', 'Texas', 0.20),
        ('UT', 'Utah', 0.24),
        ('VT', 'Vermont', 0.26),
        ('VA', 'Virginia', 0.16),
        ('WA', 'Washington', 0.38),
        ('WV', 'West Virginia', 0.20),
        ('WI', 'Wisconsin', 0.30),
        ('WY', 'Wyoming', 0.24),
        ('DC', 'District of Columbia', 0.24)
      ) AS t(state_code, state_name, rate)
    LOOP
      INSERT INTO public.ifta_tax_rates (
        company_id,
        state_code,
        state_name,
        quarter,
        year,
        tax_rate_per_gallon,
        effective_date
      ) VALUES (
        v_company_id,
        v_default_rates.state_code,
        v_default_rates.state_name,
        1, -- Q1
        2024, -- Year
        v_default_rates.rate,
        '2024-01-01'
      )
      ON CONFLICT (company_id, state_code, quarter, year) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;


