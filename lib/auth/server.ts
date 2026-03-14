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

    // EXT-002 FIX: NEVER trust JWT user_metadata for authorization - it's user-controlled
    // Only read role from database (ground truth) which can only be modified by admins
    
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

    // Use database role only (ground truth - only modifiable by admins)
    const finalRole = userData.role || 'driver'

    // Return only primitives - ensure JSON serializable
    return {
      data: {
        id: String(userData.id),
        email: String(userData.email),
        full_name: userData.full_name ? String(userData.full_name) : null,
        role: String(finalRole),
        // EXT-002 FIX: employee_role removed - only use role from database
        // Removed employee_role field to prevent confusion and ensure security
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
 * Get current user's company id and name (for scoping data and display).
 * Used to ensure dashboard and queries are keyed per company and users can verify which account they're viewing.
 */
export async function getAuthCompany() {
  try {
    const { companyId, error } = await getAuthContext()
    if (error || !companyId) return { companyId: null, companyName: null, error: error ?? "Not authenticated" }
    const supabase = await createClient()
    const { data: company } = await supabase
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .maybeSingle()
    return {
      companyId,
      companyName: company?.name ?? null,
      error: null,
    }
  } catch (e: any) {
    return { companyId: null, companyName: null, error: e?.message ?? "Failed to get company" }
  }
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

    // BUG-072 FIX: Add minimum password length validation
    const MIN_PASSWORD_LENGTH = 8
    if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
      return { 
        data: null, 
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long` 
      }
    }

    // BUG-072 FIX: Verify current password using Supabase's verifyOtp or check user session
    // Instead of signInWithPassword (which creates a ghost session), use the existing session
    // We'll verify by attempting to update with current password first, then update to new
    // Actually, Supabase doesn't provide a direct way to verify password without signIn
    // So we'll use a workaround: get the current session and verify it's valid
    
    // Get current session to verify user is authenticated
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      return { data: null, error: "Session expired. Please log in again." }
    }

    // BUG-072 FIX: Use updateUser with current password verification via a different method
    // Since Supabase doesn't support password verification without signIn, we'll use
    // the admin API to verify, or accept that we need to sign in but immediately sign out
    // Actually, the best approach is to use Supabase's built-in password update
    // which requires re-authentication, but we can verify the session is still valid
    
    // Verify current password by attempting to sign in (creates temporary session)
    const tempSupabase = await createClient()
    const { error: signInError } = await tempSupabase.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword,
    })

    if (signInError) {
      return { data: null, error: "Current password is incorrect" }
    }

    // BUG-072 FIX: Immediately sign out the temporary session to prevent ghost sessions
    await tempSupabase.auth.signOut()

    // Update password using the original session
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

