"use server"

import { revalidatePath } from "next/cache"
import { getCachedAuthContext } from "@/lib/auth/server"
import { ensureDriverIdForUser } from "@/lib/eld/ensure-driver"
import { resolveTruckIdForDriver } from "@/lib/eld/resolve-driver-truck"
import {
  DRIVER_DUTY_LOG_TYPES,
  type DriverDutyLogType,
} from "@/lib/eld/driver-duty-constants"
import { mapLegacyRole } from "@/lib/roles"
import { calendarDateYmdLocal } from "@/lib/eld/hos-calendar-date"
import { ensureWebEldDeviceForTruck } from "@/lib/eld/ensure-web-eld-device"

/**
 * Records a duty change for the logged-in driver: closes any open segment for today,
 * then opens a new one with the selected status. Uses service role so RLS does not block
 * updates to `eld_logs` (drivers often have insert-only policies).
 */
export async function changeDriverDutyStatus(logType: DriverDutyLogType): Promise<{
  error: string | null
  data: { id?: string; unchanged?: boolean } | null
}> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId || !ctx.user) {
    return { error: ctx.error || "Not authenticated", data: null }
  }
  if (mapLegacyRole(ctx.user.role) !== "driver") {
    return { error: "Only drivers can change duty from this screen.", data: null }
  }
  if (!DRIVER_DUTY_LOG_TYPES.includes(logType)) {
    return { error: "Invalid duty status.", data: null }
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
        "No vehicle linked to you yet. Set truck on the driver profile, assign this driver on the truck, or put driver and truck on an active load.",
      data: null,
    }
  }

  let deviceId: string | null = null
  const { data: existingDevice } = await admin
    .from("eld_devices")
    .select("id")
    .eq("company_id", ctx.companyId)
    .eq("truck_id", truckId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingDevice?.id) {
    deviceId = String(existingDevice.id)
  } else {
    const ensured = await ensureWebEldDeviceForTruck(
      admin,
      { companyId: ctx.companyId, userId: ctx.userId },
      truckId,
    )
    if (ensured.error || !ensured.deviceId) {
      return { error: ensured.error || "Could not register web ELD for this truck.", data: null }
    }
    deviceId = ensured.deviceId
  }

  const now = new Date()
  const logDate = calendarDateYmdLocal(now)
  const nowIso = now.toISOString()

  const { data: open } = await admin
    .from("eld_logs")
    .select("id, log_type, start_time")
    .eq("driver_id", driverId)
    .eq("company_id", ctx.companyId)
    .eq("log_date", logDate)
    .is("end_time", null)
    .order("start_time", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (open?.id) {
    if (open.log_type === logType) {
      return { error: null, data: { unchanged: true } }
    }
    const startMs = new Date(open.start_time).getTime()
    const dur = Math.max(1, Math.floor((now.getTime() - startMs) / 60000))
    const { error: upErr } = await admin
      .from("eld_logs")
      .update({ end_time: nowIso, duration_minutes: dur, updated_at: nowIso })
      .eq("id", open.id)
    if (upErr) {
      return { error: upErr.message, data: null }
    }
  }

  const { data: inserted, error: insErr } = await admin
    .from("eld_logs")
    .insert({
      company_id: ctx.companyId,
      eld_device_id: deviceId,
      driver_id: driverId,
      truck_id: truckId,
      log_date: logDate,
      log_type: logType,
      start_time: nowIso,
      end_time: null,
      duration_minutes: null,
      updated_at: nowIso,
    })
    .select("id")
    .single()

  if (insErr) {
    return { error: insErr.message, data: null }
  }

  revalidatePath("/dashboard/eld")
  revalidatePath("/dashboard")
  return { error: null, data: { id: inserted?.id ? String(inserted.id) : undefined } }
}
