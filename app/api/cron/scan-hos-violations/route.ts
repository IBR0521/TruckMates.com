import { NextResponse } from "next/server"
import { errorMessage } from "@/lib/error-message"
import { createAdminClient } from "@/lib/supabase/admin"
import { fetchAllRowsByIdCursor } from "@/lib/supabase/fetch-all-by-id-cursor"
import { runAgentEvaluation } from "@/lib/ai/agent/loop"

type EldHosClockRow = {
  id: string
  company_id: string
  driver_id: string
  remaining_drive_ms: number | null
  remaining_shift_ms: number | null
  raw_data: unknown
  updated_at: string
}

type EldLogDutyRow = {
  driver_id: string
  log_type: string
  start_time: string
  end_time: string | null
}

type AiLogRow = { action_payload: Record<string, unknown> | null }

type Severity = "critical" | "high" | "medium"

const MS_PER_HOUR = 1000 * 60 * 60
const LOOKBACK_ISO_MINUTES = 30

function hoursFromMs(ms: number | null | undefined): number | null {
  if (ms === null || ms === undefined || !Number.isFinite(Number(ms))) return null
  return Number(ms) / MS_PER_HOUR
}

/** Provider-specific duty hints on synced clock payloads (no recomputation — read-only). */
function dutyStatusHintFromClockRaw(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const nestedDriver =
    typeof o.driver === "object" && o.driver !== null ? (o.driver as Record<string, unknown>) : null
  const v =
    o.duty_status ??
    o.dutyStatus ??
    o.currentDutyStatus ??
    nestedDriver?.duty_status ??
    nestedDriver?.dutyStatus ??
    o.status ??
    o.log_type ??
    null
  if (v === null || v === undefined) return null
  return String(v).trim().toLowerCase().replace(/\s+/g, "_")
}

function classifyDriveRemainingHours(h: number | null): Severity | null {
  if (h === null || !Number.isFinite(h)) return null
  if (h < 0.5) return "critical"
  if (h < 1) return "high"
  if (h < 2) return "medium"
  return null
}

function severityRank(s: Severity): number {
  if (s === "critical") return 3
  if (s === "high") return 2
  return 1
}

function canonicalDutyFromLog(log: EldLogDutyRow): string {
  return String(log.log_type || "").trim().toLowerCase().replace(/\s+/g, "_") || "off_duty"
}

