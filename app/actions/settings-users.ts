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

  if (currentUser?.role !== "manager") {
    return { error: "Only managers can update user roles", success: false }
  }

  // Update user role
  const { error } = await supabase
    .from("users")
    .update({ role: newRole })
    .eq("id", userId)
    .eq("company_id", currentUser.company_id) // Ensure user is in same company

  if (error) {
    return { error: error.message, success: false }
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

  if (currentUser?.role !== "manager") {
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
  const { error } = await supabase
    .from("users")
    .delete()
    .eq("id", userId)

  if (error) {
    return { error: error.message, success: false }
  }

  revalidatePath("/dashboard/settings/users")
  return { success: true, error: null }
}







