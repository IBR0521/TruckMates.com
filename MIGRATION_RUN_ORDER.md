# MIGRATION RUN ORDER
**Generated:** January 2025  
**Status:** Complete Migration Checklist

---

## 🚨 CRITICAL: Run These Migrations in Order

These migrations add columns that are **actively used in your code** and will cause crashes if not run.

---

## Phase 1: Core Schema Extensions (Run First)

### 1. ✅ `add_invoices_payment_columns.sql` - **CRITICAL**
**Status:** ✅ Already created (just added)
**What it does:** Adds 7 missing payment tracking columns to `invoices` table
- `notes`, `paid_amount`, `paid_date`, `payment_method`, `tax_amount`, `tax_rate`, `subtotal`
**Impact:** Fixes invoice payment tracking functionality
**Dependencies:** None
**Priority:** 🔴 **CRITICAL - RUN FIRST**

### 2. ✅ `integrations_schema.sql` - **CRITICAL**
**What it does:** Adds payment integration columns to `invoices` table
- `stripe_payment_intent_id`, `paypal_order_id`, `paypal_capture_id`
**Impact:** Fixes Stripe/PayPal payment processing
**Dependencies:** None
**Priority:** 🔴 **CRITICAL**

### 3. ✅ `crm_schema_complete.sql` - **CRITICAL**
**What it does:** Adds customer relationship columns
- `customer_id` to `invoices` table
- `customer_id` to `loads` table
- Creates `customers` table if it doesn't exist
**Impact:** Fixes customer linking in invoices and loads
**Dependencies:** None
**Priority:** 🔴 **CRITICAL**

---

## Phase 2: Loads Table Extensions (Run Second)

### 4. ✅ `loads_schema_extended.sql` - **HIGH PRIORITY**
**What it does:** Adds 50+ extended columns to `loads` table
- `load_type`, `customer_id`
- All `shipper_*` fields (15+ columns)
- All `consignee_*` fields (15+ columns)
- `pieces`, `pallets`, `boxes`, `length`, `width`, `height`
- `temperature`, `is_hazardous`, `is_oversized`
- `special_instructions`, `requires_*` fields
- `rate`, `rate_type`, `fuel_surcharge`, `accessorial_charges`
- `discount`, `advance`, `total_rate`
- `estimated_miles`, `estimated_profit`, `estimated_revenue`
- `bol_number`, `notes`, `internal_notes`
**Impact:** Fixes load creation, editing, and detailed load management
**Dependencies:** None (but should run after `crm_schema_complete.sql` for `customer_id`)
**Priority:** 🟠 **HIGH PRIORITY**

### 5. ✅ `add_loads_pricing_columns.sql` - **HIGH PRIORITY**
**What it does:** Alternative/duplicate migration for loads pricing columns
- Same columns as `loads_schema_extended.sql`
**Impact:** Same as above
**Dependencies:** None (but may conflict with `loads_schema_extended.sql` - check if already run)
**Priority:** 🟠 **HIGH PRIORITY** (Run only if `loads_schema_extended.sql` not run)

### 6. ✅ `dispatch_board_enhancements.sql` - **HIGH PRIORITY**
**What it does:** Adds dispatch board features to `loads` table
- `status_color` - Color coding for status
- `priority` - Load priority (low, normal, high, urgent)
- `urgency_score` - Calculated urgency score
**Impact:** Fixes dispatch board functionality
**Dependencies:** None
**Priority:** 🟠 **HIGH PRIORITY**

### 7. ✅ `marketplace_schema.sql` - **MEDIUM PRIORITY**
**What it does:** Adds marketplace integration to `loads` table
- `source` - Load source (manual, marketplace)
- `marketplace_load_id` - Reference to marketplace load
**Impact:** Fixes marketplace load integration
**Dependencies:** None
**Priority:** 🟡 **MEDIUM PRIORITY** (Only if using marketplace features)

### 8. ✅ `load_delivery_points_schema_safe.sql` - **MEDIUM PRIORITY**
**What it does:** Adds multi-delivery point support to `loads` table
- `delivery_type` - Single or multi-delivery
- `total_delivery_points` - Number of delivery points
- `company_name` - Customer company name
- `customer_reference` - Customer reference number
- `requires_split_delivery` - Split delivery flag
**Impact:** Fixes multi-delivery point loads
**Dependencies:** None
**Priority:** 🟡 **MEDIUM PRIORITY**

### 9. ✅ `loads_address_book_integration.sql` - **MEDIUM PRIORITY**
**What it does:** Adds address book integration to `loads` table
- `shipper_address_book_id` - Link to address book entry
- `consignee_address_book_id` - Link to address book entry
- `shipper_latitude`, `shipper_longitude` - Coordinates
- `consignee_latitude`, `consignee_longitude` - Coordinates
**Impact:** Fixes address book integration
**Dependencies:** Requires `address_book` table (check if exists)
**Priority:** 🟡 **MEDIUM PRIORITY**

---

## Phase 3: Routes Table Extensions (Run Third)

