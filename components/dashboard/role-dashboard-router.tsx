"use client"

import { useState, useEffect } from "react"
import { getCurrentUser } from "@/app/actions/user"
import { mapLegacyRole, type EmployeeRole, getDashboardType } from "@/lib/roles"
import { SuperAdminDashboard } from "./role-dashboards/super-admin-dashboard"
import { OperationsManagerDashboard } from "./role-dashboards/operations-manager-dashboard"
import { DispatcherDashboard } from "./role-dashboards/dispatcher-dashboard"
import { SafetyComplianceDashboard } from "./role-dashboards/safety-compliance-dashboard"
import { FinancialControllerDashboard } from "./role-dashboards/financial-controller-dashboard"
import { DriverDashboard } from "./role-dashboards/driver-dashboard"

export function RoleDashboardRouter() {
  const [userRole, setUserRole] = useState<EmployeeRole | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadUserRole() {
      try {
        const result = await getCurrentUser()
        if (result?.data) {
          const employeeRole = (result.data as any).employee_role || result.data.role
          const mappedRole = mapLegacyRole(employeeRole) as EmployeeRole
          setUserRole(mappedRole)
        }
      } catch (error) {
        console.error("Error loading user role:", error)
      } finally {
        setIsLoading(false)
      }
    }
    loadUserRole()
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  // Route to appropriate dashboard based on role
  switch (userRole) {
    case "super_admin":
      return <SuperAdminDashboard />
    case "operations_manager":
      return <OperationsManagerDashboard />
    case "dispatcher":
      return <DispatcherDashboard />
    case "safety_compliance":
      return <SafetyComplianceDashboard />
    case "financial_controller":
      return <FinancialControllerDashboard />
    case "driver":
      return <DriverDashboard />
    default:
      // Fallback to default dashboard for unknown roles
      return <SuperAdminDashboard />
  }
}

