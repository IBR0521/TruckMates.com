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

  const { data, error } = await supabase
    .from("company_integrations")
    .select("*")
    .eq("company_id", result.company_id)
    .single()

  if (error && error.code !== "PGRST116") {
    return { error: error.message, data: null }
  }

  // Return defaults if no settings exist
  if (!data) {
    return {
      data: {
        quickbooks_enabled: false,
        quickbooks_api_key: "",
        quickbooks_api_secret: "",
        quickbooks_company_id: "",
        stripe_enabled: false,
        stripe_api_key: "",
        paypal_enabled: false,
        paypal_client_id: "",
        google_maps_enabled: false,
        google_maps_api_key: "",
        resend_enabled: false,
        resend_api_key: "",
        resend_from_email: "",
      },
      error: null,
    }
  }

  return { data, error: null }
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

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", success: false }
  }

  // Check if settings exist
  const { data: existing } = await supabase
    .from("company_integrations")
    .select("id")
    .eq("company_id", result.company_id)
    .single()

  if (existing) {
    // Update existing
    const { error } = await supabase
      .from("company_integrations")
      .update(settings)
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
        ...settings,
      })

    if (error) {
      return { error: error.message, success: false }
    }
  }

  revalidatePath("/dashboard/settings/integration")
  return { success: true, error: null }
}

