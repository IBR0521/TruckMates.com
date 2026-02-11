# Complete SQL Files List - All 89 Files

**Total SQL Files:** 89  
**Included in Execution List:** 67 files  
**Excluded:** 22 files (see reasons below)

---

## ✅ INCLUDED FILES (67 files - Run These)

### Already Run (4 files):
1. ✅ `schema.sql`
2. ✅ `trigger.sql`
3. ✅ `fix_users_rls_recursion.sql`
4. ✅ `fix_companies_rls_v3.sql`

### Remaining to Run (63 files):
5. `crm_schema_complete.sql`
6. `notifications_table.sql`
7. `notifications_schema.sql`
8. `audit_logs_schema.sql`
9. `drivers_schema_extended.sql`
10. `trucks_schema_extended.sql`
11. `loads_schema_extended.sql`
12. `add_loads_pricing_columns.sql`
13. `add_fuel_tracking_columns.sql`
14. `add_driver_pay_rate.sql`
15. `settings_schema.sql`
16. `add_resend_integration.sql`
17. `filter_presets_schema.sql`
18. `storage_bucket_setup.sql`
19. `subscriptions_schema.sql`
20. `dvir_schema.sql`
21. `dvir_enhancements.sql`
22. `eld_schema.sql`
23. `hos_calculation_function.sql`
24. `eld_driver_mapping_schema.sql`
25. `eld_mobile_app_policies.sql`
26. `eld_fault_code_maintenance.sql`
27. `cron_hos_exception_alerts.sql`
28. `geofencing_schema.sql`
29. `postgis_migration.sql`
30. `enhanced_eta_traffic.sql`
31. `realtime_eta.sql`
32. `actual_route_tracking.sql`
33. `backhaul_optimization.sql`
34. `dfm_matching.sql`
35. `proximity_dispatching.sql`
36. `route_stops_schema_safe.sql`
37. `load_delivery_points_schema_safe.sql`
38. `load_relationship_type_schema.sql`
39. `loads_address_book_integration.sql`
40. `enhanced_address_book.sql`
41. `dispatch_board_enhancements.sql`
42. `dispatch_timeline_functions.sql`
43. `work_orders_schema.sql`
44. `maintenance_documents_schema.sql`
45. `parts_inventory_schema.sql`
46. `maintenance_parts_integration.sql`
47. `predictive_maintenance_alerts.sql`
48. `bol_schema.sql`
49. `ebol_invoice_trigger.sql`
50. `settlement_pay_rules_schema.sql`
51. `tax_fuel_reconciliation_schema.sql`
52. `ifta_tax_rates_schema.sql`
53. `ifta_state_crossing_automation.sql`
54. `invoice_three_way_matching.sql`
55. `trucklogics_features_schema.sql`
56. `driver_onboarding_schema.sql`
57. `customer_portal_schema.sql`
58. `feedback_schema.sql`
59. `webhooks_schema.sql`
60. `api_protection_schema.sql`
61. `quickbooks_oauth_schema.sql`
62. `truckmates_ai_schema.sql`
63. `idle_time_tracking.sql`
64. `detention_tracking.sql`
65. `auto_status_updates.sql`
66. `alerts_smart_triggers.sql`
67. `performance_indexes.sql`

---

## ❌ EXCLUDED FILES (22 files - Do NOT Run)

### Category 1: Marketplace (You said not needed - 5 files)
1. ❌ `add_company_types.sql` - Marketplace company types
2. ❌ `marketplace_schema.sql` - Marketplace tables
3. ❌ `marketplace_ratings_schema.sql` - Marketplace ratings
4. ❌ `external_broker_integrations_schema.sql` - External broker integrations
5. ❌ `insert_demo_marketplace_loads.sql` - Demo data only

### Category 2: Invitation Codes (Removed feature - 3 files)
6. ❌ `employee_management_schema_safe.sql` - Contains invitation_codes table
7. ❌ `check_db_consistency.sql` - References invitation_codes
8. ❌ `cleanup_outdated_db_objects.sql` - References invitation functions

### Category 3: One-Time Fix Files (Not needed on fresh DB - 5 files)
9. ❌ `fix_foreign_key_constraints.sql` - One-time fix
10. ❌ `fix_route_loads_foreign_key.sql` - One-time fix
11. ❌ `fix_company_function_overload.sql` - One-time fix
12. ❌ `fix_crm_views_company_id.sql` - One-time fix
13. ❌ `audit_logs_fix_insert_policy.sql` - One-time fix

### Category 4: Verification Scripts (Read-only, optional - 3 files)
14. ❌ `verify_bucket.sql` - Verification script
15. ❌ `verify_postgis_indexes.sql` - Verification script
16. ❌ `check_gist_indexes.sql` - Verification script

### Category 5: Duplicate/Alternative Schemas (2 files)
17. ❌ `enhanced_crm_schema.sql` - Use `crm_schema_complete.sql` instead
18. ❌ `integrations_schema.sql` - Conflicts with `settings_schema.sql` (both create `company_integrations`)

### Category 6: Migration Runner (1 file)
19. ❌ `RUN_MAINTENANCE_MIGRATIONS.sql` - Just runs other files, not needed

### Category 7: Optional/Utility Files (3 files)
20. ❌ `enable_google_maps_for_all_companies.sql` - Utility script (if needed)
21. ❌ `customers_schema_extended.sql` - Check if this adds columns to customers table
22. ❌ `gamification.sql` - Optional feature

---

## 🤔 FILES TO REVIEW (May Need to Include)

These files might be needed - let me know if you want them:

1. **`customers_schema_extended.sql`** - May add important columns to customers table
2. **`enable_google_maps_for_all_companies.sql`** - May enable Google Maps integration
3. **`gamification.sql`** - If you want gamification features

---

## 📋 COMPLETE EXECUTION ORDER (All 67 Files with Full Paths)

See `REMAINING_SQL_FILES_TO_RUN.md` for the complete list with full file paths.

---

## ⚠️ IMPORTANT NOTES

1. **Extensions First:** Run these before any SQL files:
   ```sql
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   CREATE EXTENSION IF NOT EXISTS "pgcrypto";
   CREATE EXTENSION IF NOT EXISTS "postgis";
   ```

2. **Execution Order:** Files must be run in the order specified in `REMAINING_SQL_FILES_TO_RUN.md`

3. **Dependencies:** Some files depend on others - follow the phase order

4. **Safe to Re-run:** Most files use `IF NOT EXISTS` so they're safe to re-run

---

## ❓ Questions for You

1. Do you want to include `customers_schema_extended.sql`? (May add important columns)
2. Do you want to include `enable_google_maps_for_all_companies.sql`? (Google Maps integration)
3. Do you want to include `gamification.sql`? (Gamification features)
4. Should I check `enhanced_crm_schema.sql` vs `crm_schema_complete.sql` to see if there are features you're missing?

Let me know and I'll update the execution list!

