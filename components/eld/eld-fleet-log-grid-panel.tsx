"use client"

import { useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { HosLogGrid } from "@/components/eld/hos-log-grid"
import type { EldLogLike } from "@/lib/hos/compute-daily-remaining"
import { calendarDateYmdLocal } from "@/lib/eld/hos-calendar-date"
import { getELDLogs } from "@/app/actions/eld"
import { toast } from "sonner"

type DriverOption = { id: string; name: string }

/**
 * Fleet manager 24h RODS-style grid (same visualization as driver ELD).
 * Used by `EldLogsTab` and referenced from the fleet ELD shell.
 */
export function EldFleetLogGridPanel({ drivers }: { drivers: DriverOption[] }) {
  const [gridDriverId, setGridDriverId] = useState("")
  const [gridDate, setGridDate] = useState(() => calendarDateYmdLocal(new Date()))
  const [gridLogs, setGridLogs] = useState<EldLogLike[]>([])
  const [gridLoading, setGridLoading] = useState(false)
  const [gridNowMs, setGridNowMs] = useState(() => Date.now())

  const todayYmd = useMemo(() => calendarDateYmdLocal(new Date()), [])
  const isGridToday = gridDate === todayYmd

  useEffect(() => {
    if (!isGridToday) return
    const id = setInterval(() => setGridNowMs(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [isGridToday])

  useEffect(() => {
    if (!gridDriverId) {
      setGridLogs([])
      return
    }
    let cancelled = false
    async function loadGrid() {
      setGridLoading(true)
      try {
        const result = await getELDLogs({
          driver_id: gridDriverId,
          start_date: gridDate,
          end_date: gridDate,
          limit: 500,
        })
        if (cancelled) return
        if (result.error) {
          toast.error(result.error)
          setGridLogs([])
        } else {
          const raw = (result.data || []) as EldLogLike[]
          setGridLogs(
            [...raw].sort(
              (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
            )
          )
        }
      } catch {
        if (!cancelled) {
          toast.error("Failed to load log grid")
          setGridLogs([])
        }
      } finally {
        if (!cancelled) setGridLoading(false)
      }
    }
    void loadGrid()
    return () => {
      cancelled = true
    }
  }, [gridDriverId, gridDate])

  return (
    <Card className="border-border bg-card p-4 md:p-6">
      <h2 className="mb-1 text-lg font-semibold text-foreground">24-hour log grid</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Select a driver and date for the horizontal duty chart (same as the driver ELD 24h view). Raw log
        rows are below.
      </p>
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[200px] flex-1">
          <Label className="text-xs text-muted-foreground">Driver</Label>
          <Select
            value={gridDriverId || "none"}
            onValueChange={(v) => setGridDriverId(v === "none" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select driver" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Select driver…</SelectItem>
              {drivers.map((driver) => (
                <SelectItem key={driver.id} value={driver.id}>
                  {driver.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full min-w-[160px] sm:w-auto">
          <Label className="text-xs text-muted-foreground">Date</Label>
          <Input type="date" value={gridDate} onChange={(e) => setGridDate(e.target.value)} />
        </div>
      </div>
      {!gridDriverId ? (
        <p className="text-sm text-muted-foreground">Select a driver to load the grid.</p>
      ) : gridLoading ? (
        <p className="text-sm text-muted-foreground">Loading grid…</p>
      ) : (
        <HosLogGrid logDate={gridDate} logs={gridLogs} nowMs={isGridToday ? gridNowMs : undefined} />
      )}
    </Card>
  )
}
