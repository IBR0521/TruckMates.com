# Remaining SQL Files to Run in Supabase

**Status:** ✅ All 67 files verified to exist  
**Already Run:** Based on your screenshot, you've completed:
- ✅ Extensions (uuid-ossp, pgcrypto, postgis)
- ✅ `schema.sql`
- ✅ `trigger.sql`
- ✅ `fix_users_rls_recursion.sql`
- ✅ `fix_companies_rls_v3.sql`

**Remaining:** 63 files

---

## ⚠️ IMPORTANT: Verify Extensions First

Make sure these are enabled (run in Supabase SQL Editor):

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";
```

---

## Files Still Need to Run (In Order)

### Phase 3: Core Feature Tables

1. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/crm_schema_complete.sql`
2. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/notifications_table.sql`
3. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/notifications_schema.sql`
4. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/audit_logs_schema.sql`

### Phase 4: Extended Columns

5. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/drivers_schema_extended.sql`
6. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/trucks_schema_extended.sql`
7. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/loads_schema_extended.sql`
8. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/add_loads_pricing_columns.sql`
9. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/add_fuel_tracking_columns.sql`
10. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/add_driver_pay_rate.sql`
11. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/customers_schema_extended.sql` ⚠️ **Adds mailing/physical addresses and social media columns**

### Phase 5: Settings & Integrations

11. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/settings_schema.sql`
12. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/add_resend_integration.sql`
13. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/filter_presets_schema.sql`
14. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/enable_google_maps_for_all_companies.sql` ⚠️ **Enables Google Maps for all companies**

### Phase 6: Storage & Documents

14. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/storage_bucket_setup.sql`

### Phase 7: Subscriptions (Billing)

15. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/subscriptions_schema.sql`

### Phase 8: DVIR (Driver Vehicle Inspection Reports)

16. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/dvir_schema.sql`
17. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/dvir_enhancements.sql`

### Phase 9: ELD (Electronic Logging Device)

18. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/eld_schema.sql`
19. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/hos_calculation_function.sql`
20. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/eld_driver_mapping_schema.sql`
21. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/eld_mobile_app_policies.sql`
22. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/eld_fault_code_maintenance.sql`
23. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/cron_hos_exception_alerts.sql`

### Phase 10: PostGIS & Geofencing

**IMPORTANT:** Run `geofencing_schema.sql` FIRST to create the tables, then `postgis_migration.sql` to add PostGIS columns.

24. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/geofencing_schema.sql` ⚠️ **RUN THIS FIRST**
25. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/postgis_migration.sql` ⚠️ **RUN THIS AFTER geofencing_schema.sql**

### Phase 11: Route Tracking & ETA (Requires PostGIS)

26. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/enhanced_eta_traffic.sql`
27. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/realtime_eta.sql`
28. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/actual_route_tracking.sql`
29. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/backhaul_optimization.sql`
30. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/dfm_matching.sql`
31. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/proximity_dispatching.sql`

### Phase 12: Multi-Stop & Delivery Points

32. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/route_stops_schema_safe.sql`
33. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/load_delivery_points_schema_safe.sql`
34. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/load_relationship_type_schema.sql`
35. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/loads_address_book_integration.sql`
36. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/enhanced_address_book.sql`

### Phase 13: Dispatch Board

37. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/dispatch_board_enhancements.sql`
38. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/dispatch_timeline_functions.sql`

### Phase 14: Maintenance System

39. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/work_orders_schema.sql`
40. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/maintenance_documents_schema.sql`
41. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/parts_inventory_schema.sql`
42. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/maintenance_parts_integration.sql`
43. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/predictive_maintenance_alerts.sql`

### Phase 15: BOL (Bill of Lading)

44. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/bol_schema.sql`
45. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/ebol_invoice_trigger.sql`

### Phase 16: Accounting & IFTA

46. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/settlement_pay_rules_schema.sql`
47. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/tax_fuel_reconciliation_schema.sql`
48. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/ifta_tax_rates_schema.sql`
49. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/ifta_state_crossing_automation.sql`
50. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/invoice_three_way_matching.sql`

### Phase 17: Additional Features

51. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/trucklogics_features_schema.sql`
52. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/driver_onboarding_schema.sql`
53. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/customer_portal_schema.sql`
54. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/feedback_schema.sql`
55. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/webhooks_schema.sql`
56. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/api_protection_schema.sql`
57. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/quickbooks_oauth_schema.sql`
58. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/truckmates_ai_schema.sql`
59. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/gamification.sql` ⚠️ **Gamification features**

### Phase 18: Additional Tracking & Automation

59. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/idle_time_tracking.sql`
60. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/detention_tracking.sql`
61. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/auto_status_updates.sql`
62. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/alerts_smart_triggers.sql`

### Phase 19: Performance Indexes (Run Last)

63. `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase/performance_indexes.sql`

---

## Quick Copy Commands

### Copy all file paths at once (for reference):

```bash
cd "/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/supabase"
```

Then open each file in order from the list above.

---

## Progress Tracking

**Completed:** 4 files (schema.sql, trigger.sql, fix_users_rls_recursion.sql, fix_companies_rls_v3.sql)  
**Remaining:** 66 files  
**Total:** 70 files (including customers_schema_extended.sql, enable_google_maps_for_all_companies.sql, gamification.sql)

---

## Notes

- Run files in the order listed above
- Most files use `IF NOT EXISTS` so they're safe to re-run
- If a file fails, check error messages - it may need a dependency from an earlier phase
- The RLS warning on `spatial_ref_sys` is normal and can be ignored

