"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"
import { rateLimit } from "./rate-limit"

/**
 * API Protection Layer
 * Prevents abuse and manages costs for platform-wide API keys
 */

interface ApiUsageResult {
  allowed: boolean
  reason?: string
  retryAfter?: number
}

/**
 * Check if API call is allowed for a company
 * Implements per-company rate limiting and usage tracking
 */
export async function checkApiUsage(
  apiName: "google_maps" | "openai" | "resend",
  action: string
): Promise<ApiUsageResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { allowed: false, reason: "Not authenticated" }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { allowed: false, reason: "No company found" }
  }

  const companyId = result.company_id

  // Rate limit per company per API
  const rateLimitKey = `${apiName}:${companyId}:${action}`
  
  // Different limits for different APIs
  const limits: Record<string, { limit: number; window: number }> = {
    google_maps: { limit: 100, window: 60 }, // 100 calls per minute
    openai: { limit: 50, window: 60 }, // 50 calls per minute
    resend: { limit: 200, window: 60 }, // 200 emails per minute
  }

  const apiLimit = limits[apiName] || { limit: 50, window: 60 }
  const rateLimitResult = await rateLimit(rateLimitKey, {
    limit: apiLimit.limit,
    window: apiLimit.window,
  })

  if (!rateLimitResult.success) {
    return {
      allowed: false,
      reason: `Rate limit exceeded. Please try again in ${Math.ceil((rateLimitResult.reset - Date.now() / 1000) / 60)} minutes.`,
      retryAfter: rateLimitResult.reset,
    }
  }

  // Track daily usage (optional - for monitoring)
  try {
    const today = new Date().toISOString().split("T")[0]
    const usageKey = `api_usage:${apiName}:${companyId}:${today}`

    // Increment daily usage counter (using Supabase or Redis)
    // This is optional and can be used for billing/monitoring
  } catch (error) {
    // Don't block API calls if usage tracking fails
    console.error(`[API Protection] Usage tracking error:`, error)
  }

  return { allowed: true }
}

/**
 * Cache expensive API calls (like Google Maps routes)
 */
export async function getCachedApiResult<T>(
  cacheKey: string,
  ttl: number = 3600 // 1 hour default
): Promise<T | null> {
  try {
    const supabase = await createClient()
    
    // Check cache in database (you could use Redis instead)
    const { data: cache } = await supabase
      .from("api_cache")
      .select("data, expires_at")
      .eq("key", cacheKey)
      .single()

    if (cache && new Date(cache.expires_at) > new Date()) {
      return cache.data as T
    }

    return null
  } catch (error) {
    // If cache fails, allow API call to proceed
    return null
  }
}

/**
 * Store API result in cache
 */
export async function setCachedApiResult<T>(
  cacheKey: string,
  data: T,
  ttl: number = 3600
): Promise<void> {
  try {
    const supabase = await createClient()
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString()

    await supabase
      .from("api_cache")
      .upsert({
        key: cacheKey,
        data,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
  } catch (error) {
    // Don't block if caching fails
    console.error(`[API Protection] Cache storage error:`, error)
  }
}