### 10. ✅ `route_stops_schema_safe.sql` - **MEDIUM PRIORITY**
**What it does:** Adds route stop management to `routes` table
- `depot_name`, `depot_address`
- `pre_route_time_minutes`, `post_route_time_minutes`
- `route_start_time`, `route_departure_time`, `route_complete_time`
- `route_type`, `scenario`
**Impact:** Fixes route stop management
**Dependencies:** None
**Priority:** 🟡 **MEDIUM PRIORITY**

### 11. ✅ `realtime_eta.sql` - **MEDIUM PRIORITY**
**What it does:** Adds real-time ETA tracking to `routes` table
- `route_linestring` - PostGIS geometry for route path
- `origin_coordinates`, `destination_coordinates` - JSONB coordinates
- `current_eta` - Real-time estimated arrival
- `last_eta_update` - Last ETA update timestamp
- `eta_confidence` - ETA confidence level
**Impact:** Fixes real-time ETA functionality
**Dependencies:** Requires PostGIS extension (check if enabled)
**Priority:** 🟡 **MEDIUM PRIORITY** (Only if using real-time ETA features)

---

## Phase 4: Additional Features (Run Last)

### 12. ✅ `subscriptions_schema.sql` - **OPTIONAL**
**What it does:** Adds subscription billing columns
- `stripe_invoice_id` to `invoices` table (for billing invoices)
**Impact:** Fixes subscription billing
**Dependencies:** None
**Priority:** 🟢 **OPTIONAL** (Only if using subscription billing)

### 13. ✅ `invoice_three_way_matching.sql` - **OPTIONAL**
**What it does:** Adds invoice verification features
- `matching_status`, `verification_details`, `verified_at`, etc.
**Impact:** Adds invoice verification functionality
**Dependencies:** None
**Priority:** 🟢 **OPTIONAL** (Only if using invoice verification)

---

## 📋 Quick Run Checklist

### Must Run (Critical):
- [ ] `add_invoices_payment_columns.sql` ✅ (Already created)
- [ ] `integrations_schema.sql`
- [ ] `crm_schema_complete.sql`
- [ ] `loads_schema_extended.sql` OR `add_loads_pricing_columns.sql`
- [ ] `dispatch_board_enhancements.sql`

### Should Run (High Priority):
- [ ] `marketplace_schema.sql` (if using marketplace)
- [ ] `load_delivery_points_schema_safe.sql`
- [ ] `loads_address_book_integration.sql` (if using address book)
- [ ] `route_stops_schema_safe.sql`
- [ ] `realtime_eta.sql` (if using real-time ETA)

### Optional (Feature-Specific):
- [ ] `subscriptions_schema.sql` (if using subscriptions)
- [ ] `invoice_three_way_matching.sql` (if using invoice verification)

---

## 🚀 Recommended Run Order

```sql
-- Phase 1: Critical Core Extensions
1. add_invoices_payment_columns.sql
2. integrations_schema.sql
3. crm_schema_complete.sql

-- Phase 2: Loads Extensions
4. loads_schema_extended.sql (OR add_loads_pricing_columns.sql if not run)
5. dispatch_board_enhancements.sql
6. marketplace_schema.sql
7. load_delivery_points_schema_safe.sql
8. loads_address_book_integration.sql

-- Phase 3: Routes Extensions
9. route_stops_schema_safe.sql
10. realtime_eta.sql

-- Phase 4: Optional Features
11. subscriptions_schema.sql (if needed)
12. invoice_three_way_matching.sql (if needed)
```

---

## ⚠️ Important Notes

1. **Check Dependencies First:**
   - Ensure `address_book` table exists before running `loads_address_book_integration.sql`
   - Ensure PostGIS extension is enabled before running `realtime_eta.sql`

2. **Avoid Duplicates:**
   - `loads_schema_extended.sql` and `add_loads_pricing_columns.sql` have overlapping columns
   - Run only ONE of them (prefer `loads_schema_extended.sql` as it's more comprehensive)

3. **Safe to Re-run:**
   - All migrations use `IF NOT EXISTS` or `ADD COLUMN IF NOT EXISTS`
   - Safe to run multiple times (won't create duplicates)

4. **Test After Each Phase:**
   - Test your application after Phase 1
   - Test after Phase 2
   - Test after Phase 3
   - This helps identify issues early

---

## 🔍 How to Run

1. Open Supabase Dashboard → SQL Editor
2. Copy the contents of each migration file
3. Paste into SQL Editor
4. Click "Run"
5. Verify no errors
6. Move to next migration

---

## ✅ Verification

After running migrations, verify columns exist:

```sql
-- Check invoices table
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'invoices' 
ORDER BY column_name;

-- Check loads table
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'loads' 
ORDER BY column_name;

-- Check routes table
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'routes' 
ORDER BY column_name;
```

---

## IFTA manual trip sheets (optional)

For **Dashboard → IFTA → Trip sheet** and merged GPS + manual miles:

| Order | File |
|-------|------|
| 1 | `supabase/trip_sheets_schema.sql` |
| 2 | `supabase/ifta_reports_data_sources.sql` |

See `supabase/IFTA_TRIP_SHEETS_README.md`.

---

**Status:** ✅ Ready to run - All migrations identified and prioritized


