# 6-Role RBAC Implementation

## Overview

TruckMates now uses a simplified 6-role system designed for enterprise logistics operations. Each role has specific permissions, dashboard views, and data access levels.

## The 6 Roles

### 1. Super Admin
- **Dashboard**: Global Overview (Financial Overview, Fleet Health, User Activity)
- **Permissions**: Full CRUD access to all features including Subscriptions, Bank Accounts, and User Roles
- **Access**: Complete system visibility

### 2. Operations Manager
- **Dashboard**: Marketplace & Coordination (Marketplace Status, Yard Management, Route Map)
- **Permissions**: CRUD for Loads, Vehicles, Drivers. Cannot access bank settings
- **Access**: High-level operations coordination

### 3. Dispatcher
- **Dashboard**: Active Load Board, AI Document Inbox, Driver HOS Clock
- **Permissions**: Create/Update Loads and Documents. Financial rates are **masked** (view-only, no editing)
- **Access**: Real-time execution and AI document processing

### 4. Safety & Compliance Officer
- **Dashboard**: HOS Violation Alerts, Document Expiry, Maintenance Log
- **Permissions**: CRUD for ELD Logs and Maintenance Records. No access to Load Pricing or Marketplace
- **Access**: ELD service and regulatory compliance

### 5. Financial Controller
- **Dashboard**: Invoicing Queue, Settlement Tracker, IFTA Summary
- **Permissions**: CRUD for Invoices, Payments, and Factoring. No access to Dispatching or Map tools
- **Access**: Order-to-Cash cycle management

### 6. Driver
- **Dashboard**: My Next Load, Document Scanner, Personal ELD Log
- **Permissions**: View Assigned Loads only. Create POD Uploads/DVIRs
- **Access**: Mobile task completion

## Implementation Details

### Files Created/Modified

1. **`lib/roles.ts`** - Updated to 6 roles only
2. **`lib/feature-permissions.ts`** - Permission structure for 6 roles
3. **`lib/data-masking.ts`** - Financial data masking for dispatchers
4. **`components/dashboard/role-dashboards/`** - 6 role-specific dashboard components
5. **`components/dashboard/role-dashboard-router.tsx`** - Routes to appropriate dashboard
6. **`app/dashboard/page.tsx`** - Updated to use role-based routing
7. **`components/dashboard/sidebar.tsx`** - Updated to show/hide features based on permissions

### Key Features

- **Role-Specific Dashboards**: Each role sees only relevant information
- **Data Masking**: Financial rates masked for dispatchers (view-only)
- **Permission-Based Navigation**: Sidebar shows only accessible features
- **Data Filtering**: Role-based data access (e.g., drivers see only assigned loads)

### Permission Types

- **view**: Can see the feature
- **create**: Can create new items
- **edit**: Can modify existing items
- **delete**: Can remove items
- **manage**: Full management access
- **masked**: View-only, data is masked (for financial rates)

## Migration from Old System

The system includes backward compatibility:
- Old roles are automatically mapped to new roles via `mapLegacyRole()`
- Existing users will be migrated to the closest matching role
- All existing permission checks continue to work

## Next Steps

1. **Data Filtering (RLS)**: Implement Row-Level Security in Supabase for role-based data access
2. **Financial Masking**: Apply data masking in load/route views for dispatchers
3. **Driver Mobile View**: Optimize driver dashboard for mobile devices
4. **Testing**: Test each role's dashboard and permissions

