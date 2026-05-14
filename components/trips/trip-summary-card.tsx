"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FeatureLock } from "@/components/billing/feature-lock"
import { getTripSummary } from "@/app/actions/trip-reports"
import type { TripSummary } from "@/lib/eld/trip-aggregator"
import { MapPin, Route, AlertTriangle } from "lucide-react"

function completedStatuses(s: string): boolean {
  return ["delivered", "invoiced", "paid"].includes(s.toLowerCase())
}

export function TripSummaryCard({ loadId, loadStatus }: { loadId: string; loadStatus: string }) {
  const [summary, setSummary] = useState<TripSummary | null | undefined>(undefined)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    if (!completedStatuses(loadStatus)) {
      setSummary(null)
      setErr(null)
      return () => {
        alive = false
      }
    }
    setErr(null)
    setSummary(undefined)
    void getTripSummary(loadId).then((r) => {
      if (!alive) return
      if (r.error) setErr(r.error)
      else setErr(null)
      setSummary(r.data ?? null)
    })
    return () => {
      alive = false
    }
  }, [loadId, loadStatus])

  return (
    <FeatureLock
      featureKey="trip_replay"
      title="Trip replay"
      description="Route replay and trip analytics are available on Professional and Fleet plans."
    >
      <Card className="border-border/70 bg-card/80 p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Route className="h-5 w-5 text-primary" />
              Trip report
            </h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-xl">
              Stops and timing are inferred from sparse ELD samples (~1–2 min); use for coaching and disputes, not legal
              precision.
            </p>
          </div>
          {completedStatuses(loadStatus) && summary != null && (
            <Button asChild size="sm" variant="secondary">
              <Link href={`/dashboard/loads/${loadId}/trip`}>View full replay</Link>
            </Button>
          )}
        </div>

        {!completedStatuses(loadStatus) && (
          <p className="mt-4 text-sm text-muted-foreground">
            Trip in progress. Replay will be available after delivery.
          </p>
        )}

        {completedStatuses(loadStatus) && err && (
          <p className="mt-4 text-sm text-destructive">{err}</p>
        )}

        {completedStatuses(loadStatus) && summary === undefined && !err && (
          <p className="mt-4 text-sm text-muted-foreground">Loading trip summary…</p>
        )}

        {completedStatuses(loadStatus) && summary === null && !err && (
          <div className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              No telemetry available — ELD may not have been connected during this trip, or sync has not run yet.
            </span>
          </div>
        )}

        {completedStatuses(loadStatus) && summary && (
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Distance</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{summary.total_distance_miles.toFixed(1)} mi</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Duration</p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {Math.round(summary.total_duration_seconds / 3600)}h{" "}
                {Math.round((summary.total_duration_seconds % 3600) / 60)}m
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Harsh events</p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {summary.harsh_brake_count +
                  summary.harsh_acceleration_count +
                  summary.harsh_cornering_count +
                  summary.speeding_count}
              </p>
            </div>
            <div className="sm:col-span-3 flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/dashboard/loads/${loadId}/trip`}>
                  <MapPin className="h-4 w-4 mr-1" />
                  Open replay map
                </Link>
              </Button>
            </div>
          </div>
        )}
      </Card>
    </FeatureLock>
  )
}
