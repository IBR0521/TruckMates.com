"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { FeatureLock } from "@/components/billing/feature-lock"
import {
  getDriverScorecard,
  markCoachingFollowUpComplete,
  type DriverCoachingSession,
  type DriverSafetyScorecard,
} from "@/app/actions/safety-scorecards"
import { CoachingSessionDialog } from "@/components/eld/coaching-session-dialog"
import type { HarshEvent } from "@/app/actions/eld-events"

function gradeTint(grade: string): string {
  switch (grade) {
    case "A":
      return "border-emerald-500/25 bg-emerald-500/5"
    case "B":
      return "border-sky-500/25 bg-sky-500/5"
    case "C":
      return "border-amber-500/25 bg-amber-500/5"
    case "D":
      return "border-orange-500/25 bg-orange-500/5"
    case "F":
      return "border-rose-500/30 bg-rose-500/5"
    default:
      return "border-border/60 bg-card/80"
  }
}

function BarRow({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{pct.toFixed(0)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary/80 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function DriverScorecardDetail({
  driverId,
  driverName,
}: {
  driverId: string
  driverName?: string | null
}) {
  const [loading, setLoading] = useState(true)
  const [current, setCurrent] = useState<DriverSafetyScorecard | null>(null)
  const [history, setHistory] = useState<DriverSafetyScorecard[]>([])
  const [recentEvents, setRecentEvents] = useState<HarshEvent[]>([])
  const [coaching, setCoaching] = useState<DriverCoachingSession[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await getDriverScorecard({ driverId })
    setLoading(false)
    if (res.error || !res.data) {
      if (res.error && !res.error.includes("No scorecard")) toast.error(res.error)
      setCurrent(null)
      setHistory([])
      setRecentEvents([])
      setCoaching([])
      return
    }
    setCurrent(res.data.current)
    setHistory(res.data.history)
    setRecentEvents(res.data.recent_events)
    setCoaching(res.data.recent_coaching)
  }, [driverId])

  useEffect(() => {
    void load()
  }, [load])

  const chartData = useMemo(
    () =>
      history.map((h) => ({
        date: h.snapshot_date.slice(5),
        score: h.score,
      })),
    [history],
  )

  async function onMarkFollowUp(id: string) {
    const res = await markCoachingFollowUpComplete({ sessionId: id })
    if (res.error) return toast.error(res.error)
    toast.success("Follow-up marked complete.")
    void load()
  }

  const displayName = driverName || "Driver"

  return (
    <FeatureLock
      featureKey="driver_safety_scorecards"
      title="Driver safety scorecards"
      description="Professional and Fleet include rolling safety scorecards, fleet ranking, and structured coaching notes."
    >
      <Card className="border-border/70 bg-card/80 p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Safety scorecard</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Rolling 30-day model from harsh events, HOS signals, and miles. Low-mile periods show limited confidence.
            </p>
          </div>
          <Button type="button" size="sm" onClick={() => setDialogOpen(true)}>
            Record coaching session
          </Button>
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading scorecard…</p>
        ) : !current ? (
          <p className="mt-6 text-sm text-muted-foreground">
            No snapshot yet for {displayName}. Scorecards are generated nightly (UTC), or use Refresh on the fleet
            scorecards page if your plan allows on-demand runs.
          </p>
        ) : (
          <div className="mt-6 space-y-8">
            <div
              className={`rounded-xl border p-4 md:p-6 ${gradeTint(current.letter_grade)}`}
            >
              {current.data_confidence === "low" && current.total_miles_driven < 500 ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Insufficient miles for a full grade
                  </p>
                  <p className="mt-2 text-3xl font-bold text-foreground">—</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Under 500 miles in the window — review components and events instead of the headline score.
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Current score ({current.snapshot_date})
                  </p>
                  <div className="mt-2 flex flex-wrap items-end gap-3">
                    <span className="text-4xl font-bold text-foreground">{current.score.toFixed(1)}</span>
                    <span className="rounded-md border border-border/60 bg-background/80 px-3 py-1 text-xl font-semibold">
                      {current.letter_grade}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Confidence: {current.data_confidence} · {current.total_miles_driven.toFixed(0)} mi in period ·{" "}
                    {current.events_per_1000_miles.toFixed(2)} weighted events / 1k mi
                  </p>
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">Component scores</h4>
                <BarRow label="Harsh braking (20%)" value={current.harsh_braking_score} />
                <BarRow label="Harsh acceleration (15%)" value={current.harsh_acceleration_score} />
                <BarRow label="Harsh cornering (15%)" value={current.harsh_cornering_score} />
                <BarRow label="Speeding (25%)" value={current.speeding_score} />
                <BarRow label="HOS compliance (25%)" value={current.hos_compliance_score} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">Trend (weekly snapshots)</h4>
                {chartData.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">Not enough history yet.</p>
                ) : (
                  <div className="mt-4 h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: 8,
                          }}
                        />
                        <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {current.fleet_rank != null && current.fleet_total != null ? (
              <p className="text-sm text-foreground">
                Fleet ranking:{" "}
                <span className="font-semibold">
                  {current.fleet_rank} of {current.fleet_total} drivers
                </span>
                {current.fleet_percentile != null ? (
                  <>
                    {" "}
                    (~{current.fleet_percentile.toFixed(0)}th percentile — higher means safer vs peers on this
                    snapshot)
                  </>
                ) : null}
              </p>
            ) : null}

            <div>
              <h4 className="text-sm font-semibold text-foreground">Recent safety events (30 days)</h4>
              <ul className="mt-2 divide-y divide-border/50">
                {recentEvents.length === 0 ? (
                  <li className="py-2 text-sm text-muted-foreground">No harsh events in this window.</li>
                ) : (
                  recentEvents.slice(0, 12).map((ev) => (
                    <li key={ev.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                      <span className="font-medium capitalize">{ev.event_type.replace(/_/g, " ")}</span>
                      <span className="text-xs text-muted-foreground">{new Date(ev.occurred_at).toLocaleString()}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-foreground">Coaching history</h4>
              <ul className="mt-2 space-y-3">
                {coaching.length === 0 ? (
                  <li className="text-sm text-muted-foreground">No coaching sessions recorded yet.</li>
                ) : (
                  coaching.map((c) => (
                    <li key={c.id} className="rounded-lg border border-border/60 bg-muted/10 p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium capitalize">{c.session_type.replace(/_/g, " ")}</span>
                        <span className="text-xs text-muted-foreground">{c.session_date}</span>
                      </div>
                      {c.topics_discussed.length > 0 ? (
                        <p className="mt-1 text-xs text-muted-foreground">Topics: {c.topics_discussed.join(", ")}</p>
                      ) : null}
                      <p className="mt-2 whitespace-pre-wrap text-foreground">{c.notes}</p>
                      {c.action_items.length > 0 ? (
                        <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
                          {c.action_items.map((a, i) => (
                            <li key={i}>{a}</li>
                          ))}
                        </ul>
                      ) : null}
                      {c.follow_up_date && !c.follow_up_completed ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-amber-600 dark:text-amber-400">
                            Follow-up due {c.follow_up_date}
                          </span>
                          <Button type="button" variant="outline" size="sm" onClick={() => void onMarkFollowUp(c.id)}>
                            Mark follow-up complete
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  ))
                )}
              </ul>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Scores use severity-weighted harsh events and HOS violation signals per 1,000 miles, blended with fixed
              weights. See engineering docs in <code className="text-[11px]">lib/eld/safety-scoring.ts</code> for the
              exact formula carriers can audit.
            </p>
          </div>
        )}
      </Card>

      <CoachingSessionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        driverId={driverId}
        recentEvents={recentEvents}
        onSaved={() => void load()}
      />
    </FeatureLock>
  )
}
