import { Building2, Radio, Truck, Shield, DollarSign, UserCog } from "lucide-react"

export type RoleGroup = "executive" | "operations" | "field_ops" | "compliance" | "business" | "support"

export type EmployeeRole =
  | "owner"
  | "it_admin"
  | "operations_manager"
  | "warehouse_coordinator"
  | "broker_carrier_manager"
  | "driver"
  | "fleet_manager"
  | "maintenance_manager"
  | "safety_manager"
  | "compliance_officer"
  | "accounting_manager"
  | "customer_service"
  | "sales_rep"
  | "hr_manager"
  | "data_analyst"

export interface RoleInfo {
  id: EmployeeRole
  name: string
  description: string
  isManager: boolean // Can manage other employees
  requiresCompany: boolean // Needs company setup
}

export interface RoleGroupInfo {
  id: RoleGroup
  name: string
  description: string
  icon: any
  roles: RoleInfo[]
}

export const ROLE_GROUPS: Record<RoleGroup, RoleGroupInfo> = {
  executive: {
    id: "executive",
    name: "Executive/Management",
    description: "Company leadership and system administration",
    icon: Building2,
    roles: [
      {
        id: "owner",
        name: "Owner/Company Manager",
        description: "Full company management and strategic decisions",
        isManager: true,
        requiresCompany: true,
      },
      {
        id: "it_admin",
        name: "IT/System Administrator",
        description: "System configuration and technical management",
        isManager: true,
        requiresCompany: true,
      },
    ],
  },
  operations: {
    id: "operations",
    name: "Operations",
    description: "Day-to-day operations and logistics coordination",
    icon: Radio,
    roles: [
      {
        id: "operations_manager",
        name: "Operations Manager/Dispatcher",
        description: "Day-to-day operations, driver assignments, and dispatch",
        isManager: true,
        requiresCompany: true,
      },
      {
        id: "warehouse_coordinator",
        name: "Warehouse/Logistics Coordinator",
        description: "Load coordination and warehouse operations",
        isManager: false,
        requiresCompany: true,
      },
      {
        id: "broker_carrier_manager",
        name: "Broker/Carrier Manager",
        description: "Marketplace operations and load management",
        isManager: true,
        requiresCompany: true,
      },
    ],
  },
  field_ops: {
    id: "field_ops",
    name: "Field Operations",
    description: "On-road and vehicle operations",
    icon: Truck,
    roles: [
      {
        id: "driver",
        name: "Driver",
        description: "On-road operations and deliveries",
        isManager: false,
        requiresCompany: false,
      },
      {
        id: "fleet_manager",
        name: "Fleet Manager",
        description: "Vehicle and fleet management",
        isManager: false,
        requiresCompany: true,
      },
      {
        id: "maintenance_manager",
        name: "Maintenance Manager/Mechanic",
        description: "Vehicle maintenance and service",
        isManager: false,
        requiresCompany: true,
      },
    ],
  },
  compliance: {
    id: "compliance",
    name: "Compliance & Safety",
    description: "Safety, compliance, and regulatory management",
    icon: Shield,
    roles: [
      {
        id: "safety_manager",
        name: "Safety & Compliance Manager",
        description: "Safety programs and compliance monitoring",
        isManager: false,
        requiresCompany: true,
      },
      {
        id: "compliance_officer",
        name: "Compliance Officer",
        description: "Regulatory compliance and reporting",
        isManager: false,
        requiresCompany: true,
      },
    ],
  },
  business: {
    id: "business",
    name: "Business Operations",
    description: "Financial and customer management",
    icon: DollarSign,
    roles: [
      {
        id: "accounting_manager",
        name: "Accounting/Finance Manager",
        description: "Financial management and invoicing",
        isManager: false,
        requiresCompany: true,
      },
      {
        id: "customer_service",
        name: "Customer Service/Account Manager",
        description: "Customer relations and support",
        isManager: false,
        requiresCompany: true,
      },
      {
        id: "sales_rep",
        name: "Sales Representative",
        description: "Business development and sales",
        isManager: false,
        requiresCompany: true,
      },
    ],
  },
  support: {
    id: "support",
    name: "Support Functions",
    description: "HR, reporting, and administrative support",
    icon: UserCog,
    roles: [
      {
        id: "hr_manager",
        name: "HR/Employee Manager",
        description: "Employee management and HR operations",
        isManager: true,
        requiresCompany: true,
      },
      {
        id: "data_analyst",
        name: "Data Analyst/Reporting Specialist",
        description: "Data analysis and reporting",
        isManager: false,
        requiresCompany: true,
      },
    ],
  },
}

// Helper functions
export function getRoleGroup(groupId: RoleGroup): RoleGroupInfo {
  return ROLE_GROUPS[groupId]
}

export function getRoleInfo(roleId: EmployeeRole): RoleInfo | undefined {
  for (const group of Object.values(ROLE_GROUPS)) {
    const role = group.roles.find((r) => r.id === roleId)
    if (role) return role
  }
  return undefined
}

export function getRoleGroupByRole(roleId: EmployeeRole): RoleGroupInfo | undefined {
  for (const group of Object.values(ROLE_GROUPS)) {
    if (group.roles.some((r) => r.id === roleId)) {
      return group
    }
  }
  return undefined
}

// Map old role names to new system (for backward compatibility)
export function mapLegacyRole(legacyRole: string | null | undefined): EmployeeRole {
  if (!legacyRole) return "driver" // Default fallback
  
  const mapping: Record<string, EmployeeRole> = {
    manager: "owner",
    user: "driver",
    driver: "driver",
  }
  
  // If it's already in the mapping, use the mapped value
  if (mapping[legacyRole]) {
    return mapping[legacyRole]
  }
  
  // Check if it's already a valid EmployeeRole
  const validRoles: EmployeeRole[] = [
    "owner", "it_admin", "operations_manager", "warehouse_coordinator", "broker_carrier_manager",
    "driver", "fleet_manager", "maintenance_manager", "safety_manager", "compliance_officer",
    "accounting_manager", "customer_service", "sales_rep", "hr_manager", "data_analyst"
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

