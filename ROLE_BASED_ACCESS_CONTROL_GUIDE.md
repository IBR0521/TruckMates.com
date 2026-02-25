# Role-Based Access Control (RBAC) - Complete Guide

## Overview

TruckMates uses a **6-role system** with granular feature-level permissions. Each role has specific access to features based on their job function.

---

## The 6 Roles

### 1. **Super Admin** 👑
- **Who**: Company Owner/CEO
- **Description**: Full system control with access to all features, subscriptions, bank accounts, and user management
- **Dashboard Type**: Global dashboard with all metrics

### 2. **Operations Manager** 🚛
- **Who**: Lead Dispatcher, Fleet Manager
- **Description**: Marketplace and high-level coordination. Manages loads, vehicles, drivers, and yard operations
- **Dashboard Type**: Marketplace-focused dashboard

### 3. **Dispatcher** 📋
- **Who**: Real-time Operations Staff
- **Description**: Real-time execution role. Manages active loads, AI document processing, and driver HOS. **Financial rates are view-only (masked)**
- **Dashboard Type**: Active loads dashboard

### 4. **Safety & Compliance Officer** 🛡️
- **Who**: Safety Manager, Compliance Officer
- **Description**: Audit role focusing on ELD service and inspections. Manages HOS violations, document expiry, and maintenance logs
- **Dashboard Type**: ELD violations dashboard

### 5. **Financial Controller** 💰
- **Who**: Accounting Manager, Finance Team
- **Description**: Accounting role focusing on Order-to-Cash cycle. Manages invoicing, settlements, IFTA, and financial reporting
- **Dashboard Type**: Invoicing dashboard

### 6. **Driver** 🚗
- **Who**: Truck Drivers
- **Description**: Mobile task completion role. Views assigned loads, uploads PODs via document scanner, and manages personal ELD logs
- **Dashboard Type**: Mobile dashboard

---

## Feature Access Matrix

### Legend:
- ✅ **View**: Can see/read data
- ➕ **Create**: Can create new records
- ✏️ **Edit**: Can modify existing records
- 🗑️ **Delete**: Can delete records
- ⚙️ **Manage**: Full administrative control
- 👁️ **Masked**: Can view but data is masked (e.g., financial rates show as "***")

---

## Complete Access Breakdown

### **Super Admin** 👑
| Feature | Access |
|---------|--------|
| **Everything** | ✅ View, ➕ Create, ✏️ Edit, 🗑️ Delete, ⚙️ Manage |
| Dashboard | Full access to all metrics |
| Drivers | Full CRUD + Management |
| Vehicles | Full CRUD + Management |
| Routes | Full CRUD + Management |
| Loads | Full CRUD + Management |
| Dispatch | Full CRUD + Management |
| Fleet Map | Full access |
| Marketplace | Full CRUD + Management |
| Yard Management | Full CRUD + Management |
| Address Book | Full CRUD |
| CRM | Full CRUD |
| Accounting | Full CRUD + Management |
| Invoicing | Full CRUD + Management |
| Settlements | Full CRUD + Management |
| Factoring | Full CRUD + Management |
| Maintenance | Full CRUD + Management |
| DVIR | Full CRUD + Management |
| ELD | Full CRUD + Management |
| IFTA | Full CRUD + Management |
| Reports | Full access |
| Documents | Full CRUD |
| BOL | Full CRUD |
| Alerts | Full CRUD |
| Reminders | Full CRUD |
| Employees | Full CRUD + Management |
| Settings | Full access (only role with settings access) |
| Subscriptions | Full access |
| Bank Accounts | Full access |
| User Roles | Full access |
| Fuel Analytics | Full access |
| AI Documents | Full access |

---

### **Operations Manager** 🚛
| Feature | Access |
|---------|--------|
| Dashboard | ✅ View |
| Drivers | ✅ View, ➕ Create, ✏️ Edit |
| Vehicles | ✅ View, ➕ Create, ✏️ Edit |
| Routes | ✅ View, ➕ Create, ✏️ Edit, 🗑️ Delete, ⚙️ Manage |
| Loads | ✅ View, ➕ Create, ✏️ Edit, 🗑️ Delete, ⚙️ Manage |
| Dispatch | ✅ View, ➕ Create, ✏️ Edit, ⚙️ Manage |
| Fleet Map | ✅ View |
| Marketplace | ✅ View, ➕ Create, ✏️ Edit, 🗑️ Delete, ⚙️ Manage |
| Yard Management | ✅ View, ➕ Create, ⚙️ Manage |
| Address Book | ✅ View, ➕ Create, ✏️ Edit |
| ELD | ✅ View |
| DVIR | ✅ View |
| Documents | ✅ View, ➕ Create |
| BOL | ✅ View, ➕ Create, ✏️ Edit |
| Reports | ✅ View |
| Alerts | ✅ View, ➕ Create |
| Reminders | ✅ View, ➕ Create |

