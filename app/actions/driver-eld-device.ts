"use server"

import { revalidatePath } from "next/cache"
import { getCachedAuthContext } from "@/lib/auth/server"
import { ensureDriverIdForUser } from "@/lib/eld/ensure-driver"
import { resolveTruckIdForDriver } from "@/lib/eld/resolve-driver-truck"
import { mapLegacyRole } from "@/lib/roles"

/**
 * Register a mobile/web ELD row (`provider: truckmates_mobile` in DB for RLS compatibility) for the
 * logged-in driver — same rules as POST /api/eld/mobile/register, but uses the browser session.
 * Integrated hardware (Samsara, Geotab, etc.) is added by fleet staff, not here.
 */
export async function registerWebEldDevice(formData: { device_name: string }) {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId || !ctx.user) {
    return { error: ctx.error || "Not authenticated", data: null }
  }
  if (mapLegacyRole(ctx.user.role) !== "driver") {
    return { error: "Only drivers can register a mobile ELD from this screen.", data: null }
  }

  const { createAdminClient } = await import("@/lib/supabase/admin")
  const admin = createAdminClient()

  const driverId = await ensureDriverIdForUser(admin, ctx.companyId, ctx.userId)
  if (!driverId) {
    return { error: "No driver profile for this account.", data: null }
  }

  const truckId = await resolveTruckIdForDriver(admin, ctx.companyId, driverId)
  if (!truckId) {
    return {
      error:
        "No vehicle linked to you yet. Set truck on the driver profile, assign this driver on the truck record, or put driver and truck on an active load.",
      data: null,
    }
  }
  const device_serial_number = `web-${ctx.userId}`
  const device_name = (formData.device_name || "").trim() || "Web dashboard ELD"
  const now = new Date().toISOString()

  const deviceData = {
    company_id: ctx.companyId,
    device_name,
    device_serial_number,
    provider: "truckmates_mobile",
    provider_device_id: device_serial_number,
    truck_id: truckId,
    status: "active",
    firmware_version: "web",
    installation_date: now.split("T")[0],
    notes: JSON.stringify({ source: "web_driver_eld" }),
    last_sync_at: now,
    api_key: null as string | null,
    api_secret: null as string | null,
  }

  const { data: existingDevice } = await admin
    .from("eld_devices")
    .select("id, company_id")
    .eq("device_serial_number", device_serial_number)
    .maybeSingle()

  if (existingDevice && existingDevice.company_id !== ctx.companyId) {
    return { error: "This device id is already registered to another company.", data: null }
  }

  let device: { id: string } | null = null
  let err: { message: string } | null = null

  if (existingDevice?.id && existingDevice.company_id === ctx.companyId) {
    const result = await admin
      .from("eld_devices")
      .update(deviceData)
      .eq("id", existingDevice.id)
      .eq("company_id", ctx.companyId)
      .select("id")
      .single()
    device = result.data
    err = result.error
  } else {
    const result = await admin.from("eld_devices").insert(deviceData).select("id").single()
    device = result.data
    err = result.error
  }

  if (err || !device?.id) {
    return { error: err?.message || "Could not save ELD device", data: null }
  }

  revalidatePath("/dashboard/eld")
  revalidatePath("/dashboard")
  return { error: null, data: { device_id: String(device.id) } }
}
