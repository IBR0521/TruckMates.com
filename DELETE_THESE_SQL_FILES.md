# SQL Files to Delete - Authentication Related

## Files to DELETE (Authentication/User/Company Related)

These files contain old authentication logic that conflicts with the new clean system:

1. **`supabase/fix_companies_rls_v3.sql`**
   - Creates `create_company_for_user` function
   - Old RLS policy fixes
   - **DELETE THIS**

2. **`supabase/fix_company_function_overload.sql`**
   - Modifies `create_company_for_user` function
   - **DELETE THIS**

3. **`supabase/fix_users_rls_recursion.sql`**
   - Old RLS policy fixes for users table
   - Creates `get_user_role_and_company` function
   - **DELETE THIS**

4. **`supabase/find_tables_missing_company_id.sql`**
   - Analysis script (can delete if not needed)
   - **OPTIONAL - DELETE**

5. **`supabase/fix_crm_views_company_id.sql`**
   - CRM views fix (not auth-related, but check if needed)
   - **KEEP - Not auth-related**

## Files to KEEP

- **`supabase/schema.sql`** - Main schema (has base users/companies tables - we'll update it)
- **`supabase/auth_schema.sql`** - NEW clean authentication schema (keep this!)
- All other feature-specific SQL files (ELD, CRM, marketplace, etc.)

## Action Plan

1. Delete the 3-4 files listed above
2. Run `supabase/auth_schema.sql` in Supabase SQL Editor
3. The new schema will create/update users and companies tables cleanly

