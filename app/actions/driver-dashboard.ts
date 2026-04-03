"use server"

import * as Sentry from "@sentry/nextjs"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { errorMessage } from "@/lib/error-message"
import { mapLegacyRole } from "@/lib/roles"
import { ensureDriverIdForUser } from "@/lib/eld/ensure-driver"
import { calendarDateYmdLocal } from "@/lib/eld/hos-calendar-date"
import { calculateRemainingHOS } from "@/app/actions/eld-advanced"
import type { EldLogLike } from "@/lib/hos/compute-daily-remaining"
import type {
  DriverDashboardSnapshot,
  DriverHosSeverity,
} from "@/lib/types/driver-dashboard"

const ELD_LOGS_MINIMAL = "id, log_type, start_time, end_time, duration_minutes, log_date"

const ACTIVE_LOAD_STATUSES = ["draft", "pending", "scheduled", "in_transit"] as const

function hoursFromMinutes(totalMinutes: number): number {
  return Math.round((totalMinutes / 60) * 100) / 100
}

function sumOnDutyMinutesFromLogs(logs: EldLogLike[]): number {
  let minutes = 0
  const sorted = [...logs].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  )
  sorted.forEach((log, idx) => {
    let dur = log.duration_minutes || 0
    if (!dur && log.start_time) {
      const start = new Date(log.start_time).getTime()
      const nextStart = sorted[idx + 1]?.start_time
        ? new Date(sorted[idx + 1].start_time).getTime()
        : null
      const explicitEnd = log.end_time ? new Date(log.end_time).getTime() : null
      const inferredEnd = explicitEnd || nextStart || Date.now()
      if (Number.isFinite(start) && Number.isFinite(inferredEnd) && inferredEnd > start) {
        dur = Math.floor((inferredEnd - start) / 60000)
      }
    }
    if (log.log_type === "driving" || log.log_type === "on_duty") {
      minutes += dur
    }
  })
  return minutes
}

function hosSeverity(args: {
  violations: string[]
  remainingDrive: number
  remainingShift: number
}): DriverHosSeverity {
  if (args.violations.length > 0) return "violation"
  if (args.remainingDrive < 2 || args.remainingShift < 2) return "warning"
  return "ok"
}

/**
 * Compliance + load snapshot for the driver role.
 * Ensures a `public.drivers` row exists for this user (same as mobile ELD / getDrivers reconcile):
 * links orphan rows by email or inserts — RLS often blocks drivers from inserting themselves, so we use the admin client.
 */
