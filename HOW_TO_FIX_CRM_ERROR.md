# How to Fix the CRM Schema Error

## The Problem
You're getting this error: `ERROR: 42703: column "status" does not exist`

This happens because the `customers` and/or `vendors` tables already exist (from a previous partial run), but they don't have the `status` column yet.

## The Solution

### Option 1: Complete Fix (Recommended)
1. **Run the complete fix script first:**
   - Open `FIX_CRM_SCHEMA_COMPLETE.sql` in your project (I just created this)
   - Copy ALL contents
   - Paste into Supabase SQL Editor
   - Click "Run"
   - This will add ALL missing columns (status, customer_type, vendor_type, priority, etc.)

2. **Then run the main CRM schema:**
   - Open `supabase/crm_schema.sql` (the original file)
   - Copy ALL contents
   - Paste into Supabase SQL Editor (new query)
   - Click "Run"

### Option 2: Use the Fixed Version
1. **Use the fixed schema instead:**
   - Open `supabase/crm_schema_fixed.sql` in your project
   - Copy ALL contents
   - Paste into Supabase SQL Editor
   - Click "Run"

The fixed version automatically adds the missing columns before creating indexes.

### Option 3: Drop and Recreate (If you have no data)
If you don't have any data in customers/vendors tables yet, you can drop them and start fresh:

```sql
-- WARNING: This will delete all data!
DROP TABLE IF EXISTS public.contact_history CASCADE;
DROP TABLE IF EXISTS public.contacts CASCADE;
DROP TABLE IF EXISTS public.vendors CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
```

Then run `supabase/crm_schema.sql` normally.

---

## Recommended Steps

1. **Run `FIX_CRM_SCHEMA.sql`** first (this adds missing columns)
2. **Run `supabase/crm_schema.sql`** (the main schema)
3. **Run `supabase/bol_schema.sql`** (BOL schema)

This should resolve the error! ✅

