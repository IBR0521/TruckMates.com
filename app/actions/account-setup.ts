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
    const { data: company, error } = await supabase
      .from("companies")
      .select("id, name, setup_complete, setup_completed_at, setup_data")
      .eq("id", company_id)
      .single()

    if (error) {
      return { error: error.message, data: null }
    }

    // Check if company has basic info (address, phone)
    const { data: companyDetails } = await supabase
      .from("companies")
      .select("business_address, business_phone")
      .eq("id", company_id)
      .single()

    const hasBasicInfo = companyDetails?.business_address && companyDetails?.business_phone

    return {
      data: {
        setup_complete: company?.setup_complete || false,
        setup_completed_at: company?.setup_completed_at || null,
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
    if (data.business_address) updateData.business_address = data.business_address
    if (data.business_city) updateData.business_city = data.business_city
    if (data.business_state) updateData.business_state = data.business_state
    if (data.business_zip) updateData.business_zip = data.business_zip
    if (data.business_phone) updateData.business_phone = data.business_phone
    if (data.business_email) updateData.business_email = data.business_email
    if (data.timezone) updateData.timezone = data.timezone

    const { data: company, error } = await supabase
      .from("companies")
      .update(updateData)
      .eq("id", company_id)
      .select()
      .single()

    if (error) {
      return { error: error.message, data: null }
    }

    revalidatePath("/dashboard/settings/business")

    // Return only JSON-safe, minimal data to avoid Next.js coercion errors
    const safeData = company
      ? {
          id: String(company.id),
          name: String(company.name || ""),
          business_address: company.business_address || "",
          business_city: company.business_city || "",
          business_state: company.business_state || "",
          business_zip: company.business_zip || "",
          business_phone: company.business_phone || "",
          business_email: company.business_email || "",
        }
      : null

    return { data: safeData, error: null }
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

