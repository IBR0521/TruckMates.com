# spatial_ref_sys RLS Warning - Resolution

## The Issue

Supabase's security scanner flags the `spatial_ref_sys` table because it's in the `public` schema without Row Level Security (RLS) enabled.

## Why We Can't Fix It Directly

The `spatial_ref_sys` table is:
- Owned by the PostGIS extension (not by your user)
- A system table that cannot be modified by regular users
- Required for PostGIS to function properly

When you try to enable RLS on it, you'll get:
```
ERROR: 42501: must be owner of table spatial_ref_sys
```

## Solutions

### Option 1: Restrict Access (Recommended - Use This!)

Run `supabase/fix_spatial_ref_sys_rls_final.sql` which:
1. **Revokes access from PostgREST roles** (anon/authenticated) - This prevents API access
2. Creates an optional view with limited SRIDs if clients need spatial reference data
3. This is the safest approach since we can't alter the PostGIS-owned table

**This is the preferred solution** because:
- We don't need to alter the system table
- We simply restrict who can access it via the API
- PostGIS functions still work (they use postgres role)
- The security warning will be resolved

### Option 2: Try Moving the Table (Alternative)

Run `supabase/fix_spatial_ref_sys_rls_actual.sql` which attempts to:
1. Move the table to `postgis` schema (removes it from public schema)
2. If that fails, creates a view in `postgis` schema
3. As a last resort, tries to enable RLS directly

**Note**: Moving the table requires appropriate permissions. If it fails, use Option 1 instead.

### Option 2: Safely Ignore the Warning (If Fix Doesn't Work)

This warning can be **safely ignored** because:
- `spatial_ref_sys` contains only read-only reference data (spatial reference system definitions)
- It does not contain any sensitive user data
- It's a system table required for PostGIS functionality
- The data is public reference information (like coordinate system definitions)

**Action**: No action needed. The warning is informational and does not pose a security risk.

### Option 2: Contact Supabase Support

If you want to resolve the warning, contact Supabase support to:
1. Move PostGIS system tables (`spatial_ref_sys`, `geometry_columns`, etc.) to a non-public schema (like `postgis`)
2. Add an exception for PostGIS system tables in their security scanner

### Option 3: Use a Different Schema (Advanced)

If you have superuser access (unlikely in Supabase managed instances), you could:
```sql
-- Move to postgis schema (requires superuser)
ALTER TABLE public.spatial_ref_sys SET SCHEMA postgis;
```

## Verification

To check if the table exists and its current schema:
```sql
SELECT schemaname, tablename, tableowner 
FROM pg_tables 
WHERE tablename = 'spatial_ref_sys';
```

## Important: Warning May Persist

**Even after running the fix script, the warning may still appear.** This is expected and can be safely ignored because:

1. **Access is revoked**: The table is NOT accessible via PostgREST API (anon/authenticated roles have no privileges)
2. **RLS cannot be enabled**: We cannot enable RLS because the table is owned by PostGIS extension
3. **Scanner limitation**: The security scanner checks for RLS but doesn't verify revoked privileges
4. **Table is secure**: Even though RLS isn't enabled, the table is protected because API roles can't access it

## Conclusion

**The warning is a false positive after revoking access.** The table is secure because:
- ✅ No API access (privileges revoked from anon/authenticated)
- ✅ Only postgres role can access (for PostGIS functions)
- ✅ Contains only read-only reference data (no sensitive information)

**To fully remove the warning**, you would need to contact Supabase support to:
- Move PostGIS system tables to a non-public schema, OR
- Add an exception for PostGIS system tables in their security scanner

**For practical purposes**: The warning can be safely ignored - your database is secure.

