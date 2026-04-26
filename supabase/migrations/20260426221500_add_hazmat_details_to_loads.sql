-- Add HAZMAT-specific details to loads
ALTER TABLE public.loads
  ADD COLUMN IF NOT EXISTS un_number TEXT,
  ADD COLUMN IF NOT EXISTS hazard_class TEXT,
  ADD COLUMN IF NOT EXISTS packing_group TEXT,
  ADD COLUMN IF NOT EXISTS proper_shipping_name TEXT,
  ADD COLUMN IF NOT EXISTS placard_required BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS emergency_contact TEXT;

CREATE INDEX IF NOT EXISTS idx_loads_company_hazmat
  ON public.loads (company_id, is_hazardous);
