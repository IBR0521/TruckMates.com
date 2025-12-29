# Automatic Connections & Workflows

This document outlines all the **automatic connections** and **workflows** in the platform that work together seamlessly.

---

## 🔗 **1. Load Management → Route Auto-Creation**

**When:** Creating a new load without a route assigned

**What happens automatically:**
- System searches for existing routes matching origin/destination
- If match found → Load automatically linked to existing route
- If no match → New route automatically created and linked to load
- Route inherits load's driver/truck assignment if provided

**Files:**
- `app/actions/loads.ts` (lines 193-256)

---

## 🧾 **2. Load Delivery → Invoice Auto-Generation**

**When:** Load status changes to "delivered"

**What happens automatically:**
- System checks if invoice already exists for the load
- If no invoice exists AND load has a value → Invoice automatically created
- Invoice includes:
  - Customer name from load
  - Amount from load value
  - Load ID linked
  - Net 30 payment terms (default)
  - Description with load details

**Files:**
- `app/actions/loads.ts` (lines 392-439)

---

## 📱 **3. Dispatch Assignment → SMS Notification**

**When:** Driver is assigned to a load or route via dispatch board

**What happens automatically:**
- SMS automatically sent to driver with dispatch details
- Includes load/route information
- Non-blocking (doesn't fail if SMS fails)
- Uses Twilio integration

**Files:**
- `app/actions/dispatches.ts` (quickAssignLoad, quickAssignRoute)

---

## 💰 **4. Invoice Updates → Customer Financial Summary**

**When:** Invoice is created, updated, or marked as paid

**What happens automatically:**
- Database trigger updates customer financial summary:
  - `total_revenue` (sum of paid invoices)
  - `total_loads` (count of loads with invoices)
  - `last_load_date` (most recent load date)
- Updates happen automatically via database trigger

**Files:**
- `supabase/crm_schema_complete.sql` (update_customer_financial_summary trigger)

---

## 🔄 **5. Data Updates → UI Revalidation**

**When:** Any data is created, updated, or deleted

**What happens automatically:**
- Next.js paths are revalidated
- UI automatically refreshes to show latest data
- No page refresh needed - updates appear instantly

**Files:**
- All action files use `revalidatePath()` after updates

---

## 📦 **6. Document Upload → Auto-Record Creation**

**When:** Document is uploaded and analyzed

**What happens automatically:**
- AI analyzes document and extracts data
- Automatically creates appropriate record:
  - Driver documents → Driver records
  - Vehicle documents → Truck records
  - Load/Route documents → Load/Route records
  - Invoice documents → Invoice records
  - Expense documents → Expense records
- Links related records (e.g., route + load from same document)

**Files:**
- `app/actions/document-analysis.ts`

---

## 🔗 **7. Foreign Key Relationships (Database Level)**

**Automatic cascading and linking:**

- **Loads** → Routes, Drivers, Trucks
  - If route/driver/truck deleted → Load's reference set to NULL (cascade)

- **Invoices** → Loads
  - Invoice linked to load via `load_id`
  - If load deleted → Invoice's `load_id` set to NULL

- **BOLs** → Loads
  - BOL automatically linked to load
  - Pre-fills shipper/consignee from load data

- **Expenses** → Drivers, Trucks, Vendors
  - Expenses linked to drivers/trucks/vendors for tracking

- **Settlements** → Drivers
  - Driver settlements linked to driver records

- **Maintenance** → Trucks, Vendors
  - Maintenance records linked to trucks and vendors

- **ELD Data** → Drivers, Trucks, ELD Devices
  - Location logs, HOS logs, events all linked automatically

---

## 📊 **8. Analytics Dashboard → Real-Time Data**

**When:** Dashboard loads

**What happens automatically:**
- Fetches latest data from all sources
- Calculates:
  - Total loads, active loads
  - Total revenue, revenue by period
  - Fleet utilization
  - Driver performance metrics
- Updates automatically when underlying data changes

**Files:**
- `app/dashboard/reports/analytics/page.tsx`

---

## 🗺️ **9. Fleet Map → Real-Time GPS Updates**

**When:** Fleet Map page is open

**What happens automatically:**
- Fetches latest vehicle locations every 30 seconds
- Shows vehicles with active ELD devices
- Updates map markers in real-time
- Displays speed, heading, last update time
- **Note:** Only GPS location data refreshes. Fuel level, mileage, and other static data are NOT updated automatically - they only change when manually edited.

**Files:**
- `app/dashboard/fleet-map/page.tsx`

---

## 📍 **10. Route Optimization → Real Distance Calculation**

**When:** Route optimization is run

**What happens automatically:**
- Uses Google Maps API (if configured) for accurate distances
- Geocodes addresses to coordinates
- Calculates real travel times
- Falls back to Haversine formula if API unavailable

**Files:**
- `app/actions/route-optimization.ts`

---

## 🚚 **11. Load Creation → Multi-Delivery Points**

**When:** Creating load with multiple delivery points

**What happens automatically:**
- All delivery points automatically linked to load
- Delivery type set to "multi"
- Total delivery points count updated
- Each point can be tracked individually

**Files:**
- `app/actions/load-delivery-points.ts`

---

## 📋 **12. BOL Creation → Load Data Pre-Fill**

**When:** Creating BOL from load

**What happens automatically:**
- Shipper/consignee information pre-filled from load
- Load details automatically included
- BOL linked to load via `load_id`

**Files:**
- `app/dashboard/bols/create/page.tsx`

---

## 🔍 **13. Address Book → Unified Search**

**When:** Searching in Address Book

**What happens automatically:**
- Searches across ALL contact types simultaneously:
  - Customers
  - Vendors
  - Drivers
  - Employees
- Filters and displays unified results
- Quick access to view/edit any contact

**Files:**
- `app/actions/address-book.ts`
- `app/dashboard/address-book/page.tsx`

---

## ⛽ **14. Fuel Expense → Automatic Fuel Level Update**

**When:** Fuel expense is logged with truck selected

**What happens automatically:**
- "Fuel Level After Fill" field appears (defaults to 100%)
- When expense is saved, truck's fuel level is automatically updated
- No need to manually edit vehicle separately
- One-step process: log expense → fuel level updates automatically

**Files:**
- `app/actions/accounting.ts` (createExpense function)
- `app/dashboard/accounting/expenses/add/page.tsx`

---

## ✅ **Summary**

All these connections work **automatically** - no manual intervention needed. The platform is designed to:

1. ✅ **Minimize manual work** - Auto-create related records
2. ✅ **Keep data synchronized** - Updates cascade automatically
3. ✅ **Notify stakeholders** - SMS/notifications sent automatically
4. ✅ **Maintain data integrity** - Foreign keys ensure relationships stay valid
5. ✅ **Provide real-time updates** - UI refreshes automatically
6. ✅ **Calculate metrics** - Financial summaries update automatically
7. ✅ **Auto-update fuel levels** - Fuel expenses automatically update vehicle fuel level

Everything is **connected, automatic, and efficient**! 🚀

