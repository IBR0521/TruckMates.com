# How to Run Multi-Delivery Database Migrations

## ⚠️ IMPORTANT: Use the SAFE versions!

I've created **safe versions** of the SQL files that handle existing objects and avoid conflicts.

## ✅ Files to Run (in order):

### 1. Route Stops Migration
**File:** `supabase/route_stops_schema_safe.sql`

**Steps:**
1. Open Supabase Dashboard → SQL Editor
2. Copy ALL content from `supabase/route_stops_schema_safe.sql`
3. Paste into SQL Editor
4. Click "Run"

### 2. Load Delivery Points Migration
**File:** `supabase/load_delivery_points_schema_safe.sql`

**Steps:**
1. Open Supabase Dashboard → SQL Editor
2. Copy ALL content from `supabase/load_delivery_points_schema_safe.sql`
3. Paste into SQL Editor
4. Click "Run"

## 🔍 What the Safe Versions Do:

- ✅ Use `IF NOT EXISTS` to avoid errors if tables/columns already exist
- ✅ Drop indexes/policies/functions before creating (avoids conflicts)
- ✅ Handle existing objects gracefully
- ✅ Can be run multiple times safely

## ❌ What NOT to Do:

- ❌ Don't run the TypeScript files (`.tsx`, `.ts`)
- ❌ Don't run the original files if you get errors (use the `_safe.sql` versions)
- ❌ Don't copy from the component files

## 📁 Correct Files:

✅ **Route Stops:** `supabase/route_stops_schema_safe.sql`
✅ **Load Delivery Points:** `supabase/load_delivery_points_schema_safe.sql`

## 🎯 After Running:

1. Verify tables were created:
   - `route_stops` table should exist
   - `load_delivery_points` table should exist

2. Check columns were added:
   - `routes` table should have new columns (depot_name, etc.)
   - `loads` table should have new columns (delivery_type, etc.)

3. Test the features:
   - Try creating a route with multiple stops
   - Try creating a load with multiple delivery points

