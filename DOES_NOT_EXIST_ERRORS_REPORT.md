# Comprehensive "Does Not Exist" Errors Report
**Generated:** January 2025  
**Status:** Complete Analysis

---

## Executive Summary

This report documents all "does not exist" errors and warnings found across the platform. These fall into four main categories:
1. **Export/Import Errors** (Turbopack cache issues - mostly resolved)
2. **Database Table Missing Errors** (Gracefully handled with fallbacks)
3. **RPC Function Missing Errors** (With helpful error messages)
4. **Database Column Missing Errors** (Optional columns handled gracefully)

---

## 1. Export/Import Errors (Turbopack Cache Issues)

### Status: ✅ **RESOLVED** (Fixed with JSDoc comments)

These were Turbopack build cache issues where exports existed but weren't being recognized. All have been fixed by adding JSDoc comments to force re-parsing.

#### Fixed Issues:

1. **`createTruck`** - `app/actions/trucks.ts`
   - **Error:** "Export createTruck doesn't exist in target module"
   - **Import Location:** `app/actions/account-setup.ts:6`
   - **Status:** ✅ Fixed

2. **`createMaintenance`** - `app/actions/maintenance.ts`
   - **Error:** "Export createMaintenance doesn't exist in target module"
   - **Import Location:** `app/actions/auto-maintenance.ts:6`
   - **Status:** ✅ Fixed

3. **`getCompanySettings`** - `app/actions/number-formats.ts`
   - **Error:** "Export getCompanySettings doesn't exist in target module"
   - **Import Location:** Multiple files (dashboard pages, settings pages)
   - **Status:** ✅ Fixed

4. **`getLoads`** - `app/actions/loads.ts`
   - **Error:** "Export getLoads doesn't exist in target module"
   - **Import Location:** Dashboard pages
   - **Status:** ✅ Fixed

5. **`checkAndSendMaintenanceAlerts`** - `app/actions/predictive-maintenance-alerts.ts`
   - **Error:** "Code generation for chunk item errored - Expected export to be in eval context"
   - **Import Location:** `app/actions/auto-maintenance.ts:177`
   - **Status:** ✅ Fixed (also removed unused import)

6. **`getUnassignedLoads`** - `app/actions/dispatches.ts`
   - **Error:** "Export getUnassignedLoads doesn't exist in target module"
   - **Import Location:** Dispatch board pages
   - **Status:** ✅ Fixed

---

## 2. Database Table "Does Not Exist" Errors

### Status: ⚠️ **GRACEFULLY HANDLED** (With fallbacks and helpful error messages)

These errors are handled gracefully with proper error checking and user-friendly messages.

### Tables Checked:

#### 1. **`loads` Table**
   - **Location:** `app/actions/loads.ts`
   - **Lines:** 132, 186
   - **Error Code:** `42P01` or message includes "does not exist"
   - **Handling:**
     ```typescript
     if (error.code === "42P01" || error.message.includes("does not exist")) {
       console.error("[getLoads] Loads table does not exist")
       return { error: "Loads table does not exist", data: null }
     }
     ```
   - **Impact:** Low - Core table, should always exist
   - **Action Required:** Run base schema migration

#### 2. **`company_settings` Table**
   - **Location:** `app/actions/number-formats.ts`
   - **Line:** 76
   - **Handling:**
     ```typescript
     if (error && (error.code === "42P01" || error.message.includes("does not exist"))) {
       return { error: "company_settings table does not exist. Please run the SQL schema.", data: null }
     }
     ```
   - **Impact:** Medium - Settings won't work without this table
   - **Action Required:** Run `company_settings` schema migration

#### 3. **`reminders` Table**
   - **Location:** `app/actions/reminders.ts`
   - **Lines:** 67, 80, 276, 459, 471
   - **Handling:** Returns empty array `[]` instead of error
   - **Impact:** Low - Feature works without table (returns empty)
   - **Action Required:** Optional - Run reminders schema if needed

#### 4. **`crm_documents` Table**
   - **Location:** `app/actions/crm-documents.ts`
   - **Lines:** 190, 238, 265, 333, 383
   - **Handling:**
     ```typescript
     if (error.message?.includes("does not exist") || error.code === "42P01") {
       console.warn("[CRM Documents] Table crm_documents does not exist. Please run the SQL migration.")
       return { data: [], error: null } // Returns empty array
     }
     ```
   - **Impact:** Medium - CRM documents feature won't work
   - **Action Required:** Run `crm_schema_complete.sql`

