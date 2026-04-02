import { NextRequest, NextResponse } from "next/server"
import { getMobileAuthContext } from "@/lib/auth/mobile"
import { createAdminClient } from "@/lib/supabase/admin"

type HosLog = {
  driver_id: string
  log_type: string
  log_date: string
  start_time: string
  end_time: string | null
  duration_minutes: number | null
  created_at: string
}

function computeHosFromLogs(logs: HosLog[]) {
  const ordered = [...logs].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  )

  let drivingMinutes = 0
  let onDutyMinutes = 0
  let offDutyMinutes = 0

  for (let i = 0; i < ordered.length; i += 1) {
    const log = ordered[i]
    const start = new Date(log.start_time).getTime()
    const explicitEnd = log.end_time ? new Date(log.end_time).getTime() : null
    const nextStart = ordered[i + 1]?.start_time ? new Date(ordered[i + 1].start_time).getTime() : null
    const inferredEnd = explicitEnd || nextStart || Date.now()
    let duration = log.duration_minutes || 0
    if (!duration && Number.isFinite(start) && Number.isFinite(inferredEnd) && inferredEnd > start) {
      duration = Math.floor((inferredEnd - start) / 60000)
    }
    if (log.log_type === "driving") {
      drivingMinutes += duration
      onDutyMinutes += duration
    } else if (log.log_type === "on_duty") {
      onDutyMinutes += duration
    } else if (log.log_type === "off_duty" || log.log_type === "sleeper_berth") {
      offDutyMinutes += duration
    }
  }

  const drivingHours = drivingMinutes / 60
  const onDutyHours = onDutyMinutes / 60
  const remainingDriving = Math.max(0, 11 - drivingHours)
  const remainingOnDuty = Math.max(0, 14 - onDutyHours)
  const needsBreak = drivingHours >= 8 && offDutyMinutes < 30

  return {
    remaining_drive_hours: Number(remainingDriving.toFixed(2)),
    remaining_on_duty_hours: Number(remainingOnDuty.toFixed(2)),
    needs_break: needsBreak,
    can_drive: remainingDriving > 0 && remainingOnDuty > 0 && !needsBreak,
    violations: [] as string[],
  }
}

export async function GET(request: NextRequest) {
  const ctx = await getMobileAuthContext(request)
  if (ctx.error || !ctx.companyId) {
    return NextResponse.json({ error: ctx.error || "Not authenticated" }, { status: 401 })
  }

  try {
    const admin = createAdminClient()
    const { data: drivers, error: driversError } = await admin
      .from("drivers")
      .select("id, user_id, name, truck_id, status")
      .eq("company_id", ctx.companyId)
      .eq("status", "active")

    if (driversError) {
      return NextResponse.json({ error: driversError.message }, { status: 500 })
    }
    if (!drivers || drivers.length === 0) {
      return NextResponse.json({ data: [] })
    }

    const truckIds = drivers
      .map((d: { truck_id: string | null }) => d.truck_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
    const trucksMap = new Map<string, string>()
    if (truckIds.length > 0) {
      const { data: trucks } = await admin
        .from("trucks")
        .select("id, truck_number")
        .in("id", truckIds)
      ;(trucks || []).forEach((t: { id: string; truck_number: string | null }) => {
        trucksMap.set(t.id, t.truck_number || "")
      })
    }

    const today = new Date().toISOString().split("T")[0]
    const ids = Array.from(
      new Set(
        drivers.flatMap((d: { id: string; user_id?: string | null }) =>
          [d.id, d.user_id].filter((v): v is string => typeof v === "string" && v.length > 0)
        )
      )
    )

    const { data: logs } = await admin
      .from("eld_logs")
      .select("driver_id, log_type, log_date, start_time, end_time, duration_minutes, created_at")
      .in("driver_id", ids)
      .eq("log_date", today)
      .order("start_time", { ascending: false })

    const byDriverId = new Map<string, HosLog[]>()
    ;(logs || []).forEach((log: HosLog) => {
      const arr = byDriverId.get(log.driver_id) || []
      arr.push(log)
      byDriverId.set(log.driver_id, arr)
    })

    const data = drivers.map((d: { id: string; user_id?: string | null; name: string; truck_id: string | null }) => {
      const merged = [
        ...(byDriverId.get(d.id) || []),
        ...(d.user_id ? byDriverId.get(d.user_id) || [] : []),
      ].sort((a, b) => {
        const byStart = new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
        if (byStart !== 0) return byStart
        return new Date(b.created_at || b.start_time).getTime() - new Date(a.created_at || a.start_time).getTime()
      })

      const latestOpen = merged.find((l) => l.end_time === null)
      const current = latestOpen || merged[0]
      const hos = computeHosFromLogs(merged)

      return {
        driver_id: d.id,
        driver_name: d.name,
        truck_id: d.truck_id,
        truck_number: d.truck_id ? trucksMap.get(d.truck_id) || null : null,
        current_status: current?.log_type || "off_duty",
        remaining_drive_hours: hos.remaining_drive_hours,
        remaining_on_duty_hours: hos.remaining_on_duty_hours,
        weekly_on_duty_hours: 0,
        remaining_weekly_hours: 70,
        needs_break: hos.needs_break,
        violations: hos.violations,
        can_drive: hos.can_drive,
        last_update: new Date().toISOString(),
      }
    })

    return NextResponse.json({ data })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load HOS" }, { status: 500 })
  }
}
