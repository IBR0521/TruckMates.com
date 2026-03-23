-- ============================================================================
-- Settlement Pay Rules Engine Schema
-- ============================================================================
-- Enables complex pay structures: per mile, percentage, bonuses, deductions
-- Supports zero-touch payroll automation
-- ============================================================================

-- Step 1: Create driver_pay_rules table for complex pay structures
CREATE TABLE IF NOT EXISTS public.driver_pay_rules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE CASCADE NOT NULL,
  
  -- Pay structure type
  pay_type TEXT NOT NULL DEFAULT 'per_mile', -- 'per_mile', 'percentage', 'flat', 'hybrid'
  
  -- Base pay rates
  base_rate_per_mile DECIMAL(10, 4) DEFAULT NULL, -- e.g., 0.60
  base_percentage DECIMAL(5, 2) DEFAULT NULL, -- e.g., 25.00 (25% of load value)
  base_flat_rate DECIMAL(10, 2) DEFAULT NULL, -- e.g., 500.00 (flat per load)
  
  -- Bonuses (stored as JSONB for flexibility)
  bonuses JSONB DEFAULT '[]'::JSONB, -- Array of bonus rules
  -- Example: [
  --   { "type": "hazmat", "amount": 50.00, "description": "Hazmat load bonus" },
  --   { "type": "on_time", "amount": 25.00, "description": "On-time delivery bonus" },
  --   { "type": "mileage_threshold", "amount": 100.00, "threshold": 2000, "description": "2000+ miles bonus" }
  -- ]
  
  -- Deductions (stored as JSONB for flexibility)
  deductions JSONB DEFAULT '[]'::JSONB, -- Array of deduction rules
  -- Example: [
  --   { "type": "fuel", "percentage": 100.00, "description": "100% of fuel costs" },
  --   { "type": "advance", "amount": 0, "description": "All advances" },
  --   { "type": "equipment", "amount": 50.00, "description": "Equipment rental" }
  -- ]
  
  -- Minimum pay guarantee
  minimum_pay_guarantee DECIMAL(10, 2) DEFAULT NULL, -- e.g., 1000.00 (minimum per week)
  
  -- Effective dates
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE DEFAULT NULL, -- NULL means currently active
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  -- Ensure only one active rule per driver at a time
  CONSTRAINT unique_active_driver_rule UNIQUE (driver_id, is_active) 
    DEFERRABLE INITIALLY DEFERRED
);

