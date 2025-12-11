# Cleanup Outdated Supabase Database Objects

## Overview

Just like you deleted outdated SQL files from your codebase:
- ❌ `employee_management_schema.sql` (deleted)
- ❌ `fix_companies_rls.sql` (deleted)  
- ❌ `fix_companies_rls_v2.sql` (deleted)

You may also have outdated database objects (policies, functions, etc.) in your **actual Supabase database** that need cleanup.

---

## Step 1: Check Current Database State

**Run this first to see what exists in your Supabase database:**

1. Go to **Supabase Dashboard** → Your Project → **SQL Editor**
2. Open: `supabase/check_db_consistency.sql`
3. Copy and paste the entire file
4. Click **Run**
5. Review the results to see:
   - ✅ What tables exist
   - ✅ What policies exist
   - ✅ What functions exist
   - ⚠️ Any inconsistencies or duplicates

---

## Step 2: Clean Up Outdated Objects

**After reviewing the check results, clean up outdated objects:**

1. Go to **Supabase Dashboard** → Your Project → **SQL Editor**
2. Open: `supabase/cleanup_outdated_db_objects.sql`
3. **Review the script carefully** - it will DROP policies and functions
4. Copy and paste the entire file
5. Click **Run**

This script will:
- Remove duplicate/outdated policies on `companies` table
- Remove duplicate/outdated policies on `users` table
- Clean up any conflicting objects

---

## Step 3: Re-run Current Schemas (Recommended)

**After cleanup, re-run your current schema files to ensure everything is correct:**

These files are **safe to re-run** because they use `IF NOT EXISTS` and `DROP POLICY IF EXISTS`:

### Run in this order:

1. **`fix_companies_rls_v3.sql`**
   - Ensures companies table has correct policies
   - Creates `create_company_for_user()` function

2. **`fix_users_rls_recursion.sql`**
   - Fixes users table RLS policies
   - Creates `get_user_role_and_company()` function

3. **`employee_management_schema_safe.sql`**
   - Ensures employee management tables and policies are correct
   - Creates `invitation_codes` table if missing
   - Updates users table with `position` and `employee_status` columns

4. **`subscriptions_schema.sql`** (if you use subscriptions)
   - Ensures subscription tables are correct

5. **`eld_schema.sql`** (if you use ELD)
   - Ensures ELD tables are correct

6. **`notifications_schema.sql`** (if you use notifications)
   - Ensures notification preferences table is correct

7. **`load_delivery_points_schema_safe.sql`** (if you use multi-delivery)
   - Ensures load delivery points table is correct

8. **`route_stops_schema_safe.sql`** (if you use multi-stop routes)
   - Ensures route stops table is correct

---

## What Gets Cleaned Up?

### Outdated Policies
- Old `companies` table policies from `fix_companies_rls.sql` or `fix_companies_rls_v2.sql`
- Duplicate policies that might cause conflicts

### Outdated Functions
- Any old company creation functions (replaced by `create_company_for_user`)

---

## Safety Notes

✅ **Safe to run:**
- The cleanup script uses `DROP ... IF EXISTS` so it won't error if objects don't exist
- The schema files use `IF NOT EXISTS` so they won't duplicate objects

⚠️ **Before running:**
- Review the `check_db_consistency.sql` results first
- Make sure you understand what will be dropped
- Consider backing up your database (Supabase has automatic backups)

---

## Quick Checklist

- [ ] Run `check_db_consistency.sql` to see current state
- [ ] Review results and identify what needs cleanup
- [ ] Run `cleanup_outdated_db_objects.sql` to clean up
- [ ] Re-run current schema files (in order listed above)
- [ ] Run `check_db_consistency.sql` again to verify everything is correct
- [ ] Test your application to ensure everything still works

---

## Need Help?

If you see errors or unexpected results:
1. Check the Supabase logs
2. Verify you're running scripts in the correct order
3. Make sure you're in the **production** Supabase project (not dev/local)
