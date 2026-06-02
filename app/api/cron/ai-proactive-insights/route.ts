import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/admin"
import { databaseErrorMessage, errorMessage } from "@/lib/error-message"
import { normalizePlanTier, tierAtLeast } from "@/lib/plan-limits"
import { logAutomationEvent } from "@/lib/ai/agent/settings"
import { insertProactiveIfNew } from "@/lib/ai/notifications/process-company-smart"
import type { ProactiveAlert } from "@/lib/ai/notifications/proactive"

/** Long-running batch (per-company scans across several data domains). */
export const maxDuration = 300

type CompanyRow = { id: string; subscription_tier: string | null }

/**
 * Minimum model/heuristic confidence (0-100) before a finding is surfaced — mirrors the agent
 * confidence-gate pattern in lib/ai/agent (DEFAULT_AUTOMATION_CONFIGS thresholds). Below this we
 * stay silent rather than create low-signal noise. Findings are notify-only; no autonomous action.
 */
const PROACTIVE_INSIGHT_CONFIDENCE_THRESHOLD = 70

/** Cap surfaced findings per detector per company so a single run can't flood the inbox. */
const MAX_FINDINGS_PER_DETECTOR = 5

const LANE_LOOKBACK_DAYS = 90
const FAULT_WINDOW_DAYS = 7

type Finding = {
  automationType: string
  confidence: number
  reasoning: string
  alert: ProactiveAlert
}

type AdminClient = ReturnType<typeof createAdminClient>

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(95, Math.max(0, Math.round(value)))
}

