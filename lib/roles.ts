import { Building2, Radio, Truck, Shield, DollarSign, User } from "lucide-react"

// Simplified 6-role system
export type EmployeeRole =
  | "super_admin"
  | "operations_manager"
  | "dispatcher"
  | "safety_compliance"
  | "financial_controller"
  | "driver"

export interface RoleInfo {
  id: EmployeeRole
  name: string
  description: string
  isManager: boolean
  requiresCompany: boolean
  dashboardType: "global" | "marketplace" | "active_loads" | "eld_violations" | "invoicing" | "mobile"
}

export const ROLES: Record<EmployeeRole, RoleInfo> = {
  super_admin: {
    id: "super_admin",
    name: "Super Admin",
    description: "Global visibility and full system control. The CEO role with access to all features, subscriptions, bank accounts, and user management.",
    isManager: true,
    requiresCompany: true,
    dashboardType: "global",
  },
  operations_manager: {
    id: "operations_manager",
    name: "Operations Manager",
    description: "Lead dispatcher focusing on marketplace and high-level coordination. Manages loads, vehicles, drivers, and yard operations.",
    isManager: true,
    requiresCompany: true,
    dashboardType: "marketplace",
  },
  dispatcher: {
    id: "dispatcher",
    name: "Dispatcher",
    description: "Real-time execution role. Manages active loads, AI document processing, and driver HOS. Financial rates are view-only (masked).",
    isManager: false,
    requiresCompany: true,
    dashboardType: "active_loads",
  },
  safety_compliance: {
    id: "safety_compliance",
    name: "Safety & Compliance Officer",
    description: "Audit role focusing on ELD service and inspections. Manages HOS violations, document expiry, and maintenance logs.",
    isManager: false,
    requiresCompany: true,
    dashboardType: "eld_violations",
  },
  financial_controller: {
    id: "financial_controller",
    name: "Financial Controller",
    description: "Accounting role focusing on Order-to-Cash cycle. Manages invoicing, settlements, IFTA, and financial reporting.",
    isManager: false,
    requiresCompany: true,
    dashboardType: "invoicing",
  },
  driver: {
    id: "driver",
    name: "Driver",
    description: "Mobile task completion role. Views assigned loads, uploads PODs via document scanner, and manages personal ELD logs.",
    isManager: false,
    requiresCompany: false,
    dashboardType: "mobile",
  },
}

// Helper functions
export function getRoleInfo(roleId: EmployeeRole): RoleInfo | undefined {
  return ROLES[roleId]
}

// Map old role names to new system (for backward compatibility)
export function mapLegacyRole(legacyRole: string | null | undefined): EmployeeRole {
  if (!legacyRole) return "driver" // Default fallback
  
  const mapping: Record<string, EmployeeRole> = {
    // Old roles map to new roles
    manager: "super_admin",
    owner: "super_admin",
    user: "driver",
    driver: "driver",
    // Map old operations roles
    operations_manager: "operations_manager",
    warehouse_coordinator: "operations_manager",
    broker_carrier_manager: "operations_manager",
    // Map old compliance roles
    safety_manager: "safety_compliance",
    compliance_officer: "safety_compliance",
    // Map old financial roles
    accounting_manager: "financial_controller",
    // Map old field ops
    fleet_manager: "operations_manager",
    maintenance_manager: "safety_compliance",
  }
  
  // If it's already in the mapping, use the mapped value
  if (mapping[legacyRole]) {
    return mapping[legacyRole]
  }
  
  // Check if it's already a valid EmployeeRole
  const validRoles: EmployeeRole[] = [
    "super_admin",
    "operations_manager",
    "dispatcher",
    "safety_compliance",
    "financial_controller",
    "driver"
  ]
  
  if (validRoles.includes(legacyRole as EmployeeRole)) {
    return legacyRole as EmployeeRole
  }
  
  // Fallback to driver for unknown roles
  return "driver"
}

// Check if role requires company setup
export function requiresCompany(roleId: EmployeeRole): boolean {
  const role = getRoleInfo(roleId)
  return role?.requiresCompany ?? true
}

// Check if role has manager privileges
export function isManagerRole(roleId: EmployeeRole): boolean {
  const role = getRoleInfo(roleId)
  return role?.isManager ?? false
}

// Get dashboard type for role
export function getDashboardType(roleId: EmployeeRole): RoleInfo["dashboardType"] {
  const role = getRoleInfo(roleId)
  return role?.dashboardType ?? "global"
}
