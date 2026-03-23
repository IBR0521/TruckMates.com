# DEEP COLUMN VERIFICATION REPORT
**Generated:** January 2025  
**Status:** Comprehensive Deep Analysis - Existence, Types, Usage, Mismatches

---

## 🔍 Verification Methodology

This report performs **DEEP VERIFICATION** of all database column references:
1. ✅ **Existence Check** - Does column exist in schema/migrations?
2. ✅ **Type Check** - Does column type match code usage?
3. ✅ **Usage Check** - Is column being used correctly?
4. ✅ **Mismatch Check** - Does column exist but not match code expectations?

---

## Executive Summary

**Total Issues Found:** TBD (Analysis in progress)

### Categories:
1. **Missing Columns** - Referenced but don't exist
2. **Type Mismatches** - Exist but wrong type
3. **Naming Mismatches** - Exist but wrong name
4. **Usage Issues** - Exist but used incorrectly

---

## 1. 🔴 `loads` Table - Deep Verification

### Base Schema Columns (from `supabase/schema.sql:82-103`):
```sql
id, company_id, shipment_number, origin, destination, weight, weight_kg, 
contents, value, carrier_type, status, driver_id, truck_id, route_id, 
load_date, estimated_delivery, actual_delivery, coordinates, 
created_at, updated_at
```

### Columns Referenced in Code (from `app/actions/loads.ts`):

#### ❌ **`company_name`** - MISSING FROM BASE SCHEMA
**Status:** ❌ **DOES NOT EXIST** in base schema
**Referenced in:**
- Line 114: `.select("..., company_name, ...")` - SELECT query
- Line 657: `loadData.company_name = ...` - INSERT
- Line 983: `updateField("company_name", ...)` - UPDATE
- Line 1558: Used in duplicateLoad()

**Migration Status:** ✅ EXISTS in `load_delivery_points_schema_safe.sql:9`
**Impact:** ⚠️ **WILL CRASH** if migration not run

#### ❌ **`priority`** - MISSING FROM BASE SCHEMA
**Status:** ❌ **DOES NOT EXIST** in base schema
**Referenced in:**
- Line 516: `priority: "normal"` - INSERT (route creation)
- Line 806: `priority: "normal"` - INSERT (route creation)
- Line 1191: `priority: formData.status === "delivered" ? "high" : "normal"` - UPDATE
- `app/actions/dispatches.ts:49,125` - SELECT queries

**Migration Status:** ✅ EXISTS in `dispatch_board_enhancements.sql:13`
**Impact:** ⚠️ **WILL CRASH** if migration not run

#### ❌ **`status_color`** - MISSING FROM BASE SCHEMA
**Status:** ❌ **DOES NOT EXIST** in base schema
**Referenced in:**
- `app/actions/load-details.ts:251` - Used in response

**Migration Status:** ✅ EXISTS in `dispatch_board_enhancements.sql:9`
**Impact:** ⚠️ **WILL CRASH** if migration not run (if selected from DB)

#### ❌ **`urgency_score`** - MISSING FROM BASE SCHEMA
**Status:** ❌ **DOES NOT EXIST** in base schema
**Referenced in:**
- `app/actions/load-details.ts:253` - Used in response

**Migration Status:** ✅ EXISTS in `dispatch_board_enhancements.sql:17`
**Impact:** ⚠️ **WILL CRASH** if migration not run (if selected from DB)

#### ❌ **`source`** - MISSING FROM BASE SCHEMA
**Status:** ❌ **DOES NOT EXIST** in base schema
**Referenced in:**
- Line 749: `loadData.source = formData.source` - INSERT
- Line 1054: `updateField("source", ...)` - UPDATE

**Migration Status:** ✅ EXISTS in `marketplace_schema.sql:234`
**Impact:** ⚠️ **WILL CRASH** if migration not run

#### ❌ **`marketplace_load_id`** - MISSING FROM BASE SCHEMA
**Status:** ❌ **DOES NOT EXIST** in base schema
**Referenced in:**
- Line 750: `loadData.marketplace_load_id = formData.marketplace_load_id` - INSERT
- Line 1055: `updateField("marketplace_load_id", ...)` - UPDATE

**Migration Status:** ✅ EXISTS in `marketplace_schema.sql:235`
**Impact:** ⚠️ **WILL CRASH** if migration not run

#### ❌ **`delivery_type`** - MISSING FROM BASE SCHEMA
**Status:** ❌ **DOES NOT EXIST** in base schema
**Referenced in:**
- Line 630: `delivery_type: formData.delivery_type || "single"` - INSERT
- Line 982: `updateField("delivery_type", ...)` - UPDATE
- Line 1554: Used in duplicateLoad()

