"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { revalidatePath } from "next/cache"
import crypto from "crypto"

/**
 * Generate a secure API key
 */
function generateAPIKey(): { key: string; hash: string; prefix: string } {
  const prefix = "tm_live_"
  const randomBytes = crypto.randomBytes(32).toString("hex")
  const key = `${prefix}${randomBytes}`
  const hash = crypto.createHash("sha256").update(key).digest("hex")
  const keyPrefix = key.substring(0, 12) // "tm_live_xxxx"

  return { key, hash, prefix: keyPrefix }
}

/**
 * Get all API keys for the current company
 */
export async function getAPIKeys() {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // MEDIUM FIX 8: Select only safe fields - never return key_hash to client
  const { data: keys, error } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, is_active, expires_at, created_at, last_used_at, rate_limit_per_minute, rate_limit_per_day, allowed_ips, scopes, created_by")
    .eq("company_id", ctx.companyId)
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message, data: null }
  }

  return { data: keys, error: null }
}

/**
 * Create a new API key
 */
export async function createAPIKey(formData: {
  name: string
  expires_at?: string
  rate_limit_per_minute?: number
  rate_limit_per_day?: number
  allowed_ips?: string[]
  scopes?: string[]
}) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const { getUserRole } = await import("@/lib/server-permissions")
  const role = await getUserRole()
  if (!role || !["super_admin", "operations_manager"].includes(role)) {
    return { error: "Only managers can create API keys", data: null }
  }

  // Generate API key
  const { key, hash, prefix } = generateAPIKey()

  // Insert API key
  const { data: apiKey, error } = await supabase
    .from("api_keys")
    .insert({
      company_id: ctx.companyId,
      name: formData.name,
      key_hash: hash,
      key_prefix: prefix,
      expires_at: formData.expires_at || null,
      rate_limit_per_minute: formData.rate_limit_per_minute || 60,
      rate_limit_per_day: formData.rate_limit_per_day || 10000,
      allowed_ips: formData.allowed_ips || null,
      scopes: formData.scopes || ["read"],
      created_by: ctx.userId ?? undefined,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  // Return the full key only once (for display)
  revalidatePath("/dashboard/settings/api-keys")
  return {
    data: {
      ...apiKey,
      key, // Include full key only on creation
    },
    error: null,
  }
}

/**
 * Revoke (delete) an API key
 */
export async function revokeAPIKey(id: string) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated" }
  }

  const { getUserRole } = await import("@/lib/server-permissions")
  const role = await getUserRole()
  if (!role || !["super_admin", "operations_manager"].includes(role)) {
    return { error: "Only managers can revoke API keys" }
  }

  // Verify the API key belongs to the company
  const { error: verifyError } = await supabase
    .from("api_keys")
    .select("id")
    .eq("id", id)
    .eq("company_id", ctx.companyId)
    .single()

  if (verifyError) {
    return { error: "API key not found" }
  }

  // Delete the API key (with company_id for defense-in-depth)
  const { error } = await supabase
    .from("api_keys")
    .delete()
    .eq("id", id)
    .eq("company_id", ctx.companyId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/dashboard/settings/api-keys")
  return { error: null }
}

/**
 * Update API key settings
 */
export async function updateAPIKey(
  id: string,
  updates: {
    name?: string
    is_active?: boolean
    rate_limit_per_minute?: number
    rate_limit_per_day?: number
    allowed_ips?: string[]
    scopes?: string[]
  }
) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const { getUserRole } = await import("@/lib/server-permissions")
  const role = await getUserRole()
  if (!role || !["super_admin", "operations_manager"].includes(role)) {
    return { error: "Only managers can update API keys", data: null }
  }

  // Verify the API key belongs to the company
  const { error: verifyError } = await supabase
    .from("api_keys")
    .select("id")
    .eq("id", id)
    .eq("company_id", ctx.companyId)
    .single()

  if (verifyError) {
    return { error: "API key not found", data: null }
  }

  // MEDIUM FIX 9: Build explicit updateData object to prevent overwriting key_hash, company_id, etc.
  const updateData: any = {}
  if (updates.name !== undefined) updateData.name = updates.name
  if (updates.is_active !== undefined) updateData.is_active = updates.is_active
  if (updates.rate_limit_per_minute !== undefined) updateData.rate_limit_per_minute = updates.rate_limit_per_minute
  if (updates.rate_limit_per_day !== undefined) updateData.rate_limit_per_day = updates.rate_limit_per_day
  if (updates.allowed_ips !== undefined) updateData.allowed_ips = updates.allowed_ips
  if (updates.scopes !== undefined) updateData.scopes = updates.scopes

  // Update the API key
  const { data: apiKey, error } = await supabase
    .from("api_keys")
    .update(updateData)
    .eq("id", id)
    .eq("company_id", ctx.companyId) // Defense-in-depth
    .select("id, name, key_prefix, is_active, expires_at, created_at, last_used_at, rate_limit_per_minute, rate_limit_per_day, allowed_ips, scopes")
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/settings/api-keys")
  return { data: apiKey, error: null }
}

/**
 * Get API key usage statistics
 */
export async function getAPIKeyUsage(apiKeyId: string, days: number = 7) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const { data: usage, error } = await supabase
    .from("api_key_usage")
    .select("*")
    .eq("api_key_id", apiKeyId)
    .eq("company_id", ctx.companyId)
    .gte("created_at", startDate.toISOString())
    .order("created_at", { ascending: false })
    .limit(1000)

  if (error) {
    return { error: error.message, data: null }
  }

  return { data: usage, error: null }
}