/** Latest open log wins; otherwise most recent row by start_time. */
function buildLatestDutyMap(logs: EldLogDutyRow[], driverIds: string[]): Map<string, string> {
  const idSet = new Set(driverIds)
  const byDriver = new Map<string, EldLogDutyRow[]>()
  for (const log of logs) {
    const id = log.driver_id
    if (!id || !idSet.has(id)) continue
    const list = byDriver.get(id) || []
    list.push(log)
    byDriver.set(id, list)
  }
  const out = new Map<string, string>()
  for (const id of driverIds) {
    const list = byDriver.get(id) || []
    if (list.length === 0) {
      out.set(id, "off_duty")
      continue
    }
    const sorted = [...list].sort(
      (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime(),
    )
    const open = sorted.find((l) => l.end_time === null || String(l.end_time).trim() === "")
    const pick = open || sorted[0]
    out.set(id, canonicalDutyFromLog(pick))
  }
  return out
}

function resolveDutyForDriver(driverId: string, clockRawHint: string | null, latestLogDuty: Map<string, string>): string {
  const fromLog = latestLogDuty.get(driverId) || "off_duty"
  const h = (clockRawHint || "").trim().replace(/-/g, "_")
  if (h === "driving" || (h.includes("driv") && !h.includes("off"))) return "driving"
  if (h === "on_duty" || h === "onduty") return "on_duty"
  return fromLog
}

function extractRecentHosDedupeKeys(rows: AiLogRow[] | null): Set<string> {
  const skip = new Set<string>()
  for (const row of rows || []) {
    const payload = row.action_payload || {}
    const triggerData = payload.triggerData
    let driverId = ""
    let severity = ""
    if (triggerData && typeof triggerData === "object") {
      const td = triggerData as Record<string, unknown>
      driverId = String(td.driverId || td.driver_id || "")
      severity = String(td.severity || "").toLowerCase()
    }
    if (!driverId) {
      const apAction = payload.action as Record<string, unknown> | undefined
      const sub = apAction?.payload as Record<string, unknown> | undefined
      driverId = String(
        sub?.driverId ||
          sub?.driver_id ||
          payload.driverId ||
          payload.driver_id ||
          "",
      )
      severity = String(sub?.severity || payload.severity || "").toLowerCase()
    }
    if (driverId && severity && (severity === "critical" || severity === "high" || severity === "medium")) {
      skip.add(`${driverId}:${severity}`)
    }
  }
  return skip
}

function formatLocation(
  addr: string | null | undefined,
  lat: number | null | undefined,
  lng: number | null | undefined,
): string | null {
  const a = String(addr || "").trim()
  if (a) return a
  if (
    lat !== null &&
    lat !== undefined &&
    lng !== null &&
    lng !== undefined &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  ) {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  }
  return null
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error("[Cron scan-hos] CRON_SECRET not configured - endpoint disabled")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const sinceIso = new Date(Date.now() - LOOKBACK_ISO_MINUTES * 60 * 1000).toISOString()

  try {
    const admin = createAdminClient()
    const { data: companyRows } = await admin.from("companies").select("id").limit(2000)
    const companies = (companyRows || []) as { id: string }[]

    let scanned = 0
    let alerted = 0

    for (const { id: companyRaw } of companies) {
      const companyId = String(companyRaw || "").trim()
      if (!companyId) continue

      const { rows: clockRows, error: clockErr } = await fetchAllRowsByIdCursor<EldHosClockRow>(
        async ({ lastId, pageSize }) => {
          let q = admin
            .from("eld_hos_clocks")
            .select(
              "id, company_id, driver_id, remaining_drive_ms, remaining_shift_ms, raw_data, updated_at",
            )
            .eq("company_id", companyId)
            .order("id", { ascending: true })
            .limit(pageSize)
          if (lastId) q = q.gt("id", lastId)
          return await q
        },
        { warnLabel: `cron.scan_hos_clocks.${companyId}`, maxRows: 5000 },
      )

      if (clockErr || clockRows.length === 0) {
        continue
      }

      /** Best clock row per driver (newest updated_at). */
      const clocksByDriver = new Map<string, EldHosClockRow>()
      for (const row of clockRows) {
        const did = row.driver_id
        if (!did) continue
        const prev = clocksByDriver.get(did)
        if (
          !prev ||
          new Date(row.updated_at).getTime() > new Date(prev.updated_at).getTime()
        ) {
          clocksByDriver.set(did, row)
        }
      }

      const warningCandidates: Array<{
        driverId: string
        severity: Severity
        driveHr: number
        onDutyHr: number | null
        clockRow: EldHosClockRow
      }> = []

      for (const clock of clocksByDriver.values()) {
        const driveHr = hoursFromMs(clock.remaining_drive_ms ?? null)
        const sev = classifyDriveRemainingHours(driveHr)
        if (!sev) continue
        const onDutyHr = hoursFromMs(clock.remaining_shift_ms ?? null)
        warningCandidates.push({
          driverId: clock.driver_id,
          severity: sev,
          driveHr: driveHr!,
          onDutyHr,
          clockRow: clock,
        })
      }

      if (warningCandidates.length === 0) continue

      warningCandidates.sort(
        (a, b) =>
          severityRank(b.severity) - severityRank(a.severity) || a.driverId.localeCompare(b.driverId),
      )
      /** One severity bucket per driver: keep strongest only. */
      const perDriverFinal = new Map<string, (typeof warningCandidates)[0]>()
      for (const c of warningCandidates) {
        const prev = perDriverFinal.get(c.driverId)
        if (!prev || severityRank(c.severity) > severityRank(prev.severity)) {
          perDriverFinal.set(c.driverId, c)
        }
      }
      const finalists = [...perDriverFinal.values()]

      const driverIds = finalists.map((f) => f.driverId)

      const { data: logRowsRaw } = await admin
        .from("eld_logs")
        .select("driver_id, log_type, start_time, end_time")
        .eq("company_id", companyId)
        .in("driver_id", driverIds)
        .order("start_time", { ascending: false })
        .limit(Math.min(4000, Math.max(driverIds.length * 80, 200)))

      const latestDutyMap = buildLatestDutyMap(
        (logRowsRaw || []) as EldLogDutyRow[],
        driverIds,
      )

      const { data: recentLogsDup } = await admin
        .from("ai_automation_logs")
        .select("action_payload")
        .eq("company_id", companyId)
        .eq("automation_type", "hos_violation_prevention")
        .gte("created_at", sinceIso)
        .limit(800)

      const dedupeRecent = extractRecentHosDedupeKeys((recentLogsDup || []) as AiLogRow[])

      /** Latest locations via DB helper (SECURITY INVOKER — service_role can execute). */
      let locRows: {
        driver_id: string
        address: string | null
        latitude: number | null
        longitude: number | null
      }[] = []

      try {
        const rpc = await admin.rpc("get_latest_eld_locations_for_drivers", {
          p_company_id: companyId,
          p_driver_ids: driverIds,
        })
        if (!rpc.error && Array.isArray(rpc.data)) {
          locRows = rpc.data as typeof locRows
        }
      } catch {
        // ignore RPC missing in older deployments
      }
      const locationByDriver = new Map<
        string,
        { address: string | null; latitude: number | null; longitude: number | null }
      >()
      for (const r of locRows) {
        locationByDriver.set(String(r.driver_id), {
          address: r.address ?? null,
          latitude: r.latitude ?? null,
          longitude: r.longitude ?? null,
        })
      }

      const { data: activeLoadsRaw } = await admin
        .from("loads")
        .select("id, destination, shipment_number, driver_id, updated_at")
        .eq("company_id", companyId)
        .in("driver_id", driverIds)
        .in("status", ["pending", "scheduled", "confirmed", "in_transit"])
        .order("updated_at", { ascending: false })
        .limit(Math.max(driverIds.length * 3, 120))

      const loadByDriver = new Map<string, { id: string; destination: string | null; shipment_number: string | null }>()
      for (const lr of activeLoadsRaw || []) {
        const row = lr as {
          id: string
          driver_id: string | null
          destination: string | null
          shipment_number: string | null
        }
        if (!row.driver_id) continue
        if (!loadByDriver.has(row.driver_id)) {
          loadByDriver.set(row.driver_id, {
            id: row.id,
            destination: row.destination,
            shipment_number: row.shipment_number,
          })
        }
      }

      const { data: driversMeta } = await admin
        .from("drivers")
        .select("id, name")
        .eq("company_id", companyId)
        .in("id", driverIds)

      const nameByDriver = new Map<string, string>()
      for (const dm of driversMeta || []) {
        const drow = dm as { id: string; name?: string | null }
        nameByDriver.set(String(drow.id), String(drow.name || "").trim() || "Driver")
      }

      for (const cand of finalists) {
        const hint = dutyStatusHintFromClockRaw(cand.clockRow.raw_data)
        const duty = resolveDutyForDriver(cand.driverId, hint, latestDutyMap)

        if (duty !== "driving" && duty !== "on_duty") {
          continue
        }

        scanned += 1
        const dedupeKey = `${cand.driverId}:${cand.severity}`
        if (dedupeRecent.has(dedupeKey)) {
          continue
        }

        const loc = locationByDriver.get(cand.driverId)
        const ld = loadByDriver.get(cand.driverId)
        const currentLocation =
          formatLocation(loc?.address ?? null, loc?.latitude ?? null, loc?.longitude ?? null)

        alerted += 1
        dedupeRecent.add(dedupeKey)

        void runAgentEvaluation({
          companyId,
          trigger: "hos_violation_prevention",
          triggerData: {
            driverId: cand.driverId,
            driverName: nameByDriver.get(cand.driverId) || "Driver",
            currentLocation,
            remainingDriveHours: Number(cand.driveHr.toFixed(3)),
            remainingOnDutyHours: cand.onDutyHr !== null ? Number(cand.onDutyHr.toFixed(3)) : null,
            severity: cand.severity,
            currentLoadId: ld?.id || null,
            currentLoadDestination: ld?.destination || null,
            shipmentNumber: ld?.shipment_number || null,
          },
          contextTypes: ["driver", "load"],
        }).catch((err: unknown) => console.error("[scan-hos runAgentEvaluation]", companyId, err))
      }
    }

    return NextResponse.json({
      success: true,
      scanned,
      alerted,
    })
  } catch (error: unknown) {
    console.error("[scan-hos] cron failed:", error)
    return NextResponse.json(
      { success: false, error: errorMessage(error, "HOS violation scan failed") },
      { status: 500 },
    )
  }
}
