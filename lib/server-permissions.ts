"use server"

import { createClient } from "@/lib/supabase/server"
import { mapLegacyRole, type EmployeeRole } from "./roles"
import {
  canViewFeature,
  canCreateFeature,
  canEditFeature,
  canDeleteFeature,
  canManageFeature,
  type FeatureCategory,
} from "./feature-permissions"

// Get user role from server
export async function getUserRole(): Promise<EmployeeRole | null> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return null
    }

    // Get employee_role from metadata or fallback to role
    const employeeRole = user.user_metadata?.employee_role || null

    // Get role from users table
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    const role = employeeRole || userData?.role || null
    return role ? (mapLegacyRole(role) as EmployeeRole) : null
  } catch (error) {
    console.error("Error getting user role:", error)
    return null
  }
}

// Server-side permission checks
export async function checkViewPermission(feature: FeatureCategory): Promise<{
  allowed: boolean
  role: EmployeeRole | null
  error: string | null
}> {
  try {
    const role = await getUserRole()
    if (!role) {
      return { allowed: false, role: null, error: "User not authenticated" }
    }

    const allowed = canViewFeature(role, feature)
    return {
      allowed,
      role,
      error: allowed ? null : "You don't have permission to view this feature",
    }
  } catch (error: any) {
    return {
      allowed: false,
      role: null,
      error: error?.message || "Permission check failed",
    }
  }
}

export async function checkCreatePermission(feature: FeatureCategory): Promise<{
  allowed: boolean
  role: EmployeeRole | null
  error: string | null
}> {
  try {
    const role = await getUserRole()
    if (!role) {
      return { allowed: false, role: null, error: "User not authenticated" }
    }

    const allowed = canCreateFeature(role, feature)
    return {
      allowed,
      role,
      error: allowed ? null : "You don't have permission to create this feature",
    }
  } catch (error: any) {
    return {
      allowed: false,
      role: null,
      error: error?.message || "Permission check failed",
    }
  }
}

export async function checkEditPermission(feature: FeatureCategory): Promise<{
  allowed: boolean
  role: EmployeeRole | null
  error: string | null
}> {
  try {
    const role = await getUserRole()
    if (!role) {
      return { allowed: false, role: null, error: "User not authenticated" }
    }

    const allowed = canEditFeature(role, feature)
    return {
      allowed,
      role,
      error: allowed ? null : "You don't have permission to edit this feature",
    }
  } catch (error: any) {
    return {
      allowed: false,
      role: null,
      error: error?.message || "Permission check failed",
    }
  }
}

export async function checkDeletePermission(feature: FeatureCategory): Promise<{
  allowed: boolean
  role: EmployeeRole | null
  error: string | null
}> {
  try {
    const role = await getUserRole()
    if (!role) {
      return { allowed: false, role: null, error: "User not authenticated" }
    }

    const allowed = canDeleteFeature(role, feature)
    return {
      allowed,
      role,
      error: allowed ? null : "You don't have permission to delete this feature",
    }
  } catch (error: any) {
    return {
      allowed: false,
      role: null,
      error: error?.message || "Permission check failed",
    }
  }
}

export async function checkManagePermission(feature: FeatureCategory): Promise<{
  allowed: boolean
  role: EmployeeRole | null
  error: string | null
}> {
  try {
    const role = await getUserRole()
    if (!role) {
      return { allowed: false, role: null, error: "User not authenticated" }
    }

    const allowed = canManageFeature(role, feature)
    return {
      allowed,
      role,
      error: allowed ? null : "You don't have permission to manage this feature",
    }
  } catch (error: any) {
    return {
      allowed: false,
      role: null,
      error: error?.message || "Permission check failed",
    }
  }
}






