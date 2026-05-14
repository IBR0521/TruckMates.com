import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Safety scorecard scoring (opinionated carrier-facing model)
 * ------------------------------------------------------------------
 * Per-event-type "exposure" uses severity weights on each harsh row:
 *   critical=3, high=2, medium=1, low=0.5
 *
 * Normalize to events per 1,000 driven miles:
 *   rate = weighted_points / max(miles_driven, 1) * 1000
 *
 * Component score (0–100) uses exponential decay vs that rate:
 *   component = clamp(100 * exp(-rate / 5), 0, 100)
 *   (0 events → rate 0 → score 100; higher rate decays toward 0)
 *
 * Overall score is a weighted blend of the five components:
 *   harsh braking 20%, harsh accel 15%, harsh corner 15%, speeding 25%, HOS 25%
 *
 * HOS "violations" are counted from `eld_events` rows with event_type = 'hos_violation'
 * (same severity weighting). There is no separate `hos_violations` table in this schema.
 *
 * Miles: prefer sum of `eld_logs.miles_driven` for the driver in the period; if none,
 * fall back to sum of `loads.estimated_miles` for loads assigned to the driver with
 * status `delivered` overlapping the period on `actual_delivery` or `load_date`.
 *
 * Low sample miles: `data_confidence` is `low` when miles < 500; overall numeric score
 * is capped at 95 so we do not assign an "A" letter on thin evidence (UI may still show
 * "Insufficient data" when miles are very low — see `data_confidence`).
 */

export type ScorecardComputeInput = {
  companyId: string
  driverId: string
  periodStart: Date
  periodEnd: Date
}

export type DataConfidence = "low" | "medium" | "high"

export type ScorecardComputeResult = {
  score: number
  letter_grade: "A" | "B" | "C" | "D" | "F"
  component_scores: {
    harsh_braking: number
    harsh_acceleration: number
    harsh_cornering: number
    speeding: number
    hos_compliance: number
  }
  raw_counts: {
    miles_driven: number
    harsh_brake: number
    harsh_acceleration: number
    harsh_cornering: number
    speeding: number
    hos_violations: number
  }
  /** Sum of severity-weighted harsh + HOS points / 1000mi (single headline intensity). */
  events_per_1000_miles: number
  data_confidence: DataConfidence
}

const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 3,
  high: 2,
  medium: 1,
  low: 0.5,
}

