"use client"

import { useState, useEffect } from "react"
import { getCurrentUser } from "@/app/actions/user"
import { mapLegacyRole, type EmployeeRole } from "@/lib/roles"
import { canViewFeature, type FeatureCategory } from "@/lib/feature-permissions"

export function useFeatureAccess() {
  const [userRole, setUserRole] = useState<EmployeeRole | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadUserRole() {
      try {
        const result = await getCurrentUser()
        if (result?.data) {
          // Get employee_role from user metadata or fallback to legacy role
          const employeeRole = (result.data as any).employee_role || result.data.role
          const mappedRole = mapLegacyRole(employeeRole) as EmployeeRole
          setUserRole(mappedRole)
        }
      } catch (error) {
        console.error("Failed to load user role:", error)
      } finally {
        setIsLoading(false)
      }
    }
    loadUserRole()
  }, [])

  const hasAccess = (feature: FeatureCategory): boolean => {
    if (!userRole) return false
    return canViewFeature(userRole, feature)
  }

  return {
    userRole,
    isLoading,
    hasAccess,
  }
}






