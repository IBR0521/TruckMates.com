# Audit Logs Fix - RLS Policy Issue

## Problem
History is not being tracked because the `audit_logs` table has RLS enabled but **no INSERT policy**, so inserts are being blocked.

## Solution

### Step 1: Update the RLS Policy

The schema file has been updated. You need to run this SQL in Supabase:

```sql
-- Allow authenticated users to insert audit logs for their own company
CREATE POLICY "Users can insert audit logs for their company"
  ON public.audit_logs FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
    AND user_id = auth.uid()
  );
```

### Step 2: Or Run the Complete Updated Schema

Run the entire updated `supabase/audit_logs_schema.sql` file which now includes the INSERT policy.

### Step 3: Verify It Works

1. Edit a driver field (name, status, etc.)
2. Open browser console (F12)
3. Look for: `[AUDIT LOG] ✅ Successfully created audit log:`
4. If you see errors, check the error message:
   - `42P01` = Table doesn't exist
   - `42501` = Permission denied (RLS policy issue)

### Step 4: Test History View

1. Click the History icon (clock) next to a driver
2. You should see the change history

## Quick Fix SQL

If you just want to add the INSERT policy without re-running everything:

```sql
-- Drop existing policy if it exists (optional)
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
```

## Debugging

Check browser console for these messages:
- ✅ `[AUDIT LOG] ✅ Successfully created audit log:` = Working!
- ❌ `[AUDIT LOG] ⚠️ RLS policy blocking insert!` = Need to add INSERT policy
- ❌ `[AUDIT LOG] ⚠️ audit_logs table does not exist!` = Need to create table first

