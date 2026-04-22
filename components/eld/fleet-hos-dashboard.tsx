"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Search, Truck } from "lucide-react"
import { toast } from "sonner"
import { getFleetHOSSnapshot, type FleetHosSnapshotRow } from "@/app/actions/eld-advanced"
import { cn } from "@/lib/utils"

function parseClockToMinutes(s: string): number {
  if (s === "—") return -1
  const h = s.match(/(\d+)h/)
  const m = s.match(/(\d+)m/)
  const hours = h ? parseInt(h[1], 10) : 0
  const mins = m ? parseInt(m[1], 10) : 0
  return hours * 60 + mins
}

function getRowBorderClass(row: FleetHosSnapshotRow): string {
  if (row.rowTone === "violation") return "border-l-red-500/70"
  if (row.rowTone === "driving") return "border-l-emerald-500/70"
  if (row.rowTone === "on_duty") return "border-l-amber-500/70"
  return "border-l-slate-500/50"
}

function getStatusBadgeClass(row: FleetHosSnapshotRow): string {
  if (row.rowTone === "violation") return "bg-red-500/15 text-red-500 border-red-500/30"
  if (row.dutyKey === "driving") return "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
  if (row.dutyKey === "on_duty") return "bg-amber-500/15 text-amber-500 border-amber-500/30"
  if (row.dutyKey === "sleeper_berth") return "bg-orange-500/15 text-orange-500 border-orange-500/30"
  return "bg-slate-500/15 text-slate-500 border-slate-500/30"
}

function normalizeStatusLabel(row: FleetHosSnapshotRow): string {
  if (row.rowTone === "violation") return "VIOLATION"
  if (row.dutyKey === "driving") return "DRIVING"
  if (row.dutyKey === "on_duty") return "ON DUTY"
  if (row.dutyKey === "sleeper_berth") return "SLEEPER"
  return "OFF DUTY"
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "DR"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase()
}

function cityStateFromLocation(raw: string | null): string {
  if (!raw) return "Unknown location"
  const parts = raw.split(",").map((x) => x.trim()).filter(Boolean)
  if (parts.length >= 2) return `${parts[parts.length - 2]}, ${parts[parts.length - 1]}`
  return raw
}

function barColor(minutesLeft: number): string {
  if (minutesLeft >= 0 && minutesLeft < 120) return "[&>div]:bg-red-500"
  return "[&>div]:bg-primary"
}

function pctFromRemaining(minutesLeft: number, maxMinutes: number): number {
  if (minutesLeft < 0) return 0
  const used = Math.max(0, maxMinutes - minutesLeft)
  return Math.min(100, (used / maxMinutes) * 100)
}

function dotClass(name: "emerald" | "blue" | "amber" | "red"): string {
  if (name === "emerald") return "bg-emerald-500"
  if (name === "blue") return "bg-blue-500"
  if (name === "amber") return "bg-amber-500"
  return "bg-red-500"
}

function getSortWeight(row: FleetHosSnapshotRow): number {
  if (row.rowTone === "violation") return 0
  if (row.rowTone === "driving") return 1
  if (row.rowTone === "on_duty") return 2
  return 3
}

function sortRows(rows: FleetHosSnapshotRow[]): FleetHosSnapshotRow[] {
  return [...rows].sort((a, b) => {
    const tone = getSortWeight(a) - getSortWeight(b)
    if (tone !== 0) return tone
    return parseClockToMinutes(a.drivingLeftDisplay) - parseClockToMinutes(b.drivingLeftDisplay)
  })
}

function getProgressItems(row: FleetHosSnapshotRow) {
  const driveMin = parseClockToMinutes(row.drivingLeftDisplay)
  const shiftMin = parseClockToMinutes(row.onDutyLeftDisplay)
  // Snapshot currently exposes driving + on-duty clocks; use on-duty as cycle proxy in UI.
  const cycleMin = parseClockToMinutes(row.onDutyLeftDisplay)
  return [
    { label: "Drive remaining", display: row.drivingLeftDisplay, minutes: driveMin, max: 11 * 60 },
    { label: "Shift remaining", display: row.onDutyLeftDisplay, minutes: shiftMin, max: 14 * 60 },
    { label: "Cycle remaining", display: row.onDutyLeftDisplay, minutes: cycleMin, max: 70 * 60 },
  ]
}

