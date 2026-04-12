import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Ensure an active `truckmates_mobile` ELD row exists for the truck (browser session ELD).
 * Idempotent: updates existing web device for this user if present.
 */
export async function ensureWebEldDeviceForTruck(
  admin: SupabaseClient,
  params: { companyId: string; userId: string },
  truckId: string,
  deviceName: string = "Web dashboard ELD",
): Promise<{ deviceId: string | null; error: string | null }> {
  const device_serial_number = `web-${params.userId}`
  const now = new Date().toISOString()
  const deviceData = {
    company_id: params.companyId,
    device_name: deviceName.trim() || "Web dashboard ELD",
    device_serial_number,
    provider: "truckmates_mobile",
    provider_device_id: device_serial_number,
    truck_id: truckId,
    status: "active",
    firmware_version: "web",
    installation_date: now.split("T")[0],
    notes: JSON.stringify({ source: "web_driver_eld_auto" }),
    last_sync_at: now,
    api_key: null as string | null,
    api_secret: null as string | null,
  }

  const { data: existingDevice } = await admin
    .from("eld_devices")
    .select("id, company_id")
    .eq("device_serial_number", device_serial_number)
    .maybeSingle()

  if (existingDevice && existingDevice.company_id !== params.companyId) {
    return { deviceId: null, error: "This device id is already registered to another company." }
  }

  if (existingDevice?.id && existingDevice.company_id === params.companyId) {
    const { data, error } = await admin
      .from("eld_devices")
      .update(deviceData)
      .eq("id", existingDevice.id)
      .eq("company_id", params.companyId)
      .select("id")
      .single()
    if (error) return { deviceId: null, error: error.message }
    return { deviceId: data?.id ? String(data.id) : null, error: null }
  }

  const { data, error } = await admin.from("eld_devices").insert(deviceData).select("id").single()
  if (error) return { deviceId: null, error: error.message }
  return { deviceId: data?.id ? String(data.id) : null, error: null }
}
