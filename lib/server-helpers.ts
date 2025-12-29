"use server"

import { createClient } from "@/lib/supabase/server"

/**
 * Get the authenticated user
 * @returns User object or null if not authenticated
 */
export async function getAuthenticatedUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { user: null, error: "Not authenticated" }
  }

  return { user, error: null }
}

/**
 * Get the company_id for the authenticated user
 * @returns Company ID or null if not found
 */
export async function getUserCompanyId() {
  const { user, error: authError } = await getAuthenticatedUser()

  if (authError || !user) {
    return { companyId: null, error: "Not authenticated" }
  }

  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (userError || !userData?.company_id) {
    return { companyId: null, error: "No company found" }
  }

  return { companyId: userData.company_id, error: null }
}

/**
 * Get both authenticated user and company_id in a single call
 * Useful when both are needed to avoid duplicate queries
 */
export async function getAuthContext() {
  const { user, error: authError } = await getAuthenticatedUser()

  if (authError || !user) {
    return { user: null, companyId: null, error: "Not authenticated" }
  }

  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (userError || !userData?.company_id) {
    return { user: null, companyId: null, error: "No company found" }
  }

  return { user, companyId: userData.company_id, error: null }
}

