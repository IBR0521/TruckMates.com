"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FeatureLock } from "@/components/billing/feature-lock"
import { getHarshEventCountsForDriver, getHarshEventsForCompany } from "@/app/actions/eld-events"
import type { HarshEvent } from "@/app/actions/eld-events"

function sevClass(s: string) {
  switch (s) {
    case "critical":
      return "bg-rose-500/15 text-rose-300 border-rose-500/30"
    case "high":
      return "bg-orange-500/15 text-orange-300 border-orange-500/30"
    default:
      return "bg-amber-500/10 text-amber-200 border-amber-500/25"
  }
}

export function DriverSafetyEventsSection({ driverId }: { driverId: string }) {
  const [counts, setCounts] = useState<{ d7: number; d30: number; d90: number } | null>(null)
  const [events, setEvents] = useState<HarshEvent[]>([])

  useEffect(() => {
    let alive = true
    void Promise.all([
      getHarshEventCountsForDriver({ driverId }),
      getHarshEventsForCompany({ driverId, daysBack: 30, limit: 15 }),
    ]).then(([c, e]) => {
      if (!alive) return
      if (!c.error && c.data) setCounts(c.data)
      if (!e.error && e.data) setEvents(e.data)
    })
    return () => {
      alive = false
    }
  }, [driverId])

  return (
    <FeatureLock
      featureKey="eld_harsh_events"
      title="Driver safety events"
      description="Connect ELDs on Professional+ to see harsh events for this driver."
    >
      <Card className="border-border/70 bg-card/80 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-foreground">Safety events</h3>
          <Link href="/dashboard/eld/safety" className="text-sm text-primary hover:underline">
            Company-wide safety
          </Link>
        </div>
        {counts && (
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Badge variant="secondary">7d: {counts.d7}</Badge>
            <Badge variant="secondary">30d: {counts.d30}</Badge>
            <Badge variant="secondary">90d: {counts.d90}</Badge>
          </div>
        )}
        <ul className="mt-4 divide-y divide-border/50">
          {events.length === 0 ? (
            <li className="py-3 text-sm text-muted-foreground">No recent harsh events for this driver.</li>
          ) : (
            events.map((ev) => (
              <li key={ev.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span className="font-medium text-foreground">{ev.event_type.replace(/_/g, " ")}</span>
                <Badge variant="outline" className={sevClass(ev.severity)}>
                  {ev.severity}
                </Badge>
                <span className="w-full text-xs text-muted-foreground md:w-auto">
                  {new Date(ev.occurred_at).toLocaleString()}
                </span>
              </li>
            ))
          )}
        </ul>
      </Card>
    </FeatureLock>
  )
}
