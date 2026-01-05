"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getCachedUserCompany } from "@/lib/query-optimizer"

export async function getPortalSettings() {
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
    .from("company_portal_settings")
    .select("*")
    .eq("company_id", result.company_id)
    .single()

  if (error && error.code !== "PGRST116") {
    return { error: error.message, data: null }
  }

  // Return defaults if no settings exist
  if (!data) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://truckmates.com"
    return {
      data: {
        enabled: true,
        custom_url: "",
        portal_url: `${baseUrl}/portal/default`,
        allow_customer_login: true,
        allow_load_tracking: true,
        allow_invoice_viewing: true,
        allow_document_download: true,
        allow_load_submission: false,
        require_authentication: true,
        session_timeout_minutes: 60,
      },
      error: null,
    }
  }

  // Generate portal URL if custom_url is set
  if (data.custom_url && !data.portal_url) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://truckmates.com"
    data.portal_url = `${baseUrl}/portal/${data.custom_url}`
  }

  return { data, error: null }
}

export async function updatePortalSettings(settings: {
  enabled?: boolean
  custom_url?: string
  allow_customer_login?: boolean
  allow_load_tracking?: boolean
  allow_invoice_viewing?: boolean
  allow_document_download?: boolean
  allow_load_submission?: boolean
  require_authentication?: boolean
  session_timeout_minutes?: number
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

  // Generate portal URL if custom_url is provided
  let portalUrl = null
  if (settings.custom_url) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://truckmates.com"
    portalUrl = `${baseUrl}/portal/${settings.custom_url}`
  }

  const updateData = {
    ...settings,
    ...(portalUrl && { portal_url: portalUrl }),
  }

  // Check if settings exist
  const { data: existing } = await supabase
    .from("company_portal_settings")
    .select("id")
    .eq("company_id", result.company_id)
    .single()

  if (existing) {
    // Update existing
    const { error } = await supabase
      .from("company_portal_settings")
      .update(updateData)
      .eq("company_id", result.company_id)

    if (error) {
      return { error: error.message, success: false }
    }
  } else {
    // Create new
    const { error } = await supabase
      .from("company_portal_settings")
      .insert({
        company_id: result.company_id,
        ...updateData,
      })

    if (error) {
      return { error: error.message, success: false }
    }
  }

  revalidatePath("/dashboard/settings/portal")
  return { success: true, error: null }
}



