# Demo Role-Based Feature Access Flow

## Overview
The demo now supports role-based feature access. Users select a role during demo setup and see only the features available to that role.

## Flow

1. **User clicks "View Demo"** → `/demo`
   - Shows 6 role groups (Executive, Operations, Field Ops, Compliance, Business, Support)

2. **User selects a group** → `/demo/role?group=operations`
   - Shows 2-4 roles within that group
   - Each role has a description

3. **User selects a role** → `/demo/setup?role=operations_manager`
   - Creates demo account with email: `demo_operations_manager@truckmates.com`
   - Sets `employee_role` in auth metadata
   - Sets `role` in users table
   - Redirects to dashboard

4. **Dashboard loads** → Sidebar shows features based on role
   - Sidebar checks `userRole && canViewFeature(userRole, feature)`
   - Only shows features the role has access to

## Role Detection

The sidebar retrieves the role from:
1. `user.user_metadata.employee_role` (auth metadata) - **Primary source**
2. `users.role` (database) - Fallback

The role is then mapped using `mapLegacyRole()`:
- Legacy roles: `manager` → `owner`, `user` → `driver`
- New roles: Pass through as-is (e.g., `operations_manager` stays `operations_manager`)

## Feature Permissions

Each role has permissions defined in `lib/feature-permissions.ts`:
- `view`: Can see the feature
- `create`: Can create items
- `edit`: Can modify items
- `delete`: Can remove items
- `manage`: Full management access

## Troubleshooting

If only Dashboard is visible:

1. **Check browser console** (development mode):
   - Look for `[Sidebar] Role detection:` logs
   - Verify `raw` role value
   - Verify `mapped` role value
   - Check `hasPermissions` is `true`

2. **Check role in database**:
   - Verify `users.role` is set correctly
   - Verify `auth.users.user_metadata.employee_role` is set

3. **Check permissions**:
   - Verify the role exists in `ROLE_FEATURE_PERMISSIONS`
   - Verify the role has `view` permissions for features

4. **Timeout issues**:
   - Sidebar has 3-second timeout for role retrieval
   - If timeout, it tries to get role from auth directly
   - Check network tab for slow requests

## Example Roles and Their Features

### Operations Manager
- ✅ Dashboard, Drivers, Vehicles, Routes, Loads, Dispatch, Fleet Map, Address Book, ELD, DVIR, Alerts, Reminders, Documents, BOL, Reports
- ❌ Accounting, CRM, Maintenance, IFTA, Employees, Settings, Marketplace

### Driver
- ✅ Dashboard, Routes (assigned only), Loads (assigned only), ELD, DVIR, Documents (personal), Alerts (personal), Reminders (personal)
- ❌ Everything else

### Accounting Manager
- ✅ Dashboard, Accounting, Reports, CRM, Documents, BOL, Alerts, Reminders
- ❌ Drivers, Vehicles, Routes, Loads, Dispatch, Maintenance, ELD, DVIR, IFTA, Employees, Settings, Marketplace

## Debug Mode

In development, the sidebar shows:
- Current role
- Loading state
- Number of features with permissions

This helps identify if the role is being detected correctly.





