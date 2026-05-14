"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { checkFeatureAccess } from "@/lib/plan-enforcement"
import { safeDbError } from "@/lib/utils/error"
import { generateScorecardSnapshotsForCompany } from "@/lib/eld/scorecard-snapshot"
import type { HarshEvent } from "@/app/actions/eld-events"

export type DriverSafetyScorecard = {
  id: string
  company_id: string
  driver_id: string
  snapshot_date: string
  period_start: string
  period_end: string
  score: number
  letter_grade: string
  harsh_braking_score: number
  harsh_acceleration_score: number
  harsh_cornering_score: number
  speeding_score: number
  hos_compliance_score: number
  total_miles_driven: number
  harsh_brake_count: number
  harsh_acceleration_count: number
  harsh_cornering_count: number
  speeding_count: number
  hos_violation_count: number
  events_per_1000_miles: number
  score_change_vs_prior: number | null
  fleet_rank: number | null
  fleet_total: number | null
  fleet_percentile: number | null
  data_confidence: "low" | "medium" | "high"
  created_at: string
}

export type DriverCoachingSession = {
  id: string
  company_id: string
  driver_id: string
  coached_by: string | null
  session_date: string
  session_type: "verbal" | "written" | "formal_review" | "recognition" | "follow_up"
  scorecard_id: string | null
  score_at_session: number | null
  topics_discussed: string[]
  notes: string
  action_items: string[]
  follow_up_date: string | null
  follow_up_completed: boolean
  related_event_ids: string[]
  created_at: string
  updated_at: string
}

async function requireScorecardGate(): Promise<{ companyId: string; userId: string } | { error: string }> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId) {
    return { error: ctx.error || "Not authenticated" }
  }
  const gate = await checkFeatureAccess({ companyId: ctx.companyId, feature: "driver_safety_scorecards" })
  if (!gate.allowed) {
    return { error: "Driver safety scorecards are available on Professional and Fleet plans." }
  }
  return { companyId: ctx.companyId, userId: ctx.userId }
}

function isoWeekKey(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00Z`)
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`
}