-- Step 2: Create indexes
CREATE INDEX IF NOT EXISTS idx_driver_pay_rules_company_id ON public.driver_pay_rules(company_id);
CREATE INDEX IF NOT EXISTS idx_driver_pay_rules_driver_id ON public.driver_pay_rules(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_pay_rules_active ON public.driver_pay_rules(driver_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_driver_pay_rules_effective_dates ON public.driver_pay_rules(effective_from, effective_to);

-- Step 3: Add settlement calculation details column
ALTER TABLE public.settlements
  ADD COLUMN IF NOT EXISTS pay_rule_id UUID REFERENCES public.driver_pay_rules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS calculation_details JSONB DEFAULT '{}'::JSONB,
  -- Stores detailed breakdown: base_pay, bonuses, deductions, etc.
  ADD COLUMN IF NOT EXISTS pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS driver_approved BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS driver_approved_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS driver_approval_method TEXT; -- 'mobile_app', 'email', 'sms', 'manual'

-- Step 4: Create function to get active pay rule for driver
CREATE OR REPLACE FUNCTION get_active_pay_rule(p_driver_id UUID, p_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  id UUID,
  pay_type TEXT,
  base_rate_per_mile DECIMAL(10, 4),
  base_percentage DECIMAL(5, 2),
  base_flat_rate DECIMAL(10, 2),
  bonuses JSONB,
  deductions JSONB,
  minimum_pay_guarantee DECIMAL(10, 2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dpr.id,
    dpr.pay_type,
    dpr.base_rate_per_mile,
    dpr.base_percentage,
    dpr.base_flat_rate,
    dpr.bonuses,
    dpr.deductions,
    dpr.minimum_pay_guarantee
  FROM public.driver_pay_rules dpr
  WHERE dpr.driver_id = p_driver_id
    AND dpr.is_active = true
    AND dpr.effective_from <= p_date
    AND (dpr.effective_to IS NULL OR dpr.effective_to >= p_date)
  ORDER BY dpr.effective_from DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create function to calculate gross pay from pay rule
CREATE OR REPLACE FUNCTION calculate_gross_pay_from_rule(
  p_pay_rule RECORD,
  p_loads JSONB, -- Array of loads with value, miles, etc.
  p_total_miles DECIMAL(10, 2) DEFAULT NULL
)
RETURNS DECIMAL(10, 2) AS $$
DECLARE
  v_gross_pay DECIMAL(10, 2) := 0;
  v_load JSONB;
  v_load_value DECIMAL(10, 2);
  v_load_miles DECIMAL(10, 2);
  v_bonus_amount DECIMAL(10, 2);
  v_bonus JSONB;
BEGIN
  -- Calculate base pay based on pay type
  IF p_pay_rule.pay_type = 'per_mile' AND p_pay_rule.base_rate_per_mile IS NOT NULL THEN
    -- Per mile calculation
    IF p_total_miles IS NOT NULL THEN
      v_gross_pay := p_total_miles * p_pay_rule.base_rate_per_mile;
    ELSE
      -- Calculate from loads
      FOR v_load IN SELECT * FROM jsonb_array_elements(p_loads)
      LOOP
        v_load_miles := (v_load->>'miles')::DECIMAL;
        IF v_load_miles IS NULL THEN
          v_load_miles := 0;
        END IF;
        v_gross_pay := v_gross_pay + (v_load_miles * p_pay_rule.base_rate_per_mile);
      END LOOP;
    END IF;
    
  ELSIF p_pay_rule.pay_type = 'percentage' AND p_pay_rule.base_percentage IS NOT NULL THEN
    -- Percentage of load value
    FOR v_load IN SELECT * FROM jsonb_array_elements(p_loads)
    LOOP
      v_load_value := (v_load->>'value')::DECIMAL;
      IF v_load_value IS NULL THEN
        v_load_value := 0;
      END IF;
      v_gross_pay := v_gross_pay + (v_load_value * p_pay_rule.base_percentage / 100);
    END LOOP;
    
  ELSIF p_pay_rule.pay_type = 'flat' AND p_pay_rule.base_flat_rate IS NOT NULL THEN
    -- Flat rate per load
    v_gross_pay := jsonb_array_length(p_loads) * p_pay_rule.base_flat_rate;
    
  ELSIF p_pay_rule.pay_type = 'hybrid' THEN
    -- Hybrid: combination of rates
    -- This is more complex and will be handled in application layer
    -- For now, use per_mile if available, otherwise percentage
    IF p_pay_rule.base_rate_per_mile IS NOT NULL AND p_total_miles IS NOT NULL THEN
      v_gross_pay := p_total_miles * p_pay_rule.base_rate_per_mile;
    ELSIF p_pay_rule.base_percentage IS NOT NULL THEN
      FOR v_load IN SELECT * FROM jsonb_array_elements(p_loads)
      LOOP
        v_load_value := (v_load->>'value')::DECIMAL;
        IF v_load_value IS NULL THEN
          v_load_value := 0;
        END IF;
        v_gross_pay := v_gross_pay + (v_load_value * p_pay_rule.base_percentage / 100);
      END LOOP;
    END IF;
  END IF;
  
  -- Apply minimum pay guarantee
  IF p_pay_rule.minimum_pay_guarantee IS NOT NULL AND v_gross_pay < p_pay_rule.minimum_pay_guarantee THEN
    v_gross_pay := p_pay_rule.minimum_pay_guarantee;
  END IF;
  
  RETURN v_gross_pay;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Enable RLS
ALTER TABLE public.driver_pay_rules ENABLE ROW LEVEL SECURITY;

-- Step 7: Create RLS policies
DROP POLICY IF EXISTS "Users can view pay rules in their company" ON public.driver_pay_rules;
CREATE POLICY "Users can view pay rules in their company"
  ON public.driver_pay_rules FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert pay rules in their company" ON public.driver_pay_rules;
CREATE POLICY "Users can insert pay rules in their company"
  ON public.driver_pay_rules FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update pay rules in their company" ON public.driver_pay_rules;
CREATE POLICY "Users can update pay rules in their company"
  ON public.driver_pay_rules FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete pay rules in their company" ON public.driver_pay_rules;
CREATE POLICY "Users can delete pay rules in their company"
  ON public.driver_pay_rules FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Step 8: Add comments
COMMENT ON TABLE public.driver_pay_rules IS 
  'Stores complex pay structures for drivers. Supports per mile, percentage, flat rates, bonuses, and deductions.';
COMMENT ON COLUMN public.driver_pay_rules.bonuses IS 
  'JSONB array of bonus rules. Example: [{"type": "hazmat", "amount": 50.00, "description": "Hazmat bonus"}]';
COMMENT ON COLUMN public.driver_pay_rules.deductions IS 
  'JSONB array of deduction rules. Example: [{"type": "fuel", "percentage": 100.00, "description": "100% fuel deduction"}]';
COMMENT ON FUNCTION get_active_pay_rule IS 
  'Returns the active pay rule for a driver on a given date.';
COMMENT ON FUNCTION calculate_gross_pay_from_rule IS 
  'Calculates gross pay based on pay rule and loads. Handles per mile, percentage, flat, and hybrid pay types.';

