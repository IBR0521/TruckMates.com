"use server"

import * as Sentry from "@sentry/nextjs"
import { errorMessage, sanitizeError } from "@/lib/error-message"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { ensureDriverIdForUser } from "@/lib/eld/ensure-driver"
import { resolveTruckIdForDriver } from "@/lib/eld/resolve-driver-truck"
import { mapLegacyRole } from "@/lib/roles"
import { revalidatePath } from "next/cache"


function safeDbError(error: unknown, fallback = "Database operation failed"): string {
  Sentry.captureException(error)
  return sanitizeError(error, { fallback })
}


/** Drivers: same provisioning as dashboard/mobile (`ensureDriverIdForUser`). Others: DB lookup only. */
async function resolveDriverIdForELD(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  userId: string,
  role: ReturnType<typeof mapLegacyRole> | null
): Promise<string | null> {
  if (role !== "driver") {
    const { data: row } = await supabase
      .from("drivers")
      .select("id")
      .eq("company_id", companyId)
      .eq("user_id", userId)
      .maybeSingle()
    return row?.id ? String(row.id) : null
  }
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin")
    const id = await ensureDriverIdForUser(createAdminClient(), companyId, userId)
    if (id) return id
  } catch {
    // Missing service role or DB error — fall back to plain read
  }
  const { data: row } = await supabase
    .from("drivers")
    .select("id")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle()
  return row?.id ? String(row.id) : null
}

/** Driver ELD scope: devices are tied to `truck_id`; logs/events to `driver_id` / truck. */
async function getDriverTruckIdForUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  userId: string,
  role: ReturnType<typeof mapLegacyRole> | null
): Promise<string | null> {
  const driverId = await resolveDriverIdForELD(supabase, companyId, userId, role)
  if (!driverId) return null
  const { createAdminClient } = await import("@/lib/supabase/admin")
  return resolveTruckIdForDriver(createAdminClient(), companyId, driverId)
}

// Get all ELD devices for a company (drivers: only devices on their assigned truck)
export async function getELDDevices() {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    let query = supabase
      .from("eld_devices")
      .select(`
        *,
        trucks:truck_id (
          id,
          truck_number,
          make,
          model
        )
      `)
      .eq("company_id", ctx.companyId)
      .order("created_at", { ascending: false })

    const role = ctx.user ? mapLegacyRole(ctx.user.role) : null
    if (role === "driver" && ctx.userId) {
      const truckId = await getDriverTruckIdForUser(supabase, ctx.companyId, ctx.userId, role)
      if (!truckId) {
        return { data: [], error: null }
      }
      query = query.eq("truck_id", truckId)
    }

    const { data: devices, error } = await query

    if (error) {
      return { error: safeDbError(error), data: null }
    }

    return { data: devices, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? errorMessage(error) : "An unexpected error occurred"
    return { error: message, data: null }
  }
}

// Get a single ELD device
export async function getELDDevice(id: string) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    const { data: device, error } = await supabase
      .from("eld_devices")
      .select(`
        *,
        trucks:truck_id (
          id,
          truck_number,
          make,
          model
        )
      `)
      .eq("id", id)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (error) {
      return { error: safeDbError(error), data: null }
    }

    if (!device) {
      return { error: "ELD device not found", data: null }
    }

    const role = ctx.user ? mapLegacyRole(ctx.user.role) : null
    if (role === "driver" && ctx.userId) {
      const truckId = await getDriverTruckIdForUser(supabase, ctx.companyId, ctx.userId, role)
      const devTruck = device.truck_id ? String(device.truck_id) : null
      if (!truckId || !devTruck || devTruck !== truckId) {
        return { error: "ELD device not found", data: null }
      }
    }

    return { data: device, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? errorMessage(error) : "An unexpected error occurred"
    return { error: message, data: null }
  }
}