**❌ NO ACCESS TO:**
- Accounting/Financial features
- Invoicing/Settlements
- Maintenance management
- Settings
- Employees management
- Subscriptions/Bank accounts

---

### **Dispatcher** 📋
| Feature | Access |
|---------|--------|
| Dashboard | ✅ View |
| Loads | ✅ View (only active/upcoming), ➕ Create, ✏️ Edit (status updates only) |
| Routes | ✅ View (only assigned) |
| Drivers | ✅ View (only assigned drivers) |
| Dispatch | ✅ View |
| AI Documents | ✅ View, ➕ Create |
| ELD | ✅ View |
| DVIR | ✅ View |
| Documents | ✅ View, ➕ Create |
| BOL | ✅ View, ➕ Create, ✏️ Edit |
| Upload Document | ➕ Create (POD uploads) |
| Alerts | ✅ View, ➕ Create |
| Reminders | ✅ View, ➕ Create |
| Accounting | ✅ View (👁️ **MASKED** - rates show as "***") |

**❌ NO ACCESS TO:**
- Vehicle management
- Route creation/deletion
- Marketplace
- Financial management (can only view masked rates)
- Maintenance
- IFTA
- Reports
- Settings
- Employees

**🔒 RESTRICTIONS:**
- Can only see **assigned** loads/routes/drivers
- Financial data is **masked** (shows "***" instead of actual rates)
- Cannot delete anything
- Cannot manage anything

---

### **Safety & Compliance Officer** 🛡️
| Feature | Access |
|---------|--------|
| Dashboard | ✅ View |
| ELD | ✅ View, ➕ Create, ✏️ Edit, ⚙️ Manage |
| DVIR | ✅ View, ➕ Create, ✏️ Edit, ⚙️ Manage |
| Maintenance | ✅ View, ➕ Create, ✏️ Edit, ⚙️ Manage |
| Vehicles | ✅ View |
| Drivers | ✅ View |
| IFTA | ✅ View |
| Documents | ✅ View, ➕ Create, ✏️ Edit |
| Reports | ✅ View |
| Alerts | ✅ View, ➕ Create |
| Reminders | ✅ View, ➕ Create |

**❌ NO ACCESS TO:**
- Loads management
- Routes management
- Dispatch
- Marketplace
- Accounting/Financial features
- Invoicing/Settlements
- Settings
- Employees

**🎯 FOCUS AREAS:**
- ELD violations and compliance
- DVIR inspections
- Maintenance scheduling
- Safety alerts
- Document expiry tracking

---

### **Financial Controller** 💰
| Feature | Access |
|---------|--------|
| Dashboard | ✅ View |
| Accounting | ✅ View, ⚙️ Manage |
| Invoicing | ✅ View, ➕ Create, ✏️ Edit, ⚙️ Manage |
| Settlements | ✅ View, ➕ Create, ✏️ Edit, ⚙️ Manage |
| Factoring | ✅ View, ➕ Create, ✏️ Edit, ⚙️ Manage |
| IFTA | ✅ View |
| Reports | ✅ View |
| Documents | ✅ View, ➕ Create |
| Loads | ✅ View (only delivered loads not yet invoiced) |

**❌ NO ACCESS TO:**
- Dispatch operations
- Route management
- Driver management
- Vehicle management
- ELD/DVIR
- Maintenance
- Marketplace
- Settings
- Employees

**🎯 FOCUS AREAS:**
- Order-to-Cash cycle
- Invoice creation and management
- Driver settlements
- Financial reporting
- IFTA reporting

---

### **Driver** 🚗
| Feature | Access |
|---------|--------|
| Dashboard | ✅ View (mobile-optimized) |
| Routes | ✅ View (only assigned routes) |
| Loads | ✅ View (only assigned loads), ✏️ Edit (status updates only) |
| ELD | ✅ View (personal logs only) |
| DVIR | ✅ View, ➕ Create |
| Documents | ✅ View (personal documents only), ➕ Create |
| Upload Document | ➕ Create (POD uploads) |
| Alerts | ✅ View (personal alerts only) |
| Reminders | ✅ View (personal reminders only) |

