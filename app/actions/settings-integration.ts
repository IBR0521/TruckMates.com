"use server"

import { createClient } from "@/lib/supabase/server"
import { errorMessage, sanitizeError } from "@/lib/error-message"
import { revalidatePath } from "next/cache"
import { getCachedAuthContext } from "@/lib/auth/server"
import * as Sentry from "@sentry/nextjs"
import { getCurrentCompanyFeatureAccess } from "@/lib/plan-gates"


function safeDbError(error: unknown, fallback = "Database operation failed"): string {
  Sentry.captureException(error)
  return sanitizeError(error, { fallback })
}


export async function getIntegrationSettings() {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    const { data, error } = await supabase
      .from("company_integrations")
      .select(`
        id,
        company_id,
        quickbooks_enabled,
        quickbooks_company_id,
        quickbooks_api_key,
        quickbooks_api_secret,
        quickbooks_access_token,
        quickbooks_refresh_token,
        quickbooks_token_expires_at,
        quickbooks_sandbox,
        quickbooks_synced_at,
        quickbooks_default_income_account_id,
        quickbooks_default_item_id,
        quickbooks_gl_account_mappings,
        stripe_enabled,
        stripe_api_key,
        comdata_enabled,
        comdata_api_base_url,
        comdata_api_key,
        comdata_api_secret,
        wex_enabled,
        wex_api_base_url,
        wex_api_key,
        wex_api_secret,
        efs_enabled,
        efs_api_base_url,
        efs_api_key,
        efs_api_secret,
        fuel_card_last_synced_at,
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
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (error) {
      return { error: safeDbError(error), data: null }
    }

    // CRITICAL FIX: Check platform environment variables first
    const quickBooksGate = await getCurrentCompanyFeatureAccess("quickbooks")

    // These work automatically for all users - no per-company config needed
    const hasPlatformGoogleMapsKey = !!(
      process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    )
    const hasPlatformResendKey = !!process.env.RESEND_API_KEY

    // Return defaults if no settings exist (without exposing API keys)
    if (!data) {
      return {
        data: {
          quickbooks_enabled: false,
          quickbooks_company_id: "",
          stripe_enabled: false,
          comdata_enabled: false,
          wex_enabled: false,
          efs_enabled: false,
          paypal_enabled: false,
          google_maps_enabled: true, // platform-wide default
          resend_enabled: true, // platform-wide default
          resend_from_email: "",
          quickbooks_default_income_account_id: "",
          quickbooks_default_item_id: "",
          quickbooks_gl_account_mappings: {},
          has_quickbooks_credentials: false,
          has_stripe_api_key: false,
          has_paypal_client_id: false,
          // Platform keys work automatically - check env vars
          has_google_maps_api_key: hasPlatformGoogleMapsKey,
          has_resend_api_key: hasPlatformResendKey,
          quickbooks_allowed: quickBooksGate.allowed,
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
      comdata_enabled: !!(data as any).comdata_enabled,
      wex_enabled: !!(data as any).wex_enabled,
      efs_enabled: !!(data as any).efs_enabled,
      has_comdata_credentials: !!((data as any).comdata_api_key && (data as any).comdata_api_secret),
      has_wex_credentials: !!((data as any).wex_api_key && (data as any).wex_api_secret),
      has_efs_credentials: !!((data as any).efs_api_key && (data as any).efs_api_secret),
      fuel_card_last_synced_at: (data as any).fuel_card_last_synced_at || null,
      paypal_enabled: !!data.paypal_enabled,
      google_maps_enabled: data.google_maps_enabled !== false,
      resend_enabled: data.resend_enabled !== false,
      resend_from_email: data.resend_from_email || "",
      has_quickbooks_credentials: !!(data.quickbooks_api_key || data.quickbooks_api_secret),
      has_quickbooks_connection: !!(data.quickbooks_access_token && data.quickbooks_refresh_token && data.quickbooks_company_id),
      quickbooks_sandbox: data.quickbooks_sandbox !== false,
      quickbooks_synced_at: data.quickbooks_synced_at || null,
      quickbooks_default_income_account_id: data.quickbooks_default_income_account_id || "",
      quickbooks_default_item_id: data.quickbooks_default_item_id || "",
      quickbooks_gl_account_mappings: (data as any).quickbooks_gl_account_mappings || {},
      has_stripe_api_key: !!data.stripe_api_key,
      has_paypal_client_id: !!data.paypal_client_id,
      // Platform keys take priority - if they exist, service is configured
      has_google_maps_api_key: hasPlatformGoogleMapsKey || !!data.google_maps_api_key,
      has_resend_api_key: hasPlatformResendKey || !!data.resend_api_key,
      quickbooks_allowed: quickBooksGate.allowed,
    }

    return { data: safeData, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "An unexpected error occurred"), data: null }
  }
}

export async function updateIntegrationSettings(settings: {
  quickbooks_enabled?: boolean
  quickbooks_api_key?: string
  quickbooks_api_secret?: string
  quickbooks_company_id?: string
  quickbooks_default_income_account_id?: string
  quickbooks_default_item_id?: string
  quickbooks_gl_account_mappings?: Record<string, string>
  stripe_enabled?: boolean
  stripe_api_key?: string
  comdata_enabled?: boolean
  comdata_api_base_url?: string
  comdata_api_key?: string
  comdata_api_secret?: string
  wex_enabled?: boolean
  wex_api_base_url?: string
  wex_api_key?: string
  wex_api_secret?: string
  efs_enabled?: boolean
  efs_api_base_url?: string
  efs_api_key?: string
  efs_api_secret?: string
  fuel_card_last_synced_at?: string
  paypal_enabled?: boolean
  paypal_client_id?: string
  google_maps_enabled?: boolean
  google_maps_api_key?: string
  resend_enabled?: boolean
  resend_api_key?: string
  resend_from_email?: string
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
    return { error: "Only managers can update integration settings", success: false }
  }

  // Check if settings exist
  const { data: existing, error: existingError } = await supabase
    .from("company_integrations")
    .select("id")
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (existingError) {
    return { error: existingError.message, success: false }
  }

  // MEDIUM FIX 17: Build explicit updateData object to prevent column injection
  const updateData: any = {}
  if (settings.quickbooks_enabled !== undefined) updateData.quickbooks_enabled = settings.quickbooks_enabled
  if (settings.quickbooks_api_key !== undefined) updateData.quickbooks_api_key = settings.quickbooks_api_key
  if (settings.quickbooks_api_secret !== undefined) updateData.quickbooks_api_secret = settings.quickbooks_api_secret
  if (settings.quickbooks_company_id !== undefined) updateData.quickbooks_company_id = settings.quickbooks_company_id
  if (settings.quickbooks_default_income_account_id !== undefined)
    updateData.quickbooks_default_income_account_id = settings.quickbooks_default_income_account_id
  if (settings.quickbooks_default_item_id !== undefined)
    updateData.quickbooks_default_item_id = settings.quickbooks_default_item_id
  if (settings.quickbooks_gl_account_mappings !== undefined)
    updateData.quickbooks_gl_account_mappings = settings.quickbooks_gl_account_mappings
  if (settings.stripe_enabled !== undefined) updateData.stripe_enabled = settings.stripe_enabled
  if (settings.stripe_api_key !== undefined) updateData.stripe_api_key = settings.stripe_api_key
  if (settings.comdata_enabled !== undefined) updateData.comdata_enabled = settings.comdata_enabled
  if (settings.comdata_api_base_url !== undefined) updateData.comdata_api_base_url = settings.comdata_api_base_url
  if (settings.comdata_api_key !== undefined) updateData.comdata_api_key = settings.comdata_api_key
  if (settings.comdata_api_secret !== undefined) updateData.comdata_api_secret = settings.comdata_api_secret
  if (settings.wex_enabled !== undefined) updateData.wex_enabled = settings.wex_enabled
  if (settings.wex_api_base_url !== undefined) updateData.wex_api_base_url = settings.wex_api_base_url
  if (settings.wex_api_key !== undefined) updateData.wex_api_key = settings.wex_api_key
  if (settings.wex_api_secret !== undefined) updateData.wex_api_secret = settings.wex_api_secret
  if (settings.efs_enabled !== undefined) updateData.efs_enabled = settings.efs_enabled
  if (settings.efs_api_base_url !== undefined) updateData.efs_api_base_url = settings.efs_api_base_url
  if (settings.efs_api_key !== undefined) updateData.efs_api_key = settings.efs_api_key
  if (settings.efs_api_secret !== undefined) updateData.efs_api_secret = settings.efs_api_secret
  if (settings.fuel_card_last_synced_at !== undefined) updateData.fuel_card_last_synced_at = settings.fuel_card_last_synced_at
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
      .eq("company_id", ctx.companyId)

    if (error) {
      return { error: safeDbError(error), success: false }
    }
  } else {
    // Create new
    const { error } = await supabase
      .from("company_integrations")
      .insert({
        company_id: ctx.companyId,
        ...updateData,
      })

    if (error) {
      return { error: safeDbError(error), success: false }
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
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { configured: false, isManager: false }
  }

  const { getUserRole } = await import("@/lib/server-permissions")
  const role = await getUserRole()
  const MANAGER_ROLES = ["super_admin", "operations_manager"]
  const isManager = role != null && MANAGER_ROLES.includes(role)

  if (!isManager) {
    return { configured: false, isManager: false }
  }

  // CRITICAL FIX: Platform-wide API keys work automatically for all users
  // Check if integration record exists and is enabled (we auto-create with enabled=true)
  const { data: integrations } = await supabase
    .from("company_integrations")
    .select("resend_enabled, resend_api_key")
    .eq("company_id", ctx.companyId)
    .maybeSingle() // Use maybeSingle to handle case where record doesn't exist

  // Check environment variable (platform-wide key)
  const hasPlatformKey = !!process.env.RESEND_API_KEY

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

