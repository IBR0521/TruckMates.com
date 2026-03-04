"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"
import { revalidatePath } from "next/cache"
import { createDriver } from "./drivers"
import { createTruck } from "./trucks"
import { setupDemoCompany } from "./demo"

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

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  try {
    // NOTE:
    // The base companies table (from auth/schema.sql) only has:
    //   address, phone, email
    // It does NOT have business_address / business_phone columns.
    // To avoid schema cache errors, we read from the existing columns and
    // treat them as the basic company info for setup.
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
 * Import demo data
 */
export async function importDemoData() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  try {
    const result = await setupDemoCompany(user.id)
    return result
  } catch (error: any) {
    return { error: error.message || "Failed to import demo data", data: null }
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
    const { data: company, error } = await supabase
      .from("companies")
      .update({
        setup_complete: true,
        setup_completed_at: new Date().toISOString(),
      })
      .eq("id", company_id)
      .select()
      .single()

    if (error) {
      return { error: error.message, data: null }
    }

    revalidatePath("/dashboard")
    return { data: company, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to complete setup", data: null }
  }
}

