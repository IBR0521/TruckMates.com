-- Extended Drivers Schema to match TruckLogics
-- Add missing fields for comprehensive driver management

ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS driver_id TEXT, -- Internal driver ID/employee number
ADD COLUMN IF NOT EXISTS employee_type TEXT DEFAULT 'employee', -- 'employee', 'contractor', 'owner_operator'
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS zip TEXT,
ADD COLUMN IF NOT EXISTS license_state TEXT,
ADD COLUMN IF NOT EXISTS license_type TEXT DEFAULT 'class_a', -- 'class_a', 'class_b', 'class_c'
ADD COLUMN IF NOT EXISTS license_endorsements TEXT, -- Comma-separated list of endorsements
ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_relationship TEXT,
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS hire_date DATE,
ADD COLUMN IF NOT EXISTS pay_rate_type TEXT DEFAULT 'per_mile', -- 'per_mile', 'per_hour', 'percentage', 'flat'
ADD COLUMN IF NOT EXISTS pay_rate DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS custom_fields JSONB; -- Flexible custom fields

