"use server"

import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { getCachedAuthContext } from "@/lib/auth/server"
import { ensureDriverIdForUser } from "@/lib/eld/ensure-driver"
import { resolveTruckIdForDriver } from "@/lib/eld/resolve-driver-truck"
import { ensureWebEldDeviceForTruck } from "@/lib/eld/ensure-web-eld-device"
import { mapLegacyRole } from "@/lib/roles"

/**
 * Same DB path as "Register browser ELD", shared with `changeDriverDutyStatus` so the first
 * duty change auto-provisions `truckmates_mobile` when no active device exists on the truck.
 *
 * Pass `reuse` when caller already resolved admin client + truck (avoids duplicate lookups).
 */
export async function ensureWebEldRowForCurrentDriver(
  deviceName: string = "Web dashboard ELD",
  reuse?: { admin: SupabaseClient; truckId: string },
): Promise<{ error: string | null; deviceId: string | null }> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId || !ctx.user) {
    return { error: ctx.error || "Not authenticated", deviceId: null }
  }
  if (mapLegacyRole(ctx.user.role) !== "driver") {
    return { error: "Only drivers can register a mobile ELD from this screen.", deviceId: null }
  }

  const name = (deviceName || "").trim() || "Web dashboard ELD"

  if (reuse) {
    const ensured = await ensureWebEldDeviceForTruck(
      reuse.admin,
      { companyId: ctx.companyId, userId: ctx.userId },
      reuse.truckId,
      name,
    )
    if (ensured.error || !ensured.deviceId) {
      return { error: ensured.error || "Could not save ELD device", deviceId: null }
    }
    return { error: null, deviceId: ensured.deviceId }
  }

  const { createAdminClient } = await import("@/lib/supabase/admin")
  const admin = createAdminClient()

  const driverId = await ensureDriverIdForUser(admin, ctx.companyId, ctx.userId)
  if (!driverId) {
    return { error: "No driver profile for this account.", deviceId: null }
  }

  const truckId = await resolveTruckIdForDriver(admin, ctx.companyId, driverId)
  if (!truckId) {
    return {
      error:
        "No vehicle linked to you yet. Set truck on the driver profile, assign this driver on the truck record, or put driver and truck on an active load.",
      deviceId: null,
    }
  }

  const ensured = await ensureWebEldDeviceForTruck(
    admin,
    { companyId: ctx.companyId, userId: ctx.userId },
    truckId,
    name,
  )
  if (ensured.error || !ensured.deviceId) {
    return { error: ensured.error || "Could not save ELD device", deviceId: null }
  }
  return { error: null, deviceId: ensured.deviceId }
}

/**
 * Register a mobile/web ELD row (`provider: truckmates_mobile` in DB for RLS compatibility) for the
 * logged-in driver — same rules as POST /api/eld/mobile/register, but uses the browser session.
 * Integrated hardware (Samsara, Geotab, etc.) is added by fleet staff, not here.
 */
export async function registerWebEldDevice(formData: { device_name: string }) {
  const ensured = await ensureWebEldRowForCurrentDriver(formData.device_name)
  if (ensured.error || !ensured.deviceId) {
    return { error: ensured.error || "Could not save ELD device", data: null }
  }

  revalidatePath("/dashboard/eld")
  revalidatePath("/dashboard")
  return { error: null, data: { device_id: ensured.deviceId } }
}
