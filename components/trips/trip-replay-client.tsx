"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  getTripSummary,
  getTripTelemetry,
  refreshTripSummary,
  exportTripReport,
  type TelemetryPoint,
} from "@/app/actions/trip-reports"
import type { TripSummary, TripStop } from "@/lib/eld/trip-aggregator"
import type { HarshEvent } from "@/app/actions/eld-events"
import { toast } from "sonner"
import { errorMessage } from "@/lib/error-message"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { ArrowLeft, CheckCircle2, RefreshCw, XCircle, FileDown } from "lucide-react"

/** Minimal Google Maps JS surface used here (avoids @types/google.maps dependency). */
type LatLng = { lat: number; lng: number }
type MapInstance = { fitBounds: (b: BoundsInstance) => void }
type BoundsInstance = { extend: (p: LatLng) => void }
type PolylineInstance = { setMap: (m: MapInstance | null) => void }
type MarkerInstance = { setMap: (m: MapInstance | null) => void }
type MapsNamespace = {
  LatLngBounds: new () => BoundsInstance
  Map: new (el: HTMLElement, opts?: Record<string, unknown>) => MapInstance
  Polyline: new (opts: Record<string, unknown>) => PolylineInstance
  Marker: new (opts: Record<string, unknown>) => MarkerInstance
  SymbolPath: { CIRCLE: unknown }
}

function getMapsNamespace(): MapsNamespace {
  const win = window as unknown as { google?: { maps?: MapsNamespace } }
  const maps = win.google?.maps
  if (!maps) throw new Error("Google Maps not available")
  return maps
}

type Banner = {
  shipment_number: string
  origin: string
  destination: string
  load_date: string | null
  actual_delivery: string | null
  driverLabel: string | null
  truckLabel: string | null
}

