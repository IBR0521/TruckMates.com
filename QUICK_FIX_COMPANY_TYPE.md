# Quick Fix: Company Type Column

## The Issue
The `create_company_for_user` function is trying to use a `company_type` column that doesn't exist in your `companies` table.

## Solution Options

### Option 1: Run the SQL to add the column (Recommended)
Run this SQL in your Supabase SQL Editor:

```sql
-- Add company_type column if it doesn't exist
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS company_type TEXT DEFAULT NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_companies_company_type ON public.companies(company_type);

-- Add check constraint
ALTER TABLE public.companies
DROP CONSTRAINT IF EXISTS companies_company_type_check;

ALTER TABLE public.companies
ADD CONSTRAINT companies_company_type_check 
CHECK (company_type IS NULL OR company_type IN ('broker', 'carrier', 'both'));
```

### Option 2: The function will now work without the column
I've updated the function to check if the column exists before using it. So it will work either way!

## After Running the SQL
1. The demo setup should work immediately
2. No need to restart the server
3. Try the demo again













