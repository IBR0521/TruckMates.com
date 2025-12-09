# Fix for "new row violates row-level security policy" Error

## ✅ Fixed!

I've added the missing **INSERT policy** for the `subscriptions` table. The error occurred because RLS was blocking inserts.

## 🔧 What I Fixed

Added this policy to allow managers to create subscriptions:

```sql
CREATE POLICY "Managers can insert subscriptions for their company"
  ON public.subscriptions FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'manager'
    )
  );
```

## 📋 What to Do Now

### Option 1: Run Just the Policy (Quick Fix)

1. Go to **Supabase SQL Editor**
2. Copy and paste this:

```sql
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
```

3. Click **Run**

### Option 2: Run Updated Full Schema

1. Copy the updated `supabase/subscriptions_schema.sql` file
2. Go to **Supabase SQL Editor**
3. Paste and run the entire file

The updated schema now includes the INSERT policy.

## ✅ After Running

Try clicking **"Start Free Trial"** again - it should work now!

---

## 🔍 Why This Happened

Row Level Security (RLS) was enabled on the `subscriptions` table, but there was no policy allowing INSERT operations. Only SELECT and UPDATE policies existed, so inserts were blocked.

The new policy allows:
- ✅ Managers to create subscriptions for their company
- ✅ Only for the company they belong to
- ✅ Only if they have the 'manager' role

