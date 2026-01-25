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

// Feature permissions: what each role can access
export const ROLE_FEATURE_PERMISSIONS: Record<EmployeeRole, {
  view: FeatureCategory[]
  create: FeatureCategory[]
  edit: FeatureCategory[]
  delete: FeatureCategory[]
  manage: FeatureCategory[] // Full management access
}> = {
  // Owner/Company Manager - Full access
  owner: {
    view: ["all"],
    create: ["all"],
    edit: ["all"],
    delete: ["all"],
    manage: ["all"],
  },

  // IT/System Administrator - System management
  it_admin: {
    view: ["dashboard", "employees", "settings", "documents", "reports"],
    create: ["employees", "settings"],
    edit: ["settings", "employees"],
    delete: ["employees"],
    manage: ["settings", "employees"],
  },

  // Operations Manager/Dispatcher
  operations_manager: {
    view: [
      "dashboard",
      "drivers",
      "vehicles",
      "routes",
      "loads",
      "dispatch",
      "fleet_map",
      "address_book",
      "eld",
      "dvir",
      "alerts",
      "reminders",
      "documents",
      "bol",
      "reports",
    ],
    create: [
      "routes",
      "loads",
      "dispatch",
      "address_book",
      "bol",
      "alerts",
      "reminders",
      "documents",
    ],
    edit: [
      "drivers",
      "vehicles",
      "routes",
      "loads",
      "dispatch",
      "address_book",
      "bol",
    ],
    delete: ["routes", "loads"],
    manage: ["dispatch", "routes", "loads"],
  },

  // Warehouse/Logistics Coordinator
  warehouse_coordinator: {
    view: [
      "dashboard",
      "loads",
      "routes",
      "address_book",
      "bol",
      "documents",
      "alerts",
      "reminders",
      "crm",
    ],
    create: [
      "loads",
      "address_book",
      "bol",
      "documents",
      "alerts",
      "reminders",
    ],
    edit: ["loads", "routes", "address_book", "bol"],
    delete: [],
    manage: [],
  },

  // Broker/Carrier Manager
  broker_carrier_manager: {
    view: [
      "dashboard",
      "marketplace",
      "loads",
      "routes",
      "crm",
      "documents",
      "bol",
      "reports",
      "alerts",
    ],
    create: [
      "marketplace",
      "loads",
      "crm",
      "documents",
      "bol",
    ],
    edit: ["marketplace", "loads", "crm", "bol"],
    delete: ["loads"],
    manage: ["marketplace", "loads"],
  },

  // Driver
  driver: {
    view: [
      "dashboard",
      "routes", // Only assigned routes
      "loads", // Only assigned loads
      "eld",
      "dvir",
      "documents", // Personal documents
      "alerts", // Personal alerts
      "reminders", // Personal reminders
    ],
    create: [
      "eld",
      "dvir",
      "documents",
    ],
    edit: ["loads"], // Update status only
    delete: [],
    manage: [],
  },

  // Fleet Manager
  fleet_manager: {
    view: [
      "dashboard",
      "vehicles",
      "maintenance",
      "dvir",
      "fleet_map",
      "eld",
      "fuel_analytics",
      "reports",
      "documents",
      "alerts",
      "reminders",
    ],
    create: [
      "vehicles",
      "maintenance",
      "dvir",
      "fleet_map",
      "documents",
      "alerts",
      "reminders",
    ],
    edit: [
      "vehicles",
      "maintenance",
      "fleet_map",
    ],
    delete: ["vehicles"],
    manage: ["vehicles", "maintenance", "fleet_map"],
  },

  // Maintenance Manager/Mechanic
  maintenance_manager: {
    view: [
      "dashboard",
      "vehicles",
      "maintenance",
      "dvir",
      "fuel_analytics",
      "documents",
      "alerts",
      "reminders",
      "reports",
    ],
    create: [
      "maintenance",
      "dvir",
      "documents",
      "alerts",
      "reminders",
    ],
    edit: [
      "vehicles", // Maintenance info only
      "maintenance",
    ],
    delete: [],
    manage: ["maintenance"],
  },

  // Safety & Compliance Manager
  safety_manager: {
    view: [
      "dashboard",
      "drivers",
      "eld",
      "dvir",
      "ifta",
      "documents",
      "reports",
      "alerts",
      "reminders",
      "maintenance",
    ],
    create: [
      "dvir",
      "alerts",
      "reminders",
      "documents",
    ],
    edit: [],
    delete: [],
    manage: [],
  },

  // Compliance Officer
  compliance_officer: {
    view: [
      "dashboard",
      "eld",
      "ifta",
      "dvir",
      "documents",
      "reports",
      "alerts",
      "reminders",
      "drivers",
    ],
    create: [
      "ifta",
      "documents",
      "alerts",
      "reminders",
    ],
    edit: [],
    delete: [],
    manage: [],
  },

  // Accounting/Finance Manager
  accounting_manager: {
    view: [
      "dashboard",
      "accounting",
      "reports",
      "crm",
      "documents",
      "bol",
      "alerts",
      "reminders",
    ],
    create: [
      "accounting",
      "reports",
      "documents",
    ],
    edit: [
      "accounting",
    ],
    delete: [],
    manage: ["accounting"],
  },

  // Customer Service/Account Manager
  customer_service: {
    view: [
      "dashboard",
      "crm",
      "loads",
      "routes",
      "documents",
      "bol",
      "alerts",
      "address_book",
      "reports",
    ],
    create: [
      "crm",
      "documents",
      "bol",
      "alerts",
      "address_book",
    ],
    edit: [
      "crm",
      "loads", // Status updates
      "bol",
    ],
    delete: [],
    manage: ["crm"],
  },

  // Sales Representative
  sales_rep: {
    view: [
      "dashboard",
      "crm",
      "loads",
      "marketplace",
      "documents",
      "address_book",
      "reports",
      "alerts",
    ],
    create: [
      "crm",
      "loads",
      "marketplace",
      "documents",
      "address_book",
    ],
    edit: [
      "crm",
      "loads",
    ],
    delete: [],
    manage: [],
  },

  // HR/Employee Manager
  hr_manager: {
    view: [
      "dashboard",
      "employees",
      "drivers",
      "documents",
      "alerts",
      "reminders",
      "settings", // Users section only
    ],
    create: [
      "employees",
      "drivers",
      "documents",
    ],
    edit: [
      "employees",
      "drivers",
    ],
    delete: ["employees", "drivers"],
    manage: ["employees"],
  },

  // Data Analyst/Reporting Specialist
  data_analyst: {
    view: [
      "dashboard",
      "reports",
      "fuel_analytics",
      "eld",
      "loads",
      "routes",
      "drivers",
      "vehicles",
      "documents",
    ],
    create: ["reports"],
    edit: [],
    delete: [],
    manage: [],
  },
}

