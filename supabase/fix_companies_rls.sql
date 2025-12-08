-- Fix RLS policies for companies table to allow registration
-- Run this in Supabase SQL Editor if you're getting "new row violates row-level security policy" error

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;
DROP POLICY IF EXISTS "Managers can update their company" ON public.companies;

-- Allow authenticated users to create companies (for registration)
CREATE POLICY "Authenticated users can create companies"
  ON public.companies FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Allow managers to update their company
CREATE POLICY "Managers can update their company"
  ON public.companies FOR UPDATE
  USING (
    id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

