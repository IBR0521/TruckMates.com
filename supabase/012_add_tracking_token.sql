-- Add public_tracking_token field to loads table for secure public tracking
-- This prevents enumeration attacks by requiring a token to view load details

ALTER TABLE public.loads
ADD COLUMN IF NOT EXISTS public_tracking_token TEXT UNIQUE;

-- Create index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_loads_tracking_token ON public.loads(public_tracking_token) WHERE public_tracking_token IS NOT NULL;

-- Generate tokens for existing loads (optional - can be done on-demand)
-- UPDATE public.loads SET public_tracking_token = encode(gen_random_bytes(32), 'hex') WHERE public_tracking_token IS NULL;

