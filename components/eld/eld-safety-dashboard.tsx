"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { ChevronDown, ChevronRight, MapPin } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FeatureLock } from "@/components/billing/feature-lock"
import type { HarshEvent } from "@/app/actions/eld-events"
import {
  bulkMarkHarshEventsReviewed,
  getEldSafetyFilterOptions,
  getHarshEventsForCompany,
  getIdleSessionsForCompany,
  markEventReviewed,
} from "@/app/actions/eld-events"

const EVENT_TYPES = [
  "harsh_brake",
  "harsh_acceleration",
  "harsh_cornering",
  "speeding",
  "mobile_usage",
  "seatbelt_violation",
  "following_distance",
  "rolling_stop",
  "other",
] as const

const SEVERITIES = ["low", "medium", "high", "critical"] as const

function sevClass(s: string) {
  switch (s) {
    case "critical":
      return "bg-rose-500/15 text-rose-300 border-rose-500/30"
    case "high":
      return "bg-orange-500/15 text-orange-300 border-orange-500/30"
    case "low":
      return "bg-emerald-500/10 text-emerald-300 border-emerald-500/25"
    default:
      return "bg-amber-500/10 text-amber-200 border-amber-500/25"
  }
}

function IdleSidebar({ days }: { days: number }) {
  const [hours, setHours] = useState(0)
  const [cost, setCost] = useState(0)

  useEffect(() => {
    let alive = true
    void getIdleSessionsForCompany({ daysBack: days }).then((r) => {
      if (!alive) return
      if (r.error) {
        toast.error(r.error)
        setHours(0)
        setCost(0)
        return
      }
      const list = r.data || []
      const h = list.reduce((s, x) => s + (Number(x.duration_seconds || 0) || 0), 0) / 3600
      const c = list.reduce((s, x) => s + (Number(x.estimated_fuel_cost_usd || 0) || 0), 0)
      setHours(h)
      setCost(c)
    })
    return () => {
      alive = false
    }
  }, [days])

  return (
    <div className="border-t border-border/60 pt-4 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Idle (same range)</p>
      <p className="text-sm text-foreground">{hours.toFixed(1)} h total</p>
      <p className="text-xs text-muted-foreground">Est. cost ~${cost.toFixed(0)}</p>
      <p className="text-[10px] leading-snug text-muted-foreground">
        Idle data is estimated from periodic ELD samples and may not capture brief idle periods.
      </p>
    </div>
  )
}

