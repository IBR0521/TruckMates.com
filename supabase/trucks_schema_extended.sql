-- Extended Trucks Schema to match TruckLogics
-- Add missing fields to trucks table

ALTER TABLE public.trucks 
ADD COLUMN IF NOT EXISTS height TEXT,
ADD COLUMN IF NOT EXISTS serial_number TEXT,
ADD COLUMN IF NOT EXISTS gross_vehicle_weight INTEGER, -- GVW in pounds
ADD COLUMN IF NOT EXISTS license_expiry_date DATE,
ADD COLUMN IF NOT EXISTS inspection_date DATE,
ADD COLUMN IF NOT EXISTS insurance_provider TEXT,
ADD COLUMN IF NOT EXISTS insurance_policy_number TEXT,
ADD COLUMN IF NOT EXISTS insurance_expiry_date DATE,
ADD COLUMN IF NOT EXISTS owner_name TEXT,
ADD COLUMN IF NOT EXISTS cost DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS color TEXT,
ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'::jsonb; -- Array of document URLs/metadata

-- Add index for common queries
CREATE INDEX IF NOT EXISTS idx_trucks_status ON public.trucks(status);
CREATE INDEX IF NOT EXISTS idx_trucks_license_expiry ON public.trucks(license_expiry_date);
CREATE INDEX IF NOT EXISTS idx_trucks_inspection_date ON public.trucks(inspection_date);
CREATE INDEX IF NOT EXISTS idx_trucks_insurance_expiry ON public.trucks(insurance_expiry_date);