#### 5. **`notifications` Table**
   - **Location:** `app/actions/alerts.ts`
   - **Lines:** 620, 636
   - **Handling:** Gracefully skipped with comment "Note: notifications table may not exist, that's okay"
   - **Impact:** Low - Feature works without table
   - **Action Required:** Optional

#### 6. **`audit_logs` Table**
   - **Location:** `lib/audit-log.ts`
   - **Line:** 69
   - **Handling:**
     ```typescript
     if (error.code === "42P01" || error.message?.includes("does not exist")) {
       console.error("[AUDIT LOG] ⚠️ audit_logs table does not exist!")
       console.error("[AUDIT LOG] Please run the SQL migration: supabase/audit_logs_schema.sql")
     }
     ```
   - **Impact:** Low - Audit logging is optional
   - **Action Required:** Run `audit_logs_schema.sql` for audit logging

#### 7. **`maintenance_alert_notifications` Table**
   - **Location:** `app/actions/predictive-maintenance-alerts.ts`
   - **Line:** 51-64
   - **Handling:** Returns error if table doesn't exist
   - **Impact:** Medium - Predictive maintenance alerts won't work
   - **Action Required:** Run maintenance alerts schema migration

---

## 3. RPC Function "Does Not Exist" Errors

### Status: ⚠️ **FAIL LOUDLY** (With helpful error messages)

These RPC functions are required for certain features. The code fails loudly with helpful messages if they don't exist.

### Functions Checked:

#### 1. **`increment_load_number_sequence`**
   - **Location:** `app/actions/number-formats.ts`
   - **Line:** 280-293
   - **Error Handling:**
     ```typescript
     if (rpcError.message?.includes('function') || rpcError.message?.includes('does not exist')) {
       return { 
         error: 'Atomic sequence increment function not found. Please run fix_atomic_sequence_increment.sql migration.', 
         data: null 
       }
     }
     ```
   - **Impact:** High - Load number generation won't work
   - **Action Required:** Run `fix_atomic_sequence_increment.sql`

#### 2. **`increment_invoice_number_sequence`**
   - **Location:** `app/actions/number-formats.ts`
   - **Line:** 357-369
   - **Error Handling:** Same as above
   - **Impact:** High - Invoice number generation won't work
   - **Action Required:** Run `fix_atomic_sequence_increment.sql`

#### 3. **`increment_dispatch_number_sequence`**
   - **Location:** `app/actions/number-formats.ts`
   - **Line:** 431-443
   - **Error Handling:** Same as above
   - **Impact:** High - Dispatch number generation won't work
   - **Action Required:** Run `fix_atomic_sequence_increment.sql`

#### 4. **`increment_bol_number_sequence`**
   - **Location:** `app/actions/number-formats.ts`
   - **Line:** 505-517
   - **Error Handling:** Same as above
   - **Impact:** High - BOL number generation won't work
   - **Action Required:** Run `fix_atomic_sequence_increment.sql`

#### 5. **`check_and_send_maintenance_alerts`**
   - **Location:** `app/actions/predictive-maintenance-alerts.ts`
   - **Line:** 39-47
   - **Error Handling:** Returns error message
   - **Impact:** Medium - Predictive maintenance alerts won't work
   - **Action Required:** Run maintenance alerts RPC function migration

#### 6. **`get_dvir_stats`**
   - **Location:** `app/actions/dvir.ts`
   - **Line:** 642-643
   - **Error Handling:**
     ```typescript
     // Fallback to client-side calculation if RPC doesn't exist
     console.warn("get_dvir_stats RPC not found, using fallback:", error)
     ```
   - **Impact:** Low - Falls back to client-side calculation
   - **Action Required:** Optional

#### 7. **`update_company_for_setup`**
   - **Location:** `app/actions/account-setup.ts`
   - **Line:** 108-116
   - **Error Handling:** Falls back to direct update
   - **Impact:** Low - Has fallback
   - **Action Required:** Optional

#### 8. **`update_company_setup_complete`**
   - **Location:** `app/actions/account-setup.ts`
   - **Line:** 254-276
   - **Error Handling:** Falls back to direct update
   - **Impact:** Low - Has fallback
   - **Action Required:** Optional

#### 9. **`auto_enable_platform_integrations`**
   - **Location:** `app/actions/account-setup.ts`
   - **Line:** 213-223
   - **Error Handling:** Logs warning, doesn't fail setup
   - **Impact:** Low - Optional feature
   - **Action Required:** Optional

---

## 4. Database Column "Does Not Exist" Errors

### Status: ✅ **GRACEFULLY HANDLED** (Optional columns)

These are optional columns that may not exist in all database schemas. The code handles them gracefully.

