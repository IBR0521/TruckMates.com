"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { sendNotification } from "./notifications"

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
    const { data: userData } = await supabase
      .from("users")
      .select("role, company_id")
      .eq("id", user.id)
      .single()

    if (userData) {
      userRole = userData.role
      companyId = userData.company_id
    }
  }

  if (!userRole || userRole !== "manager") {
    return { error: "Only managers can view employees", data: null }
  }

  if (!companyId) {
    return { error: "No company found", data: null }
  }

  // Get all users in the company (excluding the manager themselves)
  const { data: employees, error } = await supabase
    .from("users")
    .select("*")
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

// Create invitation for employee
export async function createEmployeeInvitation(email: string) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  // Check subscription limits
  const { canAddUser } = await import("./subscription-limits")
  const limitCheck = await canAddUser()
  if (!limitCheck.allowed) {
    return { error: limitCheck.error || "User limit reached", data: null }
  }

  // Check if user is a manager
  const { role: userRole, companyId, error: roleError } = await getUserRoleAndCompany(supabase, user.id)

  if (roleError || !userRole) {
    return { error: roleError || "User not found", data: null }
  }

  if (userRole !== "manager") {
    return { error: "Only managers can create invitations", data: null }
  }

  if (!companyId) {
    return { error: "No company found", data: null }
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return { error: "Invalid email format", data: null }
  }

  // Check if email already exists in the company
  const { data: existingUser } = await supabase
    .from("users")
    .select("id, role, email")
    .eq("email", email.toLowerCase().trim())
    .eq("company_id", companyId)
    .maybeSingle()

  if (existingUser) {
    if (existingUser.role === "manager") {
      return { error: "Cannot add another manager", data: null }
    }
    return { error: "User is already in your company", data: null }
  }

  // Check if there's already a pending invitation for this email
  const { data: existingInvitation } = await supabase
    .from("invitation_codes")
    .select("id")
    .eq("email", email.toLowerCase().trim())
    .eq("company_id", companyId)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle()

  if (existingInvitation) {
    return { error: "An invitation already exists for this email", data: null }
  }

  // Generate invitation code
  const { data: codeData, error: codeError } = await supabase.rpc("generate_invitation_code")

  if (codeError) {
    // Fallback: generate code manually
    const invitationCode = `EMP-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
    
    // Create invitation
    const { data: invitation, error: inviteError } = await supabase
      .from("invitation_codes")
      .insert({
        company_id: companyId,
        email: email.toLowerCase().trim(),
        invitation_code: invitationCode,
        created_by: user.id,
        status: "pending",
      })
      .select()
      .single()

    if (inviteError) {
      return { error: inviteError.message, data: null }
    }

  // Don't send email - just return the invitation code
  revalidatePath("/dashboard/employees")
  revalidatePath("/account-setup/manager")
  return { 
    data: { ...invitation, invitation_code: invitationCode }, 
    error: null 
  }
  }

  // Create invitation with generated code
  const { data: invitation, error: inviteError } = await supabase
    .from("invitation_codes")
    .insert({
      company_id: companyId,
      email: email.toLowerCase().trim(),
      invitation_code: codeData,
      created_by: user.id,
      status: "pending",
    })
    .select()
    .single()

  if (inviteError) {
    return { error: inviteError.message, data: null }
  }

  // Don't send email - just return the invitation code
  revalidatePath("/dashboard/employees")
  revalidatePath("/account-setup/manager")
  return { 
    data: invitation, 
    error: null 
  }
  } catch (error: any) {
    console.error("[EMPLOYEES] Error in createEmployeeInvitation:", error)
    return { error: error?.message || "Failed to create invitation", data: null }
  }
}

// Verify and accept invitation code
export async function verifyAndAcceptInvitation(invitationCode: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  // Use the database function to accept invitation
  const { data: companyId, error } = await supabase.rpc("accept_invitation", {
    p_invitation_code: invitationCode.trim().toUpperCase(),
    p_user_id: user.id,
  })

  if (error) {
    return { error: error.message || "Invalid or expired invitation code", data: null }
  }

  revalidatePath("/dashboard")
  revalidatePath("/account-setup/user")
  return { data: { company_id: companyId }, error: null }
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

  if (roleError || !userRole || userRole !== "manager") {
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

  if (employee.role === "manager") {
    return { error: "Cannot update manager accounts", data: null }
  }

  // Update employee
  const { error: updateError } = await supabase
    .from("users")
    .update(updates)
    .eq("id", employeeId)

  if (updateError) {
    return { error: updateError.message, data: null }
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

  if (roleError || !userRole || userRole !== "manager") {
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

  if (employee.role === "manager") {
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

  if (removeError) {
    return { error: removeError.message, data: null }
  }

  revalidatePath("/dashboard/employees")
  return { data: { success: true }, error: null }
}

// Get pending invitations for a company
export async function getPendingInvitations() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  // Check if user is a manager - try using the helper function first, then fallback
  let userRole: string | null = null
  let companyId: string | null = null

  // Try using the RPC function (bypasses RLS)
  const { data: roleData, error: roleError } = await supabase.rpc("get_user_role_and_company")

  if (!roleError && roleData && roleData.length > 0) {
    userRole = roleData[0].role
    companyId = roleData[0].company_id
  } else {
    // Fallback: try direct query (might fail due to RLS, but worth trying)
    const { data: userData } = await supabase
      .from("users")
      .select("role, company_id")
      .eq("id", user.id)
      .single()

    if (userData) {
      userRole = userData.role
      companyId = userData.company_id
    }
  }

  if (!userRole || userRole !== "manager") {
    return { error: "Only managers can view invitations", data: null }
  }

  if (!companyId) {
    return { error: "No company found", data: null }
  }

  // Get pending invitations
  const { data: invitations, error } = await supabase
    .from("invitation_codes")
    .select("*")
    .eq("company_id", companyId)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message, data: null }
  }

  return { data: invitations, error: null }
}

// Cancel invitation
export async function cancelInvitation(invitationId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  // Check if user is a manager
  const { role: userRole, companyId, error: roleError } = await getUserRoleAndCompany(supabase, user.id)

  if (roleError || !userRole || userRole !== "manager") {
    return { error: roleError || "Only managers can cancel invitations", data: null }
  }

  if (!companyId) {
    return { error: "No company found", data: null }
  }

  // Verify invitation belongs to manager's company
  const { data: invitation } = await supabase
    .from("invitation_codes")
    .select("company_id, status")
    .eq("id", invitationId)
    .single()

  if (!invitation) {
    return { error: "Invitation not found", data: null }
  }

  if (invitation.company_id !== companyId) {
    return { error: "Invitation does not belong to your company", data: null }
  }

  if (invitation.status !== "pending") {
    return { error: "Can only cancel pending invitations", data: null }
  }

  // Cancel invitation
  const { error: cancelError } = await supabase
    .from("invitation_codes")
    .update({ status: "cancelled" })
    .eq("id", invitationId)

  if (cancelError) {
    return { error: cancelError.message, data: null }
  }

  revalidatePath("/dashboard/employees")
  return { data: { success: true }, error: null }
}

// Email sending function removed - invitations are now generated only, no emails sent

