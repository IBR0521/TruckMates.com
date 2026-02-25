-- Fix RLS Policies for ifta_reports table
-- This ensures all authenticated users in a company can create IFTA reports

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users can view IFTA reports in their company" ON public.ifta_reports;
DROP POLICY IF EXISTS "Users can insert IFTA reports in their company" ON public.ifta_reports;
DROP POLICY IF EXISTS "Users can update IFTA reports in their company" ON public.ifta_reports;
DROP POLICY IF EXISTS "Users can delete IFTA reports in their company" ON public.ifta_reports;
DROP POLICY IF EXISTS "Managers can manage IFTA reports" ON public.ifta_reports;

-- Enable RLS (in case it's not enabled)
ALTER TABLE public.ifta_reports ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view IFTA reports in their company
CREATE POLICY "Users can view IFTA reports in their company"
  ON public.ifta_reports
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Policy: Users can insert IFTA reports in their company
-- This is the key policy that was causing the error
CREATE POLICY "Users can insert IFTA reports in their company"
  ON public.ifta_reports
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Policy: Users can update IFTA reports in their company
CREATE POLICY "Users can update IFTA reports in their company"
  ON public.ifta_reports
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Policy: Users can delete IFTA reports in their company
CREATE POLICY "Users can delete IFTA reports in their company"
  ON public.ifta_reports
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ifta_reports TO authenticated;


