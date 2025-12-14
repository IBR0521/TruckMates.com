# Fix Demo RLS Error - Database Setup Required

## ⚠️ Error: "new row violates row-level security policy for table \"companies\""

This error occurs because the `create_company_for_user` RPC function might not exist in your Supabase database.

---

## ✅ Solution: Run SQL Script in Supabase

### Step 1: Go to Supabase Dashboard
1. Open [supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **SQL Editor**

### Step 2: Run This SQL Script

Copy and paste this entire script into the SQL Editor:

```sql
-- Create a function that can create companies with elevated privileges (bypasses RLS)
CREATE OR REPLACE FUNCTION public.create_company_for_user(
  p_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  -- Insert company (bypasses RLS because of SECURITY DEFINER)
  INSERT INTO public.companies (name, email, phone)
  VALUES (p_name, p_email, p_phone)
  RETURNING id INTO v_company_id;

  -- Update user record to link to company
  UPDATE public.users
  SET 
    company_id = v_company_id,
    role = 'manager',
    full_name = p_name,
    phone = p_phone
  WHERE id = p_user_id;

  RETURN v_company_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_company_for_user TO authenticated;

-- Also create the regular policies (as backup)
CREATE POLICY IF NOT EXISTS "Authenticated users can create companies"
  ON public.companies FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY IF NOT EXISTS "Managers can update their company"
  ON public.companies FOR UPDATE
  USING (
    id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() AND role = 'manager'
    )
  );
```

### Step 3: Click "Run" to Execute

---

## ✅ After Running the Script

1. **Try the demo again:**
   - Go to `http://localhost:3000`
   - Click "Try Demo for Free"
   - Should work now!

2. **If it still fails:**
   - Check the browser console for error messages
   - Check terminal output for server errors
   - Verify the function was created:
     ```sql
     SELECT routine_name 
     FROM information_schema.routines 
     WHERE routine_schema = 'public' 
       AND routine_name = 'create_company_for_user';
     ```

---

## 🔍 What This Does

The `create_company_for_user` function:
- Uses `SECURITY DEFINER` to bypass RLS policies
- Creates the company record
- Links the user to the company
- Sets user role to "manager"
- Returns the company ID

This is the same function used in the regular registration flow, so it's safe and tested.

---

## 📝 Alternative: If RPC Function Still Doesn't Work

If the RPC function doesn't work, you can temporarily disable RLS for the demo:

```sql
-- TEMPORARY: Allow authenticated users to insert companies
ALTER TABLE public.companies DISABLE ROW LEVEL SECURITY;

-- Then re-enable after testing:
-- ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
```

**But the RPC function is the recommended solution!**
