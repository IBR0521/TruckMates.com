import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/admin"
import { computeDriverScore } from "@/lib/eld/safety-scoring"
import { mapWithConcurrency } from "@/lib/utils/map-with-concurrency"

const DRIVERS_PER_RUN = 500

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function endOfUtcDay(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999Z`)
}

/** Trend compares this snapshot to the score from exactly one week earlier (same rolling 30-day window offset). */
function priorTrendSnapshotDate(snapshotStr: string): string {
  const d = new Date(`${snapshotStr}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 7)
  return d.toISOString().slice(0, 10)
}

export async function generateScorecardSnapshotsForCompany(params: {
  companyId: string
  snapshotDate: Date
}): Promise<{
  data: { generated: number; skipped: number; errors: number; completed: boolean } | null
  error: string | null
}> {
  const admin = createAdminClient()
  const snapshotStr = toDateOnly(params.snapshotDate)
  const periodEnd = endOfUtcDay(snapshotStr)
  const periodStart = new Date(periodEnd.getTime() - 30 * 86400000)
  periodStart.setUTCHours(0, 0, 0, 0)

  try {
    const { data: stateRow, error: stErr } = await admin
      .from("driver_safety_scorecard_batch_state")
      .select("snapshot_date, last_offset, completed")
      .eq("company_id", params.companyId)
      .eq("snapshot_date", snapshotStr)
      .maybeSingle()

    if (stErr) {
      return { data: null, error: stErr.message }
    }

    let offset = 0
    if (stateRow && typeof stateRow === "object") {
      const s = stateRow as { snapshot_date?: string; last_offset?: number; completed?: boolean }
      if (s.completed) {
        return { data: { generated: 0, skipped: 0, errors: 0, completed: true }, error: null }
      }
      offset = Number(s.last_offset ?? 0) || 0
    }

    const { data: drivers, error: dErr } = await admin
      .from("drivers")
      .select("id, name")
      .eq("company_id", params.companyId)
      .in("status", ["active", "on_route", "available", "off_duty", "on_break"])
      .order("name", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + DRIVERS_PER_RUN - 1)

    if (dErr) {
      return { data: null, error: dErr.message }
    }

    if (!drivers?.length) {
      await admin.from("driver_safety_scorecard_batch_state").upsert(
        {
          company_id: params.companyId,
          snapshot_date: snapshotStr,
          last_offset: offset,
          completed: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "company_id,snapshot_date" },
      )
      await applyFleetRanks(admin, params.companyId, snapshotStr)
      return { data: { generated: 0, skipped: 0, errors: 0, completed: true }, error: null }
    }

    let generated = 0
    const skipped = 0
    let errors = 0

    const priorDateStr = priorTrendSnapshotDate(snapshotStr)

    const driverRows = drivers as Array<{ id: string; name?: string | null }>

    const chunkResults = await mapWithConcurrency(driverRows, 10, async (d) => {
      const comp = await computeDriverScore({
        companyId: params.companyId,
        driverId: d.id,
        periodStart,
        periodEnd,
      })
      if (comp.error || !comp.data) {
        Sentry.captureMessage(`scorecard compute ${d.id}: ${comp.error}`, { level: "warning" })
        return { ok: false as const }
      }

      const { data: prior } = await admin
        .from("driver_safety_scorecards")
        .select("score")
        .eq("driver_id", d.id)
        .eq("snapshot_date", priorDateStr)
        .maybeSingle()

      const priorScore =
        prior && typeof (prior as { score?: unknown }).score === "number"
          ? Number((prior as { score: number }).score)
          : null
      const scoreChange =
        priorScore != null && Number.isFinite(priorScore)
          ? Math.round((comp.data.score - priorScore) * 100) / 100
          : null

      const row = {
        company_id: params.companyId,
        driver_id: d.id,
        snapshot_date: snapshotStr,
        period_start: toDateOnly(periodStart),
        period_end: snapshotStr,
        score: comp.data.score,
        letter_grade: comp.data.letter_grade,
        harsh_braking_score: comp.data.component_scores.harsh_braking,
        harsh_acceleration_score: comp.data.component_scores.harsh_acceleration,
        harsh_cornering_score: comp.data.component_scores.harsh_cornering,
        speeding_score: comp.data.component_scores.speeding,
        hos_compliance_score: comp.data.component_scores.hos_compliance,
        total_miles_driven: comp.data.raw_counts.miles_driven,
        harsh_brake_count: comp.data.raw_counts.harsh_brake,
        harsh_acceleration_count: comp.data.raw_counts.harsh_acceleration,
        harsh_cornering_count: comp.data.raw_counts.harsh_cornering,
        speeding_count: comp.data.raw_counts.speeding,
        hos_violation_count: comp.data.raw_counts.hos_violations,
        events_per_1000_miles: comp.data.events_per_1000_miles,
        score_change_vs_prior: scoreChange,
        data_confidence: comp.data.data_confidence,
        fleet_rank: null as number | null,
        fleet_total: null as number | null,
        fleet_percentile: null as number | null,
      }

      const { error: upErr } = await admin.from("driver_safety_scorecards").upsert(row, {
        onConflict: "driver_id,snapshot_date",
      })
      if (upErr) {
        Sentry.captureMessage(`scorecard upsert ${d.id}: ${upErr.message}`, { level: "warning" })
        return { ok: false as const }
      }
      return { ok: true as const }
    })

    for (const r of chunkResults) {
      if (r.ok) generated += 1
      else errors += 1
    }

    const newOffset = offset + drivers.length
    const completed = drivers.length < DRIVERS_PER_RUN

    await admin.from("driver_safety_scorecard_batch_state").upsert(
      {
        company_id: params.companyId,
        snapshot_date: snapshotStr,
        last_offset: newOffset,
        completed,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id,snapshot_date" },
    )

    await applyFleetRanks(admin, params.companyId, snapshotStr)

    return { data: { generated, skipped, errors, completed }, error: null }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "generateScorecardSnapshotsForCompany failed"
    return { data: null, error: msg }
  }
}

async function applyFleetRanks(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  snapshotDate: string,
): Promise<void> {
  const { data: rows, error } = await admin
    .from("driver_safety_scorecards")
    .select("id, score")
    .eq("company_id", companyId)
    .eq("snapshot_date", snapshotDate)
    .order("score", { ascending: false })

  if (error || !rows?.length) return

  const list = rows as Array<{ id: string; score: number }>
  const total = list.length
  const BATCH = 25
  for (let i = 0; i < list.length; i += BATCH) {
    const slice = list.slice(i, i + BATCH)
    await Promise.all(
      slice.map(async (r, j) => {
        const rank = i + j + 1
        const percentile =
          total <= 1 ? 100 : Math.round(((total - rank + 1) / total) * 10000) / 100
        const { error: upErr } = await admin
          .from("driver_safety_scorecards")
          .update({
            fleet_rank: rank,
            fleet_total: total,
            fleet_percentile: percentile,
          })
          .eq("id", r.id)
        if (upErr) throw upErr
      }),
    )
  }
}
