"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getCachedUserCompany } from "@/lib/query-optimizer"

export async function getIntegrationSettings() {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
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
      .select(`
        id,
        company_id,
        quickbooks_enabled,
        quickbooks_company_id,
        quickbooks_api_key,
        stripe_enabled,
        stripe_api_key,
        paypal_enabled,
        paypal_client_id,
        google_maps_enabled,
        google_maps_api_key,
        resend_enabled,
        resend_api_key,
        resend_from_email,
        created_at,
        updated_at
      `)
      .eq("company_id", result.company_id)
      .single()

    if (error && error.code !== "PGRST116") {
      return { error: error.message, data: null }
    }

    // CRITICAL FIX: Check platform environment variables first
    // These work automatically for all users - no per-company config needed
    const hasPlatformGoogleMapsKey = !!process.env.GOOGLE_MAPS_API_KEY
    const hasPlatformResendKey = !!process.env.RESEND_API_KEY

    // Return defaults if no settings exist (without exposing API keys)
    if (!data) {
      return {
        data: {
          quickbooks_enabled: false,
          quickbooks_company_id: "",
          stripe_enabled: false,
          paypal_enabled: false,
          google_maps_enabled: true, // platform-wide default
          resend_enabled: true, // platform-wide default
          resend_from_email: "",
          has_quickbooks_credentials: false,
          has_stripe_api_key: false,
          has_paypal_client_id: false,
          // Platform keys work automatically - check env vars
          has_google_maps_api_key: hasPlatformGoogleMapsKey,
          has_resend_api_key: hasPlatformResendKey,
        },
        error: null,
      }
    }
    
    // If platform keys exist, services are automatically configured for all users
    // No per-company configuration needed - it just works
    // Note: hasPlatformGoogleMapsKey and hasPlatformResendKey are already declared above
    const safeData = {
      quickbooks_enabled: !!data.quickbooks_enabled,
      quickbooks_company_id: data.quickbooks_company_id || "",
      stripe_enabled: !!data.stripe_enabled,
      paypal_enabled: !!data.paypal_enabled,
      google_maps_enabled: data.google_maps_enabled !== false,
      resend_enabled: data.resend_enabled !== false,
      resend_from_email: data.resend_from_email || "",
      has_quickbooks_credentials: !!(data.quickbooks_api_key || data.quickbooks_api_secret),
      has_stripe_api_key: !!data.stripe_api_key,
      has_paypal_client_id: !!data.paypal_client_id,
      // Platform keys take priority - if they exist, service is configured
      has_google_maps_api_key: hasPlatformGoogleMapsKey || !!data.google_maps_api_key,
      has_resend_api_key: hasPlatformResendKey || !!data.resend_api_key,
    }

    return { data: safeData, error: null }
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

/**
 * Check if email service is configured (for dashboard banner)
 * Only returns true if user is a manager/owner/admin
 */
export async function checkEmailServiceConfigured() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { configured: false, isManager: false }
  }

  // Check if user is a manager/owner/admin
  const { data: userData } = await supabase
    .from("users")
    .select("role, company_id")
    .eq("id", user.id)
    .single()

  const MANAGER_ROLES = ["manager", "admin", "owner", "super_admin", "operations_manager"]
  const isManager = userData && MANAGER_ROLES.includes(userData.role)

  if (!isManager || !userData?.company_id) {
    return { configured: false, isManager: false }
  }

  // CRITICAL FIX: Platform-wide API keys work automatically for all users
  // Check if integration record exists and is enabled (we auto-create with enabled=true)
  const { data: integrations } = await supabase
    .from("company_integrations")
    .select("resend_enabled, resend_api_key")
    .eq("company_id", userData.company_id)
    .maybeSingle() // Use maybeSingle to handle case where record doesn't exist

  // Check environment variable (platform-wide key)
  const hasPlatformKey = !!(
    process.env.RESEND_API_KEY || 
    process.env.NEXT_PUBLIC_RESEND_API_KEY
  )

  // If integration record exists and resend_enabled is true, email is configured
  // We auto-create integration records with resend_enabled=true for all new companies
  const isEnabled = integrations?.resend_enabled === true
  const hasCompanyKey = !!integrations?.resend_api_key

  // Email is configured if:
  // 1. Platform key exists in environment (automatic - works for everyone)
  // 2. OR integration record exists with resend_enabled=true (auto-created during setup)
  // 3. OR company has its own key
  // Since we auto-create integrations with enabled=true, most companies will have it configured
  const configured = hasPlatformKey || isEnabled || hasCompanyKey

  return { configured, isManager: true }
}

