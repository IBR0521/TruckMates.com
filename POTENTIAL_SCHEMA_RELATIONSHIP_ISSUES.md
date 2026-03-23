# Potential Schema Relationship Issues

This document lists all relationship queries that might fail with "Could not find a relationship" errors if the foreign keys don't exist in the database schema.

## ⚠️ HIGH RISK - Similar to drivers:truck_id issue

### 1. `app/actions/idle-time-tracking.ts`
- **Line 106**: `trucks:truck_id (id, truck_number, make, model)`
- **Line 107**: `drivers:driver_id (id, name)`
- **Risk**: If `trucks` table doesn't have FK to `idle_sessions.truck_id` or `drivers` table doesn't have FK to `idle_sessions.driver_id`

### 2. `app/actions/geofencing.ts`
- **Line 799**: `geofences:geofence_id (id, name)`
- **Line 800**: `trucks:truck_id (id, truck_number)`
- **Line 801**: `drivers:driver_id (id, name)`
- **Risk**: Multiple relationship queries that might not have proper FKs

### 3. `app/actions/fuel-analytics.ts`
- **Line 415**: `trucks:truck_id(id, truck_number)`
- **Line 416**: `drivers:driver_id(id, name)`
- **Risk**: Similar to above

### 4. `app/actions/eld.ts`
- **Line 34**: `trucks:truck_id (...)` 
- **Line 83**: `trucks:truck_id (...)`
- **Line 340**: `eld_devices:eld_device_id (...)`
- **Line 345**: `drivers:driver_id (...)`
- **Line 349**: `trucks:truck_id (...)`
- **Line 426**: `eld_devices:eld_device_id (...)`
- **Line 430**: `drivers:driver_id (...)`
- **Line 434**: `trucks:truck_id (...)`
- **Risk**: Multiple ELD-related relationship queries

### 5. `app/actions/dvir.ts`
- **Line 65**: `drivers:driver_id (id, name)`
- **Line 66**: `trucks:truck_id (id, truck_number, make, model)`
- **Line 136**: `drivers:driver_id (id, name, license_number)`
- **Line 137**: `trucks:truck_id (id, truck_number, make, model, year, vin)`
- **Line 138**: `certified_by_user:certified_by (id, full_name, email)`
- **Risk**: DVIR table relationships

### 6. `app/actions/eld-insights.ts`
- **Line 43**: `drivers:driver_id (id, name)`
- **Line 44**: `trucks:truck_id (id, truck_number)`
- **Line 67**: `drivers:driver_id (id, name)`
- **Risk**: ELD insights relationships

### 7. `app/actions/eld-advanced.ts`
- **Line 333**: `eld_devices:eld_device_id (...)`
- **Line 337**: `trucks:truck_id (...)`
- **Line 342**: `drivers:driver_id (...)`
- **Risk**: Advanced ELD relationships

### 8. `app/actions/detention-tracking.ts`
- **Line 105**: `geofences:geofence_id (id, name)`
- **Line 106**: `trucks:truck_id (id, truck_number)`
- **Line 107**: `drivers:driver_id (id, name)`
- **Line 108**: `loads:load_id (id, shipment_number)`
- **Line 167**: `geofences:geofence_id (id, name)`
- **Line 168**: `trucks:truck_id (id, truck_number)`
- **Line 169**: `drivers:driver_id (id, name)`
- **Line 170**: `loads:load_id (id, shipment_number)`
- **Line 171**: `invoices:invoice_id (id, invoice_number)`
- **Line 311**: `geofences:geofence_id(company_id)`
- **Risk**: Multiple detention tracking relationships

### 9. `app/actions/map-optimization.ts`
- **Line 53**: `trucks:truck_id (...)`
- **Line 60**: `drivers:driver_id (...)`
- **Risk**: Map optimization relationships

### 10. `app/actions/predictive-maintenance-alerts.ts`
- **Line 54**: `trucks:truck_id (id, truck_number, make, model)`
- **Line 55**: `users:sent_to (id, phone, name)`
- **Line 160**: `trucks:truck_id (id, truck_number, make, model)`
- **Line 161**: `users:sent_to (id, name, phone)`
- **Risk**: Maintenance alert relationships

### 11. `app/actions/gamification.ts`
- **Line 127**: `drivers:driver_id (id, name)`
- **Risk**: Gamification relationships

