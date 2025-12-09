-- ============================================
-- ADD INSERT POLICY FOR SUBSCRIPTIONS TABLE
-- ============================================
-- This fixes the error: "new row violates row-level security policy for table 'subscriptions'"
-- 
-- WHERE TO RUN THIS:
-- 1. Go to Supabase Dashboard: https://supabase.com/dashboard
-- 2. Select your project
-- 3. Click "SQL Editor" in the left sidebar
-- 4. Click "New query" button
-- 5. Copy and paste ALL the code below
-- 6. Click "Run" button (or press Ctrl+Enter / Cmd+Enter)
-- ============================================

-- Step 1: Drop the policy if it already exists (to avoid conflicts)
DROP POLICY IF EXISTS "Managers can insert subscriptions for their company" ON public.subscriptions;

-- Step 2: Create the INSERT policy
-- This allows managers to create subscriptions (for free trial)
CREATE POLICY "Managers can insert subscriptions for their company"
  ON public.subscriptions FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id 
      FROM public.users 
      WHERE id = auth.uid() 
      AND role = 'manager'
    )
  );

-- ============================================
-- DONE! 
-- ============================================
-- After running this, try clicking "Start Free Trial" again.
-- It should work now! ✅
-- ============================================

