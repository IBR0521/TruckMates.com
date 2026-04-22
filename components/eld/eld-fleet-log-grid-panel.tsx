"use client"

import { useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { HosLogGrid } from "@/components/eld/hos-log-grid"
import type { EldLogLike } from "@/lib/hos/compute-daily-remaining"
import { calendarDateYmdLocal } from "@/lib/eld/hos-calendar-date"
import { getELDLogs } from "@/app/actions/eld"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type DriverOption = { id: string; name: string }
type ProviderLogExtras = EldLogLike & {
  location_start?: { address?: string } | null
  location_end?: { address?: string } | null
  raw_data?: { notes?: unknown } | null
}

type DutyType = "driving" | "on_duty" | "off_duty" | "sleeper_berth"

const DUTY_COLOR: Record<DutyType, string> = {
  driving: "bg-emerald-500",
  on_duty: "bg-blue-500",
  off_duty: "bg-slate-400",
  sleeper_berth: "bg-orange-500",
}

function dutyLabel(v: string): string {
  if (v === "driving") return "Driving"
  if (v === "on_duty") return "On Duty"
  if (v === "sleeper_berth") return "Sleeper"
  return "Off Duty"
}

function getDutyForHour(logs: EldLogLike[], day: string, hour: number): DutyType {
  const ts = new Date(`${day}T${String(hour).padStart(2, "0")}:00:00`).getTime()
  const covering = logs.find((log) => {
    const start = new Date(log.start_time).getTime()
    const end = log.end_time ? new Date(log.end_time).getTime() : Number.POSITIVE_INFINITY
    return ts >= start && ts < end
  })
  const t = covering?.log_type
  if (t === "driving" || t === "on_duty" || t === "sleeper_berth" || t === "off_duty") return t
  return "off_duty"
}

export function EldFleetLogGridPanel({ drivers }: { drivers: DriverOption[] }) {
  const [gridDriverId, setGridDriverId] = useState("")
  const [gridDate, setGridDate] = useState(() => calendarDateYmdLocal(new Date()))
  const [gridLogs, setGridLogs] = useState<EldLogLike[]>([])
  const [gridLoading, setGridLoading] = useState(false)
  const [gridNowMs, setGridNowMs] = useState(() => Date.now())

  const selectedDriver = useMemo(
    () => drivers.find((driver) => driver.id === gridDriverId) || null,
    [drivers, gridDriverId]
  )

  useEffect(() => {
    if (!gridDriverId && drivers.length > 0) {
      setGridDriverId(drivers[0].id)
    }
  }, [drivers, gridDriverId])

  useEffect(() => {
    const id = setInterval(() => setGridNowMs(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

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

  const hourBuckets = useMemo(
    () => Array.from({ length: 24 }, (_, hour) => ({ hour, duty: getDutyForHour(gridLogs, gridDate, hour) })),
    [gridLogs, gridDate]
  )

  return (
    <Card className="border-border bg-card p-4 md:p-6">
      <h2 className="mb-1 text-lg font-semibold text-foreground">24-hour log view</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Select a driver from the left to load the day view and log entries.
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
        <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
          <div>
            <Label className="text-xs text-muted-foreground">Date</Label>
            <Input type="date" value={gridDate} onChange={(e) => setGridDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            {drivers.map((driver) => (
              <button
                key={driver.id}
                type="button"
                onClick={() => setGridDriverId(driver.id)}
                className={cn(
                  "w-full rounded-md border px-3 py-2 text-left text-sm transition",
                  gridDriverId === driver.id
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                )}
              >
                {driver.name}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {!gridDriverId ? (
            <p className="text-sm text-muted-foreground">No drivers available.</p>
          ) : gridLoading ? (
            <p className="text-sm text-muted-foreground">Loading grid…</p>
          ) : (
            <>
              <div className="rounded-md border border-border p-3">
                <p className="mb-2 text-sm font-medium text-foreground">
                  {selectedDriver?.name || "Driver"} · {gridDate}
                </p>
                <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
                  {hourBuckets.map((slot) => (
                    <div
                      key={slot.hour}
                      title={`${String(slot.hour).padStart(2, "0")}:00 ${dutyLabel(slot.duty)}`}
                      className={cn("h-6 rounded-sm", DUTY_COLOR[slot.duty])}
                    />
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>00:00</span>
                  <span>12:00</span>
                  <span>23:00</span>
                </div>
              </div>

              <HosLogGrid logDate={gridDate} logs={gridLogs} nowMs={gridNowMs} />

              <div className="overflow-hidden rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Start Time</th>
                      <th className="px-3 py-2 text-left">End Time</th>
                      <th className="px-3 py-2 text-left">Duration</th>
                      <th className="px-3 py-2 text-left">Location</th>
                      <th className="px-3 py-2 text-left">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gridLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                          No log entries for this day.
                        </td>
                      </tr>
                    ) : (
                      gridLogs.map((log) => {
                        const row = log as ProviderLogExtras
                        const notes =
                          row.raw_data && typeof row.raw_data === "object" && "notes" in row.raw_data
                            ? String(row.raw_data.notes || "")
                            : ""
                        return (
                        <tr key={log.id} className="border-t border-border">
                          <td className="px-3 py-2">{dutyLabel(log.log_type || "off_duty")}</td>
                          <td className="px-3 py-2">{new Date(log.start_time).toLocaleTimeString()}</td>
                          <td className="px-3 py-2">
                            {log.end_time ? new Date(log.end_time).toLocaleTimeString() : "—"}
                          </td>
                          <td className="px-3 py-2">
                            {log.duration_minutes
                              ? `${Math.floor(log.duration_minutes / 60)}h ${log.duration_minutes % 60}m`
                              : "—"}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {row.location_start?.address || row.location_end?.address || "—"}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {notes || "—"}
                          </td>
                        </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}