**Migration Status:** ✅ EXISTS in `load_delivery_points_schema_safe.sql:7`
**Impact:** ⚠️ **WILL CRASH** if migration not run

#### ❌ **`total_delivery_points`** - MISSING FROM BASE SCHEMA
**Status:** ❌ **DOES NOT EXIST** in base schema
**Referenced in:**
- Line 631: `total_delivery_points: 1` - INSERT
- Line 985: `updateField("total_delivery_points", ...)` - UPDATE

**Migration Status:** ✅ EXISTS in `load_delivery_points_schema_safe.sql:8`
**Impact:** ⚠️ **WILL CRASH** if migration not run

#### ❌ **`customer_reference`** - MISSING FROM BASE SCHEMA
**Status:** ❌ **DOES NOT EXIST** in base schema
**Referenced in:**
- Line 658: `loadData.customer_reference = ...` - INSERT
- Line 984: `updateField("customer_reference", ...)` - UPDATE

**Migration Status:** ✅ EXISTS in `load_delivery_points_schema_safe.sql:10`
**Impact:** ⚠️ **WILL CRASH** if migration not run

#### ❌ **`requires_split_delivery`** - MISSING FROM BASE SCHEMA
**Status:** ❌ **DOES NOT EXIST** in base schema
**Referenced in:**
- Line 659: `loadData.requires_split_delivery = ...` - INSERT
- Line 985: `updateField("requires_split_delivery", ...)` - UPDATE

**Migration Status:** ✅ EXISTS in `load_delivery_points_schema_safe.sql:11`
**Impact:** ⚠️ **WILL CRASH** if migration not run

#### ❌ **`shipper_address_book_id`** - MISSING FROM BASE SCHEMA
**Status:** ❌ **DOES NOT EXIST** in base schema
**Referenced in:**
- Line 753: `loadData.shipper_address_book_id = ...` - INSERT
- Line 1058: `updateField("shipper_address_book_id", ...)` - UPDATE

**Migration Status:** ✅ EXISTS in `loads_address_book_integration.sql:10`
**Impact:** ⚠️ **WILL CRASH** if migration not run

#### ❌ **`consignee_address_book_id`** - MISSING FROM BASE SCHEMA
**Status:** ❌ **DOES NOT EXIST** in base schema
**Referenced in:**
- Line 754: `loadData.consignee_address_book_id = ...` - INSERT
- Line 1059: `updateField("consignee_address_book_id", ...)` - UPDATE

**Migration Status:** ✅ EXISTS in `loads_address_book_integration.sql:11`
**Impact:** ⚠️ **WILL CRASH** if migration not run

### ✅ Extended Columns That EXIST in Migrations:
All the above columns exist in migrations but are NOT in base schema. They will cause crashes if migrations haven't been run.

### Columns in Extended Schema (from `loads_schema_extended.sql`):
- ✅ `load_type` - EXISTS
- ✅ `customer_id` - EXISTS
- ✅ `shipper_*` fields (15+ columns) - EXIST
- ✅ `consignee_*` fields (15+ columns) - EXIST
- ✅ `pieces`, `pallets`, `boxes` - EXIST
- ✅ `length`, `width`, `height` - EXIST
- ✅ `temperature`, `is_hazardous`, `is_oversized` - EXIST
- ✅ `special_instructions` - EXISTS
- ✅ `requires_*` fields - EXIST
- ✅ `rate`, `rate_type`, `fuel_surcharge`, etc. - EXIST
- ✅ `total_rate`, `estimated_miles`, `estimated_profit`, `estimated_revenue` - EXIST
- ✅ `bol_number` - EXISTS
- ✅ `notes`, `internal_notes` - EXIST

**Status:** ✅ All exist in migrations, but NOT in base schema

---

## 2. 🔴 `routes` Table - Deep Verification

### Base Schema Columns (from `supabase/schema.sql:63-79`):
```sql
id, company_id, name, origin, destination, distance, estimated_time, 
priority, driver_id, truck_id, status, waypoints, estimated_arrival, 
created_at, updated_at
```

### Columns Referenced in Code:

#### ❌ **`depot_name`** - MISSING FROM BASE SCHEMA
**Migration Status:** ✅ EXISTS in `route_stops_schema_safe.sql:7`
**Impact:** ⚠️ **WILL CRASH** if migration not run

#### ❌ **`depot_address`** - MISSING FROM BASE SCHEMA
**Migration Status:** ✅ EXISTS in `route_stops_schema_safe.sql:8`
**Impact:** ⚠️ **WILL CRASH** if migration not run

