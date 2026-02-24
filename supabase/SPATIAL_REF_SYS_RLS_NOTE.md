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

### Option 1: Try the Actual Fix Script (Try This First)

Run `supabase/fix_spatial_ref_sys_rls_actual.sql` which attempts multiple methods:
1. Moves the table to `postgis` schema (removes it from public schema)
2. If that fails, creates a view in `postgis` schema
3. As a last resort, tries to enable RLS directly

**Note**: Moving the table requires appropriate permissions. If it fails, you'll need to contact Supabase support.

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

## Conclusion

**For most users**: This warning can be safely ignored. The `spatial_ref_sys` table is a PostGIS system table with read-only reference data that poses no security risk.

If the warning bothers you, contact Supabase support to have PostGIS system tables moved to a different schema.