function DriverStatusCard({ row }: { row: FleetHosSnapshotRow }) {
  const statusLabel = normalizeStatusLabel(row)
  const progressItems = getProgressItems(row)
  return (
    <Card className={cn("border-l-2 border-border/70 bg-card/80 p-4 shadow-none", getRowBorderClass(row))}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
            {initials(row.driverName)}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">{row.driverName}</p>
            <p className="truncate text-xs text-muted-foreground">{cityStateFromLocation(row.lastLocation)}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {row.openViolationCount > 0 ? (
            <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-500">
              {row.openViolationCount} violation{row.openViolationCount === 1 ? "" : "s"}
            </Badge>
          ) : null}
          <Badge variant="outline" className={getStatusBadgeClass(row)}>
            {statusLabel}
          </Badge>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-3">
        {progressItems.map((item) => (
          <div key={item.label} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{item.label}</span>
              <span className={cn("font-medium tabular-nums", item.minutes >= 0 && item.minutes < 120 ? "text-red-500" : "text-foreground")}>
                {item.display}
              </span>
            </div>
            <Progress value={pctFromRemaining(item.minutes, item.max)} className={cn("h-2", barColor(item.minutes))} />
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Truck className="h-3.5 w-3.5" />
        <span>Truck {row.truckLabel || "—"}</span>
      </div>
    </Card>
  )
}

function KpiPill({ label, value, dot }: { label: string; value: number; dot: "emerald" | "blue" | "amber" | "red" }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 shadow-none">
      <div className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", dotClass(dot))} />
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground">{label}</span>
      </div>
      <p className="mt-1 text-base font-medium tabular-nums text-foreground/90">{value}</p>
    </div>
  )
}

export function FleetHosDashboard() {
  const [rows, setRows] = useState<FleetHosSnapshotRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getFleetHOSSnapshot()
      if (res.error) {
        toast.error(res.error)
        setRows([])
      } else {
        setRows(res.data || [])
      }
    } catch {
      toast.error("Failed to load fleet HOS")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const id = setInterval(() => void load(), 60_000)
    return () => clearInterval(id)
  }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = q
      ? rows.filter(
          (r) =>
            r.driverName.toLowerCase().includes(q) ||
            r.truckLabel.toLowerCase().includes(q) ||
            (r.lastLocation && r.lastLocation.toLowerCase().includes(q))
        )
      : rows
    return sortRows(base)
  }, [rows, query])

  const kpis = useMemo(() => {
    const totalDrivers = filtered.length
    const drivingCount = filtered.filter((r) => r.dutyKey === "driving").length
    const approachingCount = filtered.filter((r) => {
      const driveMin = parseClockToMinutes(r.drivingLeftDisplay)
      const shiftMin = parseClockToMinutes(r.onDutyLeftDisplay)
      return (driveMin >= 0 && driveMin < 120) || (shiftMin >= 0 && shiftMin < 120)
    }).length
    const violationsCount = filtered.reduce((sum, r) => sum + r.openViolationCount, 0)
    return { totalDrivers, drivingCount, approachingCount, violationsCount }
  }, [filtered])

  return (
    <Card className="overflow-hidden border-border">
      <div className="flex flex-col gap-3 border-b border-border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Fleet HOS — right now</h2>
          <p className="text-xs text-muted-foreground">
            Driver status grid with live remaining clocks and violations.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search driver, truck, location…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 pl-8"
            />
          </div>
          <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => void load()}>
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <KpiPill label="Total drivers" value={kpis.totalDrivers} dot="blue" />
          <KpiPill label="Currently driving" value={kpis.drivingCount} dot="emerald" />
          <KpiPill label="Approaching limits" value={kpis.approachingCount} dot="amber" />
          <KpiPill label="Active violations" value={kpis.violationsCount} dot="red" />
        </div>

        {loading && rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Loading drivers…</p>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">No drivers match this filter.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {filtered.map((row) => (
              <DriverStatusCard key={row.driverId} row={row} />
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}
