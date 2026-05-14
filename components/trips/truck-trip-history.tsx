"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { FeatureLock } from "@/components/billing/feature-lock"
import { listTripSummariesForTruck, type TripSummaryListRow } from "@/app/actions/trip-reports"
import { Route } from "lucide-react"

export function TruckTripHistorySection({ truckId }: { truckId: string }) {
  const [rows, setRows] = useState<TripSummaryListRow[] | null>(null)

  useEffect(() => {
    let alive = true
    void listTripSummariesForTruck(truckId).then((r) => {
      if (!alive) return
      if (!r.error && r.data) setRows(r.data)
      else setRows([])
    })
    return () => {
      alive = false
    }
  }, [truckId])

  return (
    <FeatureLock
      featureKey="trip_replay"
      title="Trip history"
      description="Completed-load trip replays are available on Professional and Fleet plans."
    >
      <Card className="border-border/70 bg-card/80 p-4 md:p-6">
        <div className="flex items-center gap-2 mb-3">
          <Route className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Recent trips</h3>
        </div>
        {!rows || rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No completed trip summaries for this truck yet.</p>
        ) : (
          <ul className="divide-y divide-border/50">
            {rows.map((t) => (
              <li key={t.load_id} className="py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                <div>
                  <span className="font-medium text-foreground">{t.shipment_number || t.load_id.slice(0, 8)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {new Date(t.trip_started_at).toLocaleString()} · {t.total_distance_miles.toFixed(0)} mi ·{" "}
                    {t.harsh_total} events
                  </span>
                </div>
                <Link href={`/dashboard/loads/${t.load_id}/trip`} className="text-primary text-xs hover:underline">
                  Replay →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </FeatureLock>
  )
}