### 12. `app/actions/driver-onboarding.ts`
- **Line 152**: `driver:driver_id(id, name, email, phone)`
- **Line 153**: `assigned_to:assigned_to_user_id(id, full_name, email)`
- **Line 507**: `driver:driver_id(id, name, email, phone, status)`
- **Line 508**: `assigned_to:assigned_to_user_id(id, full_name, email)`
- **Risk**: Onboarding relationships

## ⚠️ MEDIUM RISK - Other relationship queries

### 13. `app/actions/marketplace.ts`
- **Line 27**: `broker:broker_id(id, name)`
- **Line 81**: `broker:broker_id(id, name, email, phone)`
- **Line 504**: `created_load:created_load_id(id, shipment_number, status)`
- **Risk**: Marketplace relationships (might not exist if marketplace is disabled)

### 14. `app/actions/invoice-email.ts`
- **Line 120**: `loads:load_id (...)`
- **Line 124**: `customers:customer_id (...)`
- **Risk**: Invoice email relationships

### 15. `app/actions/bol.ts`
- **Line 191**: `shipper_address_book:shipper_address_book_id (...)`
- **Line 204**: `consignee_address_book:consignee_address_book_id (...)`
- **Risk**: BOL address book relationships

### 16. `app/actions/settlement-pdf.ts`
- **Line 40**: `driver:driver_id (...)`
- **Line 46**: `pay_rule:pay_rule_id (...)`
- **Risk**: Settlement relationships

### 17. `app/actions/on-time-delivery.ts`
- **Line 51**: `customers:customer_id(...)`
- **Risk**: Customer relationship

### 18. `app/actions/maintenance.ts`
- **Line 204**: `truck:truck_id (...)`
- **Risk**: Maintenance truck relationship

### 19. `app/actions/load-details.ts`
- **Line 118**: `driver:driver_id (...)`
- **Line 124**: `truck:truck_id (...)`
- **Line 130**: `shipper_address_book:shipper_address_book_id (...)`
- **Line 138**: `consignee_address_book:consignee_address_book_id (...)`
- **Risk**: Load detail relationships

### 20. `app/actions/invoice-verification.ts`
- **Line 77**: `invoice:invoice_id (...)`
- **Line 84**: `load:load_id (...)`
- **Line 92**: `bol:bol_id (...)`
- **Line 150**: `load:load_id (...)`
- **Risk**: Invoice verification relationships

### 21. `app/actions/dispatch-timeline.ts`
- **Line 241**: `driver:driver_id (...)`
- **Line 245**: `truck:truck_id (...)`
- **Line 282**: `driver:driver_id (...)`
- **Line 286**: `truck:truck_id (...)`
- **Risk**: Dispatch timeline relationships

### 22. `app/actions/customer-portal.ts`
- **Line 373**: `customer:customers(id, name, company_name, email)` - **NOTE: Uses table name, not FK column**
- **Line 374**: `company:companies(id, name)` - **NOTE: Uses table name, not FK column**
- **Line 451**: `driver:drivers(name, phone)` - **NOTE: Uses table name, not FK column**
- **Line 452**: `truck:trucks(truck_number, make, model)` - **NOTE: Uses table name, not FK column**
- **Line 453**: `route:routes(name, origin, destination, status)` - **NOTE: Uses table name, not FK column**
- **Line 522**: `driver:drivers(name, phone)` - **NOTE: Uses table name, not FK column**
- **Line 523**: `truck:trucks(truck_number, make, model)` - **NOTE: Uses table name, not FK column**
- **Line 524**: `route:routes(name, origin, destination, status)` - **NOTE: Uses table name, not FK column**
- **Line 525**: `invoices:invoices(*)` - **NOTE: Uses table name, not FK column**
- **Risk**: **CRITICAL** - These use table names instead of FK column names, which is incorrect syntax

### 23. `app/actions/auto-status-updates.ts`
- **Line 83**: `geofences:geofence_id (id, name)`
- **Line 84**: `users:changed_by (id, name)`
- **Risk**: Status update relationships

### 24. `app/actions/accounting.ts`
- **Line 101**: `loads:load_id (...)`
- **Line 215**: `drivers:driver_id (...)`
- **Risk**: Accounting relationships

### 25. `app/actions/maintenance-enhanced.ts`
- **Line 247**: `uploaded_by_user:uploaded_by (id, name, email)`
- **Line 441**: `maintenance:maintenance_id (...)`
- **Line 447**: `truck:truck_id (...)`
- **Line 453**: `assigned_user:assigned_to (...)`
- **Line 458**: `assigned_vendor:assigned_vendor_id (...)`
- **Line 509**: `maintenance:maintenance_id (...)`
- **Line 514**: `truck:truck_id (...)`
- **Risk**: Enhanced maintenance relationships

