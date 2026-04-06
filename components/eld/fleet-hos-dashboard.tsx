"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ArrowDownUp, RefreshCw, Search } from "lucide-react"
import { toast } from "sonner"
import { getFleetHOSSnapshot, type FleetHosSnapshotRow } from "@/app/actions/eld-advanced"
import { cn } from "@/lib/utils"

type SortKey = "driver" | "truck" | "status" | "drive" | "shift" | "violations"

function parseClockToMinutes(s: string): number {
  if (s === "—") return -1
  const h = s.match(/(\d+)h/)
  const m = s.match(/(\d+)m/)
  const hours = h ? parseInt(h[1], 10) : 0
  const mins = m ? parseInt(m[1], 10) : 0
  return hours * 60 + mins
}

function statusDot(row: FleetHosSnapshotRow) {
  if (row.rowTone === "violation") {
    return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" title="In violation" />
  }
  if (row.rowTone === "driving") {
    return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" title="Driving" />
  }
  if (row.rowTone === "on_duty") {
    return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400" title="On duty" />
  }
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-muted-foreground/50" title="Off / other" />
}

export function FleetHosDashboard() {
  const [rows, setRows] = useState<FleetHosSnapshotRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("drive")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

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
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.driverName.toLowerCase().includes(q) ||
        r.truckLabel.toLowerCase().includes(q) ||
        (r.lastLocation && r.lastLocation.toLowerCase().includes(q))
    )
  }, [rows, query])

  const sorted = useMemo(() => {
    const out = [...filtered]
    const dir = sortDir === "asc" ? 1 : -1
    out.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case "driver":
          cmp = a.driverName.localeCompare(b.driverName)
          break
        case "truck":
          cmp = a.truckLabel.localeCompare(b.truckLabel)
          break
        case "status":
          cmp = a.statusLabel.localeCompare(b.statusLabel)
          break
        case "drive":
          cmp = parseClockToMinutes(a.drivingLeftDisplay) - parseClockToMinutes(b.drivingLeftDisplay)
          break
        case "shift":
          cmp = parseClockToMinutes(a.onDutyLeftDisplay) - parseClockToMinutes(b.onDutyLeftDisplay)
          break
        case "violations":
          cmp = a.openViolationCount - b.openViolationCount
          break
        default:
          cmp = 0
      }
      return cmp * dir
    })
    return out
  }, [filtered, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  return (
    <Card className="border-border overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Fleet HOS — right now</h2>
          <p className="text-xs text-muted-foreground">
            Today&apos;s clocks and duty from ELD logs. Sorted with tightest drive time first by default.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
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

      <div className="overflow-x-auto">
        {loading && rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Loading drivers…</p>
        ) : sorted.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">No drivers match this filter.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[44px]" />
                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                    onClick={() => toggleSort("driver")}
                  >
                    Driver
                    <ArrowDownUp className="h-3 w-3 opacity-60" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                    onClick={() => toggleSort("truck")}
                  >
                    Truck
                    <ArrowDownUp className="h-3 w-3 opacity-60" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                    onClick={() => toggleSort("status")}
                  >
                    Status
                    <ArrowDownUp className="h-3 w-3 opacity-60" />
                  </button>
                </TableHead>
                <TableHead className="text-right tabular-nums">
                  <button
                    type="button"
                    className="inline-flex w-full items-center justify-end gap-1 font-medium hover:text-foreground"
                    onClick={() => toggleSort("drive")}
                  >
                    Driving left
                    <ArrowDownUp className="h-3 w-3 opacity-60" />
                  </button>
                </TableHead>
                <TableHead className="text-right tabular-nums">
                  <button
                    type="button"
                    className="inline-flex w-full items-center justify-end gap-1 font-medium hover:text-foreground"
                    onClick={() => toggleSort("shift")}
                  >
                    On-duty left
                    <ArrowDownUp className="h-3 w-3 opacity-60" />
                  </button>
                </TableHead>
                <TableHead>Last location</TableHead>
                <TableHead className="text-right tabular-nums">
                  <button
                    type="button"
                    className="inline-flex w-full items-center justify-end gap-1 font-medium hover:text-foreground"
                    onClick={() => toggleSort("violations")}
                  >
                    Open violations
                    <ArrowDownUp className="h-3 w-3 opacity-60" />
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((r) => (
                <TableRow
                  key={r.driverId}
                  className={cn(
                    r.approachingLimit && "bg-amber-500/5",
                    r.rowTone === "violation" && "bg-red-500/5"
                  )}
                >
                  <TableCell className="align-middle">{statusDot(r)}</TableCell>
                  <TableCell className="font-medium text-foreground">{r.driverName}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">{r.truckLabel}</TableCell>
                  <TableCell className="text-sm">{r.statusLabel}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-foreground">{r.drivingLeftDisplay}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-foreground">{r.onDutyLeftDisplay}</TableCell>
                  <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground" title={r.lastLocation || undefined}>
                    {r.lastLocation || "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{r.openViolationCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </Card>
  )
}