export async function getDriverDashboardSnapshot(): Promise<{
  data: DriverDashboardSnapshot | null
  error: string | null
}> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId || !ctx.user) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }

  const mapped = mapLegacyRole(ctx.user.role)
  if (mapped !== "driver") {
    return { data: null, error: null }
  }

  try {
  const supabase = await createClient()

  let driverId: string | null = null
  let provisionNote: string | null = null

  try {
    const { createAdminClient } = await import("@/lib/supabase/admin")
    driverId = await ensureDriverIdForUser(
      createAdminClient(),
      ctx.companyId,
      ctx.userId
    )
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (
      msg.includes("SUPABASE_SERVICE_ROLE_KEY") ||
      msg.includes("service role") ||
      msg.includes("not configured")
    ) {
      provisionNote =
        "Automatic driver setup requires the server secret SUPABASE_SERVICE_ROLE_KEY. Add it to your deployment (Vercel/host env), then refresh — or ask your fleet admin to create a driver record for you with the same email as this login."
    } else {
      provisionNote = `Could not create or link a driver profile: ${msg}`
    }
    const { data: row } = await supabase
      .from("drivers")
      .select("id")
      .eq("company_id", ctx.companyId)
      .eq("user_id", ctx.userId)
      .maybeSingle()
    if (row?.id) {
      driverId = String(row.id)
      provisionNote = null
    }
  }

  let driverTruckId: string | null = null
  if (driverId) {
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin")
      const { resolveTruckIdForDriver } = await import("@/lib/eld/resolve-driver-truck")
      driverTruckId = await resolveTruckIdForDriver(createAdminClient(), ctx.companyId, driverId)
    } catch {
      driverTruckId = null
    }
  }

  const today = calendarDateYmdLocal(new Date())

  const emptyDvir = {
    preTripCompletedToday: false,
    postTripCompletedToday: false,
    postTripPrompt: false,
  }

  if (!driverId) {
    return {
      data: {
        driverId: null,
        driverProvisionNote:
          provisionNote ||
          "Ask your fleet to add you as a driver (same email) or set role to Driver. Self-host: set SUPABASE_SERVICE_ROLE_KEY.",
        hos: null,
        activeLoad: null,
        dvir: emptyDvir,
        violations24h: { count: 0, items: [] },
      },
      error: null,
    }
  }

  const eldEventsListQuery = (() => {
    const base = supabase
      .from("eld_events")
      .select("title, event_time, severity, event_type, resolved")
      .eq("company_id", ctx.companyId)
      .eq("event_type", "hos_violation")
      .eq("resolved", false)
      .gte("event_time", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order("event_time", { ascending: false })
      .limit(25)
    if (driverTruckId) {
      return base.or(`driver_id.eq.${driverId},truck_id.eq.${driverTruckId}`)
    }
    return base.eq("driver_id", driverId)
  })()

  const [
    hosResult,
    latestLogResult,
    weekLogsResult,
    loadResult,
    preTripResult,
    postTripResult,
    eventsResult,
  ] = await Promise.all([
    calculateRemainingHOS(driverId, today),
    supabase
      .from("eld_logs")
      .select("log_type, start_time, end_time")
      .eq("driver_id", driverId)
      .eq("company_id", ctx.companyId)
      .order("start_time", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("eld_logs")
      .select(ELD_LOGS_MINIMAL)
      .eq("driver_id", driverId)
      .eq("company_id", ctx.companyId)
      .gte("log_date", new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
      .limit(2000),
    supabase
      .from("loads")
      .select(
        "id, shipment_number, origin, destination, status, load_date, estimated_delivery, pickup_time, delivery_time, special_instructions"
      )
      .eq("company_id", ctx.companyId)
      .eq("driver_id", driverId)
      .in("status", [...ACTIVE_LOAD_STATUSES])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("dvir")
      .select("id")
      .eq("company_id", ctx.companyId)
      .eq("driver_id", driverId)
      .eq("inspection_type", "pre_trip")
      .eq("inspection_date", today)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("dvir")
      .select("id")
      .eq("company_id", ctx.companyId)
      .eq("driver_id", driverId)
      .eq("inspection_type", "post_trip")
      .eq("inspection_date", today)
      .limit(1)
      .maybeSingle(),
    eldEventsListQuery,
  ])

  const hosData = hosResult.data
  const mergedViolations = [...(hosData?.violations || [])]
  const weekLogs = (weekLogsResult.data || []) as EldLogLike[]
  const weeklyOnDutyHours = hoursFromMinutes(sumOnDutyMinutesFromLogs(weekLogs))
  const remainingCycleHours = Math.max(0, Math.round((70 - weeklyOnDutyHours) * 100) / 100)

  const currentDutyStatus =
    (latestLogResult.data as { log_type?: string } | null)?.log_type || "off_duty"

  let hosBlock: DriverDashboardSnapshot["hos"] = null
  if (hosData) {
    const severity = hosSeverity({
      violations: mergedViolations,
      remainingDrive: hosData.remainingDriving,
      remainingShift: hosData.remainingOnDuty,
    })
    hosBlock = {
      currentDutyStatus,
      remainingDriveHours: hosData.remainingDriving,
      remainingShiftHours: hosData.remainingOnDuty,
      remainingCycleHours,
      needsBreak: hosData.needsBreak,
      canDrive: hosData.canDrive,
      violations: mergedViolations,
      severity,
    }
  }

  const activeLoad = loadResult.data
    ? {
        id: String(loadResult.data.id),
        shipment_number: loadResult.data.shipment_number ?? null,
        origin: loadResult.data.origin ?? null,
        destination: loadResult.data.destination ?? null,
        status: loadResult.data.status ?? null,
        load_date: loadResult.data.load_date ?? null,
        estimated_delivery: loadResult.data.estimated_delivery ?? null,
        pickup_time: loadResult.data.pickup_time ?? null,
        delivery_time: loadResult.data.delivery_time ?? null,
        special_instructions: loadResult.data.special_instructions ?? null,
      }
    : null

  const preTripCompletedToday = !!preTripResult.data
  const postTripCompletedToday = !!postTripResult.data
  const postTripPrompt =
    preTripCompletedToday &&
    !postTripCompletedToday &&
    (currentDutyStatus === "off_duty" || currentDutyStatus === "sleeper_berth")

  const hosViolationRows = (eventsResult.data || []) as {
    title: string
    event_time: string
    severity: string | null
  }[]
  const fromEvents = hosViolationRows.map((e) => ({
    title: e.title,
    event_time: e.event_time,
    severity: e.severity,
  }))
  const fromDailyHos = mergedViolations.map((msg) => ({
    title: msg,
    event_time: new Date().toISOString(),
    severity: "warning" as string | null,
  }))
  const violations24h = {
    count: fromDailyHos.length + fromEvents.length,
    items: [...fromDailyHos, ...fromEvents],
  }

  if (hosBlock && hosViolationRows.length > 0) {
    hosBlock = { ...hosBlock, severity: "violation" }
  }

  return {
    data: {
      driverId,
      driverProvisionNote: null,
      hos: hosBlock,
      activeLoad,
      dvir: {
        preTripCompletedToday,
        postTripCompletedToday,
        postTripPrompt,
      },
      violations24h,
    },
    error: null,
  }
  } catch (e: unknown) {
    Sentry.captureException(e)
    return {
      data: {
        driverId: null,
        driverProvisionNote: `Load failed: ${errorMessage(e)}. Refresh. Check SUPABASE_SERVICE_ROLE_KEY or contact support.`,
        hos: null,
        activeLoad: null,
        dvir: {
          preTripCompletedToday: false,
          postTripCompletedToday: false,
          postTripPrompt: false,
        },
        violations24h: { count: 0, items: [] },
      },
      error: null,
    }
  }
}