// Helper functions
export function canViewFeature(role: EmployeeRole, feature: FeatureCategory): boolean {
  const permissions = ROLE_FEATURE_PERMISSIONS[role]
  if (!permissions) return false
  
  return permissions.view.includes("all") || permissions.view.includes(feature)
}

export function canCreateFeature(role: EmployeeRole, feature: FeatureCategory): boolean {
  const permissions = ROLE_FEATURE_PERMISSIONS[role]
  if (!permissions) return false
  
  return permissions.create.includes("all") || permissions.create.includes(feature)
}

export function canEditFeature(role: EmployeeRole, feature: FeatureCategory): boolean {
  const permissions = ROLE_FEATURE_PERMISSIONS[role]
  if (!permissions) return false
  
  return permissions.edit.includes("all") || permissions.edit.includes(feature)
}

export function canDeleteFeature(role: EmployeeRole, feature: FeatureCategory): boolean {
  const permissions = ROLE_FEATURE_PERMISSIONS[role]
  if (!permissions) return false
  
  return permissions.delete.includes("all") || permissions.delete.includes(feature)
}

export function canManageFeature(role: EmployeeRole, feature: FeatureCategory): boolean {
  const permissions = ROLE_FEATURE_PERMISSIONS[role]
  if (!permissions) return false
  
  return permissions.manage.includes("all") || permissions.manage.includes(feature)
}

// Get all accessible features for a role
export function getAccessibleFeatures(role: EmployeeRole): {
  view: FeatureCategory[]
  create: FeatureCategory[]
  edit: FeatureCategory[]
  delete: FeatureCategory[]
  manage: FeatureCategory[]
} {
  return ROLE_FEATURE_PERMISSIONS[role] || {
    view: [],
    create: [],
    edit: [],
    delete: [],
    manage: [],
  }
}

// Map feature categories to sidebar navigation items
export const FEATURE_TO_NAV: Record<FeatureCategory, string> = {
  dashboard: "/dashboard",
  drivers: "/dashboard/drivers",
  vehicles: "/dashboard/trucks",
  routes: "/dashboard/routes",
  loads: "/dashboard/loads",
  dispatch: "/dashboard/dispatches",
  fleet_map: "/dashboard/fleet-map",
  address_book: "/dashboard/address-book",
  crm: "/dashboard/customers",
  fuel_analytics: "/dashboard/fuel-analytics",
  accounting: "/dashboard/accounting/invoices",
  maintenance: "/dashboard/maintenance",
  dvir: "/dashboard/dvir",
  eld: "/dashboard/eld",
  ifta: "/dashboard/ifta",
  reports: "/dashboard/reports/analytics",
  documents: "/dashboard/documents",
  bol: "/dashboard/bols",
  alerts: "/dashboard/alerts",
  reminders: "/dashboard/reminders",
  employees: "/dashboard/employees",
  settings: "/dashboard/settings",
  marketplace: "/dashboard/marketplace",
  upload_document: "/dashboard/upload-document",
}

