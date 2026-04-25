"use server"

import { createClient } from "@/lib/supabase/server"
import { errorMessage, sanitizeError } from "@/lib/error-message"
import { getCachedAuthContext } from "@/lib/auth/server"
import * as Sentry from "@sentry/nextjs"
import { revalidatePath } from "next/cache"
import { createDriver } from "./drivers"
import { createTruck } from "./trucks"


function safeDbError(error: unknown, fallback = "Database operation failed"): string {
  Sentry.captureException(error)
  return sanitizeError(error, { fallback })
}


// Note: getCachedUserCompany removed - using direct queries for setup to avoid cache issues

/**
 * Get account setup status
 */
export async function getSetupStatus() {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }
  const company_id = ctx.companyId

  try {
    // CRITICAL FIX: Always fetch fresh data, no caching
    // This ensures setup_complete is always up-to-date
    const { data: company, error } = await supabase
      .from("companies")
      .select("id, name, address, phone, setup_complete, setup_completed_at, setup_data")
      .eq("id", company_id)
      .maybeSingle()

    if (error) {
      return { error: safeDbError(error), data: null }
    }
    if (!company) {
      return { error: "Company not found", data: null }
    }

    const hasBasicInfo = !!(company?.address && company?.phone)

    return {
      data: {
        setup_complete: company?.setup_complete ?? false,
        setup_completed_at: company?.setup_completed_at ?? null,
        has_basic_info: hasBasicInfo || false,
        setup_data: company?.setup_data || {},
      },
      error: null,
    }
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to get setup status"), data: null }
  }
}

/**
 * Update company profile during setup
 */
export async function updateCompanyProfile(data: {
  business_address?: string
  business_city?: string
  business_state?: string
  business_zip?: string
  business_phone?: string
  business_email?: string
  timezone?: string
}) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "No company found. Please complete registration first.", data: null }
  }
  const company_id = ctx.companyId

  try {
    // CRITICAL FIX: Use RPC function to bypass RLS during setup
    // This ensures the update works even if role isn't fully set yet
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'update_company_for_setup',
      {
        p_company_id: company_id,
        p_address: data.business_address || null,
        p_phone: data.business_phone || null,
        p_email: data.business_email || null,
      }
    )

    if (rpcError) {
      Sentry.captureException(rpcError)
      // Fallback to direct update if RPC doesn't exist
      const updateData: any = {}
      if (data.business_address) updateData.address = data.business_address
      if (data.business_phone) updateData.phone = data.business_phone
      if (data.business_email) updateData.email = data.business_email

      const { error: updateError } = await supabase
        .from("companies")
        .update(updateData)
        .eq("id", company_id)

      if (updateError) {
        return { 
          error: updateError.message || "Failed to update company profile. Please ensure the update_company_for_setup function exists in your database.",
          data: null 
        }
      }
    } else if (rpcResult && !rpcResult.success) {
      return { 
        error: rpcResult.error || "Failed to update company profile",
        data: null 
      }
    }

    revalidatePath("/dashboard/settings/business")

    // Return minimal JSON-safe response - no database row, just success flag
    return {
      data: { success: true },
      error: null,
    }
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to update company profile"), data: null }
  }
}

/**
 * Create first driver during setup
 */
export async function createFirstDriver(data: {
  name: string
  email?: string
  phone?: string
  license_number?: string
}) {
  try {
    const result = await createDriver({
      name: data.name,
      email: data.email || "",
      phone: data.phone || "",
      license_number: data.license_number || "",
      status: "active",
    })

    return result
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to create driver"), data: null }
  }
}

/**
 * Create first truck during setup
 */
export async function createFirstTruck(data: {
  truck_number: string
  make?: string
  model?: string
  year?: number
  vin?: string
}) {
  try {
    const result = await createTruck({
      truck_number: data.truck_number,
      make: data.make || "",
      model: data.model || "",
      year: data.year || new Date().getFullYear(),
      vin: data.vin || "",
      status: "active",
    })

    return result
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to create truck"), data: null }
  }
}

/**
 * Complete setup
 */
// Auto-enable platform integrations (Google Maps, Email Service) for new companies
async function enablePlatformIntegrations(companyId: string) {
  try {
    const supabase = await createClient()
    const { error } = await supabase.rpc('auto_enable_platform_integrations', {
      p_company_id: companyId
    })
    if (error) {
      Sentry.captureException(error)
      // Don't fail setup if this fails - it's optional
    }
  } catch (error) {
    Sentry.captureException(error)
    // Don't fail setup if this fails
  }
}

export async function completeSetup() {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "No company found. Please complete registration first.", data: null }
  }
  const company_id = ctx.companyId

  try {
    // CRITICAL FIX: Use RPC function to bypass RLS during setup
    // This ensures the update works even if role isn't fully set yet
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'update_company_setup_complete',
      {
        p_company_id: company_id,
      }
    )

    if (rpcError) {
      // Fallback to direct update if RPC doesn't exist
      const { error: updateError } = await supabase
        .from("companies")
        .update({
          setup_complete: true,
          setup_completed_at: new Date().toISOString(),
        })
        .eq("id", company_id)

      if (updateError) {
        return { 
          error: updateError.message || "Failed to complete setup. Please ensure the update_company_setup_complete function exists in your database.",
          data: null 
        }
      }
    } else if (rpcResult && !rpcResult.success) {
      return { 
        error: rpcResult.error || "Failed to complete setup",
        data: null 
      }
    }

    // CRITICAL FIX: Auto-enable platform integrations (Google Maps, Email Service)
    // These use platform-wide API keys and work automatically for all users
    await enablePlatformIntegrations(company_id)

    // CRITICAL FIX: Force revalidation of all paths and clear Next.js cache
    revalidatePath("/dashboard")
    revalidatePath("/account-setup/manager")
    revalidatePath("/", "layout") // Revalidate root layout to clear any cached redirects
    
    // Also revalidate the setup status check itself
    // This ensures getSetupStatus() will return fresh data
    revalidatePath("/", "page")
    
    // CRITICAL FIX: Add a small delay to ensure database write is committed
    // This prevents race conditions where the redirect check happens before the update is visible
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Return minimal JSON-safe response - no database row, just success flag
    return {
      data: { success: true, company_id: String(company_id) },
      error: null,
    }
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to complete setup"), data: null }
  }
}

