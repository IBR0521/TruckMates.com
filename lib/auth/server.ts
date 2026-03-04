"use server"

import { createClient } from "@/lib/supabase/server"

/**
 * Get the current authenticated user
 * Returns only plain JSON-serializable data
 * Includes employee_role from auth metadata (primary) and role from users table (fallback)
 */
export async function getCurrentUser() {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return { data: null, error: "Not authenticated" }
    }

    // Get employee_role from auth metadata (primary source)
    const employeeRole = user.user_metadata?.employee_role || null

    // Get user profile from database
    // ERR-004 FIX: Use maybeSingle() to handle missing user records gracefully
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, email, full_name, role, company_id, phone, created_at, updated_at")
      .eq("id", user.id)
      .maybeSingle()

    if (userError) {
      return { data: null, error: userError.message || "Failed to fetch user data" }
    }

    if (!userData) {
      return { data: null, error: "User not found" }
    }

    // Priority: auth metadata employee_role > users table role
    const finalRole = employeeRole || userData.role || 'driver'

    // Return only primitives - ensure JSON serializable
    return {
      data: {
        id: String(userData.id),
        email: String(userData.email),
        full_name: userData.full_name ? String(userData.full_name) : null,
        role: String(finalRole),
        employee_role: employeeRole ? String(employeeRole) : null, // Include for compatibility
        company_id: userData.company_id ? String(userData.company_id) : null,
        phone: userData.phone ? String(userData.phone) : null,
        created_at: userData.created_at ? String(userData.created_at) : null,
        updated_at: userData.updated_at ? String(userData.updated_at) : null,
      },
      error: null
    }
  } catch (error: any) {
    return { 
      data: null, 
      error: String(error?.message || error || "Failed to get user") 
    }
  }
}

/**
 * Alias for backward compatibility
 */
export async function getUserProfile() {
  return getCurrentUser()
}

/**
 * Get authenticated user and company context
 * Returns only plain JSON-serializable data
 */
export async function getAuthContext() {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return { user: null, companyId: null, error: "Not authenticated" }
    }

    // Get user with company_id
    // ERR-004 FIX: Use maybeSingle() to handle missing user records gracefully
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, company_id, role")
      .eq("id", user.id)
      .maybeSingle()

    if (userError) {
      return { user: null, companyId: null, error: userError.message || "Failed to fetch user data" }
    }

    if (!userData) {
      return { user: null, companyId: null, error: "User not found" }
    }

    return {
      user: {
        id: String(userData.id),
        email: String(user.email || ""),
        role: String(userData.role),
      },
      userId: String(userData.id), // Add userId for mobile API compatibility
      companyId: userData.company_id ? String(userData.company_id) : null,
      error: null
    }
  } catch (error: any) {
    return { 
      user: null, 
      companyId: null, 
      error: String(error?.message || error || "Authentication failed") 
    }
  }
}

/**
 * Update user profile
 * Returns only plain JSON-serializable data
 */
export async function updateUserProfile(formData: {
  full_name?: string
  phone?: string
}) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { data: null, error: "Not authenticated" }
    }

    const updateData: any = {}
    if (formData.full_name !== undefined) updateData.full_name = formData.full_name
    if (formData.phone !== undefined) updateData.phone = formData.phone || null

    const { error: updateError } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", user.id)

    if (updateError) {
      return { data: null, error: updateError.message }
    }

    return { data: { success: true }, error: null }
  } catch (error: any) {
    return { 
      data: null, 
      error: String(error?.message || error || "Failed to update profile") 
    }
  }
}

/**
 * Update user password
 * Returns only plain JSON-serializable data
 */
export async function updateUserPassword(currentPassword: string, newPassword: string) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { data: null, error: "Not authenticated" }
    }

    // Verify current password by attempting to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword,
    })

    if (signInError) {
      return { data: null, error: "Current password is incorrect" }
    }

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (updateError) {
      return { data: null, error: updateError.message }
    }

    return { data: { success: true }, error: null }
  } catch (error: any) {
    return { 
      data: null, 
      error: String(error?.message || error || "Failed to update password") 
    }
  }
}

