"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getCompanySettings } from "./number-formats"
import { handleDbError } from "@/lib/db-helpers"

/**
 * Get check calls for a load, route, or driver
 */
export async function getCheckCalls(filters?: {
  load_id?: string
  route_id?: string
  driver_id?: string
  status?: string
  start_date?: string
  end_date?: string
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
  }

  let query = supabase
    .from("check_calls")
    .select("*")
    .eq("company_id", userData.company_id)
    .order("scheduled_time", { ascending: false })

  if (filters?.load_id) {
    query = query.eq("load_id", filters.load_id)
  }
  if (filters?.route_id) {
    query = query.eq("route_id", filters.route_id)
  }
  if (filters?.driver_id) {
    query = query.eq("driver_id", filters.driver_id)
  }
  if (filters?.status) {
    query = query.eq("status", filters.status)
  }
  if (filters?.start_date) {
    query = query.gte("scheduled_time", filters.start_date)
  }
  if (filters?.end_date) {
    query = query.lte("scheduled_time", filters.end_date)
  }

  const { data, error } = await query

  if (error) {
    const result = handleDbError(error, [])
    if (result.error) return result
    return { data: result.data, error: null }
  }

  return { data: data || [], error: null }
}

/**
 * Create a check call
 */
export async function createCheckCall(formData: {
  load_id?: string
  route_id?: string
  driver_id: string
  call_type: string
  scheduled_time: string
  location?: string
  latitude?: number
  longitude?: number
  address?: string
  notes?: string
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
  }

  const { data, error } = await supabase
    .from("check_calls")
    .insert({
      company_id: userData.company_id,
      load_id: formData.load_id || null,
      route_id: formData.route_id || null,
      driver_id: formData.driver_id,
      call_type: formData.call_type,
      scheduled_time: formData.scheduled_time,
      location: formData.location || null,
      latitude: formData.latitude || null,
      longitude: formData.longitude || null,
      address: formData.address || null,
      notes: formData.notes || null,
      status: "pending",
    })
    .select()
    .single()

  if (error) {
    const result = handleDbError(error, null)
    if (result.error) return result
    return { error: "Table not available. Please run the SQL schema.", data: null }
  }

  revalidatePath("/dashboard/dispatches")
  return { data, error: null }
}

/**
 * Update check call (mark as completed, missed, etc.)
 */
export async function updateCheckCall(
  id: string,
  updates: {
    status?: string
    actual_time?: string
    location?: string
    latitude?: number
    longitude?: number
    address?: string
    driver_status?: string
    odometer_reading?: number
    fuel_level?: number
    notes?: string
    dispatcher_notes?: string
  }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
  }

  const { data, error } = await supabase
    .from("check_calls")
    .update(updates)
    .eq("id", id)
    .eq("company_id", userData.company_id)
    .select()
    .single()

  if (error) {
    const result = handleDbError(error, null)
    if (result.error) return result
    return { error: "Table not available. Please run the SQL schema.", data: null }
  }

  revalidatePath("/dashboard/dispatches")
  return { data, error: null }
}

/**
 * Auto-schedule check calls for a load based on company settings
 */
export async function scheduleCheckCallsForLoad(loadId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
  }

  // Get load details
  const { data: load, error: loadError } = await supabase
    .from("loads")
    .select("*")
    .eq("id", loadId)
    .eq("company_id", userData.company_id)
    .single()

  if (loadError || !load) {
    return { error: "Load not found", data: null }
  }

  if (!load.driver_id) {
    return { error: "Load has no driver assigned", data: null }
  }

  // Get company settings
  const settingsResult = await getCompanySettings()
  if (settingsResult.error || !settingsResult.data) {
    return { error: "Failed to get company settings", data: null }
  }

  const settings = settingsResult.data
  const intervalHours = settings.default_check_call_interval || 4

  // Schedule check calls
  const checkCalls: any[] = []

  // Pickup check call
  if (settings.require_check_call_at_pickup && load.load_date) {
    const pickupTime = new Date(load.load_date)
    checkCalls.push({
      company_id: userData.company_id,
      load_id: loadId,
      driver_id: load.driver_id,
      call_type: "pickup",
      scheduled_time: pickupTime.toISOString(),
      status: "pending",
    })
  }

  // Scheduled interval check calls
  if (load.load_date && load.estimated_delivery) {
    const startTime = new Date(load.load_date)
    const endTime = new Date(load.estimated_delivery)
    const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)

    let currentTime = new Date(startTime)
    currentTime.setHours(currentTime.getHours() + intervalHours)

    while (currentTime < endTime) {
      checkCalls.push({
        company_id: userData.company_id,
        load_id: loadId,
        driver_id: load.driver_id,
        call_type: "scheduled",
        scheduled_time: new Date(currentTime).toISOString(),
        status: "pending",
      })
      currentTime.setHours(currentTime.getHours() + intervalHours)
    }
  }

  // Delivery check call
  if (settings.require_check_call_at_delivery && load.estimated_delivery) {
    const deliveryTime = new Date(load.estimated_delivery)
    checkCalls.push({
      company_id: userData.company_id,
      load_id: loadId,
      driver_id: load.driver_id,
      call_type: "delivery",
      scheduled_time: deliveryTime.toISOString(),
      status: "pending",
    })
  }

  if (checkCalls.length > 0) {
    const { data, error } = await supabase
      .from("check_calls")
      .insert(checkCalls)
      .select()

    if (error) {
      const result = handleDbError(error, [])
      if (result.error) return result
      return { data: [], error: null }
    }

    return { data, error: null }
  }

  return { data: [], error: null }
}

/**
 * Get overdue check calls
 */
export async function getOverdueCheckCalls() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
  }

  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from("check_calls")
    .select("*")
    .eq("company_id", userData.company_id)
    .eq("status", "pending")
    .lt("scheduled_time", now)
    .order("scheduled_time", { ascending: true })

  if (error) {
    const result = handleDbError(error, [])
    if (result.error) return result
    return { data: result.data, error: null }
  }

  return { data: data || [], error: null }
}

