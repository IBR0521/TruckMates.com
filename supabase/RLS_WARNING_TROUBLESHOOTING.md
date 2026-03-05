# RLS Performance Warnings - Troubleshooting Guide

## Why Warnings Might Still Appear

Even after running the migration files, warnings may persist for several reasons:

### 1. **Supabase Linter Cache**
The Supabase linter caches warnings. It may take time to refresh, or you may need to manually refresh it.

**Solution:**
- Wait 5-10 minutes after running migrations
- Go to Database → Linter in Supabase dashboard
- Click "Refresh" or reload the page
- Run the `refresh_supabase_linter.sql` query to force a schema reload

### 2. **Policies in Original Schema Files**
The linter might be checking your original schema files (`.sql` files) rather than the actual database state.

**Solution:**
- The linter should check the database, not files
- Verify policies were actually applied by running `verify_rls_fixes.sql`
- Check that helper functions exist: `get_user_company_id()` and `is_user_manager()`

### 3. **Policies Not Covered in Migration**
Some tables might have policies created in other schema files that weren't included in the migration.

**Solution:**
- Run `find_all_problematic_policies.sql` to identify which policies still need fixing
- Check the results and manually fix any remaining policies
- Or create additional migration files for those tables

### 4. **Migration Not Applied Correctly**
The migration might have failed partway through, or some policies weren't dropped/recreated.

**Solution:**
- Check for any errors in the SQL Editor when running migrations
- Verify policies exist by running: `SELECT * FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;`
- Re-run the migrations (they're safe to run multiple times)

## Step-by-Step Troubleshooting

### Step 1: Verify Helper Functions Exist
```sql
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname IN ('get_user_company_id', 'is_user_manager');
```

If they don't exist, re-run the beginning of `fix_rls_performance.sql` (the helper function creation section).

### Step 2: Check Which Policies Are Still Problematic
Run `find_all_problematic_policies.sql` to see:
- Policies still using `auth.uid()` directly
- Policies using `company_id IN (SELECT...)` pattern
- Tables with multiple permissive policies

### Step 3: Verify Policies Were Applied
Run `verify_rls_fixes.sql` to check:
- If helper functions exist
- Which policies are using optimized patterns
- Which policies still need optimization

### Step 4: Refresh Linter Cache
1. Run `refresh_supabase_linter.sql`
2. Wait a few minutes
3. Go to Database → Linter in Supabase dashboard
4. Click refresh or reload the page

### Step 5: Check for Other Schema Files
If warnings persist, check if there are policies in other schema files that weren't covered:
- Look for `CREATE POLICY` statements in other `.sql` files
- Check if those tables were included in the migration
- Create additional fixes for any missing tables

## Common Issues

### Issue: "Helper functions don't exist"
**Fix:** Re-run the helper function creation section from `fix_rls_performance.sql`:
```sql
CREATE OR REPLACE FUNCTION get_user_company_id() ...
CREATE OR REPLACE FUNCTION is_user_manager() ...
```

### Issue: "Policies still using old pattern"
**Fix:** Check if the DROP POLICY statements succeeded. Some policies might have different names. Run:
```sql
SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename = 'your_table_name';
```

### Issue: "Multiple policies for same table"
**Fix:** Some tables intentionally have multiple policies (e.g., public access + authenticated access). These warnings are expected and can be ignored if the policies serve different purposes.

## Expected Results

After successful migration:
- ✅ Helper functions `get_user_company_id()` and `is_user_manager()` exist
- ✅ Most policies use `(select auth.uid())` or helper functions
- ✅ Most `auth_rls_initplan` warnings should be resolved
- ✅ Some `multiple_permissive_policies` warnings may remain (if policies serve different purposes)

## Still Having Issues?

If warnings persist after following these steps:
1. Share the output of `find_all_problematic_policies.sql`
2. Share the specific warning messages from Supabase linter
3. Check which tables are still showing warnings
4. We can create targeted fixes for those specific tables










