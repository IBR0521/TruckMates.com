"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { FeatureLock } from "@/components/billing/feature-lock"
import { listGeofenceEvents, type GeofenceEventListItem } from "@/app/actions/geofences"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

export default function GeofenceEventsPage() {
  const [rows, setRows] = useState<GeofenceEventListItem[]>([])
  const [eventType, setEventType] = useState<string>("all")

  useEffect(() => {
    void listGeofenceEvents({
      daysBack: 14,
      eventType: eventType === "all" ? undefined : (eventType as "enter" | "exit"),
      limit: 300,
    }).then((r) => {
      if (r.error) toast.error(r.error)
      else setRows(r.data ?? [])
    })
  }, [eventType])

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-4">
      <div className="text-xs text-muted-foreground">
        <Link href="/dashboard/eld/geofences" className="text-primary hover:underline">
          ← Geofences
        </Link>
      </div>
      <FeatureLock featureKey="geofencing_automation" title="Geofence events" description="Telemetry-driven enter/exit stream.">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">Geofence events</h1>
          <Select value={eventType} onValueChange={setEventType}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="enter">Enter</SelectItem>
              <SelectItem value="exit">Exit</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Card className="mt-4 border-border/70 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-muted-foreground">
                <th className="p-2">Time</th>
                <th className="p-2">Event</th>
                <th className="p-2">Geofence</th>
                <th className="p-2">Truck</th>
                <th className="p-2">Load</th>
                <th className="p-2">Dwell</th>
                <th className="p-2">Status auto</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-b border-border/40">
                  <td className="p-2 whitespace-nowrap">{new Date(e.occurred_at).toLocaleString()}</td>
                  <td className="p-2">{e.event_type}</td>
                  <td className="p-2 font-mono text-xs">{e.geofence_id.slice(0, 8)}…</td>
                  <td className="p-2 font-mono text-xs">{e.truck_id?.slice(0, 8) ?? "—"}</td>
                  <td className="p-2 font-mono text-xs">{e.load_id?.slice(0, 8) ?? "—"}</td>
                  <td className="p-2">{e.dwell_seconds != null ? `${Math.round(e.dwell_seconds / 60)}m` : "—"}</td>
                  <td className="p-2">{e.triggered_status_update ? `${e.previous_load_status}→${e.new_load_status}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </FeatureLock>
    </div>
  )
}