#### ❌ **`pre_route_time_minutes`** - MISSING FROM BASE SCHEMA
**Migration Status:** ✅ EXISTS in `route_stops_schema_safe.sql:9`
**Impact:** ⚠️ **WILL CRASH** if migration not run

#### ❌ **`post_route_time_minutes`** - MISSING FROM BASE SCHEMA
**Migration Status:** ✅ EXISTS in `route_stops_schema_safe.sql:10`
**Impact:** ⚠️ **WILL CRASH** if migration not run

#### ❌ **`route_start_time`** - MISSING FROM BASE SCHEMA
**Migration Status:** ✅ EXISTS in `route_stops_schema_safe.sql:11`
**Impact:** ⚠️ **WILL CRASH** if migration not run

#### ❌ **`route_departure_time`** - MISSING FROM BASE SCHEMA
**Migration Status:** ✅ EXISTS in `route_stops_schema_safe.sql:12`
**Impact:** ⚠️ **WILL CRASH** if migration not run

#### ❌ **`route_complete_time`** - MISSING FROM BASE SCHEMA
**Migration Status:** ✅ EXISTS in `route_stops_schema_safe.sql:13`
**Impact:** ⚠️ **WILL CRASH** if migration not run

#### ❌ **`route_type`** - MISSING FROM BASE SCHEMA
**Migration Status:** ✅ EXISTS in `route_stops_schema_safe.sql:14`
**Impact:** ⚠️ **WILL CRASH** if migration not run

#### ❌ **`scenario`** - MISSING FROM BASE SCHEMA
**Migration Status:** ✅ EXISTS in `route_stops_schema_safe.sql:15`
**Impact:** ⚠️ **WILL CRASH** if migration not run

#### ❌ **`route_linestring`** - MISSING FROM BASE SCHEMA
**Migration Status:** ✅ EXISTS in `realtime_eta.sql:9`
**Impact:** ⚠️ **WILL CRASH** if migration not run

#### ❌ **`origin_coordinates`** - MISSING FROM BASE SCHEMA
**Migration Status:** ✅ EXISTS in `realtime_eta.sql:10`
**Impact:** ⚠️ **WILL CRASH** if migration not run

#### ❌ **`destination_coordinates`** - MISSING FROM BASE SCHEMA
**Migration Status:** ✅ EXISTS in `realtime_eta.sql:11`
**Impact:** ⚠️ **WILL CRASH** if migration not run

#### ❌ **`current_eta`** - MISSING FROM BASE SCHEMA
**Migration Status:** ✅ EXISTS in `realtime_eta.sql:12`
**Impact:** ⚠️ **WILL CRASH** if migration not run

#### ❌ **`last_eta_update`** - MISSING FROM BASE SCHEMA
**Migration Status:** ✅ EXISTS in `realtime_eta.sql:13`
**Impact:** ⚠️ **WILL CRASH** if migration not run

#### ❌ **`eta_confidence`** - MISSING FROM BASE SCHEMA
**Migration Status:** ✅ EXISTS in `realtime_eta.sql:14`
**Impact:** ⚠️ **WILL CRASH** if migration not run

---

## 3. ✅ `invoices` Table - Already Fixed

### Status: ✅ **FIXED** - All 7 missing columns added to schema

---

## 4. 🔍 Type Mismatches & Usage Issues

### Checking for Type Mismatches:
- DECIMAL vs INTEGER
- TEXT vs VARCHAR
- DATE vs TIMESTAMP
- JSONB vs TEXT

### Checking for Usage Issues:
- Columns selected but never used
- Columns updated but wrong type
- Columns inserted with wrong format

---

## 5. Recommendations

### Immediate Actions:

1. **Run All Pending Migrations:**
   - `dispatch_board_enhancements.sql`
   - `marketplace_schema.sql`
   - `load_delivery_points_schema_safe.sql`
   - `loads_address_book_integration.sql`
   - `route_stops_schema_safe.sql`
   - `realtime_eta.sql`
   - `loads_schema_extended.sql`
   - `add_loads_pricing_columns.sql`
   - All other pending migrations

2. **Update Base Schema:**
   - Add all extended columns to `supabase/schema.sql` base definitions
   - This ensures new databases have all columns from the start

3. **Add Column Existence Checks:**
   - Add runtime checks for column existence before using
   - Use `handleDbError` utility for graceful degradation

---

## 6. Next Steps

1. Continue deep verification for other tables (trucks, drivers, customers, etc.)
2. Check for type mismatches
3. Check for naming mismatches
4. Check for usage issues
5. Generate comprehensive fix migration

---

**Report Status:** 🔄 **IN PROGRESS** - Deep verification continuing...


