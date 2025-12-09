# Debug: Employees Link Not Showing

## Quick Checks

### 1. Check Your User Role in Database

1. Go to **Supabase Dashboard** → **Table Editor**
2. Open the `users` table
3. Find your user record
4. Check the `role` column - it should say `"manager"` (exact match, case-sensitive)

### 2. Verify RLS Policies

The migration should have created these policies. To verify:

1. Go to **Supabase Dashboard** → **Authentication** → **Policies**
2. Click on `users` table
3. You should see:
   - "Users can view their own profile"
   - "Managers can view employees in their company"

### 3. Test in Browser Console

1. Open your app in browser
2. Open Developer Tools (F12)
3. Go to Console tab
4. Check for any errors related to "getCurrentUser" or "role"

### 4. Hard Refresh

1. Press `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
2. This clears cache and reloads everything

---

## If Role is Not "manager"

If your role is something else (like `"user"` or `null`):

1. Go to **Supabase Dashboard** → **Table Editor**
2. Open `users` table
3. Find your user record
4. Click **Edit**
5. Change `role` to: `manager` (exact spelling, lowercase)
6. Click **Save**

---

## If Still Not Working

Try accessing the page directly:
- Go to: `http://localhost:3000/dashboard/employees` (or your domain)
- If it redirects you, the page is checking role correctly
- If it shows an error, check the error message

---

## Quick Fix SQL

If you need to set your role to manager manually:

```sql
-- Replace 'your-email@example.com' with your actual email
UPDATE public.users 
SET role = 'manager' 
WHERE email = 'your-email@example.com';
```

Run this in Supabase SQL Editor.