### 26. `app/actions/dvir-enhanced.ts`
- **Line 214**: `maintenance:maintenance_id (...)`
- **Risk**: DVIR enhanced relationships

### 27. `app/actions/crm-documents.ts`
- **Line 165**: `customers:customer_id(name)`
- **Line 166**: `vendors:vendor_id(name)`
- **Line 250**: `customers:customer_id(name)`
- **Line 251**: `vendors:vendor_id(name)`
- **Risk**: CRM document relationships

### 28. `app/actions/crm-communication.ts`
- **Line 142**: `customers:customer_id(name)`
- **Line 143**: `vendors:vendor_id(name)`
- **Line 144**: `contacts:contact_id(first_name, last_name)`
- **Line 145**: `users:user_id(full_name)`
- **Risk**: CRM communication relationships

## 🔴 CRITICAL ISSUES

### Issue 1: `customer-portal.ts` - Incorrect Relationship Syntax
**Problem**: Uses table names instead of FK column names
- `customer:customers(...)` should be `customer:customer_id(...)`
- `company:companies(...)` should be `company:company_id(...)`
- `driver:drivers(...)` should be `driver:driver_id(...)`
- `truck:trucks(...)` should be `truck:truck_id(...)`
- `route:routes(...)` should be `route:route_id(...)`
- `invoices:invoices(...)` should be `invoices:invoice_id(...)`

**Files affected**: `app/actions/customer-portal.ts` (lines 373, 374, 451-453, 522-525)

## 📋 Summary

**Total files with relationship queries**: 28
**Total relationship queries found**: ~60+
**Critical syntax errors**: 1 file (customer-portal.ts)
**High-risk files** (similar to drivers:truck_id): 12 files

## 📊 Potentially Missing Tables/Views

Based on error handling code, these tables/views might not exist:

1. **`crm_customer_performance`** (view)
   - Referenced in: `app/actions/crm-performance.ts`
   - Error handling: Lines 110, 186, 256, 321, 393, 435

2. **`crm_vendor_performance`** (view)
   - Referenced in: `app/actions/crm-performance.ts`
   - Error handling: Lines 256, 321, 435

3. **`crm_documents`** (table)
   - Referenced in: `app/actions/crm-documents.ts`
   - Error handling: Lines 187, 235, 261, 329, 379

4. **`company_settings`** (table)
   - Referenced in: `app/actions/number-formats.ts`
   - Error handling: Line 71

5. **`billing_invoices`** (table)
   - Referenced in: `app/api/webhooks/stripe/route.ts`
   - Error handling: Line 250

6. **`filter_presets`** (table)
   - Referenced in: `app/actions/filter-presets.ts`
   - Error handling: Lines 50, 103

7. **`reminders`** (table)
   - Referenced in: `app/actions/reminders.ts`
   - Error handling: Lines 65, 78, 265, 445, 457

8. **`load_delivery_points`** (table)
   - Referenced in: `app/actions/load-delivery-points.ts`
   - Error handling: Line 41

9. **`route_stops`** (table)
   - Referenced in: `app/actions/route-stops.ts`
   - Error handling: Line 41

10. **`driver_performance_scores`** (table)
    - Referenced in: `FIX_DRIVER_LEADERBOARD_BUG.md`
    - Error: "Could not find the table 'public.driver_performance_scores' in the schema cache"

11. **`ifta_tax_rates`** (table)
    - Referenced in: `IFTA_DATABASE_FIXES.md`
    - Error: "Could not find the table 'public.ifta_tax_rates' in the schema cache"

12. **`load_marketplace`** (table)
    - Referenced in: `MARKETPLACE_SETUP_INSTRUCTIONS.md`
    - Error: "Could not find the table 'public.load_marketplace' in the schema cache"
    - **Note**: Marketplace is currently set to "Coming Soon" status

## 🎯 Recommended Action

1. **Immediate**: Fix `customer-portal.ts` syntax errors
2. **High Priority**: Check and fix all `trucks:truck_id` and `drivers:driver_id` relationships (similar to the drivers.ts fix)
3. **Medium Priority**: Verify all other relationship queries have proper FK constraints in database
4. **Low Priority**: Add error handling for missing relationships (graceful degradation)
5. **Database Setup**: Verify all tables/views listed above exist in the database schema

