# Fix for "stripe_invoice_id column does not exist" Error

## ✅ Fixed!

I've updated the `supabase/subscriptions_schema.sql` file to handle this error. The issue was that if the `invoices` table already existed (from a previous run), it might not have the `stripe_invoice_id` column.

## 🔧 What I Fixed

The schema now:
1. ✅ Checks if the `invoices` table exists
2. ✅ Checks if the `stripe_invoice_id` column exists
3. ✅ Adds the column if it's missing
4. ✅ Creates the index safely

## 📋 What to Do Now

1. **Copy the updated schema file** (`supabase/subscriptions_schema.sql`)
2. **Go to Supabase SQL Editor**
3. **Paste and run the entire file again**

The schema is now **safe to run multiple times** - it will:
- Create tables if they don't exist
- Add missing columns if tables exist
- Skip creating indexes if columns don't exist yet

## ⚠️ If You Still Get Errors

If you still see errors, you can run this quick fix first:

```sql
-- Quick fix: Add column if missing
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT;

-- Add unique constraint if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'invoices_stripe_invoice_id_key'
  ) THEN
    ALTER TABLE public.invoices 
    ADD CONSTRAINT invoices_stripe_invoice_id_key 
    UNIQUE (stripe_invoice_id);
  END IF;
END $$;

-- Create index
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_invoice_id 
ON public.invoices(stripe_invoice_id);
```

Then run the full schema file again.