### Columns Checked:

#### 1. **`bol_number` Column**
   - **Location:** `app/actions/loads.ts`
   - **Line:** 1572
   - **Handling:**
     ```typescript
     // Only include bol_number if it exists in the original load (column may not exist in schema)
     if (originalLoad.bol_number) {
       loadData.bol_number = originalLoad.bol_number
     }
     ```
   - **Impact:** Low - Optional field
   - **Action Required:** None - Handled gracefully

#### 2. **`load_type` Column**
   - **Location:** `app/actions/loads.ts`
   - **Line:** 1576
   - **Handling:** Similar to bol_number
   - **Impact:** Low - Optional field
   - **Action Required:** None - Handled gracefully

#### 3. **`uses_state_crossings` Column**
   - **Location:** `app/actions/ifta.ts`
   - **Line:** 403-404
   - **Handling:**
     ```typescript
     // Note: uses_state_crossings column may not exist in all schemas
     // If it doesn't exist, this will be ignored (non-breaking)
     ```
   - **Impact:** Low - Optional field
   - **Action Required:** None - Handled gracefully

---

## 5. Other "Not Found" Errors (User Data)

### Status: ✅ **EXPECTED BEHAVIOR** (Proper error handling)

These are not errors but proper error handling for missing user data:

#### Resource Not Found Errors:
- **Truck not found** - `app/actions/trucks.ts:106, 411`
- **Load not found** - `app/actions/loads.ts:195, 925, 1309, 1519`
- **BOL not found** - `app/actions/bol.ts:120, 501`
- **DVIR not found** - `app/actions/dvir.ts:166, 429`
- **Employee not found** - `app/actions/employees.ts:157, 252`
- **Alert rule not found** - `app/actions/alerts.ts:204, 293`
- **Document not found** - `app/actions/documents.ts:100, 192, 286`
- **Reminder not found** - `app/actions/reminders.ts:279, 283`
- **ELD device not found** - `app/actions/eld.ts:103`
- **Driver not found** - `app/actions/dvir.ts:264`
- **Fleet manager phone not found** - `app/actions/predictive-maintenance-alerts.ts:78`

**These are all proper error handling, not bugs.**

---

## Summary by Priority

### 🔴 **Critical (Must Fix)**
1. **RPC Functions for Number Generation** - Required for load/invoice/dispatch/BOL numbering
   - Files: `app/actions/number-formats.ts`
   - Action: Run `fix_atomic_sequence_increment.sql`

### 🟡 **High Priority (Should Fix)**
2. **Core Database Tables** - Required for basic functionality
   - `loads` table - Core functionality
   - `company_settings` table - Settings won't work
   - Action: Run base schema migrations

### 🟢 **Medium Priority (Nice to Have)**
3. **Feature-Specific Tables** - Required for specific features
   - `crm_documents` table - CRM documents feature
   - `maintenance_alert_notifications` table - Predictive maintenance
   - Action: Run feature-specific migrations

### ⚪ **Low Priority (Optional)**
4. **Optional Features** - Work without these
   - `reminders` table - Returns empty array
   - `notifications` table - Gracefully skipped
   - `audit_logs` table - Optional logging
   - Various RPC functions with fallbacks

---

## Recommended Actions

### Immediate Actions:
1. ✅ **Export errors** - Already fixed with JSDoc comments
2. ⚠️ **Run SQL migrations** for missing tables:
   - Base schema (`schema.sql`)
   - Company settings migration
   - CRM schema (`crm_schema_complete.sql`)
   - Audit logs (`audit_logs_schema.sql`)
   - Maintenance alerts schema

3. ⚠️ **Run RPC function migrations**:
   - `fix_atomic_sequence_increment.sql` (Critical for numbering)

### Verification:
Run the database consistency check:
```sql
-- Run: supabase/check_db_consistency.sql
```

---

## Conclusion

**Total Issues Found:** 30+ "does not exist" checks
- ✅ **6 Export errors** - All fixed
- ⚠️ **7 Database tables** - Need migrations (most have graceful fallbacks)
- ⚠️ **9 RPC functions** - Need migrations (some have fallbacks)
- ✅ **3 Optional columns** - Handled gracefully
- ✅ **10+ Resource not found** - Proper error handling (not bugs)

**Overall Status:** The platform handles missing resources gracefully. Most "does not exist" errors are:
1. Properly handled with fallbacks
2. Provide helpful error messages
3. Don't break core functionality
4. Can be resolved by running appropriate SQL migrations

**Recommendation:** Run the SQL migrations listed above to enable all features, but the platform will work in a degraded mode without them.


