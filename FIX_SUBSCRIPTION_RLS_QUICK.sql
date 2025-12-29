-- Quick Fix: Add INSERT policy for subscriptions table
-- Run this in Supabase SQL Editor if you get RLS policy violation error

-- Drop existing policy if it exists (to avoid conflicts)
DROP POLICY IF EXISTS "Managers can insert subscriptions for their company" ON public.subscriptions;

-- Create INSERT policy for subscriptions
CREATE POLICY "Managers can insert subscriptions for their company"
  ON public.subscriptions FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'manager'
    )
  );

