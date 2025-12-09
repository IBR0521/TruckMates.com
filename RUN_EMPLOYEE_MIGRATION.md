# How to Run Employee Management Migration

## ⚠️ If the migration failed, use this safe version:

### Step 1: Open Supabase SQL Editor
1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **"SQL Editor"** in left sidebar
4. Click **"New query"**

### Step 2: Run the Safe Migration
1. Open the file: `supabase/employee_management_schema_safe.sql`
2. **Copy ALL the SQL code** (entire file)
3. **Paste** into Supabase SQL Editor
4. Click **"Run"** (or press Cmd/Ctrl + Enter)

### Step 3: Check for Success
- You should see: **"Success. No rows returned"** or similar
- If you see errors, copy the error message and let me know

---

## 🔍 Common Issues & Solutions

### Issue 1: "relation already exists"
**Solution:** The safe migration uses `IF NOT EXISTS` and `DROP IF EXISTS`, so this shouldn't happen. If it does, the table might already be partially created.

### Issue 2: "function does not exist"
**Solution:** The safe migration creates the `update_updated_at_column` function if it doesn't exist.

### Issue 3: "policy already exists"
**Solution:** The safe migration drops all policies first before creating them.

### Issue 4: "permission denied"
**Solution:** Make sure you're running this in the Supabase SQL Editor (not through the API). The SQL Editor has full permissions.

---

## ✅ After Migration Succeeds

1. **Verify the table exists:**
   - Go to **Table Editor** in Supabase
   - You should see `invitation_codes` table

2. **Test the system:**
   - Go to `/dashboard/employees` (as a manager)
   - Try adding an employee
   - It should work now!

---

## 🆘 Still Having Issues?

If the migration still fails:
1. **Copy the exact error message** from Supabase
2. **Share it with me** and I'll help fix it
3. Or try running it in **smaller chunks** (I can break it down if needed)

