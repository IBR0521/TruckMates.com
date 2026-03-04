"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { createDriver } from "./drivers"
import { createTruck } from "./trucks"

/**
 * Get account setup status
 */
export async function getSetupStatus() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  // CRITICAL FIX: Don't use cached company_id - fetch fresh from database
  // This ensures we get the latest setup_complete status
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (userError || !userData?.company_id) {
    return { error: "No company found", data: null }
  }

  const company_id = userData.company_id

  try {
    // CRITICAL FIX: Always fetch fresh data, no caching
    // This ensures setup_complete is always up-to-date
    const { data: company, error } = await supabase
      .from("companies")
      .select("id, name, address, phone, setup_complete, setup_completed_at, setup_data")
      .eq("id", company_id)
      .single()

    if (error) {
      return { error: error.message, data: null }
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
  } catch (error: any) {
    return { error: error.message || "Failed to get setup status", data: null }
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

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  try {
    const updateData: any = {}
    // Map wizard fields onto existing companies columns:
    // - Store the full business address string in companies.address
    // - Store phone/email in companies.phone / companies.email
    if (data.business_address) updateData.address = data.business_address
    if (data.business_phone) updateData.phone = data.business_phone
    if (data.business_email) updateData.email = data.business_email
    // City/state/zip are currently not separate columns on companies;
    // they are stored in the more detailed settings table instead.

    const { error } = await supabase
      .from("companies")
      .update(updateData)
      .eq("id", company_id)

    if (error) {
      return { error: error.message, data: null }
    }

    revalidatePath("/dashboard/settings/business")

    // Return minimal JSON-safe response - no database row, just success flag
    return {
      data: { success: true },
      error: null,
    }
  } catch (error: any) {
    return { error: error.message || "Failed to update company profile", data: null }
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
  } catch (error: any) {
    return { error: error.message || "Failed to create driver", data: null }
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
  } catch (error: any) {
    return { error: error.message || "Failed to create truck", data: null }
  }
}

/**
 * Complete setup
 */
export async function completeSetup() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  try {
    const { error } = await supabase
      .from("companies")
      .update({
        setup_complete: true,
        setup_completed_at: new Date().toISOString(),
      })
      .eq("id", company_id)

    if (error) {
      return { error: error.message, data: null }
    }

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
  } catch (error: any) {
    return { error: error.message || "Failed to complete setup", data: null }
  }
}

