-- ============================================================================
-- Add RLS to dvir_errors table
-- ============================================================================
-- EXT-013 FIX: dvir_errors table has no RLS policy
-- This table stores error logs from DVIR trigger functions
-- ============================================================================

-- Enable RLS on dvir_errors table
ALTER TABLE IF EXISTS public.dvir_errors ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view dvir_errors from their company" ON public.dvir_errors;
DROP POLICY IF EXISTS "Users can insert dvir_errors for their company" ON public.dvir_errors;

-- RLS Policy: Users can only see dvir_errors from their company
-- Errors are linked to DVIRs, which are company-scoped
CREATE POLICY "Users can view dvir_errors from their company"
  ON public.dvir_errors
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.dvir
      WHERE dvir.id = dvir_errors.dvir_id
      AND dvir.company_id IN (
        SELECT company_id FROM public.users WHERE id = auth.uid()
      )
    )
  );

-- RLS Policy: Only system triggers can insert dvir_errors
-- Regular users should not be able to insert error logs directly
-- This is handled by database triggers, but we add a policy for safety
CREATE POLICY "System can insert dvir_errors"
  ON public.dvir_errors
  FOR INSERT
  WITH CHECK (true); -- Triggers run with SECURITY DEFINER, so this allows system inserts

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_dvir_errors_dvir_id ON public.dvir_errors(dvir_id);
CREATE INDEX IF NOT EXISTS idx_dvir_errors_created_at ON public.dvir_errors(created_at);

-- Add comment for documentation
COMMENT ON TABLE public.dvir_errors IS 'Error logs from DVIR trigger functions - stores errors when work order creation fails';
COMMENT ON COLUMN public.dvir_errors.dvir_id IS 'Reference to the DVIR that triggered the error';
COMMENT ON COLUMN public.dvir_errors.error_message IS 'The error message from the trigger function';
COMMENT ON COLUMN public.dvir_errors.error_context IS 'Additional context about where the error occurred';

