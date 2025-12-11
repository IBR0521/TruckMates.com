# Complete Database Migration Checklist

## 🎯 All SQL Files You Need to Run in Supabase

### For Multi-Stop Routes & Multi-Delivery Loads:

#### ✅ File 1: Route Stops
**Location:** `supabase/route_stops_schema_safe.sql`
**Purpose:** Enables multiple stops per route
**Tables Created:** `route_stops`
**Tables Modified:** `routes` (adds depot and timing fields)

#### ✅ File 2: Load Delivery Points  
**Location:** `supabase/load_delivery_points_schema_safe.sql`
**Purpose:** Enables multiple delivery points per load
**Tables Created:** `load_delivery_points`
**Tables Modified:** `loads` (adds delivery_type, company_name, etc.)

---

## 📝 Step-by-Step Instructions

### 1. Route Stops Migration

1. Open: `supabase/route_stops_schema_safe.sql`
2. Select ALL content (Ctrl+A / Cmd+A)
3. Copy (Ctrl+C / Cmd+C)
4. Go to Supabase Dashboard → SQL Editor
5. Paste into SQL Editor
6. Click "Run" button
7. Wait for success message

### 2. Load Delivery Points Migration

1. Open: `supabase/load_delivery_points_schema_safe.sql`
2. Select ALL content (Ctrl+A / Cmd+A)
3. Copy (Ctrl+C / Cmd+C)
4. Go to Supabase Dashboard → SQL Editor
5. Paste into SQL Editor
6. Click "Run" button
7. Wait for success message

---

## ✅ That's It!

After running both files, you'll have:
- ✅ Multi-stop routes functionality
- ✅ Multi-delivery loads functionality
- ✅ All necessary tables, indexes, and policies

---

## 🔍 Quick Verification

After running, check in Supabase:
- Table Editor → Look for `route_stops` table
- Table Editor → Look for `load_delivery_points` table
- Table Editor → `routes` table should have new columns
- Table Editor → `loads` table should have new columns

