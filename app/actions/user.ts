"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// Get current user profile (with timeout protection)
export async function getUserProfile() {
  try {
    const supabase = await createClient()

    // Add timeout to auth check
    const authPromise = supabase.auth.getUser()
    const authTimeout = new Promise((resolve) => {
      setTimeout(() => resolve({ data: { user: null } }), 1000) // 1 second timeout
    })

    const authResult = await Promise.race([authPromise, authTimeout]) as any
    const user = authResult?.data?.user

    if (!user) {
      return { error: "Not authenticated", data: null }
    }

    // Add timeout to user query
    const userQueryPromise = supabase
      .from("users")
      .select("id, email, full_name, phone, role, company_id")
      .eq("id", user.id)
      .single()
    
    // Also get employee_role from auth metadata
    const employeeRole = user.user_metadata?.employee_role || null

    const userQueryTimeout = new Promise((resolve) => {
      setTimeout(() => resolve({ data: null, error: { message: "Query timeout" } }), 1000) // 1 second timeout
    })

    const { data: userData, error } = await Promise.race([
      userQueryPromise,
      userQueryTimeout
    ]) as any

    if (error) {
      return { error: error.message, data: null }
    }

    // Add employee_role to user data
    // Priority: auth metadata > users table role
    const finalEmployeeRole = employeeRole || userData?.role || null
    
    const userDataWithRole = {
      ...userData,
      employee_role: finalEmployeeRole,
      role: userData?.role || finalEmployeeRole, // Ensure role is always set
    }

    return { data: userDataWithRole, error: null }
  } catch (error: any) {
    return { error: error?.message || "Failed to get user profile", data: null }
  }
}

// Alias for backward compatibility
export async function getCurrentUser() {
  return getUserProfile()
}

// Update user profile
export async function updateUserProfile(formData: {
  full_name?: string
  phone?: string
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const updateData: any = {}
  if (formData.full_name !== undefined) updateData.full_name = formData.full_name
  if (formData.phone !== undefined) updateData.phone = formData.phone || null

  const { error } = await supabase
    .from("users")
    .update(updateData)
    .eq("id", user.id)

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/settings")
  return { data: { success: true }, error: null }
}

// Update user password
export async function updateUserPassword(currentPassword: string, newPassword: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  // Verify current password by attempting to sign in
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: currentPassword,
  })

  if (signInError) {
    return { error: "Current password is incorrect", data: null }
  }

  // Update password
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (updateError) {
    return { error: updateError.message, data: null }
  }

  return { data: { success: true }, error: null }
}