export function EldSafetyDashboard() {
  const [days, setDays] = useState("7")
  const [driverId, setDriverId] = useState<string>("all")
  const [truckId, setTruckId] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [sevFilter, setSevFilter] = useState<string>("all")
  const [events, setEvents] = useState<HarshEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [options, setOptions] = useState<{ drivers: { id: string; name: string | null }[]; trucks: { id: string; truck_number: string | null }[] } | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [bulkNote, setBulkNote] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    const d = Number(days) || 7
    const res = await getHarshEventsForCompany({
      daysBack: d,
      driverId: driverId === "all" ? undefined : driverId,
      truckId: truckId === "all" ? undefined : truckId,
      eventTypes: typeFilter === "all" ? undefined : [typeFilter],
      severities: sevFilter === "all" ? undefined : [sevFilter],
      limit: 200,
    })
    setLoading(false)
    if (res.error) {
      toast.error(res.error)
      setEvents([])
      return
    }
    setEvents(res.data || [])
  }, [days, driverId, truckId, typeFilter, sevFilter])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    let alive = true
    void getEldSafetyFilterOptions().then((r) => {
      if (!alive || r.error || !r.data) return
      setOptions(r.data)
    })
    return () => {
      alive = false
    }
  }, [])

  const selectedIds = useMemo(() => Object.entries(selected).filter(([, v]) => v).map(([k]) => k), [selected])

  async function onMarkReviewed(id: string) {
    const res = await markEventReviewed({ eventId: id })
    if (res.error) return toast.error(res.error)
    toast.success("Marked reviewed")
    void load()
  }

  async function onBulkReview() {
    if (selectedIds.length === 0) return toast.message("Select events first")
    const res = await bulkMarkHarshEventsReviewed({ eventIds: selectedIds, coachingNote: bulkNote || undefined })
    if (res.error) return toast.error(res.error)
    toast.success(`Updated ${res.data?.updated ?? 0} events`)
    setSelected({})
    setBulkNote("")
    void load()
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">ELD safety events</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Harsh driving events from connected providers. Open an event for map coordinates and coaching notes.
        </p>
      </div>

      <FeatureLock
        featureKey="eld_harsh_events"
        title="ELD safety events"
        description="Professional and Fleet include harsh-event sync from Samsara, Motive, and Geotab."
      >
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <Card className="h-fit border-border/70 bg-card/80 p-4 space-y-4">
            <div className="space-y-2">
              <Label>Date range</Label>
              <Select value={days} onValueChange={setDays}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="14">Last 14 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Driver</Label>
              <Select value={driverId} onValueChange={setDriverId}>
                <SelectTrigger>
                  <SelectValue placeholder="All drivers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All drivers</SelectItem>
                  {(options?.drivers || []).map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name || d.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Truck</Label>
              <Select value={truckId} onValueChange={setTruckId}>
                <SelectTrigger>
                  <SelectValue placeholder="All trucks" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All trucks</SelectItem>
                  {(options?.trucks || []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.truck_number || t.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Event type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {EVENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Severity</Label>
              <Select value={sevFilter} onValueChange={setSevFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {SEVERITIES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" variant="secondary" className="w-full" onClick={() => void load()}>
              Apply
            </Button>

            <FeatureLock
              featureKey="eld_idle_tracking"
              title="Idle sessions"
              description="Idle fuel estimates are on Professional+."
            >
              <IdleSidebar days={Number(days) || 7} />
            </FeatureLock>
          </Card>

          <div className="space-y-4">
            <Card className="border-border/70 bg-card/80 p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[200px] space-y-2">
                  <Label>Bulk coaching note (optional)</Label>
                  <Textarea value={bulkNote} onChange={(e) => setBulkNote(e.target.value)} rows={2} className="resize-none" />
                </div>
                <Button type="button" onClick={() => void onBulkReview()} disabled={selectedIds.length === 0}>
                  Mark selected reviewed ({selectedIds.length})
                </Button>
              </div>
            </Card>

            <Card className="border-border/70 bg-card/80">
              {loading ? (
                <p className="p-6 text-sm text-muted-foreground">Loading…</p>
              ) : events.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No events in this range. Ensure ELD devices are active and cron is running.</p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {events.map((ev) => {
                    const open = expanded[ev.id] === true
                    return (
                      <li key={ev.id} className="p-4">
                        <div className="flex flex-wrap items-start gap-3">
                          <Checkbox
                            checked={Boolean(selected[ev.id])}
                            onCheckedChange={(c) => setSelected((s) => ({ ...s, [ev.id]: Boolean(c) }))}
                            aria-label="Select event"
                          />
                          <button
                            type="button"
                            className="mt-0.5 text-muted-foreground hover:text-foreground"
                            onClick={() => setExpanded((x) => ({ ...x, [ev.id]: !open }))}
                            aria-expanded={open}
                          >
                            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className={sevClass(ev.severity)}>
                                {ev.severity}
                              </Badge>
                              <span className="text-sm font-medium text-foreground">{ev.event_type.replace(/_/g, " ")}</span>
                              <span className="text-xs text-muted-foreground">{new Date(ev.occurred_at).toLocaleString()}</span>
                            </div>
                            <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" aria-hidden />
                              {ev.truck?.truck_number ? `Truck ${ev.truck.truck_number}` : "Truck unknown"}
                              {ev.driver?.name ? ` · ${ev.driver.name}` : ""}
                              {ev.location_lat != null && ev.location_lng != null
                                ? ` · ${Number(ev.location_lat).toFixed(4)}, ${Number(ev.location_lng).toFixed(4)}`
                                : ""}
                            </p>
                            {open && (
                              <div className="mt-3 space-y-2 rounded-md border border-border/60 bg-muted/20 p-3 text-xs">
                                <p className="font-medium text-foreground">Map preview</p>
                                {ev.location_lat != null && ev.location_lng != null ? (
                                  <Link
                                    className="text-primary underline"
                                    target="_blank"
                                    rel="noreferrer"
                                    href={`https://www.openstreetmap.org/?mlat=${encodeURIComponent(String(ev.location_lat))}&mlon=${encodeURIComponent(String(ev.location_lng))}#map=14/${ev.location_lat}/${ev.location_lng}`}
                                  >
                                    Open location in OpenStreetMap
                                  </Link>
                                ) : (
                                  <span className="text-muted-foreground">No coordinates on file.</span>
                                )}
                                <p className="font-medium text-foreground pt-2">Provider payload</p>
                                <pre className="max-h-40 overflow-auto rounded bg-background/80 p-2 text-[10px] leading-relaxed">
                                  {JSON.stringify(ev.raw_payload, null, 2)}
                                </pre>
                                <div className="flex flex-wrap gap-2 pt-2">
                                  {!ev.reviewed ? (
                                    <Button size="sm" type="button" variant="secondary" onClick={() => void onMarkReviewed(ev.id)}>
                                      Mark reviewed
                                    </Button>
                                  ) : (
                                    <span className="text-emerald-600 dark:text-emerald-400">Reviewed</span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </FeatureLock>
    </div>
  )
}