// Create ELD device
export async function createELDDevice(formData: {
  device_name: string
  device_serial_number: string
  provider: string
  provider_device_id?: string
  api_key?: string
  api_secret?: string
  api_endpoint?: string
  truck_id?: string
  status?: string
  firmware_version?: string
  installation_date?: string
  notes?: string
}) {
  try {
    const supabase = await createClient()

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    const { checkCreatePermission } = await import("@/lib/server-permissions")
    const perm = await checkCreatePermission("eld")
    if (!perm.allowed) {
      return { error: perm.error || "You don't have permission to create ELD devices", data: null }
    }

    // Basic server-side validation so we fail fast with clear errors
    if (!formData.device_name?.trim()) {
      return { error: "Device name is required", data: null }
    }
    if (!formData.device_serial_number?.trim()) {
      return { error: "Device serial number is required", data: null }
    }
    if (!formData.provider?.trim()) {
      return { error: "Provider is required", data: null }
    }

    // Build insert data
    const deviceData: any = {
      company_id: ctx.companyId,
      device_name: formData.device_name.trim(),
      device_serial_number: formData.device_serial_number.trim(),
      provider: formData.provider.trim(),
      status: formData.status || "active",
    }

    if (formData.provider_device_id) deviceData.provider_device_id = formData.provider_device_id.trim()
    if (formData.api_key) deviceData.api_key = formData.api_key
    if (formData.api_secret) deviceData.api_secret = formData.api_secret
    if (formData.api_endpoint) deviceData.api_endpoint = formData.api_endpoint
    if (formData.truck_id) deviceData.truck_id = formData.truck_id
    if (formData.firmware_version) deviceData.firmware_version = formData.firmware_version
    if (formData.installation_date) deviceData.installation_date = formData.installation_date
    if (formData.notes) deviceData.notes = formData.notes

    const { data, error } = await supabase
      .from("eld_devices")
      .insert(deviceData)
      .select()
      .single()

    if (error) {
      return { error: safeDbError(error), data: null }
    }

    revalidatePath("/dashboard/eld")
    return { data, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? errorMessage(error) : "Failed to create ELD device"
    return { error: message, data: null }
  }
}

// Update ELD device
export async function updateELDDevice(
  id: string,
  formData: {
    device_name?: string
    device_serial_number?: string
    provider?: string
    provider_device_id?: string
    api_key?: string
    api_secret?: string
    api_endpoint?: string
    truck_id?: string
    status?: string
    firmware_version?: string
    installation_date?: string
    notes?: string
  }
) {
  try {
    const supabase = await createClient()

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    const { checkEditPermission } = await import("@/lib/server-permissions")
    const perm = await checkEditPermission("eld")
    if (!perm.allowed) {
      return { error: perm.error || "You don't have permission to update ELD devices", data: null }
    }

    // Build update data
    const updateData: any = {}
    if (formData.device_name !== undefined) updateData.device_name = formData.device_name
    if (formData.device_serial_number !== undefined) updateData.device_serial_number = formData.device_serial_number
    if (formData.provider !== undefined) updateData.provider = formData.provider
    if (formData.provider_device_id !== undefined) updateData.provider_device_id = formData.provider_device_id
    if (formData.api_key !== undefined) updateData.api_key = formData.api_key
    if (formData.api_secret !== undefined) updateData.api_secret = formData.api_secret
    if (formData.api_endpoint !== undefined) updateData.api_endpoint = formData.api_endpoint
    if (formData.truck_id !== undefined) updateData.truck_id = formData.truck_id || null
    if (formData.status !== undefined) updateData.status = formData.status
    if (formData.firmware_version !== undefined) updateData.firmware_version = formData.firmware_version
    if (formData.installation_date !== undefined) updateData.installation_date = formData.installation_date || null
    if (formData.notes !== undefined) updateData.notes = formData.notes

    if (Object.keys(updateData).length === 0) {
      return { error: "No changes provided", data: null }
    }

    const { data, error } = await supabase
      .from("eld_devices")
      .update(updateData)
      .eq("id", id)
      .eq("company_id", ctx.companyId)
      .select()
      .single()

    if (error) {
      return { error: safeDbError(error), data: null }
    }

    revalidatePath("/dashboard/eld")
    return { data, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? errorMessage(error) : "Failed to update ELD device"
    return { error: message, data: null }
  }
}

// Delete ELD device
export async function deleteELDDevice(id: string) {
  try {
    const supabase = await createClient()

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    // Basic UUID format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!id || !uuidRegex.test(id)) {
      return { error: "Invalid device ID format", data: null }
    }

    const { checkDeletePermission } = await import("@/lib/server-permissions")
    const permission = await checkDeletePermission("eld")
    if (!permission.allowed) {
      return { error: permission.error || "You don't have permission to delete ELD devices", data: null }
    }

    const { error } = await supabase
      .from("eld_devices")
      .delete()
      .eq("id", id)
      .eq("company_id", ctx.companyId)

    if (error) {
      return { error: safeDbError(error), data: null }
    }

    revalidatePath("/dashboard/eld")
    return { error: null, data: { id } }
  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? errorMessage(error) : "Failed to delete ELD device"
    return { error: message, data: null }
  }
}

// Sync ELD device data from provider
export async function syncELDData(deviceId: string) {
  const { syncELDDevice } = await import("./eld-sync")
  return await syncELDDevice(deviceId)
}

// Get ELD logs for a device or driver
export async function getELDLogs(filters?: {
  eld_device_id?: string
  driver_id?: string
  truck_id?: string
  start_date?: string
  end_date?: string
  log_type?: string
  limit?: number
  offset?: number
}) {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const role = ctx.user ? mapLegacyRole(ctx.user.role) : null
  let driverScopeId: string | null = null
  if (role === "driver" && ctx.userId) {
    driverScopeId = await resolveDriverIdForELD(supabase, ctx.companyId, ctx.userId, role)
    if (!driverScopeId) {
      return { data: [], error: null, count: 0 }
    }
  }

  let query = supabase
    .from("eld_logs")
    .select(`
      *,
      eld_devices:eld_device_id (
        id,
        device_name,
        device_serial_number
      ),
      drivers:driver_id (
        id,
        name
      ),
      trucks:truck_id (
        id,
        truck_number
      )
    `)
    .eq("company_id", ctx.companyId)
    .order("log_date", { ascending: false })
    .order("start_time", { ascending: false })

  if (driverScopeId) {
    query = query.eq("driver_id", driverScopeId)
  } else {
    if (filters?.driver_id) {
      query = query.eq("driver_id", filters.driver_id)
    }
  }

  if (filters?.eld_device_id) {
    query = query.eq("eld_device_id", filters.eld_device_id)
  }
  if (!driverScopeId && filters?.truck_id) {
    query = query.eq("truck_id", filters.truck_id)
  }
  if (filters?.start_date) {
    query = query.gte("log_date", filters.start_date)
  }
  if (filters?.end_date) {
    query = query.lte("log_date", filters.end_date)
  }
  if (filters?.log_type) {
    query = query.eq("log_type", filters.log_type)
  }

  // Apply pagination (default limit 100, max 500 for performance)
  const limit = Math.min(filters?.limit || 100, 500)
  const offset = filters?.offset || 0
  const { data: logs, error, count } = await query.range(offset, offset + limit - 1)

  if (error) {
    return { error: safeDbError(error), data: null, count: 0 }
  }

  return { data: logs || [], error: null, count: count || 0 }
}

// Get ELD events/alerts
export async function getELDEvents(filters?: {
  eld_device_id?: string
  driver_id?: string
  truck_id?: string
  event_type?: string
  severity?: string
  resolved?: boolean
  start_date?: string
  end_date?: string
  limit?: number
  offset?: number
}) {
  try {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const role = ctx.user ? mapLegacyRole(ctx.user.role) : null
  let driverScopeId: string | null = null
  let driverTruckId: string | null = null
  if (role === "driver" && ctx.userId) {
    driverScopeId = await resolveDriverIdForELD(supabase, ctx.companyId, ctx.userId, role)
    driverTruckId = await getDriverTruckIdForUser(supabase, ctx.companyId, ctx.userId, role)
    if (!driverScopeId) {
      return { data: [], error: null, count: 0 }
    }
  }

  let query = supabase
    .from("eld_events")
    .select(`
      *,
      eld_devices:eld_device_id (
        id,
        device_name
      ),
      drivers:driver_id (
        id,
        name
      ),
      trucks:truck_id (
        id,
        truck_number
      )
    `)
    .eq("company_id", ctx.companyId)
    .order("event_time", { ascending: false })

  if (driverScopeId) {
    if (driverTruckId) {
      query = query.or(
        `driver_id.eq.${driverScopeId},truck_id.eq.${driverTruckId}`
      )
    } else {
      query = query.eq("driver_id", driverScopeId)
    }
  } else {
    if (filters?.driver_id) {
      query = query.eq("driver_id", filters.driver_id)
    }
    if (filters?.truck_id) {
      query = query.eq("truck_id", filters.truck_id)
    }
  }

  if (filters?.eld_device_id) {
    query = query.eq("eld_device_id", filters.eld_device_id)
  }
  if (filters?.event_type) {
    query = query.eq("event_type", filters.event_type)
  }
  if (filters?.severity) {
    query = query.eq("severity", filters.severity)
  }
  if (filters?.resolved !== undefined) {
    query = query.eq("resolved", filters.resolved)
  }
  if (filters?.start_date) {
    query = query.gte("event_time", filters.start_date)
  }
  if (filters?.end_date) {
    query = query.lte("event_time", filters.end_date)
  }

  // Apply pagination (default limit 100, max 500)
  const limit = Math.min(filters?.limit || 100, 500)
  const offset = filters?.offset || 0
  const { data: events, error, count } = await query.range(offset, offset + limit - 1)

  if (error) {
    return { error: safeDbError(error), data: null }
  }

  return { data: events || [], error: null, count: count || 0 }
  } catch (e: unknown) {
    Sentry.captureException(e)
    return {
      error: errorMessage(e, "Failed to load ELD events"),
      data: null,
    }
  }
}

// Get ELD mileage data for IFTA reports
export async function getELDMileageData(filters: {
  truck_ids: string[]
  start_date: string
  end_date: string
}) {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const role = ctx.user ? mapLegacyRole(ctx.user.role) : null
  let truckIds = filters.truck_ids
  if (role === "driver" && ctx.userId) {
    const myTruck = await getDriverTruckIdForUser(supabase, ctx.companyId, ctx.userId, role)
    if (!myTruck) {
      return { data: { logs: [], mileageByTruck: {}, totalMiles: 0 }, error: null }
    }
    truckIds = filters.truck_ids.filter((id) => id === myTruck)
    if (truckIds.length === 0) {
      return { data: { logs: [], mileageByTruck: {}, totalMiles: 0 }, error: null }
    }
  }

  // Get mileage data from ELD logs for the specified trucks and date range
  // V3-007 FIX: Add LIMIT to prevent OOM on large datasets
  const { data: logs, error } = await supabase
    .from("eld_logs")
    .select("truck_id, miles_driven, log_date, location_start, location_end")
    .eq("company_id", ctx.companyId)
    .in("truck_id", truckIds)
    .gte("log_date", filters.start_date)
    .lte("log_date", filters.end_date)
    .eq("log_type", "driving")
    .not("miles_driven", "is", null)
    .limit(10000) // V3-007: Limit to 10k records to prevent OOM

  if (error) {
    return { error: safeDbError(error), data: null }
  }

  // Aggregate mileage by truck
  const mileageByTruck: Record<string, number> = {}
  logs?.forEach((log: { truck_id: string | null; miles_driven: number | string | null; [key: string]: any }) => {
    if (log.truck_id && log.miles_driven) {
      mileageByTruck[log.truck_id] = (mileageByTruck[log.truck_id] || 0) + Number(log.miles_driven)
    }
  })

  return { data: { logs, mileageByTruck, totalMiles: Object.values(mileageByTruck).reduce((a, b) => a + b, 0) }, error: null }
}

// Resolve ELD event
export async function resolveELDEvent(eventId: string) {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const { checkEditPermission } = await import("@/lib/server-permissions")
  const perm = await checkEditPermission("eld")
  if (!perm.allowed) {
    return { error: perm.error || "You don't have permission to resolve ELD events", data: null }
  }

  const { data, error } = await supabase
    .from("eld_events")
    .update({
      resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by: ctx.userId!,
    })
    .eq("id", eventId)
    .eq("company_id", ctx.companyId)
    .select()
    .single()

  if (error) {
    return { error: safeDbError(error), data: null }
  }

  revalidatePath("/dashboard/eld")
  return { data, error: null }
}
