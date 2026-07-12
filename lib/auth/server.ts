"use server"

import { cache } from "react"
import { errorMessage } from "@/lib/error-message"
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
  } catch (error: unknown) {
    return { 
      data: null, 
      error: String(errorMessage(error) || error || "Failed to get user") 
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
    const { companyId, error } = await getCachedAuthContext()
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
  } catch (e: unknown) {
    return { companyId: null, companyName: null, error: errorMessage(e) ?? "Failed to get company" }
  }
}

/**
 * Get authenticated user and company context (uncached).
 * Prefer getCachedAuthContext() in server actions so auth + user lookup run once per request.
 */
export async function getAuthContext(): Promise<{
  user: { id: string; email: string; role: string } | null
  userId: string | null
  companyId: string | null
  error: string | null
}> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { user: null, userId: null, companyId: null, error: "Not authenticated" }
    }

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, company_id, role")
      .eq("id", user.id)
      .maybeSingle()

    if (userError) {
      return { user: null, userId: null, companyId: null, error: userError.message || "Failed to fetch user data" }
    }
    if (!userData) {
      return { user: null, userId: null, companyId: null, error: "User not found" }
    }

    return {
      user: {
        id: String(userData.id),
        email: String(user.email || ""),
        role: String(userData.role),
      },
      userId: String(userData.id),
      companyId: userData.company_id ? String(userData.company_id) : null,
      error: null,
    }
  } catch (error: unknown) {
    return {
      user: null,
      userId: null,
      companyId: null,
      error: String(errorMessage(error) || error || "Authentication failed"),
    }
  }
}

/** Auth + company lookup cached per request. Use in server actions to avoid 2–3 repeated round trips. */
export const getCachedAuthContext = cache(getAuthContext)

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

    const updateData: Record<string, string | null> = {}
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
  } catch (error: unknown) {
    return { 
      data: null, 
      error: String(errorMessage(error) || error || "Failed to update profile") 
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

    // Verify the current password on an ISOLATED Supabase client that does NOT touch this
    // request's cookie store. The cookie-bound SSR client (createClient) shares the user's
    // session cookies, so signing in/out on it would overwrite or clear the live session —
    // the previous "temp client + signOut" approach risked logging the user out. A throwaway
    // client with persistSession:false validates the credential with no session side effects.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) {
      return { data: null, error: "Authentication is not configured" }
    }

    const { createClient: createIsolatedClient } = await import("@supabase/supabase-js")
    const verifier = createIsolatedClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { error: signInError } = await verifier.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword,
    })

    if (signInError) {
      return { data: null, error: "Current password is incorrect" }
    }

    // Update password using the original session
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (updateError) {
      return { data: null, error: updateError.message }
    }

    return { data: { success: true }, error: null }
  } catch (error: unknown) {
    return { 
      data: null, 
      error: String(errorMessage(error) || error || "Failed to update password") 
    }
  }
}

