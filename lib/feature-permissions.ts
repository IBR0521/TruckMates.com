import type { EmployeeRole } from "./roles"

// Feature categories
export type FeatureCategory =
  | "dashboard"
  | "drivers"
  | "vehicles"
  | "routes"
  | "loads"
  | "dispatch"
  | "fleet_map"
  | "address_book"
  | "crm"
  | "accounting"
  | "maintenance"
  | "dvir"
  | "eld"
  | "ifta"
  | "reports"
  | "documents"
  | "bol"
  | "alerts"
  | "reminders"
  | "employees"
  | "settings"
  | "marketplace"
  | "upload_document"
  | "fuel_analytics"
  | "subscriptions"
  | "bank_accounts"
  | "user_roles"
  | "yard_management"
  | "ai_documents"
  | "invoicing"
  | "settlements"
  | "factoring"
  | "all" // Special value for super admin - full access

// Permission types
export type PermissionType = "view" | "create" | "edit" | "delete" | "manage"

// Feature permissions: what each role can access
export const ROLE_FEATURE_PERMISSIONS: Record<EmployeeRole, {
  view: FeatureCategory[]
  create: FeatureCategory[]
  edit: FeatureCategory[]
  delete: FeatureCategory[]
  manage: FeatureCategory[]
  masked?: FeatureCategory[] // Features where data is masked (view-only, no editing)
}> = {
  // Super Admin - Full access to everything
  super_admin: {
    view: ["all"],
    create: ["all"],
    edit: ["all"],
    delete: ["all"],
    manage: ["all"],
  },

  // Operations Manager - Marketplace & Coordination
  operations_manager: {
    view: [
      "dashboard",
      "drivers",
      "vehicles",
      "routes",
      "loads",
      "dispatch",
      "fleet_map",
      "marketplace",
      "yard_management",
      "address_book",
      "crm",
      "eld",
      "dvir",
      "documents",
      "bol",
      "reports",
      "alerts",
      "reminders",
    ],
    create: [
      "drivers",
      "vehicles",
      "routes",
      "loads",
      "dispatch",
      "marketplace",
      "address_book",
      "crm",
      "bol",
      "documents",
      "alerts",
      "reminders",
    ],
    edit: [
      "drivers",
      "vehicles",
      "routes",
      "loads",
      "dispatch",
      "marketplace",
      "address_book",
      "crm",
      "bol",
    ],
    delete: [
      "routes",
      "loads",
      "marketplace",
      "crm",
      "eld",
    ],
    manage: [
      "dispatch",
      "routes",
      "loads",
      "marketplace",
      "yard_management",
      "crm",
    ],
  },

  // Dispatcher - Real-Time Execution
  dispatcher: {
    view: [
      "dashboard",
      "loads", // Only active/upcoming
      "routes", // Only assigned
      "drivers", // Only assigned drivers
      "dispatch",
      "ai_documents",
      "eld",
      "dvir",
      "documents",
      "bol",
      "alerts",
      "reminders",
      "accounting", // View-only, rates masked
    ],
    create: [
      "loads",
      "documents",
      "bol",
      "upload_document",
      "alerts",
      "reminders",
    ],
    edit: [
      "loads", // Status updates only
      "documents",
      "bol",
    ],
    delete: [],
    manage: [],
    masked: ["accounting"], // Financial rates are masked (view-only)
  },

  // Safety & Compliance Officer - ELD & Inspections
  safety_compliance: {
    view: [
      "dashboard",
      "eld",
      "dvir",
      "maintenance",
      "vehicles",
      "drivers",
      "ifta",
      "documents",
      "reports",
      "alerts",
      "reminders",
    ],
    create: [
      "eld",
      "dvir",
      "maintenance",
      "documents",
      "alerts",
      "reminders",
    ],
    edit: [
      "eld",
      "dvir",
      "maintenance",
      "documents",
    ],
    delete: ["eld", "dvir"],
    manage: [
      "eld",
      "dvir",
      "maintenance",
    ],
  },

  // Financial Controller - Order-to-Cash
  financial_controller: {
    view: [
      "dashboard",
      "accounting",
      "invoicing",
      "settlements",
      "factoring",
      "crm",
      "ifta",
      "reports",
      "documents",
      "loads", // Only delivered loads not yet invoiced
    ],
    create: [
      "invoicing",
      "settlements",
      "factoring",
      "crm",
      "documents",
    ],
    edit: [
      "invoicing",
      "settlements",
      "factoring",
      "crm",
    ],
    delete: [],
    manage: [
      "invoicing",
      "settlements",
      "factoring",
      "crm",
    ],
  },

  // Driver - Mobile Task Completion
  driver: {
    view: [
      "dashboard",
      "loads", // Assigned loads only (server-filtered); routes folded into "My load" UX
      "eld",
      "dvir",
      "documents", // Personal documents only
      "alerts", // Personal alerts only
      "reminders", // Personal reminders only
    ],
    create: [
      "dvir",
      "documents",
      "upload_document", // POD uploads
    ],
    edit: [
      "loads", // Status updates only
    ],
    delete: [],
    manage: [],
  },
}

