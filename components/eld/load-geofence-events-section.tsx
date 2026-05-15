"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { listGeofenceEvents, type GeofenceEventListItem } from "@/app/actions/geofences"
import { FeatureLock } from "@/components/billing/feature-lock"
import { toast } from "sonner"

export function LoadGeofenceEventsSection({ loadId }: { loadId: string }) {
  const [rows, setRows] = useState<GeofenceEventListItem[]>([])

  useEffect(() => {
    void listGeofenceEvents({ loadId, daysBack: 60, limit: 100 }).then((r) => {
      if (r.error) toast.error(r.error)
      else setRows(r.data ?? [])
    })
  }, [loadId])

  return (
    <FeatureLock
      featureKey="geofencing_automation"
      title="Location events"
      description="Geofence enter/exit tied to this load when telemetry matches."
    >
      <Card className="border-border/70 p-4 md:p-6">
        <h3 className="text-lg font-semibold mb-2">Location events</h3>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No geofence events recorded for this load yet.</p>
        ) : (
          <ul className="text-sm space-y-2 max-h-56 overflow-y-auto">
            {rows.map((e) => (
              <li key={e.id} className="border-b border-border/30 pb-2">
                <span className="font-medium">{e.event_type}</span> · {new Date(e.occurred_at).toLocaleString()}
                {e.dwell_seconds != null ? ` · dwell ~${Math.round(e.dwell_seconds / 60)}m` : ""}
                {e.triggered_status_update ? ` · status ${e.previous_load_status}→${e.new_load_status}` : ""}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </FeatureLock>
  )
}
