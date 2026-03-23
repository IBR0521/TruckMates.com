"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getCachedAuthContext } from "@/lib/auth/server"

export async function getPortalSettings() {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const { data, error } = await supabase
    .from("company_portal_settings")
    .select(
      "enabled, custom_url, portal_url, allow_customer_login, allow_load_tracking, allow_invoice_viewing, allow_document_download, allow_load_submission, require_authentication, session_timeout_minutes"
    )
    .eq("company_id", ctx.companyId)
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

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", success: false }
  }

  const { getUserRole } = await import("@/lib/server-permissions")
  const role = await getUserRole()
  const MANAGER_ROLES = ["super_admin", "operations_manager"]
  if (!role || !MANAGER_ROLES.includes(role)) {
    return { error: "Only managers can update portal settings", success: false }
  }

  const result = { company_id: ctx.companyId }

  // MEDIUM FIX 10: Validate custom_url with strict regex to prevent path traversal
  if (settings.custom_url) {
    // Only allow lowercase letters, digits, and hyphens, 3-50 characters
    const customUrlRegex = /^[a-z0-9-]{3,50}$/
    if (!customUrlRegex.test(settings.custom_url)) {
      return { error: "Custom URL must contain only lowercase letters, numbers, and hyphens (3-50 characters)", success: false }
    }
  }

  // LOW FIX 19: Validate session_timeout_minutes
  if (settings.session_timeout_minutes !== undefined) {
    if (settings.session_timeout_minutes < 1 || settings.session_timeout_minutes > 10080) {
      return { error: "Session timeout must be between 1 and 10080 minutes (1 week)", success: false }
    }
  }

  // Generate portal URL if custom_url is provided
  let portalUrl = null
  if (settings.custom_url) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://truckmates.com"
    portalUrl = `${baseUrl}/portal/${settings.custom_url}`
  }

  // MEDIUM FIX 17: Build explicit updateData object to prevent column injection
  const updateData: any = {}
  if (settings.enabled !== undefined) updateData.enabled = settings.enabled
  if (settings.custom_url !== undefined) updateData.custom_url = settings.custom_url
  if (settings.allow_customer_login !== undefined) updateData.allow_customer_login = settings.allow_customer_login
  if (settings.allow_load_tracking !== undefined) updateData.allow_load_tracking = settings.allow_load_tracking
  if (settings.allow_invoice_viewing !== undefined) updateData.allow_invoice_viewing = settings.allow_invoice_viewing
  if (settings.allow_document_download !== undefined) updateData.allow_document_download = settings.allow_document_download
  if (settings.allow_load_submission !== undefined) updateData.allow_load_submission = settings.allow_load_submission
  if (settings.require_authentication !== undefined) updateData.require_authentication = settings.require_authentication
  if (settings.session_timeout_minutes !== undefined) updateData.session_timeout_minutes = settings.session_timeout_minutes
  if (portalUrl) updateData.portal_url = portalUrl

  // Check if settings exist
  const { data: existing, error: existingError } = await supabase
    .from("company_portal_settings")
    .select("id")
    .eq("company_id", result.company_id)
    .single()

  if (existingError && existingError.code !== "PGRST116") {
    return { error: existingError.message, success: false }
  }

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












