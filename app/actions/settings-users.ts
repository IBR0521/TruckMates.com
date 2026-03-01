"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getCachedUserCompany } from "@/lib/query-optimizer"

export async function getCompanyUsers() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  // HIGH FIX 8: Add role check - only managers can list all company users
  const { data: userData } = await supabase
    .from("users")
    .select("role, company_id")
    .eq("id", user.id)
    .single()

  const MANAGER_ROLES = ["super_admin", "operations_manager"]
  if (!userData || !MANAGER_ROLES.includes(userData.role)) {
    return { error: "Only managers can view company users", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", data: null }
  }

  // Get all users in the company
  const { data: users, error } = await supabase
    .from("users")
    .select("id, email, full_name, phone, role, created_at")
    .eq("company_id", result.company_id)
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message, data: null }
  }

  // Map to include status (active by default)
  const usersWithStatus = users.map((u) => ({
    ...u,
    status: "Active", // You can add a status field to users table if needed
  }))

  return { data: usersWithStatus, error: null }
}

export async function updateUserRole(userId: string, newRole: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", success: false }
  }

  // Check if current user is manager
  const { data: currentUser } = await supabase
    .from("users")
    .select("role, company_id")
    .eq("id", user.id)
    .single()

  const MANAGER_ROLES = ["super_admin", "operations_manager"]
  if (!currentUser || !MANAGER_ROLES.includes(currentUser.role)) {
    return { error: "Only managers can update user roles", success: false }
  }

  // HIGH FIX 4: Validate newRole against valid EmployeeRole enum
  const VALID_ROLES = ["super_admin", "operations_manager", "dispatcher", "safety_compliance", "financial_controller", "driver"]
  if (!VALID_ROLES.includes(newRole)) {
    return { error: `Invalid role: ${newRole}. Must be one of: ${VALID_ROLES.join(", ")}`, success: false }
  }

  // Prevent self-promotion to super_admin
  if (userId === user.id && newRole === "super_admin") {
    return { error: "You cannot promote yourself to super_admin", success: false }
  }

  // Prevent assigning role higher than caller's role
  const roleHierarchy: Record<string, number> = {
    "driver": 1,
    "dispatcher": 2,
    "safety_compliance": 2,
    "financial_controller": 2,
    "operations_manager": 3,
    "super_admin": 4,
  }
  const callerLevel = roleHierarchy[currentUser.role] || 0
  const targetLevel = roleHierarchy[newRole] || 0
  if (targetLevel > callerLevel) {
    return { error: `You cannot assign a role higher than your own (${currentUser.role})`, success: false }
  }

  // Update user role in database
  const { error } = await supabase
    .from("users")
    .update({ role: newRole })
    .eq("id", userId)
    .eq("company_id", currentUser.company_id) // Ensure user is in same company

  if (error) {
    return { error: error.message, success: false }
  }

  // SECURITY: Also update auth metadata to keep role in sync (requires admin client)
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin")
    const adminSupabase = createAdminClient()
    
    const { error: authError } = await adminSupabase.auth.admin.updateUserById(userId, {
      user_metadata: {
        employee_role: newRole,
        role: newRole, // Keep both for compatibility
      }
    })

    if (authError) {
      console.error("[updateUserRole] Failed to update auth metadata:", authError)
      // Don't fail the request, but log the error
      // The role is still updated in the database
    }
  } catch (error) {
    console.error("[updateUserRole] Failed to import admin client:", error)
    // Continue - role is still updated in database
  }

  revalidatePath("/dashboard/settings/users")
  return { success: true, error: null }
}

export async function removeUser(userId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", success: false }
  }

  // Check if current user is manager
  const { data: currentUser } = await supabase
    .from("users")
    .select("role, company_id")
    .eq("id", user.id)
    .single()

  const MANAGER_ROLES = ["super_admin", "operations_manager"]
  if (!currentUser || !MANAGER_ROLES.includes(currentUser.role)) {
    return { error: "Only managers can remove users", success: false }
  }

  // Prevent removing yourself
  if (userId === user.id) {
    return { error: "You cannot remove yourself", success: false }
  }

  // Check if user is in same company
  const { data: targetUser } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", userId)
    .single()

  if (targetUser?.company_id !== currentUser.company_id) {
    return { error: "User not found in your company", success: false }
  }

  // Delete user (this will cascade delete related records)
  // Defense-in-depth: Add company_id to DELETE query
  const { error } = await supabase
    .from("users")
    .delete()
    .eq("id", userId)
    .eq("company_id", currentUser.company_id)

  if (error) {
    return { error: error.message, success: false }
  }

  // MEDIUM FIX 15: Also delete auth account to prevent ghost accounts
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin")
    const adminSupabase = createAdminClient()
    
    const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(userId)
    
    if (deleteError) {
      console.error("[removeUser] Failed to delete auth account:", deleteError)
      // Don't fail the request, but log the error
    }
  } catch (error) {
    console.error("[removeUser] Failed to import admin client:", error)
  }

  revalidatePath("/dashboard/settings/users")
  return { success: true, error: null }
}












