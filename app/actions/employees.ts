"use server"

import { createClient } from "@/lib/supabase/server"
import { getUserRole } from "@/lib/server-permissions"
import { getCachedUserCompany } from "@/lib/query-optimizer"
import { mapLegacyRole, type EmployeeRole } from "@/lib/roles"
import { revalidatePath } from "next/cache"
import { sendNotification } from "./notifications"

const MANAGER_ROLES: readonly EmployeeRole[] = ["super_admin", "operations_manager"]

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

    const role = await getUserRole()
    if (!role || !MANAGER_ROLES.includes(role)) {
      return { error: "Only managers can view employees", data: null }
    }

    const { company_id: companyId, error: companyError } = await getCachedUserCompany(user.id)
    if (companyError || !companyId) {
      return { error: companyError || "No company found", data: null }
    }

    // HIGH FIX 1: Select only necessary columns to prevent exposing sensitive internal fields
    const { data: employees, error } = await supabase
      .from("users")
      .select("id, full_name, email, phone, employee_status, role, created_at")
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


// Update employee (status, etc.)
export async function updateEmployee(
  employeeId: string,
  updates: {
    full_name?: string
    email?: string
    phone?: string
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

  const role = await getUserRole()
  if (!role || !MANAGER_ROLES.includes(role)) {
    return { error: "Only managers can update employees", data: null }
  }

  const { company_id: companyId, error: companyError } = await getCachedUserCompany(user.id)
  if (companyError || !companyId) {
    return { error: companyError || "No company found", data: null }
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

  const employeeMappedRole = mapLegacyRole(employee.role)
  if (MANAGER_ROLES.includes(employeeMappedRole)) {
    return { error: "Cannot update manager accounts", data: null }
  }

  // HIGH FIX 3: Build explicit updateData object with only allowed fields to prevent arbitrary column injection
  const updateData: any = {}
  if (updates.full_name !== undefined) updateData.full_name = updates.full_name
  if (updates.email !== undefined) updateData.email = updates.email
  if (updates.phone !== undefined) updateData.phone = updates.phone
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

  const role = await getUserRole()
  if (!role || !MANAGER_ROLES.includes(role)) {
    return { error: "Only managers can remove employees", data: null }
  }

  const { company_id: companyId, error: companyError } = await getCachedUserCompany(user.id)
  if (companyError || !companyId) {
    return { error: companyError || "No company found", data: null }
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

  const employeeMappedRole = mapLegacyRole(employee.role)
  if (MANAGER_ROLES.includes(employeeMappedRole)) {
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


