"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { FeatureLock } from "@/components/billing/feature-lock"
import { listGeofenceEvents, markGeofenceDetentionReviewed, type GeofenceEventListItem } from "@/app/actions/geofences"
import { toast } from "sonner"
import { errorMessage } from "@/lib/error-message"

export default function DetentionCandidatesPage() {
  const [rows, setRows] = useState<GeofenceEventListItem[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const r = await listGeofenceEvents({ daysBack: 30, eventType: "exit", limit: 500 })
      if (r.error) {
        toast.error(r.error)
        setRows([])
      } else {
        const long = (r.data ?? []).filter((e) => (e.dwell_seconds ?? 0) >= 7200 && e.detention_billing_status === "candidate")
        setRows(long)
      }
    } catch (e: unknown) {
      toast.error(errorMessage(e, "Failed to load"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const mark = async (id: string, status: "reviewed" | "ignored") => {
    const r = await markGeofenceDetentionReviewed({ eventId: id, status })
    if (r.error) toast.error(r.error)
    else {
      toast.success("Updated")
      void load()
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Detention candidates</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Exit events with ~2+ hours dwell (from sparse ELD). “Add to invoice” is deferred — mark reviewed when handled.
        </p>
      </div>

      <FeatureLock
        featureKey="geofencing_automation"
        title="Detention candidates"
        description="Geofence automation is included from Starter; billing automation can follow in a later release."
      >
        <Card className="border-border/70 p-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open detention candidates.</p>
          ) : (
            <ul className="divide-y divide-border/50 text-sm">
              {rows.map((e) => (
                <li key={e.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {e.event_type} · {Math.round((e.dwell_seconds ?? 0) / 3600)}h dwell
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(e.occurred_at).toLocaleString()} · load {e.load_id?.slice(0, 8) ?? "—"} · geofence{" "}
                      {e.geofence_id.slice(0, 8)}…
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => mark(e.id, "reviewed")}>
                      Mark reviewed
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => mark(e.id, "ignored")}>
                      Ignore
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </FeatureLock>
    </div>
  )
}
