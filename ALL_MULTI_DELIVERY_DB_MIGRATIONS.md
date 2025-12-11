# All Multi-Load/Destination Database Migrations

## 📋 Complete List of SQL Files to Run in Supabase

Run these files **in order** in the Supabase SQL Editor:

---

## 1️⃣ Route Stops Migration (Multi-Stop Routes)

**File:** `supabase/route_stops_schema_safe.sql`

**What it does:**
- Creates `route_stops` table for multiple stops per route
- Adds depot and timing fields to `routes` table
- Sets up RLS policies and indexes

**Run this first** if you want multi-stop routes.

---

## 2️⃣ Load Delivery Points Migration (Multi-Delivery Loads)

**File:** `supabase/load_delivery_points_schema_safe.sql`

**What it does:**
- Creates `load_delivery_points` table for multiple delivery points per load
- Adds delivery type and company fields to `loads` table
- Sets up RLS policies and indexes

**Run this second** if you want multi-delivery loads.

---

## 🚀 Quick Start Guide

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase project dashboard
2. Click "SQL Editor" in the left sidebar
3. Click "New Query"

### Step 2: Run Route Stops Migration
1. Open file: `supabase/route_stops_schema_safe.sql`
2. Copy **ALL** the SQL code
3. Paste into Supabase SQL Editor
4. Click "Run" (or press Ctrl+Enter / Cmd+Enter)
5. Wait for "Success" message

### Step 3: Run Load Delivery Points Migration
1. Open file: `supabase/load_delivery_points_schema_safe.sql`
2. Copy **ALL** the SQL code
3. Paste into Supabase SQL Editor
4. Click "Run" (or press Ctrl+Enter / Cmd+Enter)
5. Wait for "Success" message

---

## ✅ Verification

After running both migrations, verify:

1. **Tables created:**
   - `route_stops` table exists
   - `load_delivery_points` table exists

2. **Columns added:**
   - `routes` table has: `depot_name`, `depot_address`, `pre_route_time_minutes`, etc.
   - `loads` table has: `delivery_type`, `company_name`, `total_delivery_points`, etc.

3. **Test in app:**
   - Create a route with multiple stops
   - Create a load with multiple delivery points

---

## 📁 File Locations

All files are in the `supabase/` folder:

- ✅ `supabase/route_stops_schema_safe.sql` - Multi-stop routes
- ✅ `supabase/load_delivery_points_schema_safe.sql` - Multi-delivery loads

---

## ⚠️ Important Notes

- Run the `_safe.sql` versions (they handle existing objects)
- Don't run TypeScript files (`.tsx`, `.ts`) in SQL Editor
- You can run these migrations multiple times safely
- If you get errors, check that you copied the entire file content

