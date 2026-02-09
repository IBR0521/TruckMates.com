# Role-Based Access Control (RBAC) Implementation

## Overview

TruckMates now has a comprehensive role-based access control system that restricts features based on employee roles. The system includes:

1. **15 Employee Roles** organized into 6 groups
2. **Feature-level permissions** (view, create, edit, delete, manage)
3. **Sidebar navigation** that adapts to user role
4. **Page-level protection** with AccessGuard component
5. **Server action permission checks** for security

---

## Employee Roles & Groups

### Group 1: Executive/Management
- **Owner/Company Manager** - Full access to all features
- **IT/System Administrator** - System configuration and user management

### Group 2: Operations
- **Operations Manager/Dispatcher** - Day-to-day operations, dispatch, routes, loads
- **Warehouse/Logistics Coordinator** - Load coordination, BOL, address book
- **Broker/Carrier Manager** - Marketplace operations

### Group 3: Field Operations
- **Driver** - Assigned routes/loads, ELD, DVIR
- **Fleet Manager** - Vehicle and fleet management
- **Maintenance Manager/Mechanic** - Vehicle maintenance

### Group 4: Compliance & Safety
- **Safety & Compliance Manager** - Safety programs, ELD, DVIR, IFTA
- **Compliance Officer** - Regulatory compliance, IFTA reporting

### Group 5: Business Operations
- **Accounting/Finance Manager** - Financial management, invoicing, reports
- **Customer Service/Account Manager** - Customer relations, portal
- **Sales Representative** - Business development, marketplace

### Group 6: Support Functions
- **HR/Employee Manager** - Employee management, users
- **Data Analyst/Reporting Specialist** - Reports and analytics (view only)

---

## Feature Access Matrix

| Feature | Owner | IT Admin | Ops Mgr | Warehouse | Broker | Driver | Fleet Mgr | Maint Mgr | Safety | Compliance | Accounting | Customer | Sales | HR | Analyst |
|---------|:-----:|:--------:|:-------:|:---------:|:------:|:------:|:---------:|:---------:|:------:|:----------:|:----------:|:--------:|:----:|:--:|:-------:|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Drivers | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Vehicles | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Routes | ✅ | ❌ | ✅ | ✅ | ✅ | ✅* | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Loads | ✅ | ❌ | ✅ | ✅ | ✅ | ✅* | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ |
| Dispatch | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Fleet Map | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| CRM | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Accounting | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Maintenance | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| DVIR | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| ELD | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| IFTA | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Reports | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Documents | ✅ | ✅ | ✅ | ✅ | ✅ | ✅* | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| BOL | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Alerts | ✅ | ❌ | ✅ | ✅ | ✅ | ✅* | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Reminders | ✅ | ❌ | ✅ | ✅ | ❌ | ✅* | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Employees | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Settings | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Marketplace | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |

*Driver: Only assigned routes/loads, personal documents/alerts/reminders

---

## Implementation Details

### 1. Registration Flow

**Step 1: Group Selection** (`/register`)
- User selects from 6 department groups
- Clean interface with 3-column grid

**Step 2: Role Selection** (`/register/role?group=operations`)
- Shows 2-4 roles within selected group
- Displays role description and manager badge

**Step 3: Registration Form** (`/register/manager?role=operations_manager`)
- Role stored in user metadata (`employee_role`)
- Backward compatible with legacy roles

### 2. Sidebar Navigation

The sidebar automatically shows/hides features based on user role:
- Uses `canViewFeature(role, feature)` to check permissions
- Only displays accessible features
- Manager badge shown for manager roles

### 3. Page Protection

Use `AccessGuard` component to protect pages:

```tsx
import { AccessGuard } from "@/components/access-guard"

export default function DriversPage() {
  return (
    <AccessGuard requiredFeature="drivers">
      {/* Page content */}
    </AccessGuard>
  )
}
```

### 4. Server Action Protection

Add permission checks to server actions:

```ts
import { checkViewPermission, checkCreatePermission } from "@/lib/server-permissions"

export async function getDrivers() {
  const permission = await checkViewPermission("drivers")
  if (!permission.allowed) {
    return { error: permission.error, data: null }
  }
  // ... rest of function
}
```

### 5. Permission Types

- **view**: Can see the feature
- **create**: Can create new items
- **edit**: Can modify existing items
- **delete**: Can remove items
- **manage**: Full management access

---

## Files Created/Modified

### New Files
- `lib/roles.ts` - Role definitions and groups
- `lib/feature-permissions.ts` - Feature access matrix
- `lib/server-permissions.ts` - Server-side permission checks
- `lib/action-wrapper.ts` - Action wrapper helper
- `lib/hooks/use-feature-access.ts` - Client-side permission hook
- `components/access-guard.tsx` - Page protection component
- `app/register/role/page.tsx` - Role selection page

### Modified Files
- `app/register/page.tsx` - Group selection
- `app/register/manager/page.tsx` - Role handling
- `app/register/user/page.tsx` - Role handling
- `components/dashboard/sidebar.tsx` - Role-based navigation
- `app/actions/user.ts` - Employee role retrieval
- `app/actions/drivers.ts` - Permission checks
- `app/actions/loads.ts` - Permission checks
- `app/dashboard/drivers/page.tsx` - AccessGuard wrapper

---

## Usage Examples

### Check Permission in Component

```tsx
import { useFeatureAccess } from "@/lib/hooks/use-feature-access"

function MyComponent() {
  const { hasAccess, userRole } = useFeatureAccess()
  
  if (!hasAccess("drivers")) {
    return <div>Access denied</div>
  }
  
  return <div>Driver content</div>
}
```

### Check Permission in Server Action

```ts
import { checkCreatePermission } from "@/lib/server-permissions"

export async function createSomething() {
  const permission = await checkCreatePermission("drivers")
  if (!permission.allowed) {
    return { error: permission.error, data: null }
  }
  // ... create logic
}
```

---

## Testing Checklist

- [x] Registration flow works (group → role → form)
- [x] Sidebar shows correct features per role
- [x] Page protection works (AccessGuard)
- [x] Server actions check permissions
- [x] Build succeeds with no errors
- [ ] Test with different roles in production
- [ ] Verify all pages have appropriate protection

---

## Next Steps

1. Add AccessGuard to all dashboard pages
2. Add permission checks to all server actions
3. Create role-specific dashboards
4. Add permission indicators in UI (e.g., "You need X role to access this")
5. Add role management UI for owners/managers

---

## Notes

- Legacy roles (`manager`, `user`, `driver`) are automatically mapped to new roles
- Owner role has full access to everything
- Driver role has limited access (only assigned items)
- All permission checks are server-side for security
- Client-side checks are for UI only (not security)






