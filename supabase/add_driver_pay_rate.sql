-- Add pay_rate field to drivers table for automatic settlement calculations
ALTER TABLE public.drivers
ADD COLUMN IF NOT EXISTS pay_rate DECIMAL(10, 2) DEFAULT NULL;

COMMENT ON COLUMN public.drivers.pay_rate IS 'Driver pay rate per load or per mile (used for automatic settlement calculations)';
