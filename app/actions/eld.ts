"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// Get all ELD devices for a company
export async function getELDDevices() {
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

  const { data: devices, error } = await supabase
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
    .eq("company_id", userData.company_id)
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message, data: null }
  }

  return { data: devices, error: null }
}

// Get a single ELD device
export async function getELDDevice(id: string) {
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
    .eq("company_id", userData.company_id)
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  return { data: device, error: null }
}

// Create ELD device
export async function createELDDevice(formData: {
  device_name: string
  device_serial_number: string
  provider: string
  provider_device_id?: string
  api_key?: string
  api_secret?: string
  truck_id?: string
  status?: string
  firmware_version?: string
  installation_date?: string
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
    .select("company_id, role")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
  }

  if (userData.role !== "manager") {
    return { error: "Only managers can create ELD devices", data: null }
  }

  // Build insert data
  const deviceData: any = {
    company_id: userData.company_id,
    device_name: formData.device_name,
    device_serial_number: formData.device_serial_number,
    provider: formData.provider,
    status: formData.status || "active",
  }

  if (formData.provider_device_id) deviceData.provider_device_id = formData.provider_device_id
  if (formData.api_key) deviceData.api_key = formData.api_key
  if (formData.api_secret) deviceData.api_secret = formData.api_secret
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
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/eld")
  return { data, error: null }
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
    truck_id?: string
    status?: string
    firmware_version?: string
    installation_date?: string
    notes?: string
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
    .select("company_id, role")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
  }

  if (userData.role !== "manager") {
    return { error: "Only managers can update ELD devices", data: null }
  }

  // Build update data
  const updateData: any = {}
  if (formData.device_name !== undefined) updateData.device_name = formData.device_name
  if (formData.device_serial_number !== undefined) updateData.device_serial_number = formData.device_serial_number
  if (formData.provider !== undefined) updateData.provider = formData.provider
  if (formData.provider_device_id !== undefined) updateData.provider_device_id = formData.provider_device_id
  if (formData.api_key !== undefined) updateData.api_key = formData.api_key
  if (formData.api_secret !== undefined) updateData.api_secret = formData.api_secret
  if (formData.truck_id !== undefined) updateData.truck_id = formData.truck_id || null
  if (formData.status !== undefined) updateData.status = formData.status
  if (formData.firmware_version !== undefined) updateData.firmware_version = formData.firmware_version
  if (formData.installation_date !== undefined) updateData.installation_date = formData.installation_date || null
  if (formData.notes !== undefined) updateData.notes = formData.notes

  const { data, error } = await supabase
    .from("eld_devices")
    .update(updateData)
    .eq("id", id)
    .eq("company_id", userData.company_id)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/eld")
  return { data, error: null }
}

// Delete ELD device
export async function deleteELDDevice(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id, role")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
  }

  if (userData.role !== "manager") {
    return { error: "Only managers can delete ELD devices", data: null }
  }

  const { error } = await supabase
    .from("eld_devices")
    .delete()
    .eq("id", id)
    .eq("company_id", userData.company_id)

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/eld")
  return { error: null }
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
    .eq("company_id", userData.company_id)
    .order("log_date", { ascending: false })
    .order("start_time", { ascending: false })

  if (filters?.eld_device_id) {
    query = query.eq("eld_device_id", filters.eld_device_id)
  }
  if (filters?.driver_id) {
    query = query.eq("driver_id", filters.driver_id)
  }
  if (filters?.truck_id) {
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
    return { error: error.message, data: null, count: 0 }
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
    .eq("company_id", userData.company_id)
    .order("event_time", { ascending: false })

  if (filters?.eld_device_id) {
    query = query.eq("eld_device_id", filters.eld_device_id)
  }
  if (filters?.driver_id) {
    query = query.eq("driver_id", filters.driver_id)
  }
  if (filters?.truck_id) {
    query = query.eq("truck_id", filters.truck_id)
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
    return { error: error.message, data: null }
  }

  return { data: events || [], error: null, count: count || 0 }
}

// Get ELD mileage data for IFTA reports
export async function getELDMileageData(filters: {
  truck_ids: string[]
  start_date: string
  end_date: string
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

  // Get mileage data from ELD logs for the specified trucks and date range
  const { data: logs, error } = await supabase
    .from("eld_logs")
    .select("truck_id, miles_driven, log_date, location_start, location_end")
    .eq("company_id", userData.company_id)
    .in("truck_id", filters.truck_ids)
    .gte("log_date", filters.start_date)
    .lte("log_date", filters.end_date)
    .eq("log_type", "driving")
    .not("miles_driven", "is", null)

  if (error) {
    return { error: error.message, data: null }
  }

  // Aggregate mileage by truck
  const mileageByTruck: Record<string, number> = {}
  logs?.forEach((log) => {
    if (log.truck_id && log.miles_driven) {
      mileageByTruck[log.truck_id] = (mileageByTruck[log.truck_id] || 0) + Number(log.miles_driven)
    }
  })

  return { data: { logs, mileageByTruck, totalMiles: Object.values(mileageByTruck).reduce((a, b) => a + b, 0) }, error: null }
}

// Resolve ELD event
export async function resolveELDEvent(eventId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id, role")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
  }

  if (userData.role !== "manager") {
    return { error: "Only managers can resolve events", data: null }
  }

  const { data, error } = await supabase
    .from("eld_events")
    .update({
      resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
    })
    .eq("id", eventId)
    .eq("company_id", userData.company_id)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/eld")
  return { data, error: null }
}
