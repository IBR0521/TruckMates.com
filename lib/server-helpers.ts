"use server"

import { createClient } from "@/lib/supabase/server"
import { cache, cacheKeys } from "./cache"

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
 * Get the company_id for the authenticated user (with caching)
 * @returns Company ID or null if not found
 */
export async function getUserCompanyId() {
  const { user, error: authError } = await getAuthenticatedUser()

  if (authError || !user) {
    return { companyId: null, error: "Not authenticated" }
  }

  // Check cache first
  const cacheKey = cacheKeys.userCompany(user.id)
  const cached = cache.get<{ company_id: string | null }>(cacheKey)
  if (cached) {
    return { companyId: cached.company_id, error: null }
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

  // Cache for 5 minutes (company_id rarely changes)
  cache.set(cacheKey, { company_id: userData.company_id }, 5 * 60 * 1000)

  return { companyId: userData.company_id, error: null }
}

/**
 * Get both authenticated user and company_id in a single call (with caching)
 * Useful when both are needed to avoid duplicate queries
 * FAST - optimized for speed
 */
export async function getAuthContext() {
  try {
    // Add timeout protection (1 second max)
    const authPromise = getAuthenticatedUser()
    const timeoutPromise = new Promise<{ user: null; companyId: null; error: string }>((resolve) => {
      setTimeout(() => resolve({ user: null, companyId: null, error: "Authentication timeout" }), 2000) // Increased slightly for stability
    })

    const authResult = await Promise.race([authPromise, timeoutPromise])
    
    // If timeout won, return early
    if ('error' in authResult && authResult.error === "Authentication timeout") {
      return authResult
    }

    const { user, error: authError } = authResult as { user: any; error: string | null }

    if (authError || !user) {
      return { user: null, companyId: null, error: "Not authenticated" }
    }

    // Check cache first (fast path)
    const cacheKey = cacheKeys.userCompany(user.id)
    const cached = cache.get<{ company_id: string | null }>(cacheKey)
    if (cached) {
      return { user, companyId: cached.company_id, error: null }
    }

    // Fetch from database (with timeout protection)
    let supabase
    try {
      supabase = await createClient()
    } catch (clientError: any) {
      // Handle Supabase client creation errors (e.g., missing env vars, connection issues)
      const errorMessage = clientError?.message || "Failed to connect to database"
      if (errorMessage.includes('Missing Supabase') || errorMessage.includes('Invalid Supabase')) {
        return { user: null, companyId: null, error: "Database configuration error. Please check your Supabase settings." }
      }
      if (errorMessage.includes('timeout') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch')) {
        return { user: null, companyId: null, error: "Connection failed. Please check your internet connection and try again." }
      }
      return { user: null, companyId: null, error: errorMessage }
    }

    const queryPromise = supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single()

    const queryTimeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) => {
      setTimeout(() => resolve({ data: null, error: { message: "Database query timeout" } }), 3000) // Increased slightly for stability
    })

    const { data: userData, error: userError } = await Promise.race([
      queryPromise,
      queryTimeoutPromise
    ]) as any

    if (userError) {
      // Check for connection errors
      const errorMsg = userError.message || "Failed to fetch company"
      if (errorMsg.includes('timeout') || errorMsg.includes('ECONNREFUSED') || errorMsg.includes('fetch')) {
        return { user: null, companyId: null, error: "Connection failed. Please check your internet connection and try again." }
      }
      // Don't cache errors
      return { user: null, companyId: null, error: errorMsg }
    }

    if (!userData?.company_id) {
      return { user: null, companyId: null, error: "No company found" }
    }

    // Cache for 5 minutes (only cache successful results)
    cache.set(cacheKey, { company_id: userData.company_id }, 5 * 60 * 1000)

    return { user, companyId: userData.company_id, error: null }
  } catch (error: any) {
    // Catch any unexpected errors
    const errorMessage = error?.message || "Authentication failed"
    if (errorMessage.includes('timeout') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch')) {
      return { user: null, companyId: null, error: "Connection failed. Please check your internet connection and try again." }
    }
    return { user: null, companyId: null, error: errorMessage }
  }
}