function normalizeLocationToken(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

function moneyText(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`
}

/** Stable, filesystem-safe key fragment for dedup alert keys. */
function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60)
}

// ---------------------------------------------------------------------------
// 1. Lanes losing money repeatedly
// ---------------------------------------------------------------------------
async function detectLaneLosses(admin: AdminClient, companyId: string): Promise<Finding[]> {
  const sinceIso = new Date(Date.now() - LANE_LOOKBACK_DAYS * 86400000).toISOString()

  const { data: loadsRaw } = await admin
    .from("loads")
    .select("id, origin, destination, total_rate, rate, status")
    .eq("company_id", companyId)
    .in("status", ["delivered", "completed"])
    .gte("updated_at", sinceIso)
    .limit(500)

  const loads = (loadsRaw || []) as Array<{
    id: string
    origin?: string | null
    destination?: string | null
    total_rate?: number | null
    rate?: number | null
  }>
  if (loads.length === 0) return []

  const loadIds = loads.map((l) => l.id).slice(0, 500)
  const costByLoad = new Map<string, number>()
  for (let i = 0; i < loadIds.length; i += 200) {
    const batch = loadIds.slice(i, i + 200)
    const { data: expRaw } = await admin
      .from("expenses")
      .select("load_id, amount")
      .eq("company_id", companyId)
      .in("load_id", batch)
    for (const e of (expRaw || []) as Array<{ load_id?: string | null; amount?: number | null }>) {
      const id = String(e.load_id || "")
      if (!id) continue
      costByLoad.set(id, (costByLoad.get(id) || 0) + Number(e.amount || 0))
    }
  }

  type Lane = { origin: string; destination: string; loads: number; losing: number; revenue: number; cost: number }
  const lanes = new Map<string, Lane>()
  for (const load of loads) {
    const origin = normalizeLocationToken(load.origin)
    const destination = normalizeLocationToken(load.destination)
    if (!origin || !destination) continue
    const revenue = Number(load.total_rate ?? load.rate ?? 0)
    const cost = costByLoad.get(load.id) || 0
    if (revenue <= 0 && cost <= 0) continue

    const key = `${origin}__${destination}`
    const lane = lanes.get(key) || { origin, destination, loads: 0, losing: 0, revenue: 0, cost: 0 }
    lane.loads += 1
    lane.revenue += revenue
    lane.cost += cost
    if (cost > 0 && revenue - cost < 0) lane.losing += 1
    lanes.set(key, lane)
  }

  const findings: Finding[] = []
  for (const lane of lanes.values()) {
    const netMargin = lane.revenue - lane.cost
    // Only repeated losses count: >=3 runs, >=2 of them unprofitable, net negative.
    if (lane.loads < 3 || lane.losing < 2 || netMargin >= 0) continue

    const laneLabel = `${lane.origin} → ${lane.destination}`.replace(/\b\w/g, (c) => c.toUpperCase())
    const confidence = clampConfidence(50 + lane.losing * 12 + (netMargin < -1000 ? 10 : 0))
    findings.push({
      automationType: "proactive_lane_loss",
      confidence,
      reasoning: `Lane ${laneLabel} lost money on ${lane.losing} of ${lane.loads} runs in the last ${LANE_LOOKBACK_DAYS} days (net ${moneyText(netMargin)}).`,
      alert: {
        alert_type: "lane_losing_money",
        alert_key: `lane_${slug(`${lane.origin}_${lane.destination}`)}`,
        priority: netMargin < -2000 ? "high" : "medium",
        title: "Lane repeatedly losing money",
        body: `${laneLabel} ran at a loss on ${lane.losing} of ${lane.loads} loads over the last ${LANE_LOOKBACK_DAYS} days — net ${moneyText(netMargin)}. Review pricing or costs on this lane.`,
        details: {
          lane: laneLabel,
          origin: lane.origin,
          destination: lane.destination,
          loads: lane.loads,
          losing_loads: lane.losing,
          revenue: Math.round(lane.revenue),
          cost: Math.round(lane.cost),
          net_margin: Math.round(netMargin),
        },
        affected_resource_type: "lane",
        affected_resource_id: null,
      },
    })
  }

  return findings
    .sort((a, b) => Number(a.alert.details.net_margin) - Number(b.alert.details.net_margin))
    .slice(0, MAX_FINDINGS_PER_DETECTOR)
}

// ---------------------------------------------------------------------------
// 2. Driver trending toward an HOS limit on an upcoming assignment
// ---------------------------------------------------------------------------
async function detectHosTrend(admin: AdminClient, companyId: string): Promise<Finding[]> {
  const { data: clockRaw } = await admin
    .from("eld_hos_clocks")
    .select("driver_id, remaining_drive_ms, updated_at")
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false })
    .limit(2000)

  const clocks = (clockRaw || []) as Array<{ driver_id?: string | null; remaining_drive_ms?: number | null }>
  if (clocks.length === 0) return []

  // Newest clock per driver (rows already DESC by updated_at).
  const driveHoursByDriver = new Map<string, number>()
  for (const c of clocks) {
    const id = String(c.driver_id || "")
    if (!id || driveHoursByDriver.has(id)) continue
    const ms = c.remaining_drive_ms
    if (ms === null || ms === undefined || !Number.isFinite(Number(ms))) continue
    driveHoursByDriver.set(id, Number(ms) / 3600000)
  }

  const lowDrivers = [...driveHoursByDriver.entries()].filter(([, h]) => h < 2)
  if (lowDrivers.length === 0) return []
  const driverIds = lowDrivers.map(([id]) => id)

  const { data: loadsRaw } = await admin
    .from("loads")
    .select("id, driver_id, destination, shipment_number, status")
    .eq("company_id", companyId)
    .in("driver_id", driverIds)
    .in("status", ["pending", "scheduled", "confirmed", "in_transit"])
    .order("updated_at", { ascending: false })
    .limit(Math.max(driverIds.length * 3, 60))

  const loadByDriver = new Map<string, { id: string; destination: string | null; shipment_number: string | null }>()
  for (const l of (loadsRaw || []) as Array<{
    id: string
    driver_id?: string | null
    destination?: string | null
    shipment_number?: string | null
  }>) {
    const id = String(l.driver_id || "")
    if (!id || loadByDriver.has(id)) continue
    loadByDriver.set(id, { id: l.id, destination: l.destination ?? null, shipment_number: l.shipment_number ?? null })
  }

  const { data: driversRaw } = await admin
    .from("drivers")
    .select("id, name")
    .eq("company_id", companyId)
    .in("id", driverIds)
  const nameByDriver = new Map<string, string>()
  for (const d of (driversRaw || []) as Array<{ id: string; name?: string | null }>) {
    nameByDriver.set(String(d.id), String(d.name || "").trim() || "Driver")
  }

  const findings: Finding[] = []
  for (const [driverId, hours] of lowDrivers) {
    const assignment = loadByDriver.get(driverId)
    // Only surface when there's an upcoming/active assignment the limit would affect.
    if (!assignment) continue

    const confidence = clampConfidence(hours < 0.5 ? 90 : hours < 1 ? 80 : 72)
    const priority: ProactiveAlert["priority"] = hours < 0.5 ? "critical" : hours < 1 ? "high" : "medium"
    const driverName = nameByDriver.get(driverId) || "Driver"
    const dest = assignment.destination ? ` to ${assignment.destination}` : ""
    const ship = assignment.shipment_number || assignment.id

    findings.push({
      automationType: "proactive_hos_trend",
      confidence,
      reasoning: `${driverName} has ${hours.toFixed(1)}h drive time left with active/upcoming load ${ship}.`,
      alert: {
        alert_type: "hos_limit_trending",
        alert_key: `hos_${driverId}`,
        priority,
        title: "Driver nearing HOS limit on an assignment",
        body: `${driverName} has only ${hours.toFixed(1)}h of drive time remaining and is assigned to load ${ship}${dest}. Plan a reset, relay, or reassignment before they run out.`,
        details: {
          driver_id: driverId,
          driver_name: driverName,
          remaining_drive_hours: Math.round(hours * 100) / 100,
          load_id: assignment.id,
          shipment_number: assignment.shipment_number,
        },
        affected_resource_type: "driver",
        affected_resource_id: driverId,
      },
    })
  }

  return findings
    .sort((a, b) => Number(a.alert.details.remaining_drive_hours) - Number(b.alert.details.remaining_drive_hours))
    .slice(0, MAX_FINDINGS_PER_DETECTOR)
}

// ---------------------------------------------------------------------------
// 3. Customers with worsening AR aging
// ---------------------------------------------------------------------------
async function detectArAging(admin: AdminClient, companyId: string): Promise<Finding[]> {
  const { data: invRaw } = await admin
    .from("invoices")
    .select("amount, status, due_date, customer_name")
    .eq("company_id", companyId)
    .limit(5000)

  const invoices = (invRaw || []) as Array<{
    amount?: number | null
    status?: string | null
    due_date?: string | null
    customer_name?: string | null
  }>
  if (invoices.length === 0) return []

  const paidStatuses = new Set(["paid", "cancelled", "void"])
  const now = Date.now()

  type Aging = { customer: string; current: number; days31: number; days61: number; days90: number }
  const byCustomer = new Map<string, Aging>()
  for (const inv of invoices) {
    const status = String(inv.status || "").toLowerCase()
    if (paidStatuses.has(status)) continue
    if (!inv.due_date) continue
    const amount = Number(inv.amount || 0)
    if (amount <= 0) continue

    const customer = String(inv.customer_name || "").trim() || "Unknown customer"
    const daysPastDue = Math.floor((now - new Date(inv.due_date).getTime()) / 86400000)
    const agg = byCustomer.get(customer) || { customer, current: 0, days31: 0, days61: 0, days90: 0 }
    if (daysPastDue <= 30) agg.current += amount
    else if (daysPastDue <= 60) agg.days31 += amount
    else if (daysPastDue <= 90) agg.days61 += amount
    else agg.days90 += amount
    byCustomer.set(customer, agg)
  }

  const findings: Finding[] = []
  for (const agg of byCustomer.values()) {
    const aged = agg.days61 + agg.days90
    // Worsening = balance has slipped into the 60+ buckets and is material.
    if (aged < 1000) continue

    const confidence = clampConfidence(60 + (agg.days90 > 0 ? 20 : 0) + (aged > 5000 ? 10 : 0))
    const priority: ProactiveAlert["priority"] = agg.days90 > 2500 ? "high" : "medium"
    findings.push({
      automationType: "proactive_ar_aging",
      confidence,
      reasoning: `${agg.customer} has ${moneyText(aged)} aged past 60 days (${moneyText(agg.days90)} past 90).`,
      alert: {
        alert_type: "ar_aging_worsening",
        alert_key: `ar_${slug(agg.customer)}`,
        priority,
        title: "Customer AR aging is worsening",
        body: `${agg.customer} now has ${moneyText(aged)} outstanding past 60 days (${moneyText(agg.days90)} past 90 days). Consider a collections call or credit review.`,
        details: {
          customer: agg.customer,
          aged_61_90: Math.round(agg.days61),
          aged_90_plus: Math.round(agg.days90),
          aged_total: Math.round(aged),
        },
        affected_resource_type: "customer",
        affected_resource_id: null,
      },
    })
  }

  return findings
    .sort((a, b) => Number(b.alert.details.aged_total) - Number(a.alert.details.aged_total))
    .slice(0, MAX_FINDINGS_PER_DETECTOR)
}

// ---------------------------------------------------------------------------
// 4. Trucks with rising fault-code frequency
// ---------------------------------------------------------------------------
async function detectFaultTrend(admin: AdminClient, companyId: string): Promise<Finding[]> {
  const windowStart = new Date(Date.now() - 2 * FAULT_WINDOW_DAYS * 86400000).toISOString()
  const recentCutoff = Date.now() - FAULT_WINDOW_DAYS * 86400000

  const { data: faultsRaw } = await admin
    .from("eld_fault_codes")
    .select("truck_id, severity, last_seen_at")
    .eq("company_id", companyId)
    .gte("last_seen_at", windowStart)
    .limit(5000)

  const faults = (faultsRaw || []) as Array<{
    truck_id?: string | null
    severity?: string | null
    last_seen_at?: string | null
  }>
  if (faults.length === 0) return []

  type TruckTrend = { truckId: string; recent: number; prior: number; severe: boolean }
  const byTruck = new Map<string, TruckTrend>()
  for (const f of faults) {
    const truckId = String(f.truck_id || "")
    if (!truckId || !f.last_seen_at) continue
    const ts = new Date(f.last_seen_at).getTime()
    const trend = byTruck.get(truckId) || { truckId, recent: 0, prior: 0, severe: false }
    if (ts >= recentCutoff) trend.recent += 1
    else trend.prior += 1
    const sev = String(f.severity || "").toLowerCase()
    if (sev === "critical" || sev === "high") trend.severe = true
    byTruck.set(truckId, trend)
  }

  const truckIds = [...byTruck.keys()]
  const { data: trucksRaw } = await admin
    .from("trucks")
    .select("id, truck_number, unit_number")
    .eq("company_id", companyId)
    .in("id", truckIds.slice(0, 500))
  const labelByTruck = new Map<string, string>()
  for (const t of (trucksRaw || []) as Array<{ id: string; truck_number?: string | null; unit_number?: string | null }>) {
    labelByTruck.set(String(t.id), String(t.truck_number || t.unit_number || "").trim() || "Truck")
  }

  const findings: Finding[] = []
  for (const trend of byTruck.values()) {
    // Rising = at least 3 recent faults AND at least double the prior window.
    if (trend.recent < 3) continue
    if (trend.recent < Math.max(trend.prior * 2, trend.prior + 2)) continue

    const confidence = clampConfidence(55 + Math.min(30, trend.recent * 5) + (trend.severe ? 10 : 0))
    const label = labelByTruck.get(trend.truckId) || "Truck"
    findings.push({
      automationType: "proactive_fault_trend",
      confidence,
      reasoning: `Truck ${label} logged ${trend.recent} fault codes in ${FAULT_WINDOW_DAYS}d vs ${trend.prior} prior.`,
      alert: {
        alert_type: "fault_frequency_rising",
        alert_key: `faults_${trend.truckId}`,
        priority: trend.severe ? "high" : "medium",
        title: "Truck fault-code frequency is rising",
        body: `Truck ${label} logged ${trend.recent} engine fault codes in the last ${FAULT_WINDOW_DAYS} days (up from ${trend.prior} the prior period). Schedule a diagnostic before it escalates.`,
        details: {
          truck_id: trend.truckId,
          truck_label: label,
          recent_faults: trend.recent,
          prior_faults: trend.prior,
          has_severe: trend.severe,
        },
        affected_resource_type: "truck",
        affected_resource_id: trend.truckId,
      },
    })
  }

  return findings
    .sort((a, b) => Number(b.alert.details.recent_faults) - Number(a.alert.details.recent_faults))
    .slice(0, MAX_FINDINGS_PER_DETECTOR)
}

async function processCompany(companyId: string): Promise<{ surfaced: number; suppressed: number }> {
  const admin = createAdminClient()

  const detectors = await Promise.all([
    detectLaneLosses(admin, companyId).catch(() => [] as Finding[]),
    detectHosTrend(admin, companyId).catch(() => [] as Finding[]),
    detectArAging(admin, companyId).catch(() => [] as Finding[]),
    detectFaultTrend(admin, companyId).catch(() => [] as Finding[]),
  ])

  const findings = detectors.flat()
  let surfaced = 0
  let suppressed = 0

  for (const finding of findings) {
    // Confidence gate (mirrors lib/ai/agent threshold behavior). Below threshold: stay silent.
    if (finding.confidence < PROACTIVE_INSIGHT_CONFIDENCE_THRESHOLD) {
      suppressed += 1
      continue
    }

    const inserted = await insertProactiveIfNew(admin, companyId, finding.alert)
    const triggered = inserted === "created"
    if (triggered) surfaced += 1

    // Notify-only audit trail; never an autonomous action.
    await logAutomationEvent({
      companyId,
      automationType: finding.automationType,
      level: "notify",
      triggered,
      confidence: finding.confidence,
      reasoning: inserted === "skipped" ? `${finding.reasoning} (existing open alert — not duplicated)` : finding.reasoning,
      actionTaken: triggered ? "notification_only" : inserted === "skipped" ? "skipped_duplicate" : null,
      actionPayload: { ...finding.alert.details, alert_type: finding.alert.alert_type, confidence: finding.confidence },
      approved: null,
      reversedAt: null,
    })
  }

  return { surfaced, suppressed }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const vercelCronHeader = request.headers.get("x-vercel-cron")
  const cronSecret = process.env.CRON_SECRET

  const isAuthorizedBySecret = !!cronSecret && authHeader === `Bearer ${cronSecret}`
  const isAuthorizedByVercelCron = !!vercelCronHeader
  if (!isAuthorizedBySecret && !isAuthorizedByVercelCron) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const admin = createAdminClient()
    const { data: companiesRaw, error: companiesErr } = await admin
      .from("companies")
      .select("id, subscription_tier")
      .in("subscription_status", ["active", "trial"])
      .neq("subscription_tier", "owner_operator")

    if (companiesErr) {
      return NextResponse.json(
        { error: databaseErrorMessage(companiesErr, "Failed to load companies") },
        { status: 500 },
      )
    }

    const companies = ((companiesRaw || []) as CompanyRow[]).filter((r) => r.id)

    let processed = 0
    let skippedPlan = 0
    let surfaced = 0
    let suppressed = 0
    let failed = 0

    for (const company of companies) {
      // Plan gate: proactive surfacing is a Fleet-tier (and up) capability. Lower tiers get nothing.
      const tier = normalizePlanTier(company.subscription_tier)
      if (!tierAtLeast(tier, "fleet")) {
        skippedPlan += 1
        continue
      }

      try {
        const result = await processCompany(company.id)
        processed += 1
        surfaced += result.surfaced
        suppressed += result.suppressed
      } catch (err: unknown) {
        failed += 1
        Sentry.captureException(err, { extra: { companyId: company.id } })
      }
    }

    return NextResponse.json({
      success: true,
      companies: companies.length,
      processed,
      skippedPlan,
      surfaced,
      suppressed,
      failed,
    })
  } catch (error: unknown) {
    Sentry.captureException(error)
    return NextResponse.json(
      { success: false, error: errorMessage(error, "ai-proactive-insights cron failed") },
      { status: 500 },
    )
  }
}
