"use server"

import { createClient } from "@/lib/supabase/server"
import { errorMessage } from "@/lib/error-message"
import { revalidatePath } from "next/cache"
import { getCachedAuthContext } from "@/lib/auth/server"
import { getCompanySettings } from "./number-formats"
import { handleDbError } from "@/lib/db-helpers"
import * as Sentry from "@sentry/nextjs"

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
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    let query = supabase
      .from("check_calls")
      .select(
        "id, company_id, load_id, route_id, driver_id, call_type, scheduled_time, actual_time, location, latitude, longitude, address, notes, dispatcher_notes, driver_status, odometer_reading, fuel_level, timestamp, status, created_at, updated_at",
      )
      .eq("company_id", ctx.companyId)
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
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "An unexpected error occurred"), data: null }
  }
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
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // LOW FIX: Use driver's timezone for timestamp if available, otherwise use server time
  let timestamp = new Date().toISOString()
  if (formData.driver_id) {
    // Try to get driver's timezone from profile
    const { data: driver, error: driverError } = await supabase
      .from("drivers")
      .select("timezone")
      .eq("id", formData.driver_id)
      .eq("company_id", ctx.companyId)
      .maybeSingle()
    
    if (!driverError && driver?.timezone) {
      // Convert to driver's timezone
      const now = new Date()
      const driverTime = new Date(now.toLocaleString("en-US", { timeZone: driver.timezone }))
      timestamp = driverTime.toISOString()
    }
  }

  const { data, error } = await supabase
    .from("check_calls")
    .insert({
      company_id: ctx.companyId,
      load_id: formData.load_id || null,
      route_id: formData.route_id || null,
      driver_id: formData.driver_id,
      call_type: formData.call_type,
      scheduled_time: formData.scheduled_time,
      location: formData.location || null,
      latitude: formData.latitude || null,
      longitude: formData.longitude || null,
      timestamp: timestamp, // LOW FIX: Use driver timezone-aware timestamp
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
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const { data, error } = await supabase
    .from("check_calls")
    .update(updates)
    .eq("id", id)
    .eq("company_id", ctx.companyId)
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
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // Get load details
  const { data: load, error: loadError } = await supabase
    .from("loads")
    .select("id, company_id, driver_id, load_date, estimated_delivery")
    .eq("id", loadId)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

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
      company_id: ctx.companyId,
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
        company_id: ctx.companyId,
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
      company_id: ctx.companyId,
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
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from("check_calls")
    .select(
      "id, company_id, load_id, route_id, driver_id, call_type, scheduled_time, actual_time, location, latitude, longitude, address, notes, dispatcher_notes, driver_status, odometer_reading, fuel_level, timestamp, status, created_at, updated_at",
    )
    .eq("company_id", ctx.companyId)
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