**❌ NO ACCESS TO:**
- All other features
- Cannot see other drivers' data
- Cannot see financial information
- Cannot create/edit routes
- Cannot manage anything

**🔒 RESTRICTIONS:**
- Can only see **assigned** loads/routes
- Can only see **personal** documents/alerts/reminders
- Cannot delete anything
- Cannot manage anything
- Mobile-optimized interface

---

## Data Masking

### What is Data Masking?
For certain roles, financial data is **masked** (hidden) to show "***" instead of actual values. This allows users to see that data exists without revealing sensitive financial information.

### Who Gets Masked Data?
- **Dispatcher**: Accounting/Financial rates are masked
  - Example: Load value shows as "$***" instead of "$5,000"

### Masked Fields:
- `total_rate`
- `value`
- `rate`
- `freight_charges`
- `amount`

---

## Permission Types Explained

### **View** (Read-Only)
- Can see data in lists, tables, and detail pages
- Cannot modify or delete
- Example: Dispatcher can view loads but cannot delete them

### **Create**
- Can create new records
- Example: Operations Manager can create new routes

### **Edit**
- Can modify existing records
- May be limited to specific fields (e.g., status updates only)
- Example: Driver can update load status but not change origin/destination

### **Delete**
- Can remove records
- Usually restricted to managers
- Example: Operations Manager can delete routes/loads

### **Manage** (Full Control)
- Complete administrative control
- Can configure settings, assign resources, etc.
- Example: Operations Manager can manage dispatch operations

---

## Implementation Details

### How It Works:
1. **Role Detection**: User's role is stored in `auth.users.user_metadata.employee_role`
2. **Permission Checks**: `canViewFeature()`, `canCreateFeature()`, etc. check permissions
3. **UI Filtering**: Sidebar and pages hide/show features based on role
4. **Data Masking**: Financial data is masked for certain roles
5. **Server-Side Protection**: Server actions also check permissions

### Files Involved:
- `lib/roles.ts` - Role definitions
- `lib/feature-permissions.ts` - Permission matrix
- `lib/data-masking.ts` - Financial data masking
- `lib/hooks/use-feature-access.ts` - Client-side permission hook
- `components/access-guard.tsx` - Page-level protection
- `components/dashboard/sidebar.tsx` - Role-based navigation

---

## Common Scenarios

### Scenario 1: Dispatcher Views Load
- ✅ Can see load details
- ✅ Can see route information
- 👁️ Financial rates show as "***" (masked)
- ❌ Cannot see other dispatchers' loads
- ❌ Cannot delete load

### Scenario 2: Driver Uploads POD
- ✅ Can view assigned load
- ✅ Can upload document (POD)
- ✅ Can update load status to "Delivered"
- ❌ Cannot see financial information
- ❌ Cannot see other drivers' loads

### Scenario 3: Financial Controller Creates Invoice
- ✅ Can view delivered loads
- ✅ Can create invoice from load
- ✅ Can see all financial details
- ❌ Cannot see active loads
- ❌ Cannot manage dispatch

### Scenario 4: Safety Officer Reviews ELD Violations
- ✅ Can view all ELD data
- ✅ Can view HOS violations
- ✅ Can create DVIR
- ✅ Can manage maintenance
- ❌ Cannot see financial data
- ❌ Cannot manage loads/routes

---

## Best Practices

1. **Principle of Least Privilege**: Users only get access to what they need
2. **Data Masking**: Sensitive financial data is hidden from non-financial roles
3. **Role-Based Dashboards**: Each role sees a dashboard tailored to their job
4. **Server-Side Validation**: Permissions are checked on both client and server
5. **Audit Trail**: All actions are logged with user role information

---

## Summary Table

| Role | Primary Focus | Key Features | Financial Access |
|------|--------------|--------------|------------------|
| **Super Admin** | Everything | All features | ✅ Full access |
| **Operations Manager** | Marketplace & Coordination | Loads, Routes, Dispatch, Marketplace | ❌ No access |
| **Dispatcher** | Real-Time Execution | Active Loads, AI Docs, ELD | 👁️ Masked (view-only) |
| **Safety & Compliance** | ELD & Inspections | ELD, DVIR, Maintenance | ❌ No access |
| **Financial Controller** | Order-to-Cash | Invoicing, Settlements, IFTA | ✅ Full access |
| **Driver** | Mobile Tasks | Assigned Loads, POD Uploads, ELD | ❌ No access |

---

This RBAC system ensures that users only see and can interact with features relevant to their job function, improving security and user experience.


