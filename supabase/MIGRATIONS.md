# Supabase SQL Migration Order

Ordered by inferred table dependency from `CREATE TABLE` and `ALTER TABLE`/`REFERENCES` statements.

000. `000_auth_schema.sql` - TRUCKMATES AUTHENTICATION SCHEMA
002. `002_account_setup_schema.sql` - Account Setup Tracking Schema
003. `003_actual_route_tracking.sql` - Planned vs. Actual Route Tracking
004. `004_add_company_type_quick_fix.sql` - Quick fix: Add company_type column to companies table
005. `005_add_driver_pay_rate.sql` - Add pay_rate field to drivers table for automatic settlement calculations
006. `006_add_dvir_errors_rls.sql` - Add RLS to dvir_errors table
007. `007_add_fuel_tracking_columns.sql` - Add Fuel Tracking Columns to Expenses Table
008. `008_add_ifta_reports_columns.sql` - Add missing columns to ifta_reports table
009. `009_add_invoices_payment_columns.sql` - Add Missing Payment Tracking Columns to Invoices Table
010. `010_add_resend_integration.sql` - Add Resend Email Integration columns to company_integrations table
011. `011_add_routes_cost_columns.sql` - Add Missing Cost and Notes Columns to Routes Table
012. `012_add_tracking_token.sql` - Add public_tracking_token field to loads table for secure public tracking
013. `013_alerts_smart_triggers.sql` - Smart Alerts via Database Triggers
014. `014_audit_logs_fix_insert_policy.sql` - Quick Fix: Add INSERT Policy for Audit Logs
015. `015_auto_enable_platform_integrations.sql` - Auto-Enable Platform Integrations for New Companies
016. `016_backhaul_optimization.sql` - Backhaul Optimization
017. `017_check_db_consistency.sql` - Database Consistency Check
018. `018_check_gist_indexes.sql` - Simple Check for GIST Indexes
019. `019_cleanup_outdated_db_objects.sql` - Cleanup Outdated Database Objects in Supabase
020. `020_cron_hos_exception_alerts.sql` - HOS Exception Alerts Function
021. `021_customers_schema_extended.sql` - Extended Customers Schema to match TruckLogics
022. `022_dfm_matching.sql` - Digital Freight Matching (DFM)
023. `023_dispatch_board_enhancements.sql` - Enhanced Dispatch Board - Phase 1: Visual Clarity & Real-Time Updates
024. `024_dispatch_timeline_functions.sql` - Dispatch Timeline & Gantt Chart - PostGIS Functions
025. `025_drivers_schema_extended.sql` - Extended Drivers Schema to match TruckLogics
026. `026_ebol_invoice_trigger.sql` - eBOL Invoice Automation Trigger
027. `027_eld_api_keys_encryption.sql` - Migration: Encrypt API keys and secrets in eld_devices table
028. `028_eld_locations_speed_heading_decimal.sql` - Migration: Change speed and heading columns from INTEGER to DECIMAL
029. `029_eld_logs_unique_constraint.sql` - Add unique constraint to prevent duplicate ELD logs
030. `030_eld_mobile_app_policies.sql` - ELD Mobile App RLS Policies Update
031. `031_enable_google_maps_for_all_companies.sql` - Enable Google Maps Integration for All Companies
032. `032_enhanced_eta_traffic.sql` - Enhanced AI-Powered Predictive ETA with Real-Time Traffic
033. `033_factoring_schema.sql` - Factoring: company settings + invoice tracking
034. `034_find_all_problematic_policies.sql` - Find ALL Policies That Still Need Optimization
035. `035_find_locations_within_radius_filtered.sql` - Bounded variant of `find_locations_within_radius` to prevent unbounded
036. `036_find_tables_missing_company_id.sql` - Find tables from the migration that don't have company_id column
037. `037_fix_all_rls_warnings.sql` - Comprehensive RLS Performance Fix - All Warnings
038. `038_fix_all_security_warnings.sql` - Fix All Security Warnings - Comprehensive Solution
039. `039_fix_atomic_sequence_increment.sql` - Fix Atomic Sequence Increment for Number Generation
040. `040_fix_auth_trigger_privilege_escalation.sql` - BUG-034 FIX: Auth trigger privilege escalation vulnerability
041. `041_fix_crm_views_company_id.sql` - Quick Fix: Add company_id to CRM Performance Views
042. `042_fix_drivers_rls_setup.sql` - Fix RLS policies for drivers and trucks tables to use the actual 6-role system
043. `043_fix_duplicate_trigger.sql` - FIX DUPLICATE TRIGGER
044. `044_fix_duplicate_trigger_comprehensive.sql` - COMPREHENSIVE FIX FOR DUPLICATE TRIGGER
045. `045_fix_duplicate_trigger_final.sql` - FINAL FIX FOR DUPLICATE TRIGGER
046. `046_fix_dvir_audit_function.sql` - Fix DVIR Audit Function
047. `047_fix_ein_atomic_write.sql` - Fix EIN Atomic Write - Prevent Orphaned Records
048. `048_fix_eld_rls_policies.sql` - Fix ELD RLS Policies - Update role check from 'manager' to correct roles
049. `049_fix_function_search_path.sql` - Fix Function Search Path - Generate Fix Statements
050. `050_fix_ifta_reports_rls.sql` - Fix RLS Policies for ifta_reports table
051. `051_fix_is_user_manager_function.sql` - Fix is_user_manager() function to check for correct manager roles
052. `052_fix_marketplace_ratings_constraints.sql` - BUG-066 FIX: Marketplace ratings constraints
053. `053_fix_payment_method_default_atomic.sql` - Fix Payment Method Default Swap - Atomic Transaction
054. `054_fix_per_company_unique_constraints.sql` - Fix Unique Constraints to be Per-Company (Multi-Tenant Isolation)
055. `055_fix_rls_company_creation.sql` - create_company_for_user — superseded (do not maintain a duplicate here)
056. `056_fix_rls_performance.sql` - Fix RLS Performance Issues
057. `057_fix_security_warnings.sql` - Fix Security Warnings
058. `058_fix_security_warnings_actual.sql` - Fix Security Warnings - Comprehensive Solution
059. `059_fix_spatial_ref_sys_rls.sql` - Fix RLS Warning for spatial_ref_sys Table
060. `060_fix_spatial_ref_sys_rls_actual.sql` - ACTUAL Fix for spatial_ref_sys RLS Warning
061. `061_fix_spatial_ref_sys_rls_final.sql` - Final Fix for spatial_ref_sys RLS Warning
062. `062_fix_unindexed_foreign_keys.sql` - Fix Unindexed Foreign Keys
063. `063_get_dvir_stats_rpc.sql` - RPC function to get DVIR statistics efficiently
064. `064_get_trigger_details.sql` - GET DETAILED TRIGGER INFORMATION
065. `065_hos_calculation_function.sql` - SQL Function: calculate_remaining_hos
066. `066_ifta_reports_data_sources.sql` - Optional metadata: how IFTA report mileage was sourced (GPS vs manual trip sheets)
067. `067_insert_demo_marketplace_loads.sql` - Insert Demo Marketplace Loads
068. `068_insert_demo_platform_data.sql` - COMPREHENSIVE PLATFORM DEMO DATA
069. `069_investigate_duplicate_trigger.sql` - INVESTIGATE DUPLICATE TRIGGER
070. `070_load_relationship_type_schema.sql` - Add Load Relationship Type field to loads table
071. `071_maintenance_parts_integration.sql` - Maintenance Parts Inventory Integration
072. `migrations/072_20260410_fix_auth_user_delete_constraints.sql` - Fix user deletion failures from auth.users
073. `migrations/073_20260410_fix_security_linter_warnings.sql` - Security linter hardening pass
074. `migrations/074_20260412120000_eld_latest_locations_per_driver.sql` - One row per driver: latest eld_locations ping (avoids scanning 800 arbitrary rows in app code).
075. `migrations/075_20260413120000_notifications_realtime_publication.sql` - Realtime (postgres_changes) for public.notifications:
076. `migrations/076_20260413140000_notifications_security_linter_fixes.sql` - Supabase database linter remediations (security):
077. `migrations/077_20260416171500_enforce_paid_plan_stripe_prices.sql` - Ensure paid plans cannot be configured without Stripe price IDs.
078. `migrations/078_20260417100000_security_linter_hardening.sql` - Security linter hardening migration
079. `migrations/079_20260421113000_add_dvir_source_columns.sql` - Provider-synced DVIR metadata.
080. `migrations/080_20260425100000_add_fuel_price_history_and_fsc_settings.sql` - Fuel surcharge automation: weekly DOE/EIA diesel history + FSC baseline settings.
081. `migrations/081_20260425130000_add_per_diem_settings_and_settlement_fields.sql` - Per-diem support for settlements and company defaults.
082. `migrations/082_20260426133000_add_stripe_ach_fields_for_settlements.sql` - ALTER TABLE public.drivers
083. `migrations/083_20260426220000_add_factoring_api_integration_fields.sql` - ALTER TABLE public.company_settings
084. `migrations/084_20260426221500_add_hazmat_details_to_loads.sql` - Add HAZMAT-specific details to loads
085. `migrations/085_20260427104000_add_driver_normalized_phone.sql` - ALTER TABLE public.drivers
086. `migrations/086_20260427113000_add_onboarding_tour_state_to_users.sql` - ALTER TABLE public.users
087. `migrations/087_20260427120000_add_fcm_token_to_users.sql` - ALTER TABLE public.users
088. `migrations/088_20260428001000_add_customer_portal_load_request_fields.sql` - ALTER TABLE public.loads
089. `migrations/089_ADD_SUBSCRIPTION_INSERT_POLICY.sql` - ADD INSERT POLICY FOR SUBSCRIPTIONS TABLE
090. `migrations/090_CHECK_DATA_COUNTS.sql` - Quick Data Counts Check for Demo Company
091. `migrations/091_CHECK_DEMO_DATA.sql` - Quick check: Verify demo data exists in your database
092. `migrations/092_CHECK_DEMO_FUNCTION.sql` - Quick check: Verify populate_demo_data_for_company function exists
093. `migrations/093_CHECK_REGISTRATION_ISSUES.sql` - 093 CHECK REGISTRATION ISSUES
094. `migrations/094_CREATE_BUCKET.sql` - COPY THIS ENTIRE FILE AND PASTE INTO SUPABASE SQL EDITOR
095. `migrations/095_CREATE_BUCKET_NOW.sql` - COPY AND PASTE THIS ENTIRE FILE INTO SUPABASE SQL EDITOR
096. `migrations/096_CREATE_BUCKET_SQL.sql` - Create the documents storage bucket
097. `migrations/097_DROP_CRM_TABLES.sql` - Drop CRM tables to start fresh
098. `migrations/098_ENABLE_POSTGIS.sql` - Enable PostGIS Extension
099. `migrations/099_ENABLE_POSTGIS_SIMPLE.sql` - Enable PostGIS Extension in Supabase
100. `migrations/100_FIX_MISSING_DATA.sql` - Fix Missing Demo Data - Create Trucks, Loads, and Invoices
101. `migrations/101_FIX_SUBSCRIPTION_RLS_QUICK.sql` - Quick Fix: Add INSERT policy for subscriptions table
102. `migrations/102_QUICK_BUCKET_SETUP.sql` - QUICK SETUP: Copy and paste this into Supabase SQL Editor
103. `migrations/103_QUICK_MISSING_CHECK.sql` - 103 QUICK MISSING CHECK
104. `migrations/104_subscriptions_backfill_and_signup_seed.sql` - Seed subscriptions row on new companies + backfill existing companies on free plan.
105. `migrations/105_VERIFY_DEMO_DATA.sql` - Verify Demo Data Exists
106. `migrations/106_VERIFY_DEMO_DATA_SIMPLE.sql` - Quick Demo Data Verification - All Counts in One Query
107. `107_one_time_dedupe_drivers_by_email.sql` - ONE-TIME: Deduplicate drivers (same company + same email, case-insensitive)
108. `108_performance_indexes.sql` - Performance Indexes for Logistics SaaS Platform
109. `109_populate_demo_data_function.sql` - Automated Demo Data Population Function
110. `110_postgis_migration.sql` - PostGIS Migration for Location Tracking
111. `111_promiles_load_estimate.sql` - ProMiles-style planning snapshot on loads (estimates before trip; reconcile with GPS/IFTA later)
112. `112_proximity_dispatching.sql` - Proximity Dispatching with PostGIS + HOS Filtering
113. `113_quick_verification.sql` - QUICK VERIFICATION - Run this to check critical components
114. `114_quickbooks_mapping_schema.sql` - QuickBooks minimal mapping settings
115. `115_quickbooks_oauth_schema.sql` - QuickBooks OAuth Token Storage
116. `116_refresh_supabase_linter.sql` - Refresh Supabase Linter Cache
117. `117_remove_unused_indexes.sql` - Remove Unused Indexes
118. `118_RUN_MAINTENANCE_MIGRATIONS.sql` - Enhanced Maintenance Features - Migration Script
119. `119_schema.sql` - Enable UUID extension
120. `sql/legacy/120_factoring_schema.sql` - Factoring: company settings + invoice tracking
121. `sql/legacy/121_ifta_reports_data_sources.sql` - Optional metadata: how IFTA report mileage was sourced (GPS vs manual trip sheets)
122. `122_storage_bucket_setup.sql` - Storage Bucket Setup for Documents
123. `123_trucks_schema_extended.sql` - Extended Trucks Schema to match TruckLogics
124. `124_update_company_for_setup.sql` - Update Company During Setup (Bypasses RLS)
125. `125_update_company_setup_complete.sql` - Update Company Setup Complete (Bypasses RLS)
126. `126_verify_bucket.sql` - Verify Storage Bucket Setup
127. `127_verify_critical_columns.sql` - CRITICAL COLUMN VERIFICATION
128. `128_verify_migrations.sql` - MIGRATION VERIFICATION SCRIPT
129. `129_verify_postgis_indexes.sql` - Verify PostGIS GIST Indexes
130. `130_verify_rls_fixes.sql` - Verify RLS Performance Fixes
131. `131_verify_trigger_correctly.sql` - CORRECT TRIGGER VERIFICATION
132. `132_api_protection_schema.sql` - API Protection Schema
133. `133_audit_logs_schema.sql` - Audit Logs Schema
134. `134_bol_schema.sql` - BOL (Bill of Lading) Schema
135. `135_create_driver_performance_tables.sql` - Create Driver Performance Tables
136. `136_create_ifta_tax_rates_table.sql` - Create IFTA Tax Rates Table
137. `137_create_invitation_codes_table.sql` - Create invitation_codes table (required for Settings > Users > Invite)
138. `138_driver_onboarding_schema.sql` - Driver Onboarding Workflow Schema
139. `139_dvir_schema.sql` - DVIR (Driver Vehicle Inspection Report) Schema
140. `140_eld_fault_code_maintenance.sql` - ELD Fault Code Analysis & Predictive Maintenance
141. `141_eld_schema.sql` - ELD (Electronic Logging Device) Schema
142. `142_employee_management_schema_safe.sql` - Employee Management Schema (Safe Version)
143. `143_enterprise_api_keys_schema.sql` - Enterprise API Keys Schema
144. `144_external_broker_integrations_schema.sql` - External Broker/Load Board Integrations Schema
145. `145_feedback_schema.sql` - Feedback and Suggestions Schema
146. `146_filter_presets_schema.sql` - Filter Presets Schema
147. `147_fix_foreign_key_constraints.sql` - Fix Foreign Key Constraints to Allow Updates/Deletes
148. `148_fix_route_loads_foreign_key.sql` - Fix Foreign Key Constraint for routes and loads
149. `149_gamification.sql` - Driver Gamification and Scoring System
150. `150_geofencing_schema.sql` - Geofencing Schema
151. `151_ifta_tax_rates_schema.sql` - IFTA Tax Rates Management Schema
152. `152_integrations_schema.sql` - Integration Settings Schema
153. `153_load_delivery_points_schema_safe.sql` - Load Delivery Points Schema (Safe Version)
154. `154_maintenance_documents_schema.sql` - Maintenance Document Storage
155. `155_marketplace_schema.sql` - Load Marketplace Schema
156. `migrations/156_20260411120000_ensure_company_settings_table.sql` - Ensures public.company_settings exists (fixes: "company_settings table does not exist")
157. `migrations/157_20260424113000_add_trailers_and_asset_links.sql` - Trailer management: base trailers table + cross-module trailer links
158. `migrations/158_20260425104500_add_compliance_registrations.sql` - Compliance registrations: UCR / IRP / MCS-150 / Operating Authority.
159. `migrations/159_20260425111000_add_roadside_inspections.sql` - Roadside inspection tracking (DOT/FMCSA CSA awareness).
160. `migrations/160_20260425113000_add_incidents.sql` - Accident / incident logging for compliance + FMCSA accident register export.
161. `migrations/161_20260426113000_add_gl_accounts_and_gl_codes.sql` - GL coding foundation for accounting, AP, and settlements.
162. `migrations/162_20260426120000_add_terminals_and_branch_links.sql` - Multi-terminal / branch management for single-company multi-location operations.
163. `migrations/163_20260426130000_add_driver_applications.sql` - CREATE TABLE IF NOT EXISTS public.driver_applications (
164. `migrations/164_20260426140000_add_csa_scores.sql` - ALTER TABLE public.company_settings
165. `migrations/165_20260426143000_add_fuel_card_live_sync.sql` - CREATE TABLE IF NOT EXISTS public.fuel_card_transactions (
166. `migrations/166_20260426150000_add_bank_reconciliation.sql` - CREATE TABLE IF NOT EXISTS public.bank_statement_imports (
167. `migrations/167_20260426234500_add_permit_management.sql` - Oversize / Overweight Permit Management
168. `migrations/168_20260427000500_add_owner_operator_lease_management.sql` - Owner-Operator Lease Management
169. `migrations/169_20260427002000_add_edi_receiving_and_tender_workflow.sql` - EDI Receiving + Tender workflow (204 inbound, 990/214 outbound artifacts)
170. `migrations/170_20260428140000_add_data_subject_requests.sql` - CREATE TABLE IF NOT EXISTS public.data_subject_requests (
171. `171_notifications_schema.sql` - Notification Preferences Table
172. `172_notifications_table.sql` - Notifications Table
173. `173_parts_inventory_schema.sql` - Parts Inventory System Schema
174. `174_predictive_maintenance_alerts.sql` - Predictive Maintenance SMS Alerts
175. `175_realtime_eta.sql` - Real-time ETA Updates with PostGIS
176. `176_route_stops_schema_safe.sql` - Route Stops Schema (Safe Version)
177. `177_settings_schema.sql` - Settings Schema for TruckMates
178. `178_settlement_pay_rules_schema.sql` - Settlement Pay Rules Engine Schema
179. `179_subscriptions_schema.sql` - Subscriptions Schema
180. `180_tax_fuel_reconciliation_schema.sql` - Tax and Fuel Reconciliation Schema for IFTA Reporting
181. `181_trip_sheets_schema.sql` - IFTA Trip Sheets (manual entry — no ELD required)
182. `182_trucklogics_settings_enhancements.sql` - TruckLogics Settings Enhancements
183. `183_webhooks_schema.sql` - Webhook System Schema
184. `184_dvir_enhancements.sql` - DVIR Enhancements
185. `185_eld_driver_mapping_schema.sql` - ELD Driver ID Mapping Schema
186. `186_ifta_state_crossing_automation.sql` - IFTA State Line Crossing Automation with PostGIS
187. `migrations/187_20260421103000_add_eld_hos_clocks.sql` - Live HOS clocks synced from ELD providers (Samsara, Motive).
188. `migrations/188_20260421110000_add_eld_diagnostics.sql` - Engine diagnostics and fault-code telemetry from ELD providers.
189. `189_auto_status_updates.sql` - Automated Load Status Updates via Geofences
190. `190_enhanced_address_book.sql` - Enhanced Address Book with PostGIS & Role-Based Categorization
191. `191_geofencing_backend_engine.sql` - Geofencing Backend Engine (Entry/Exit/Dwell)
192. `192_idle_time_tracking.sql` - Idle Time Tracking
193. `193_marketplace_ratings_schema.sql` - Marketplace Ratings & Reviews Schema
194. `migrations/194_20260426233000_add_ltl_shipments_and_movements.sql` - LTL architecture foundation:
195. `195_add_documents_foreign_keys.sql` - Migration: Add foreign key columns to documents table for load, route, invoice, and expense relationships
196. `196_billing_invoices_schema.sql` - Billing Invoices Schema
197. `197_crm_schema_complete.sql` - CRM SCHEMA - Complete (Customers, Vendors, Contacts, Contact History)
198. `198_detention_tracking.sql` - Automated Detention Tracking System
199. `migrations/199_COPY_TO_SUPABASE.sql` - DATABASE SETUP FOR TRUCKMATES PLATFORM
200. `200_fix_rls_performance_part2.sql` - Fix RLS Performance Issues - Part 2
201. `201_loads_address_book_integration.sql` - Loads Address Book Integration
202. `202_add_loads_customer_relationship.sql` - Ensure `loads.customer_id` relationship exists for PostgREST schema cache
203. `203_add_loads_pricing_columns.sql` - Add missing columns to loads table
204. `204_customer_portal_schema.sql` - Customer Portal Access Schema
205. `205_enhanced_crm_schema.sql` - Enhanced CRM Schema - Logistics-Focused Relationship Management
206. `206_invoice_three_way_matching.sql` - Invoice Three-Way Matching Schema
207. `207_loads_schema_extended.sql` - Extended Loads Schema to match TruckLogics functionality
208. `migrations/208_20260426103000_add_vendor_invoices.sql` - Accounts Payable: vendor invoices and AP aging source table
209. `migrations/209_20260428113000_add_unified_communication_threads.sql` - CREATE TABLE IF NOT EXISTS public.communication_threads (
210. `210_trucklogics_features_schema.sql` - TruckLogics Features Schema
211. `211_work_orders_schema.sql` - Work Orders System
