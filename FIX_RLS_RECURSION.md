# Fix: Infinite Recursion in Users RLS Policies

## The Problem

The RLS policies on the `users` table are causing infinite recursion because:
- To check if a user is a manager, the policy queries the `users` table
- But to query the `users` table, it needs to pass RLS policies
- Which then queries the `users` table again... creating infinite recursion

## The Solution

We'll use a `SECURITY DEFINER` function to bypass RLS when checking user roles, breaking the circular dependency.

---

## How to Fix

### Step 1: Run the Fix SQL

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Click **"New query"**
3. Open the file: `supabase/fix_users_rls_recursion.sql`
4. **Copy ALL the SQL code**
5. **Paste** into Supabase SQL Editor
6. Click **"Run"**

### Step 2: Verify It Works

1. **Refresh your browser** (hard refresh: Ctrl+Shift+R or Cmd+Shift+R)
2. The Employees link should now appear in the sidebar
3. You should be able to access `/dashboard/employees`

---

## What This Fix Does

1. **Drops all existing policies** on the `users` table
2. **Creates a SECURITY DEFINER function** (`get_user_role_and_company`) that bypasses RLS
3. **Recreates all policies** using this function to avoid recursion
4. **Maintains all security** - only managers can view/update/delete employees

---

## After Running the Fix

- ✅ No more infinite recursion errors
- ✅ Employees link appears in sidebar (for managers)
- ✅ Employee management page works
- ✅ All security policies still enforced

---

## If You Still See Errors

1. **Clear browser cache** completely
2. **Restart your dev server**:
   ```bash
   # Stop server (Ctrl+C)
   npm run dev
   ```
3. **Check browser console** for any remaining errors
4. **Verify your role** in Supabase Table Editor (should be `manager`)

---

**Run the SQL fix now and the Employees section should appear!** 🚀

