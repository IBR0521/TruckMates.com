"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getCachedUserCompany } from "@/lib/query-optimizer"

export async function getIntegrationSettings() {
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

  // HIGH FIX 4: Select only non-sensitive fields - never return API keys to client
  const { data, error } = await supabase
    .from("company_integrations")
    .select("id, company_id, quickbooks_enabled, quickbooks_company_id, stripe_enabled, paypal_enabled, google_maps_enabled, resend_enabled, resend_from_email, created_at, updated_at")
    .eq("company_id", result.company_id)
    .single()

  if (error && error.code !== "PGRST116") {
    return { error: error.message, data: null }
  }

  // Return defaults if no settings exist (without API keys)
  if (!data) {
    return {
      data: {
        quickbooks_enabled: false,
        quickbooks_company_id: "",
        stripe_enabled: false,
        paypal_enabled: false,
        google_maps_enabled: false,
        resend_enabled: false,
        resend_from_email: "",
      },
      error: null,
    }
  }
  
  // HIGH FIX 4: Obfuscate any API keys that might have been returned
  // Return obfuscated display strings only
  const obfuscatedData = {
    ...data,
    quickbooks_api_key: data.quickbooks_api_key ? "sk_...xxxx" : "",
    quickbooks_api_secret: data.quickbooks_api_secret ? "***" : "",
    stripe_api_key: data.stripe_api_key ? "sk_live_...xxxx" : "",
    paypal_client_id: data.paypal_client_id ? "***" : "",
    google_maps_api_key: data.google_maps_api_key ? "AIza...xxxx" : "",
    resend_api_key: data.resend_api_key ? "re_...xxxx" : "",
  }

  return { data: obfuscatedData, error: null }
}

export async function updateIntegrationSettings(settings: {
  quickbooks_enabled?: boolean
  quickbooks_api_key?: string
  quickbooks_api_secret?: string
  quickbooks_company_id?: string
  stripe_enabled?: boolean
  stripe_api_key?: string
  paypal_enabled?: boolean
  paypal_client_id?: string
  google_maps_enabled?: boolean
  google_maps_api_key?: string
  resend_enabled?: boolean
  resend_api_key?: string
  resend_from_email?: string
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", success: false }
  }

  // HIGH FIX 1: Add RBAC check - only managers can update integration settings
  const { data: userData } = await supabase
    .from("users")
    .select("role, company_id")
    .eq("id", user.id)
    .single()

  const MANAGER_ROLES = ["super_admin", "operations_manager"]
  if (!userData || !MANAGER_ROLES.includes(userData.role)) {
    return { error: "Only managers can update integration settings", success: false }
  }

  if (!userData.company_id) {
    return { error: "No company found", success: false }
  }

  const result = { company_id: userData.company_id }

  // Check if settings exist
  const { data: existing } = await supabase
    .from("company_integrations")
    .select("id")
    .eq("company_id", result.company_id)
    .single()

  // MEDIUM FIX 17: Build explicit updateData object to prevent column injection
  const updateData: any = {}
  if (settings.quickbooks_enabled !== undefined) updateData.quickbooks_enabled = settings.quickbooks_enabled
  if (settings.quickbooks_api_key !== undefined) updateData.quickbooks_api_key = settings.quickbooks_api_key
  if (settings.quickbooks_api_secret !== undefined) updateData.quickbooks_api_secret = settings.quickbooks_api_secret
  if (settings.quickbooks_company_id !== undefined) updateData.quickbooks_company_id = settings.quickbooks_company_id
  if (settings.stripe_enabled !== undefined) updateData.stripe_enabled = settings.stripe_enabled
  if (settings.stripe_api_key !== undefined) updateData.stripe_api_key = settings.stripe_api_key
  if (settings.paypal_enabled !== undefined) updateData.paypal_enabled = settings.paypal_enabled
  if (settings.paypal_client_id !== undefined) updateData.paypal_client_id = settings.paypal_client_id
  if (settings.google_maps_enabled !== undefined) updateData.google_maps_enabled = settings.google_maps_enabled
  if (settings.google_maps_api_key !== undefined) updateData.google_maps_api_key = settings.google_maps_api_key
  if (settings.resend_enabled !== undefined) updateData.resend_enabled = settings.resend_enabled
  if (settings.resend_api_key !== undefined) updateData.resend_api_key = settings.resend_api_key
  if (settings.resend_from_email !== undefined) updateData.resend_from_email = settings.resend_from_email

  if (existing) {
    // Update existing
    const { error } = await supabase
      .from("company_integrations")
      .update(updateData)
      .eq("company_id", result.company_id)

    if (error) {
      return { error: error.message, success: false }
    }
  } else {
    // Create new
    const { error } = await supabase
      .from("company_integrations")
      .insert({
        company_id: result.company_id,
        ...updateData,
      })

    if (error) {
      return { error: error.message, success: false }
    }
  }

  revalidatePath("/dashboard/settings/integration")
  return { success: true, error: null }
}

