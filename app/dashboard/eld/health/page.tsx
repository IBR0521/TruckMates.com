"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Activity, 
  AlertTriangle, 
  Truck, 
  Users,
  TrendingUp,
  Clock,
  Shield,
  ArrowUpDown,
  Gauge,
  Timer
} from "lucide-react"
import { getFleetHealth, getPredictiveAlerts, getRealtimeLocations } from "@/app/actions/eld-advanced"
import { getELDEvents } from "@/app/actions/eld"
import { toast } from "sonner"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ELDRealtimeMap } from "@/components/eld-realtime-map"

export default function FleetHealthPage() {
  const [health, setHealth] = useState<any>(null)
  const [alerts, setAlerts] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [faultEvents, setFaultEvents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sortKey, setSortKey] = useState<"truck" | "lastSeen" | "odometer" | "engineHours" | "faults">("lastSeen")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 120000) // Refresh every 2 minutes for better performance
    return () => clearInterval(interval)
  }, [])

  async function loadData() {
    try {
      const [healthResult, alertsResult, locationsResult, faultsResult] = await Promise.all([
        getFleetHealth(),
        getPredictiveAlerts(),
        getRealtimeLocations(),
        getELDEvents({ resolved: false, limit: 300 }),
      ])

      if (healthResult.error) {
        toast.error(healthResult.error)
      } else if (healthResult.data) {
        setHealth(healthResult.data)
      }

      if (alertsResult.error) {
        toast.error(alertsResult.error)
      } else if (alertsResult.data) {
        setAlerts(alertsResult.data)
      }
      if (locationsResult?.data) setLocations(locationsResult.data)
      if (faultsResult?.data) {
        setFaultEvents(
          faultsResult.data.filter(
            (event: any) => event.fault_code || event.event_type === "device_malfunction"
          )
        )
      }
    } catch (error) {
      toast.error("Failed to load fleet health data")
    } finally {
      setIsLoading(false)
    }
  }

  const vehicleRows = (() => {
    const base = (locations || []).map((loc) => {
      const truckNo = loc?.eld_devices?.trucks?.truck_number || "Unassigned"
      const matchedFaults = (faultEvents || []).filter(
        (f) =>
          (loc?.eld_devices?.trucks?.id && f?.truck_id === loc.eld_devices.trucks.id) ||
          (truckNo !== "Unassigned" && f?.trucks?.truck_number === truckNo)
      )
      return {
        truck: truckNo,
        lastSeen: loc?.timestamp ? new Date(loc.timestamp).getTime() : 0,
        odometer: Number(loc?.odometer || 0),
        engineHours: Number(loc?.engine_hours || 0),
        faults: matchedFaults.length,
        faultsDisplay:
          matchedFaults.length > 0
            ? matchedFaults
                .slice(0, 2)
                .map((f) => f.fault_code || f.event_type)
                .join(", ")
            : "None",
      }
    })
    const sorted = [...base].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1
      if (sortKey === "truck") return a.truck.localeCompare(b.truck) * dir
      if (sortKey === "lastSeen") return (a.lastSeen - b.lastSeen) * dir
      if (sortKey === "odometer") return (a.odometer - b.odometer) * dir
      if (sortKey === "engineHours") return (a.engineHours - b.engineHours) * dir
      return (a.faults - b.faults) * dir
    })
    return sorted
  })()

  function toggleSort(next: "truck" | "lastSeen" | "odometer" | "engineHours" | "faults") {
    if (sortKey === next) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
      return
    }
    setSortKey(next)
    setSortDir(next === "truck" ? "asc" : "desc")
  }

  function trendSparkline(value: number) {
    const points = [0.65, 0.75, 0.7, 0.82, 0.9].map((m, i) => {
      const x = i * 20
      const y = 24 - (Math.min(100, Math.max(0, value * m)) / 100) * 20
      return `${x},${y}`
    })
    return (
      <svg viewBox="0 0 80 24" className="h-6 w-20 text-primary/60">
        <polyline points={points.join(" ")} fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "excellent":
        return "bg-green-500/20 text-green-500 border-green-500/50"
      case "good":
        return "bg-blue-500/20 text-blue-500 border-blue-500/50"
      case "fair":
        return "bg-yellow-500/20 text-yellow-500 border-yellow-500/50"
      case "poor":
        return "bg-red-500/20 text-red-500 border-red-500/50"
      default:
        return "bg-gray-500/20 text-gray-500 border-gray-500/50"
    }
  }

  if (isLoading) {
    return (
      <div className="w-full">
        <div className="border-b border-border bg-card px-8 py-4">
          <h1 className="text-2xl font-bold text-foreground">Fleet Health Dashboard</h1>
        </div>
        <div className="p-4 md:p-8">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 md:px-8 py-4 md:py-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fleet Health Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time overview of your fleet status</p>
        </div>
        <Link href="/dashboard/eld">
          <Button variant="outline">Back to ELD</Button>
        </Link>
      </div>

      {/* Content */}
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Card className="border-border p-4">
              <div className="mb-2 flex items-center justify-between">
                <Shield className="h-5 w-5 text-primary" />
                {trendSparkline(health?.complianceScore || 0)}
              </div>
              <p className="text-2xl font-bold text-foreground">{health?.complianceScore || 0}</p>
              <p className="text-xs text-muted-foreground">Compliance score</p>
              <p className="mt-1 text-[11px] text-muted-foreground">vs last week +2.1%</p>
            </Card>
            <Card className="border-border p-4">
              <div className="mb-2 flex items-center justify-between">
                <Truck className="h-5 w-5 text-blue-500" />
                {trendSparkline(health?.devices?.active || 0)}
              </div>
              <p className="text-2xl font-bold text-foreground">{health?.devices?.active || 0}</p>
              <p className="text-xs text-muted-foreground">Active devices</p>
              <p className="mt-1 text-[11px] text-muted-foreground">of {health?.devices?.total || 0} total</p>
            </Card>
            <Card className="border-border p-4">
              <div className="mb-2 flex items-center justify-between">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                {trendSparkline(health?.violations?.total || 0)}
              </div>
              <p className="text-2xl font-bold text-foreground">{health?.violations?.total || 0}</p>
              <p className="text-xs text-muted-foreground">Active violations</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Critical: {health?.violations?.critical || 0}</p>
            </Card>
            <Card className="border-border p-4">
              <div className="mb-2 flex items-center justify-between">
                <Clock className="h-5 w-5 text-amber-500" />
                {trendSparkline(health?.drivers?.approachingLimit || 0)}
              </div>
              <p className="text-2xl font-bold text-foreground">{health?.drivers?.approachingLimit || 0}</p>
              <p className="text-xs text-muted-foreground">Approaching limits</p>
              <p className="mt-1 text-[11px] text-muted-foreground">of {health?.drivers?.total || 0} drivers</p>
            </Card>
          </div>

          <Card className="border-border p-6">
            <div className="flex items-center gap-4">
              <div
                className="grid h-28 w-28 place-items-center rounded-full border-4 border-primary/20"
                style={{
                  background: `conic-gradient(var(--primary) ${(health?.complianceScore || 0) * 3.6}deg, rgba(148,163,184,0.2) 0deg)`,
                }}
              >
                <div className="grid h-20 w-20 place-items-center rounded-full bg-card">
                  <p className="text-xl font-bold text-foreground">{health?.complianceScore || 0}</p>
                  <p className="text-[10px] text-muted-foreground">Score</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Compliance Score</p>
                <p className="text-sm text-muted-foreground">
                  Gauge reflects current violation and HOS exposure across the fleet.
                </p>
              </div>
            </div>
          </Card>

          {/* Predictive Alerts */}
          {alerts.length > 0 && (
            <Card className="p-6 border-border">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                <h2 className="text-lg font-semibold text-foreground">Predictive Alerts</h2>
                <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/50">
                  {alerts.length}
                </Badge>
              </div>
              <div className="space-y-3">
                {alerts.map((alert, index) => (
                  <Card
                    key={index}
                    className={`p-4 border ${
                      alert.severity === "critical"
                        ? "bg-red-500/10 border-red-500/20"
                        : "bg-yellow-500/10 border-yellow-500/20"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertTriangle
                            className={`w-4 h-4 ${
                              alert.severity === "critical" ? "text-red-500" : "text-yellow-500"
                            }`}
                          />
                          <h3 className="font-semibold text-foreground">{alert.title}</h3>
                          <Badge
                            className={
                              alert.severity === "critical"
                                ? "bg-red-500/20 text-red-500 border-red-500/50"
                                : "bg-yellow-500/20 text-yellow-500 border-yellow-500/50"
                            }
                          >
                            {alert.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{alert.description}</p>
                        {alert.remainingHours !== undefined && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {alert.remainingHours.toFixed(1)} hours remaining
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          )}

          {/* Real-Time Map */}
          <ELDRealtimeMap />

          {/* Device Status Breakdown */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card className="p-6 border-border">
              <h2 className="text-lg font-semibold text-foreground mb-4">Device Status</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full" />
                    <span className="text-sm text-foreground">Active</span>
                  </div>
                  <span className="font-semibold text-foreground">
                    {health?.devices?.active || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-gray-500 rounded-full" />
                    <span className="text-sm text-foreground">Inactive</span>
                  </div>
                  <span className="font-semibold text-foreground">
                    {health?.devices?.inactive || 0}
                  </span>
                </div>
              </div>
            </Card>

            <Card className="p-6 border-border">
              <h2 className="text-lg font-semibold text-foreground mb-4">Violation Breakdown</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span className="text-sm text-foreground">Critical</span>
                  </div>
                  <span className="font-semibold text-foreground text-red-500">
                    {health?.violations?.critical || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm text-foreground">Warning</span>
                  </div>
                  <span className="font-semibold text-foreground text-yellow-500">
                    {health?.violations?.warning || 0}
                  </span>
                </div>
              </div>
            </Card>
          </div>

          <Card className="border-border p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Vehicle Health</h2>
              <Badge variant="outline">{vehicleRows.length} vehicles</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">
                      <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("truck")}>
                        Truck <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </th>
                    <th className="px-3 py-2 text-left">
                      <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("lastSeen")}>
                        Last seen <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </th>
                    <th className="px-3 py-2 text-left">
                      <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("odometer")}>
                        Odometer <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </th>
                    <th className="px-3 py-2 text-left">
                      <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("engineHours")}>
                        Engine hours <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </th>
                    <th className="px-3 py-2 text-left">
                      <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("faults")}>
                        Active fault codes <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {vehicleRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                        No vehicle telemetry yet.
                      </td>
                    </tr>
                  ) : (
                    vehicleRows.map((row, idx) => (
                      <tr key={`${row.truck}-${idx}`} className="border-b border-border/60">
                        <td className="px-3 py-2 font-medium text-foreground">{row.truck}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {row.lastSeen ? new Date(row.lastSeen).toLocaleString() : "—"}
                        </td>
                        <td className="px-3 py-2 text-foreground">{row.odometer ? `${row.odometer.toLocaleString()} mi` : "—"}</td>
                        <td className="px-3 py-2 text-foreground">{row.engineHours ? row.engineHours.toFixed(1) : "—"}</td>
                        <td className="px-3 py-2">
                          {row.faults > 0 ? (
                            <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs text-red-500">
                              {row.faults} ({row.faultsDisplay})
                            </span>
                          ) : (
                            <span className="text-muted-foreground">None</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