function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"))
  const w = window as unknown as { google?: { maps?: { Map?: unknown } } }
  if (w.google?.maps?.Map) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="maps.googleapis.com"]')
    if (existing) {
      const iv = setInterval(() => {
        const ww = window as unknown as { google?: { maps?: { Map?: unknown } } }
        if (ww.google?.maps?.Map) {
          clearInterval(iv)
          resolve()
        }
      }, 100)
      setTimeout(() => {
        clearInterval(iv)
        reject(new Error("Google Maps timeout"))
      }, 12000)
      return
    }

    let apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    const finish = (key: string | undefined) => {
      if (!key) {
        reject(new Error("Missing Google Maps API key"))
        return
      }
      const s = document.createElement("script")
      s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=geometry&loading=async`
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => reject(new Error("Google Maps script failed"))
      document.head.appendChild(s)
    }

    if (!apiKey) {
      void fetch("/api/google-maps-key")
        .then((r) => r.json())
        .then((d: { apiKey?: string }) => finish(d.apiKey))
        .catch(() => finish(undefined))
    } else {
      finish(apiKey)
    }
  })
}

function sevColor(sev: string): string {
  if (sev === "critical") return "#f43f5e"
  if (sev === "high") return "#fb923c"
  return "#facc15"
}

export function TripReplayClient({ loadId, banner }: { loadId: string; banner: Banner }) {
  const mapEl = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapInstance | null>(null)
  const polyRef = useRef<PolylineInstance | null>(null)
  const markersRef = useRef<MarkerInstance[]>([])

  const [summary, setSummary] = useState<TripSummary | null>(null)
  const [points, setPoints] = useState<TelemetryPoint[]>([])
  const [events, setEvents] = useState<HarshEvent[]>([])
  const [stops, setStops] = useState<TripStop[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [mapErr, setMapErr] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [s, t] = await Promise.all([
        getTripSummary(loadId),
        getTripTelemetry({ loadId, simplify: true }),
      ])
      if (s.error) toast.error(s.error)
      setSummary(s.data ?? null)
      if (t.error) {
        toast.error(t.error)
        setPoints([])
        setEvents([])
        setStops([])
      } else if (t.data) {
        setPoints(t.data.points)
        setEvents(t.data.events)
        setStops(t.data.stops)
      }
    } catch (e: unknown) {
      toast.error(errorMessage(e, "Failed to load trip data"))
    } finally {
      setLoading(false)
    }
  }, [loadId])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!mapEl.current || points.length < 2) return
    let cancelled = false
    void (async () => {
      try {
        await loadGoogleMaps()
        if (cancelled || !mapEl.current) return
        const maps = getMapsNamespace()
        const path = points.map((p) => ({ lat: p.location_lat, lng: p.location_lng }))
        const bounds = new maps.LatLngBounds()
        for (const pt of path) bounds.extend(pt)

        if (!mapRef.current) {
          mapRef.current = new maps.Map(mapEl.current, {
            zoom: 8,
            center: path[Math.floor(path.length / 2)],
            mapTypeControl: false,
            streetViewControl: false,
          })
        } else {
          mapRef.current.fitBounds(bounds)
        }

        if (polyRef.current) polyRef.current.setMap(null)
        polyRef.current = new maps.Polyline({
          path,
          strokeColor: "#2563eb",
          strokeOpacity: 0.95,
          strokeWeight: 4,
          map: mapRef.current,
        })

        for (const m of markersRef.current) m.setMap(null)
        markersRef.current = []

        const mk = (pos: LatLng, title: string, color: string, label?: string) => {
          const opts: Record<string, unknown> = {
            position: pos,
            map: mapRef.current,
            title,
            icon: {
              path: maps.SymbolPath.CIRCLE,
              scale: label ? 10 : 8,
              fillColor: color,
              fillOpacity: 1,
              strokeWeight: 1,
              strokeColor: "#0f172a",
            },
          }
          if (label) opts.label = { text: label, color: "#ffffff" }
          markersRef.current.push(new maps.Marker(opts))
        }

        mk(path[0], "Trip start", "#22c55e")
        mk(path[path.length - 1], "Trip end", "#ef4444")

        stops.forEach((st, i) => {
          mk({ lat: st.lat, lng: st.lng }, `${st.type} stop`, "#a855f7", String(i + 1))
        })

        events.forEach((ev) => {
          if (ev.location_lat == null || ev.location_lng == null) return
          mk({ lat: ev.location_lat, lng: ev.location_lng }, `${ev.event_type} (${ev.severity})`, sevColor(ev.severity))
        })

        mapRef.current.fitBounds(bounds)
        setMapErr(null)
      } catch (e: unknown) {
        setMapErr(errorMessage(e, "Map failed to load"))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [points, events, stops])

  const chartData = points.map((p) => ({
    t: new Date(p.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    speed: p.speed_mph ?? 0,
  }))

  const onRefresh = async () => {
    setRefreshing(true)
    try {
      const r = await refreshTripSummary(loadId)
      if (r.error) toast.error(r.error)
      else {
        toast.success("Trip summary refreshed")
        await reload()
      }
    } catch (e: unknown) {
      toast.error(errorMessage(e, "Refresh failed"))
    } finally {
      setRefreshing(false)
    }
  }

  const onExport = async () => {
    const r = await exportTripReport(loadId)
    if (r.error) toast.error(r.error)
    else if (r.data?.pdfUrl) toast.success("Report ready")
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border/60 bg-card/40 px-4 py-3 flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/loads/${loadId}`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to load
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold truncate">Trip replay · {banner.shipment_number || loadId}</h1>
          <p className="text-xs text-muted-foreground truncate">
            {banner.origin} → {banner.destination}
            {banner.load_date ? ` · Pickup ${new Date(banner.load_date).toLocaleDateString()}` : ""}
            {banner.actual_delivery ? ` · Delivered ${new Date(banner.actual_delivery).toLocaleString()}` : ""}
            {banner.driverLabel ? ` · ${banner.driverLabel}` : ""}
            {banner.truckLabel ? ` · ${banner.truckLabel}` : ""}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing || loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
          Refresh data
        </Button>
        <Button variant="outline" size="sm" onClick={onExport} disabled>
          <FileDown className="h-4 w-4 mr-1" />
          Export PDF
        </Button>
      </div>

      <p className="px-4 py-2 text-[11px] text-muted-foreground border-b border-border/40">
        Privacy: trip replay shows vehicle positions over time. Access is limited to users in your company who can open
        this load.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-0 lg:gap-4 p-4">
        <Card className="overflow-hidden border-border/70 min-h-[420px] lg:min-h-[calc(100vh-220px)]">
          <div ref={mapEl} className="h-[420px] lg:h-full w-full bg-muted/20" />
          {mapErr && <p className="p-2 text-sm text-destructive">{mapErr}</p>}
          {loading && <p className="p-2 text-sm text-muted-foreground">Loading map data…</p>}
          {!loading && points.length < 2 && (
            <p className="p-3 text-sm text-muted-foreground">
              Not enough GPS samples to draw a route (need at least two points in the trip window).
            </p>
          )}
        </Card>

        <div className="space-y-4 mt-4 lg:mt-0">
          {summary && (
            <Card className="p-4 border-border/70 space-y-3">
              <h2 className="text-sm font-semibold">Summary</h2>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Distance</p>
                  <p className="font-medium">{summary.total_distance_miles.toFixed(1)} mi</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Drive / idle / off</p>
                  <p className="font-medium text-xs">
                    {Math.round(summary.active_drive_seconds / 60)}m / {Math.round(summary.idle_seconds / 60)}m /{" "}
                    {Math.round(summary.stopped_seconds / 60)}m
                  </p>
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">On-time pickup</span>
                  {summary.on_time_pickup === true && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                  {summary.on_time_pickup === false && <XCircle className="h-4 w-4 text-rose-500" />}
                  {summary.on_time_pickup == null && <span className="text-xs">—</span>}
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">On-time delivery</span>
                  {summary.on_time_delivery === true && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                  {summary.on_time_delivery === false && <XCircle className="h-4 w-4 text-rose-500" />}
                  {summary.on_time_delivery == null && <span className="text-xs">—</span>}
                </div>
              </div>
            </Card>
          )}

          <Card className="p-4 border-border/70">
            <h2 className="text-sm font-semibold mb-2">Speed (sampled)</h2>
            {chartData.length > 1 ? (
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="t" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} unit=" mph" width={44} />
                    <Tooltip />
                    <Line type="monotone" dataKey="speed" stroke="#38bdf8" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No speed series for this window.</p>
            )}
          </Card>

          <Card className="p-4 border-border/70">
            <h2 className="text-sm font-semibold mb-2">Stops ({stops.length})</h2>
            <ul className="text-xs space-y-2 max-h-40 overflow-y-auto">
              {stops.length === 0 ? (
                <li className="text-muted-foreground">No stops detected (sparse data).</li>
              ) : (
                stops.map((s, i) => (
                  <li key={`${s.started_at}-${i}`} className="border-b border-border/30 pb-2">
                    <span className="font-medium">{s.type}</span> · {Math.round(s.duration_seconds / 60)} min
                    <br />
                    <span className="text-muted-foreground">
                      {new Date(s.started_at).toLocaleString()} – {new Date(s.ended_at).toLocaleString()}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </Card>

          <Card className="p-4 border-border/70">
            <h2 className="text-sm font-semibold mb-2">Harsh events ({events.length})</h2>
            <ul className="text-xs space-y-2 max-h-48 overflow-y-auto">
              {events.length === 0 ? (
                <li className="text-muted-foreground">None in this window.</li>
              ) : (
                events.map((ev) => (
                  <li key={ev.id} className="flex justify-between gap-2 border-b border-border/30 pb-2">
                    <span>{ev.event_type.replace(/_/g, " ")}</span>
                    <span className="text-muted-foreground">{ev.severity}</span>
                  </li>
                ))
              )}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}