// Check if role can view feature
export function canViewFeature(role: EmployeeRole, feature: FeatureCategory): boolean {
  // CRITICAL FIX: Super admin ALWAYS has access to everything
  if (role === "super_admin") return true
  
  const permissions = ROLE_FEATURE_PERMISSIONS[role]
  if (!permissions) return false
  
  // Check if role has "all" access
  if (permissions.view.includes("all")) return true
  
  return permissions.view.includes(feature)
}

// Check if role can create in feature
export function canCreateFeature(role: EmployeeRole, feature: FeatureCategory): boolean {
  // CRITICAL FIX: Super admin ALWAYS has access to everything
  if (role === "super_admin") return true
  
  const permissions = ROLE_FEATURE_PERMISSIONS[role]
  if (!permissions) return false
  
  if (permissions.create.includes("all")) return true
  
  return permissions.create.includes(feature)
}

// Check if role can edit in feature
export function canEditFeature(role: EmployeeRole, feature: FeatureCategory): boolean {
  // CRITICAL FIX: Super admin ALWAYS has access to everything
  if (role === "super_admin") return true
  
  const permissions = ROLE_FEATURE_PERMISSIONS[role]
  if (!permissions) return false
  
  if (permissions.edit.includes("all")) return true
  
  return permissions.edit.includes(feature)
}

// Check if role can delete in feature
export function canDeleteFeature(role: EmployeeRole, feature: FeatureCategory): boolean {
  // CRITICAL FIX: Super admin ALWAYS has access to everything
  if (role === "super_admin") return true
  
  const permissions = ROLE_FEATURE_PERMISSIONS[role]
  if (!permissions) return false
  
  if (permissions.delete.includes("all")) return true
  
  return permissions.delete.includes(feature)
}

// Check if role can manage feature
export function canManageFeature(role: EmployeeRole, feature: FeatureCategory): boolean {
  // CRITICAL FIX: Super admin ALWAYS has access to everything
  if (role === "super_admin") return true
  
  const permissions = ROLE_FEATURE_PERMISSIONS[role]
  if (!permissions) return false
  
  if (permissions.manage.includes("all")) return true
  
  return permissions.manage.includes(feature)
}

// Check if feature data should be masked for role
export function isFeatureMasked(role: EmployeeRole, feature: FeatureCategory): boolean {
  const permissions = ROLE_FEATURE_PERMISSIONS[role]
  if (!permissions || !permissions.masked) return false
  
  return permissions.masked.includes(feature)
}

// Get all accessible features for a role
export function getAccessibleFeatures(role: EmployeeRole): {
  view: FeatureCategory[]
  create: FeatureCategory[]
  edit: FeatureCategory[]
  delete: FeatureCategory[]
  manage: FeatureCategory[]
  masked: FeatureCategory[]
} {
  const permissions = ROLE_FEATURE_PERMISSIONS[role]
  if (!permissions) {
    return {
      view: [],
      create: [],
      edit: [],
      delete: [],
      manage: [],
      masked: [],
    }
  }
  
  return {
    view: permissions.view,
    create: permissions.create,
    edit: permissions.edit,
    delete: permissions.delete,
    manage: permissions.manage,
    masked: permissions.masked || [],
  }
}