function pickWeeklyHistory(rows: DriverSafetyScorecard[], maxWeeks: number): DriverSafetyScorecard[] {
  const sorted = [...rows].sort((a, b) => new Date(b.snapshot_date).getTime() - new Date(a.snapshot_date).getTime())
  const seen = new Set<string>()
  const picked: DriverSafetyScorecard[] = []
  for (const r of sorted) {
    const wk = isoWeekKey(r.snapshot_date)
    if (seen.has(wk)) continue
    seen.add(wk)
    picked.push(r)
    if (picked.length >= maxWeeks) break
  }
  return picked.sort((a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime())
}

function normalizeDataConfidence(raw: unknown): DriverSafetyScorecard["data_confidence"] {
  if (raw === "low" || raw === "high" || raw === "medium") return raw
  return "medium"
}

function asScorecard(row: unknown): DriverSafetyScorecard | null {
  if (!row || typeof row !== "object") return null
  const o = row as Record<string, unknown>
  if (typeof o.id !== "string" || typeof o.driver_id !== "string") return null
  return {
    id: o.id,
    company_id: String(o.company_id ?? ""),
    driver_id: o.driver_id,
    snapshot_date: String(o.snapshot_date ?? ""),
    period_start: String(o.period_start ?? ""),
    period_end: String(o.period_end ?? ""),
    score: Number(o.score ?? 0),
    letter_grade: String(o.letter_grade ?? ""),
    harsh_braking_score: Number(o.harsh_braking_score ?? 0),
    harsh_acceleration_score: Number(o.harsh_acceleration_score ?? 0),
    harsh_cornering_score: Number(o.harsh_cornering_score ?? 0),
    speeding_score: Number(o.speeding_score ?? 0),
    hos_compliance_score: Number(o.hos_compliance_score ?? 0),
    total_miles_driven: Number(o.total_miles_driven ?? 0),
    harsh_brake_count: Number(o.harsh_brake_count ?? 0),
    harsh_acceleration_count: Number(o.harsh_acceleration_count ?? 0),
    harsh_cornering_count: Number(o.harsh_cornering_count ?? 0),
    speeding_count: Number(o.speeding_count ?? 0),
    hos_violation_count: Number(o.hos_violation_count ?? 0),
    events_per_1000_miles: Number(o.events_per_1000_miles ?? 0),
    score_change_vs_prior: o.score_change_vs_prior == null ? null : Number(o.score_change_vs_prior),
    fleet_rank: o.fleet_rank == null ? null : Number(o.fleet_rank),
    fleet_total: o.fleet_total == null ? null : Number(o.fleet_total),
    fleet_percentile: o.fleet_percentile == null ? null : Number(o.fleet_percentile),
    data_confidence: normalizeDataConfidence(o.data_confidence),
    created_at: String(o.created_at ?? ""),
  }
}

export async function getFleetScorecards(params: {
  snapshotDate?: string
  sortBy?: "score_asc" | "score_desc" | "rank" | "change_desc"
  limit?: number
}): Promise<{
  data: Array<{
    driver_id: string
    driver_name: string
    score: number
    letter_grade: string
    fleet_rank: number
    fleet_total: number
    score_change_vs_prior: number | null
    miles_driven: number
    total_events: number
    snapshot_date: string
    data_confidence: DriverSafetyScorecard["data_confidence"]
  }> | null
  error: string | null
}> {
  const gate = await requireScorecardGate()
  if ("error" in gate) return { data: null, error: gate.error }
  const supabase = await createClient()

  let snapshotDate = params.snapshotDate?.trim() || ""
  if (!snapshotDate) {
    const { data: latest, error: le } = await supabase
      .from("driver_safety_scorecards")
      .select("snapshot_date")
      .eq("company_id", gate.companyId)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (le) return { data: null, error: safeDbError(le) }
    if (!latest || typeof (latest as { snapshot_date?: string }).snapshot_date !== "string") {
      return { data: [], error: null }
    }
    snapshotDate = (latest as { snapshot_date: string }).snapshot_date
  }

  const { data: cards, error } = await supabase
    .from("driver_safety_scorecards")
    .select(
      "driver_id, score, letter_grade, fleet_rank, fleet_total, score_change_vs_prior, total_miles_driven, harsh_brake_count, harsh_acceleration_count, harsh_cornering_count, speeding_count, hos_violation_count, snapshot_date, data_confidence",
    )
    .eq("company_id", gate.companyId)
    .eq("snapshot_date", snapshotDate)

  if (error) return { data: null, error: safeDbError(error) }
  const rows = (cards || []) as Array<{
    driver_id: string
    score: number
    letter_grade: string
    fleet_rank: number | null
    fleet_total: number | null
    score_change_vs_prior: number | null
    total_miles_driven: number
    harsh_brake_count: number
    harsh_acceleration_count: number
    harsh_cornering_count: number
    speeding_count: number
    hos_violation_count: number
    snapshot_date: string
    data_confidence: string
  }>

  if (rows.length === 0) return { data: [], error: null }

  const driverIds = [...new Set(rows.map((r) => r.driver_id))]
  const { data: drivers, error: dErr } = await supabase.from("drivers").select("id, name").in("id", driverIds)
  if (dErr) return { data: null, error: safeDbError(dErr) }
  const nameById = new Map<string, string>()
  for (const d of drivers ?? []) {
    const row = d as Record<string, unknown>
    const id = typeof row.id === "string" ? row.id : ""
    const raw = row.name
    const label = typeof raw === "string" && raw.trim().length > 0 ? raw : "Driver"
    if (id) nameById.set(id, label)
  }

  const lim = Math.min(Math.max(1, params.limit ?? 500), 500)
  let list = rows.map((r) => ({
    driver_id: r.driver_id,
    driver_name: nameById.get(r.driver_id) || "Driver",
    score: r.score,
    letter_grade: r.letter_grade,
    fleet_rank: r.fleet_rank ?? 0,
    fleet_total: r.fleet_total ?? rows.length,
    score_change_vs_prior: r.score_change_vs_prior,
    miles_driven: r.total_miles_driven,
    total_events:
      r.harsh_brake_count +
      r.harsh_acceleration_count +
      r.harsh_cornering_count +
      r.speeding_count +
      r.hos_violation_count,
    snapshot_date: r.snapshot_date,
    data_confidence: normalizeDataConfidence(r.data_confidence),
  }))

  const sortBy = params.sortBy ?? "rank"
  if (sortBy === "score_asc") list = [...list].sort((a, b) => a.score - b.score)
  else if (sortBy === "score_desc") list = [...list].sort((a, b) => b.score - a.score)
  else if (sortBy === "change_desc") {
    list = [...list].sort((a, b) => {
      const av = a.score_change_vs_prior
      const bv = b.score_change_vs_prior
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      return bv - av
    })
  } else {
    list = [...list].sort((a, b) => a.fleet_rank - b.fleet_rank)
  }

  return { data: list.slice(0, lim), error: null }
}

export async function getDriverScorecard(params: {
  driverId: string
  snapshotDate?: string
}): Promise<{
  data: {
    current: DriverSafetyScorecard
    history: DriverSafetyScorecard[]
    recent_events: HarshEvent[]
    recent_coaching: DriverCoachingSession[]
  } | null
  error: string | null
}> {
  const gate = await requireScorecardGate()
  if ("error" in gate) return { data: null, error: gate.error }
  const supabase = await createClient()

  let snapshotDate = params.snapshotDate?.trim() || ""
  if (!snapshotDate) {
    const { data: latest, error: le } = await supabase
      .from("driver_safety_scorecards")
      .select("snapshot_date")
      .eq("company_id", gate.companyId)
      .eq("driver_id", params.driverId)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (le) return { data: null, error: safeDbError(le) }
    if (!latest || typeof (latest as { snapshot_date?: string }).snapshot_date !== "string") {
      return { data: null, error: "No scorecard found for this driver yet." }
    }
    snapshotDate = (latest as { snapshot_date: string }).snapshot_date
  }

  const { data: cur, error: cErr } = await supabase
    .from("driver_safety_scorecards")
    .select("*")
    .eq("company_id", gate.companyId)
    .eq("driver_id", params.driverId)
    .eq("snapshot_date", snapshotDate)
    .maybeSingle()
  if (cErr) return { data: null, error: safeDbError(cErr) }
  const current = asScorecard(cur)
  if (!current) return { data: null, error: "Scorecard not found." }

  const { data: histRaw, error: hErr } = await supabase
    .from("driver_safety_scorecards")
    .select("*")
    .eq("company_id", gate.companyId)
    .eq("driver_id", params.driverId)
    .order("snapshot_date", { ascending: false })
    .limit(120)
  if (hErr) return { data: null, error: safeDbError(hErr) }
  const allHist = ((histRaw ?? []) as unknown[])
    .map(asScorecard)
    .filter((r: DriverSafetyScorecard | null): r is DriverSafetyScorecard => r != null)
  const history = pickWeeklyHistory(allHist, 12)

  const from = new Date()
  from.setUTCDate(from.getUTCDate() - 30)
  const { data: evs, error: eErr } = await supabase
    .from("eld_harsh_events")
    .select(
      `id, company_id, truck_id, driver_id, eld_device_id, event_type, severity, occurred_at,
       location_lat, location_lng, location_address, speed_mph, speed_limit_mph, g_force,
       duration_seconds, provider, provider_event_id, raw_payload, reviewed, reviewed_at, coaching_note,
       driver:drivers(id, name),
       truck:trucks(id, truck_number)`,
    )
    .eq("company_id", gate.companyId)
    .eq("driver_id", params.driverId)
    .gte("occurred_at", from.toISOString())
    .order("occurred_at", { ascending: false })
    .limit(40)
  if (eErr) return { data: null, error: safeDbError(eErr) }

  const recent_events: HarshEvent[] = ((evs ?? []) as unknown[]).map((r: unknown) => {
    const o = r as Record<string, unknown>
    return {
      id: String(o.id),
      company_id: String(o.company_id),
      truck_id: (o.truck_id as string | null) ?? null,
      driver_id: (o.driver_id as string | null) ?? null,
      eld_device_id: String(o.eld_device_id ?? ""),
      event_type: String(o.event_type ?? ""),
      severity: String(o.severity ?? "medium"),
      occurred_at: String(o.occurred_at ?? ""),
      location_lat: o.location_lat == null ? null : Number(o.location_lat),
      location_lng: o.location_lng == null ? null : Number(o.location_lng),
      location_address: (o.location_address as string | null) ?? null,
      speed_mph: o.speed_mph == null ? null : Number(o.speed_mph),
      speed_limit_mph: o.speed_limit_mph == null ? null : Number(o.speed_limit_mph),
      g_force: o.g_force == null ? null : Number(o.g_force),
      duration_seconds: o.duration_seconds == null ? null : Number(o.duration_seconds),
      provider: String(o.provider ?? ""),
      provider_event_id: String(o.provider_event_id ?? ""),
      raw_payload: (o.raw_payload as Record<string, unknown>) || {},
      reviewed: Boolean(o.reviewed),
      reviewed_at: (o.reviewed_at as string | null) ?? null,
      coaching_note: (o.coaching_note as string | null) ?? null,
      driver: o.driver as HarshEvent["driver"],
      truck: o.truck as HarshEvent["truck"],
    }
  })

  const { data: coachRaw, error: coErr } = await supabase
    .from("driver_coaching_sessions")
    .select("*")
    .eq("company_id", gate.companyId)
    .eq("driver_id", params.driverId)
    .order("session_date", { ascending: false })
    .limit(25)
  if (coErr) return { data: null, error: safeDbError(coErr) }

  const recent_coaching: DriverCoachingSession[] = ((coachRaw ?? []) as unknown[]).map((row: unknown) => {
    const o = row as Record<string, unknown>
    return {
      id: String(o.id),
      company_id: String(o.company_id),
      driver_id: String(o.driver_id),
      coached_by: (o.coached_by as string | null) ?? null,
      session_date: String(o.session_date ?? ""),
      session_type: o.session_type as DriverCoachingSession["session_type"],
      scorecard_id: (o.scorecard_id as string | null) ?? null,
      score_at_session: o.score_at_session == null ? null : Number(o.score_at_session),
      topics_discussed: Array.isArray(o.topics_discussed) ? (o.topics_discussed as string[]) : [],
      notes: String(o.notes ?? ""),
      action_items: Array.isArray(o.action_items) ? (o.action_items as string[]) : [],
      follow_up_date: (o.follow_up_date as string | null) ?? null,
      follow_up_completed: Boolean(o.follow_up_completed),
      related_event_ids: Array.isArray(o.related_event_ids) ? (o.related_event_ids as string[]) : [],
      created_at: String(o.created_at ?? ""),
      updated_at: String(o.updated_at ?? ""),
    }
  })

  return { data: { current, history, recent_events, recent_coaching }, error: null }
}

export async function createCoachingSession(params: {
  driverId: string
  sessionDate: string
  sessionType: DriverCoachingSession["session_type"]
  topicsDiscussed: string[]
  notes: string
  actionItems: string[]
  followUpDate?: string
  relatedEventIds?: string[]
}): Promise<{ data: { sessionId: string } | null; error: string | null }> {
  const gate = await requireScorecardGate()
  if ("error" in gate) return { data: null, error: gate.error }
  const supabase = await createClient()

  const { data: sc } = await supabase
    .from("driver_safety_scorecards")
    .select("id, score")
    .eq("company_id", gate.companyId)
    .eq("driver_id", params.driverId)
    .lte("snapshot_date", params.sessionDate)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle()

  const scoreRow = sc as { id?: string; score?: number } | null

  const { data: inserted, error } = await supabase
    .from("driver_coaching_sessions")
    .insert({
      company_id: gate.companyId,
      driver_id: params.driverId,
      coached_by: gate.userId,
      session_date: params.sessionDate,
      session_type: params.sessionType,
      scorecard_id: scoreRow?.id ?? null,
      score_at_session: scoreRow?.score != null ? Number(scoreRow.score) : null,
      topics_discussed: params.topicsDiscussed,
      notes: params.notes,
      action_items: params.actionItems,
      follow_up_date: params.followUpDate || null,
      related_event_ids: params.relatedEventIds ?? [],
    })
    .select("id")
    .single()

  if (error) return { data: null, error: safeDbError(error) }
  const id = (inserted as { id?: string } | null)?.id
  if (!id) return { data: null, error: "Failed to create session." }
  return { data: { sessionId: id }, error: null }
}

export async function markCoachingFollowUpComplete(params: {
  sessionId: string
}): Promise<{ data: { completed: boolean } | null; error: string | null }> {
  const gate = await requireScorecardGate()
  if ("error" in gate) return { data: null, error: gate.error }
  const supabase = await createClient()

  const { data: updated, error } = await supabase
    .from("driver_coaching_sessions")
    .update({ follow_up_completed: true, updated_at: new Date().toISOString() })
    .eq("company_id", gate.companyId)
    .eq("id", params.sessionId)
    .select("id")
    .maybeSingle()

  if (error) return { data: null, error: safeDbError(error) }
  if (!updated) return { data: null, error: "Session not found." }
  return { data: { completed: true }, error: null }
}

const ONDEMAND_MAX_CHUNKS = 12

export async function generateScorecardOnDemand(): Promise<{
  data: { generated: number; skipped: number } | null
  error: string | null
}> {
  const gate = await requireScorecardGate()
  if ("error" in gate) return { data: null, error: gate.error }

  const admin = createAdminClient()
  const runDate = new Date().toISOString().slice(0, 10)
  const snapshotDate = new Date(`${runDate}T12:00:00Z`)

  const { data: existing } = await admin
    .from("driver_safety_scorecard_ondemand_runs")
    .select("company_id")
    .eq("company_id", gate.companyId)
    .eq("run_date", runDate)
    .maybeSingle()
  if (existing && typeof (existing as { company_id?: string }).company_id === "string") {
    return { data: null, error: "On-demand scorecard refresh is limited to once per company per UTC day." }
  }

  await admin.from("driver_safety_scorecard_batch_state").delete().eq("company_id", gate.companyId).eq("snapshot_date", runDate)
  await admin.from("driver_safety_scorecards").delete().eq("company_id", gate.companyId).eq("snapshot_date", runDate)

  let generated = 0
  let skipped = 0
  for (let i = 0; i < ONDEMAND_MAX_CHUNKS; i += 1) {
    const chunk = await generateScorecardSnapshotsForCompany({
      companyId: gate.companyId,
      snapshotDate,
    })
    if (chunk.error) return { data: null, error: chunk.error }
    if (!chunk.data) return { data: null, error: "Snapshot run failed." }
    generated += chunk.data.generated
    skipped += chunk.data.skipped
    if (chunk.data.completed) break
  }

  await admin.from("driver_safety_scorecard_ondemand_runs").insert({
    company_id: gate.companyId,
    run_date: runDate,
  })

  return { data: { generated, skipped }, error: null }
}

export async function getScorecardSnapshotDates(): Promise<{ data: string[] | null; error: string | null }> {
  const gate = await requireScorecardGate()
  if ("error" in gate) return { data: null, error: gate.error }
  const supabase = await createClient()

  const { data: rows, error } = await supabase
    .from("driver_safety_scorecards")
    .select("snapshot_date")
    .eq("company_id", gate.companyId)
    .order("snapshot_date", { ascending: false })
    .limit(400)

  if (error) return { data: null, error: safeDbError(error) }
  const rowList = (rows ?? []) as Array<{ snapshot_date?: unknown }>
  const dates: string[] = [
    ...new Set(
      rowList
        .map((r) => (typeof r.snapshot_date === "string" ? r.snapshot_date : ""))
        .filter((s) => s.length > 0),
    ),
  ]
  return { data: dates, error: null }
}
