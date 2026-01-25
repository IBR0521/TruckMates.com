"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"

/**
 * Map provider driver ID to internal driver ID
 * Returns internal driver ID if mapping exists, otherwise returns null
 */
export async function mapProviderDriverId(
  eldDeviceId: string,
  providerDriverId: string | number | null | undefined,
  provider: string
): Promise<string | null> {
  if (!providerDriverId) {
    return null
  }

  const supabase = await createClient()
  const providerDriverIdStr = String(providerDriverId)

  // Look up mapping
  const { data: mapping } = await supabase
    .from("eld_driver_mappings")
    .select("internal_driver_id")
    .eq("eld_device_id", eldDeviceId)
    .eq("provider_driver_id", providerDriverIdStr)
    .eq("provider", provider)
    .eq("is_active", true)
    .single()

  return mapping?.internal_driver_id || null
}

/**
 * Create or update driver ID mapping
 */
export async function createDriverMapping(data: {
  eld_device_id: string
  provider_driver_id: string
  internal_driver_id: string
  provider: string
  driver_name?: string
  driver_email?: string
}) {
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

  // Verify device belongs to company
  const { data: device } = await supabase
    .from("eld_devices")
    .select("company_id")
    .eq("id", data.eld_device_id)
    .single()

  if (!device || device.company_id !== result.company_id) {
    return { error: "Device not found or access denied", data: null }
  }

  // Verify driver belongs to company
  const { data: driver } = await supabase
    .from("drivers")
    .select("company_id")
    .eq("id", data.internal_driver_id)
    .single()

  if (!driver || driver.company_id !== result.company_id) {
    return { error: "Driver not found or access denied", data: null }
  }

  // Upsert mapping
  const { data: mapping, error } = await supabase
    .from("eld_driver_mappings")
    .upsert(
      {
        company_id: result.company_id,
        eld_device_id: data.eld_device_id,
        provider_driver_id: data.provider_driver_id,
        internal_driver_id: data.internal_driver_id,
        provider: data.provider,
        driver_name: data.driver_name || null,
        driver_email: data.driver_email || null,
        is_active: true,
      },
      {
        onConflict: "eld_device_id,provider_driver_id",
        ignoreDuplicates: false,
      }
    )
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  return { data: mapping, error: null }
}

/**
 * Get all driver mappings for a device
 */
export async function getDriverMappings(eldDeviceId: string) {
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

  const { data: mappings, error } = await supabase
    .from("eld_driver_mappings")
    .select(`
      *,
      driver:drivers!internal_driver_id(id, full_name, email, phone, license_number)
    `)
    .eq("eld_device_id", eldDeviceId)
    .eq("company_id", result.company_id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message, data: null }
  }

  return { data: mappings || [], error: null }
}

/**
 * Delete driver mapping
 */
export async function deleteDriverMapping(mappingId: string) {
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

  // Verify mapping belongs to company
  const { data: mapping } = await supabase
    .from("eld_driver_mappings")
    .select("company_id")
    .eq("id", mappingId)
    .single()

  if (!mapping || mapping.company_id !== result.company_id) {
    return { error: "Mapping not found or access denied", success: false }
  }

  // Soft delete (set is_active to false)
  const { error } = await supabase
    .from("eld_driver_mappings")
    .update({ is_active: false })
    .eq("id", mappingId)

  if (error) {
    return { error: error.message, success: false }
  }

  return { success: true, error: null }
}