function severityMultiplier(sev: string | null | undefined): number {
  const k = String(sev || "medium").toLowerCase()
  return SEVERITY_WEIGHT[k] ?? 1
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

/** Exponential decay component: 100 at rate 0, decays as rate grows. */
function componentFromRate(rate: number): number {
  const raw = 100 * Math.exp(-rate / 5)
  return clamp(raw, 0, 100)
}

function letterFromScore(s: number): ScorecardComputeResult["letter_grade"] {
  if (s >= 90) return "A"
  if (s >= 80) return "B"
  if (s >= 70) return "C"
  if (s >= 60) return "D"
  return "F"
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

async function fetchMilesDriven(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  driverId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<number> {
  const start = ymd(periodStart)
  const end = ymd(periodEnd)
  const { data: logs, error } = await admin
    .from("eld_logs")
    .select("miles_driven")
    .eq("company_id", companyId)
    .eq("driver_id", driverId)
    .gte("log_date", start)
    .lte("log_date", end)

  if (!error && logs?.length) {
    let sum = 0
    for (const row of logs as Array<{ miles_driven?: number | string | null }>) {
      const m = Number(row.miles_driven ?? 0)
      if (Number.isFinite(m) && m > 0) sum += m
    }
    if (sum > 0) return sum
  }

  const { data: loads, error: lErr } = await admin
    .from("loads")
    .select("estimated_miles, status, actual_delivery, load_date")
    .eq("company_id", companyId)
    .eq("driver_id", driverId)
    .eq("status", "delivered")

  if (lErr || !loads?.length) return 0

  const ps = periodStart.getTime()
  const pe = periodEnd.getTime()
  let sumMiles = 0
  for (const row of loads as Array<{
    estimated_miles?: number | null
    actual_delivery?: string | null
    load_date?: string | null
  }>) {
    const ref = row.actual_delivery || row.load_date
    if (!ref) continue
    const t = new Date(ref).getTime()
    if (!Number.isFinite(t) || t < ps || t > pe) continue
    const em = Number(row.estimated_miles ?? 0)
    if (Number.isFinite(em) && em > 0) sumMiles += em
  }
  return sumMiles
}

type HarshAgg = {
  raw: { harsh_brake: number; harsh_acceleration: number; harsh_cornering: number; speeding: number }
  weighted: { harsh_brake: number; harsh_acceleration: number; harsh_cornering: number; speeding: number }
}

async function fetchHarshAggregates(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  driverId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<HarshAgg> {
  const empty: HarshAgg = {
    raw: { harsh_brake: 0, harsh_acceleration: 0, harsh_cornering: 0, speeding: 0 },
    weighted: { harsh_brake: 0, harsh_acceleration: 0, harsh_cornering: 0, speeding: 0 },
  }
  const { data, error } = await admin
    .from("eld_harsh_events")
    .select("event_type, severity")
    .eq("company_id", companyId)
    .eq("driver_id", driverId)
    .gte("occurred_at", periodStart.toISOString())
    .lte("occurred_at", periodEnd.toISOString())
    .limit(5000)

  if (error || !data?.length) return empty

  const out: HarshAgg = {
    raw: { ...empty.raw },
    weighted: { ...empty.weighted },
  }
  for (const row of data as Array<{ event_type?: string; severity?: string | null }>) {
    const et = String(row.event_type || "")
    const w = severityMultiplier(row.severity)
    if (et === "harsh_brake") {
      out.raw.harsh_brake += 1
      out.weighted.harsh_brake += w
    } else if (et === "harsh_acceleration") {
      out.raw.harsh_acceleration += 1
      out.weighted.harsh_acceleration += w
    } else if (et === "harsh_cornering") {
      out.raw.harsh_cornering += 1
      out.weighted.harsh_cornering += w
    } else if (et === "speeding") {
      out.raw.speeding += 1
      out.weighted.speeding += w
    }
  }
  return out
}

async function fetchHosViolationWeighted(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  driverId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<{ rawCount: number; weighted: number }> {
  const { data, error } = await admin
    .from("eld_events")
    .select("id, severity")
    .eq("company_id", companyId)
    .eq("driver_id", driverId)
    .eq("event_type", "hos_violation")
    .gte("event_time", periodStart.toISOString())
    .lte("event_time", periodEnd.toISOString())
    .limit(5000)

  if (error || !data?.length) return { rawCount: 0, weighted: 0 }
  let weighted = 0
  for (const row of data as Array<{ severity?: string | null }>) {
    weighted += severityMultiplier(row.severity)
  }
  return { rawCount: data.length, weighted }
}

function dataConfidenceFromMiles(miles: number): DataConfidence {
  if (miles < 500) return "low"
  if (miles < 3000) return "medium"
  return "high"
}

export async function computeDriverScore(
  input: ScorecardComputeInput,
): Promise<{ data: ScorecardComputeResult | null; error: string | null }> {
  try {
    const admin = createAdminClient()
    const miles = await fetchMilesDriven(admin, input.companyId, input.driverId, input.periodStart, input.periodEnd)
    const harsh = await fetchHarshAggregates(admin, input.companyId, input.driverId, input.periodStart, input.periodEnd)
    const hos = await fetchHosViolationWeighted(admin, input.companyId, input.driverId, input.periodStart, input.periodEnd)

    const m = Math.max(miles, 1)
    const rBrake = (harsh.weighted.harsh_brake / m) * 1000
    const rAccel = (harsh.weighted.harsh_acceleration / m) * 1000
    const rCorner = (harsh.weighted.harsh_cornering / m) * 1000
    const rSpeed = (harsh.weighted.speeding / m) * 1000
    const rHos = (hos.weighted / m) * 1000

    const cBrake = componentFromRate(rBrake)
    const cAccel = componentFromRate(rAccel)
    const cCorner = componentFromRate(rCorner)
    const cSpeed = componentFromRate(rSpeed)
    const cHos = componentFromRate(rHos)

    let overall =
      cBrake * 0.2 + cAccel * 0.15 + cCorner * 0.15 + cSpeed * 0.25 + cHos * 0.25

    const confidence = dataConfidenceFromMiles(miles)
    if (confidence === "low") {
      overall = Math.min(overall, 95)
    }

    const totalWeightedPoints =
      harsh.weighted.harsh_brake +
      harsh.weighted.harsh_acceleration +
      harsh.weighted.harsh_cornering +
      harsh.weighted.speeding +
      hos.weighted
    const eventsPer1000 = (totalWeightedPoints / m) * 1000

    const result: ScorecardComputeResult = {
      score: clamp(Math.round(overall * 100) / 100, 0, 100),
      letter_grade: letterFromScore(overall),
      component_scores: {
        harsh_braking: clamp(Math.round(cBrake * 100) / 100, 0, 100),
        harsh_acceleration: clamp(Math.round(cAccel * 100) / 100, 0, 100),
        harsh_cornering: clamp(Math.round(cCorner * 100) / 100, 0, 100),
        speeding: clamp(Math.round(cSpeed * 100) / 100, 0, 100),
        hos_compliance: clamp(Math.round(cHos * 100) / 100, 0, 100),
      },
      raw_counts: {
        miles_driven: Math.round(miles * 100) / 100,
        harsh_brake: harsh.raw.harsh_brake,
        harsh_acceleration: harsh.raw.harsh_acceleration,
        harsh_cornering: harsh.raw.harsh_cornering,
        speeding: harsh.raw.speeding,
        hos_violations: hos.rawCount,
      },
      events_per_1000_miles: Math.round(eventsPer1000 * 1000) / 1000,
      data_confidence: confidence,
    }
    return { data: result, error: null }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "computeDriverScore failed"
    return { data: null, error: msg }
  }
}
