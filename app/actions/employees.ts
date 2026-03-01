"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { sendNotification } from "./notifications"

// Manager roles that can manage employees
const MANAGER_ROLES = ["super_admin", "operations_manager"]

// Helper function to get user role and company_id (bypasses RLS)
async function getUserRoleAndCompany(supabase: any, userId: string) {
  let userRole: string | null = null
  let companyId: string | null = null

  // Try using the RPC function first (bypasses RLS)
  try {
    const { data: roleData, error: roleError } = await supabase.rpc("get_user_role_and_company")
    if (!roleError && roleData && Array.isArray(roleData) && roleData.length > 0) {
      userRole = roleData[0].role
      companyId = roleData[0].company_id
      return { role: userRole, companyId, error: null }
    }
  } catch (error) {
    // RPC function might not exist, use fallback
  }

  // Fallback: try direct query
  const { data: userData, error } = await supabase
    .from("users")
    .select("role, company_id")
    .eq("id", userId)
    .single()

  if (error || !userData) {
    return { role: null, companyId: null, error: error?.message || "User not found" }
  }

  return { role: userData.role, companyId: userData.company_id, error: null }
}

// Get all employees for a company (managers only)
export async function getEmployees() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  // Check if user is a manager - try using RPC function first
  let userRole: string | null = null
  let companyId: string | null = null

  try {
    const { data: roleData, error: roleError } = await supabase.rpc("get_user_role_and_company")
    if (!roleError && roleData && Array.isArray(roleData) && roleData.length > 0) {
      userRole = roleData[0].role
      companyId = roleData[0].company_id
    }
  } catch (error) {
    // RPC function might not exist, use fallback
  }

  // Fallback: try direct query
  if (!userRole || !companyId) {
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("role, company_id")
      .eq("id", user.id)
      .single()

    if (userError) {
      return { error: userError.message || "Failed to fetch user data", data: null }
    }

    if (userData) {
      userRole = userData.role
      companyId = userData.company_id
    }
  }

  if (!userRole || !MANAGER_ROLES.includes(userRole)) {
    return { error: "Only managers can view employees", data: null }
  }

  if (!companyId) {
    return { error: "No company found", data: null }
  }

  // HIGH FIX 1: Select only necessary columns to prevent exposing sensitive internal fields
  const { data: employees, error } = await supabase
    .from("users")
    .select("id, full_name, email, phone, position, employee_status, role, created_at")
    .eq("company_id", companyId)
    .neq("id", user.id) // Exclude the manager
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message, data: null }
  }

  return { data: employees, error: null }
  } catch (error: any) {
    console.error("[EMPLOYEES] Error in getEmployees:", error)
    return { error: error?.message || "Failed to fetch employees", data: null }
  }
}


// Update employee (status, position, etc.)
export async function updateEmployee(
  employeeId: string,
  updates: {
    full_name?: string
    email?: string
    phone?: string
    position?: string
    employee_status?: string
  }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  // Check if user is a manager
  const { role: userRole, companyId, error: roleError } = await getUserRoleAndCompany(supabase, user.id)

  if (roleError || !userRole || !MANAGER_ROLES.includes(userRole)) {
    return { error: roleError || "Only managers can update employees", data: null }
  }

  if (!companyId) {
    return { error: "No company found", data: null }
  }

  // Verify employee belongs to manager's company and is not a manager
  const { data: employee } = await supabase
    .from("users")
    .select("id, role, company_id")
    .eq("id", employeeId)
    .single()

  if (!employee) {
    return { error: "Employee not found", data: null }
  }

  if (employee.company_id !== companyId) {
    return { error: "Employee does not belong to your company", data: null }
  }

  if (MANAGER_ROLES.includes(employee.role)) {
    return { error: "Cannot update manager accounts", data: null }
  }

  // HIGH FIX 3: Build explicit updateData object with only allowed fields to prevent arbitrary column injection
  const updateData: any = {}
  if (updates.full_name !== undefined) updateData.full_name = updates.full_name
  if (updates.email !== undefined) updateData.email = updates.email
  if (updates.phone !== undefined) updateData.phone = updates.phone
  if (updates.position !== undefined) updateData.position = updates.position
  if (updates.employee_status !== undefined) updateData.employee_status = updates.employee_status

  // MEDIUM FIX 9: Sync email update with auth.users
  let emailUpdated = false
  if (updates.email !== undefined && updates.email !== employee.email) {
    emailUpdated = true
  }

  // HIGH FIX 2: Add company_id filter to update query for defense-in-depth
  const { error: updateError } = await supabase
    .from("users")
    .update(updateData)
    .eq("id", employeeId)
    .eq("company_id", companyId)

  if (updateError) {
    return { error: updateError.message, data: null }
  }

  // MEDIUM FIX 9: Sync email with auth.users when email is updated
  if (emailUpdated && updates.email) {
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin")
      const adminSupabase = createAdminClient()
      
      const { error: authError } = await adminSupabase.auth.admin.updateUserById(employeeId, {
        email: updates.email,
      })

      if (authError) {
        console.error("[updateEmployee] Failed to sync email with auth.users:", authError)
        // Don't fail the request, but log the error
      }
    } catch (error) {
      console.error("[updateEmployee] Failed to import admin client:", error)
    }
  }

  revalidatePath("/dashboard/employees")
  return { data: { success: true }, error: null }
}

// Remove employee from company
export async function removeEmployee(employeeId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  // Check if user is a manager
  const { role: userRole, companyId, error: roleError } = await getUserRoleAndCompany(supabase, user.id)

  if (roleError || !userRole || !MANAGER_ROLES.includes(userRole)) {
    return { error: roleError || "Only managers can remove employees", data: null }
  }

  if (!companyId) {
    return { error: "No company found", data: null }
  }

  // Verify employee belongs to manager's company and is not a manager
  const { data: employee } = await supabase
    .from("users")
    .select("id, role, company_id")
    .eq("id", employeeId)
    .single()

  if (!employee) {
    return { error: "Employee not found", data: null }
  }

  if (employee.company_id !== companyId) {
    return { error: "Employee does not belong to your company", data: null }
  }

  if (MANAGER_ROLES.includes(employee.role)) {
    return { error: "Cannot remove manager accounts", data: null }
  }

  if (employee.id === user.id) {
    return { error: "Cannot remove yourself", data: null }
  }

  // Remove employee by setting company_id to null
  const { error: removeError } = await supabase
    .from("users")
    .update({ company_id: null })
    .eq("id", employeeId)
    .eq("company_id", companyId) // Defense-in-depth

  // HIGH FIX 7: Revoke all active sessions for the removed employee
  if (!removeError) {
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin")
      const adminSupabase = createAdminClient()
      
      // Sign out the user from all sessions
      const { error: signOutError } = await adminSupabase.auth.admin.signOut(employeeId, "others")
      
      if (signOutError) {
        console.error("[removeEmployee] Failed to revoke sessions:", signOutError)
        // Don't fail the request, but log the error
      }
    } catch (error) {
      console.error("[removeEmployee] Failed to import admin client:", error)
    }
  }

  if (removeError) {
    return { error: removeError.message, data: null }
  }

  revalidatePath("/dashboard/employees")
  return { data: { success: true }, error: null }
}


