-- Quick Fix: Add INSERT Policy for Audit Logs
-- Run this if you already have the audit_logs table and SELECT policy

-- Drop existing INSERT policy if it exists (to allow re-running)
DROP POLICY IF EXISTS "Users can insert audit logs for their company" ON public.audit_logs;

-- Create INSERT policy
CREATE POLICY "Users can insert audit logs for their company"
  ON public.audit_logs FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
    AND user_id = auth.uid()
  );

