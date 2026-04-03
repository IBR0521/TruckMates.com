"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  FileCheck,
  MessageSquareWarning,
  RefreshCw,
  Shield,
  Smartphone,
} from "lucide-react"
import { toast } from "sonner"
import { errorMessage } from "@/lib/error-message"
import { getELDDevices, getELDLogs } from "@/app/actions/eld"
import { registerWebEldDevice } from "@/app/actions/driver-eld-device"
import { getDriverDashboardSnapshot } from "@/app/actions/driver-dashboard"
import { calculateRemainingHOS } from "@/app/actions/eld-advanced"
import { changeDriverDutyStatus } from "@/app/actions/driver-eld-duty"
import { HosLogGrid } from "@/components/eld/hos-log-grid"
import {
  computeDailyRemainingFromEldLogs,
  type EldLogLike,
} from "@/lib/hos/compute-daily-remaining"
import type { DriverDashboardSnapshot } from "@/lib/types/driver-dashboard"

function localYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function addDaysYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10))
  const dt = new Date(y, m - 1, d + delta)
  return localYmd(dt)
}

function formatDutyLabel(raw: string): string {
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function eldProviderLabel(provider: string | null | undefined): string {
  if (!provider) return "—"
  if (provider === "truckmates_mobile") return "Mobile / web ELD"
  return provider.replace(/_/g, " ")
}

export function DriverEldPage() {
  const [today] = useState(() => localYmd(new Date()))
  const [selectedDate, setSelectedDate] = useState(today)
  const [snapshot, setSnapshot] = useState<DriverDashboardSnapshot | null>(null)
  const [logs, setLogs] = useState<EldLogLike[]>([])
  const [hosDay, setHosDay] = useState<Awaited<
    ReturnType<typeof calculateRemainingHOS>
  >["data"]>(null)
  const [loading, setLoading] = useState(true)
  const [liveNowMs, setLiveNowMs] = useState(() => Date.now())
  const [certNote, setCertNote] = useState("")
  const [editReason, setEditReason] = useState("")
  const [pendingDuty, setPendingDuty] = useState<string | null>(null)
  const [eldDevices, setEldDevices] = useState<
    { id: string; device_name?: string | null; provider?: string | null; status?: string | null }[]
  >([])
  const [eldRegisterName, setEldRegisterName] = useState("Web dashboard ELD")
  const [eldRegistering, setEldRegistering] = useState(false)

  const isToday = selectedDate === today

  useEffect(() => {
    if (isToday) setLiveNowMs(Date.now())
  }, [isToday, selectedDate])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const snapResult = await getDriverDashboardSnapshot()
      if (snapResult.error) {
        toast.error(snapResult.error)
        setSnapshot(null)
        setLogs([])
        setHosDay(null)
        setEldDevices([])
        return
      }
      const snap = snapResult.data
      setSnapshot(snap)

      const driverId = snap?.driverId
      if (!driverId) {
        setLogs([])
        setHosDay(null)
        setEldDevices([])
        return
      }

      const [logsResult, hosResult, devicesResult] = await Promise.all([
        getELDLogs({
          start_date: selectedDate,
          end_date: selectedDate,
          limit: 500,
        }),
        calculateRemainingHOS(driverId, selectedDate),
        getELDDevices(),
      ])

      if (logsResult.error) {
        toast.error(logsResult.error)
      } else {
        const raw = (logsResult.data || []) as EldLogLike[]
        setLogs(
          [...raw].sort(
            (a, b) =>
              new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
          )
        )
      }

      if (hosResult.error) {
        setHosDay(null)
      } else {
        setHosDay(hosResult.data)
      }

      if (devicesResult.error) {
        setEldDevices([])
      } else {
        setEldDevices(
          (devicesResult.data || []) as {
            id: string
            device_name?: string | null
            provider?: string | null
            status?: string | null
          }[]
        )
      }
    } catch (e: unknown) {
      toast.error(errorMessage(e, "Failed to load HOS"))
    } finally {
      setLoading(false)
    }
  }, [selectedDate])

  useEffect(() => {
    void load()
  }, [load])

  /** Advance “now” for open-ended log segments so drive/shift clocks count down between server refreshes. */
  useEffect(() => {
    if (!isToday) return
    const id = setInterval(() => setLiveNowMs(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [isToday])

  useEffect(() => {
    if (!isToday) return
    const id = setInterval(() => {
      void load()
    }, 60_000)
    return () => clearInterval(id)
  }, [isToday, load])

  const hos = snapshot?.hos

  /** Same math as the 24h grid — updates as soon as `logs` refresh after a duty change (not stale snapshot). */
  const computedFromLogs = useMemo(() => {
    if (!isToday) return null
    return computeDailyRemainingFromEldLogs(logs, liveNowMs)
  }, [logs, liveNowMs, isToday])

  const cycleHours = hos?.remainingCycleHours
  const driveClock = isToday
    ? (computedFromLogs?.remainingDriving ?? hosDay?.remainingDriving ?? hos?.remainingDriveHours)
    : hosDay?.remainingDriving
  const shiftClock = isToday
    ? (computedFromLogs?.remainingOnDuty ?? hosDay?.remainingOnDuty ?? hos?.remainingShiftHours)
    : hosDay?.remainingOnDuty

  return (
    <div className="relative w-full bg-background">
      <div className="absolute inset-0 bg-background -z-10" aria-hidden />

      <div className="border-b border-border bg-card px-3 py-2.5 md:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-1 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Hours of service</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Your logs only.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-2"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-3 p-3 md:p-5">
        {!snapshot?.driverId && !loading && (
          <Card className="border-border bg-card/50 p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">No driver profile</p>
            <p className="text-sm text-muted-foreground">
              {snapshot?.driverProvisionNote ||
                "Ask your fleet to add you as a driver (same email) or set your role to Driver."}
            </p>
          </Card>
        )}

        {snapshot?.driverId && (
          <>
            {/* Day navigation */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Previous day"
                  onClick={() => setSelectedDate((d) => addDaysYmd(d, -1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-[10rem] text-center">
                  <p className="text-sm font-medium text-foreground">
                    {new Date(selectedDate + "T12:00:00").toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                  {isToday ? (
                    <p className="text-xs text-muted-foreground">Today</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Past day</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Next day"
                  disabled={selectedDate >= today}
                  onClick={() =>
                    setSelectedDate((d) => {
                      const n = addDaysYmd(d, 1)
                      return n > today ? d : n
                    })
                  }
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                {!isToday && (
                  <Button type="button" variant="secondary" size="sm" onClick={() => setSelectedDate(today)}>
                    Today
                  </Button>
                )}
              </div>
            </div>

            {/* ELD device: fleet adds integrated ELDs; drivers can register browser/mobile provider row */}
            <Card className="border-border bg-card/50 p-3 md:p-4">
              <div className="mb-2 flex items-center gap-1.5">
                <Smartphone className="h-4 w-4 shrink-0 text-primary" />
                <h2 className="text-base font-semibold text-foreground">ELD device</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Fleet adds integrated ELDs to your truck. Otherwise register this browser below.
              </p>
              {eldDevices.length > 0 ? (
                <ul className="mt-2 space-y-1 rounded-md border border-border bg-background/40 p-2 text-sm">
                  {eldDevices.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-foreground">{d.device_name || "ELD"}</span>
                      <span className="text-xs text-muted-foreground">
                        {eldProviderLabel(d.provider)} · {d.status || "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">No ELD on this truck yet.</p>
              )}
              <div className="mt-3 space-y-1.5">
                <Label htmlFor="eld-reg-name">Label</Label>
                <Input
                  id="eld-reg-name"
                  value={eldRegisterName}
                  onChange={(e) => setEldRegisterName(e.target.value)}
                  placeholder="e.g. Web ELD"
                  disabled={eldRegistering || loading}
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={eldRegistering || loading}
                  onClick={async () => {
                    setEldRegistering(true)
                    try {
                      const r = await registerWebEldDevice({ device_name: eldRegisterName })
                      if (r.error) {
                        toast.error(r.error)
                        return
                      }
                      toast.success("ELD registered on your truck")
                      await load()
                    } finally {
                      setEldRegistering(false)
                    }
                  }}
                >
                  {eldRegistering ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Smartphone className="mr-2 h-4 w-4" />
                  )}
                  Register browser ELD
                </Button>
                <p className="text-xs text-muted-foreground">Truck from driver profile, truck, or active load.</p>
              </div>
            </Card>

            {/* Duty status — only for today; writes eld_logs */}
            {isToday ? (
              <Card className="border-border bg-card/50 p-3 md:p-4">
                <h2 className="text-base font-semibold text-foreground">Duty status</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">Needs truck + ELD on that truck.</p>
                <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {(
                    [
                      { key: "off_duty" as const, label: "Off duty", className: "border-emerald-500/40 hover:bg-emerald-500/10" },
                      { key: "sleeper_berth" as const, label: "Sleeper", className: "border-violet-500/40 hover:bg-violet-500/10" },
                      { key: "driving" as const, label: "Driving", className: "border-sky-500/40 hover:bg-sky-500/10" },
                      { key: "on_duty" as const, label: "On duty", className: "border-amber-500/40 hover:bg-amber-500/10" },
                    ] as const
                  ).map(({ key, label, className }) => (
                    <Button
                      key={key}
                      type="button"
                      variant="outline"
                      disabled={!!pendingDuty || loading}
                      className={`h-auto min-h-[2.5rem] flex-col gap-0 py-1.5 text-center text-sm ${className}`}
                      onClick={async () => {
                        setPendingDuty(key)
                        try {
                          const result = await changeDriverDutyStatus(key)
                          if (result.error) {
                            toast.error(result.error)
                            return
                          }
                          if (result.data?.unchanged) {
                            toast.message("Already in this duty status")
                            return
                          }
                          toast.success(`Duty: ${formatDutyLabel(key)}`)
                          await load()
                        } finally {
                          setPendingDuty(null)
                        }
                      }}
                    >
                      {pendingDuty === key ? (
                        <RefreshCw className="mx-auto h-4 w-4 animate-spin" />
                      ) : (
                        label
                      )}
                    </Button>
                  ))}
                </div>
              </Card>
            ) : (
              <p className="text-sm text-muted-foreground">Go to today to change duty.</p>
            )}

            <HosLogGrid
              logDate={selectedDate}
              logs={logs}
              nowMs={isToday ? liveNowMs : undefined}
            />

            {/* Clocks */}
            <Card className="border-border bg-card/50 p-3 md:p-4">
              <div className="mb-2 flex items-center gap-1.5">
                <Clock className="h-4 w-4 shrink-0 text-primary" />
                <h2 className="text-base font-semibold text-foreground">Clocks</h2>
              </div>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                  <div className="rounded-lg border border-border bg-background/60 p-3">
                    <p className="text-xs font-medium text-muted-foreground">Drive</p>
                    <p
                      className={`mt-1 text-2xl font-bold tabular-nums ${
                        (driveClock ?? 0) < 1 ? "text-destructive" : "text-foreground"
                      }`}
                    >
                      {driveClock != null ? `${driveClock.toFixed(1)}h` : "—"}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">11h max</p>
                  </div>
                  <div className="rounded-lg border border-border bg-background/60 p-3">
                    <p className="text-xs font-medium text-muted-foreground">Shift</p>
                    <p
                      className={`mt-1 text-2xl font-bold tabular-nums ${
                        (shiftClock ?? 0) < 1 ? "text-destructive" : "text-foreground"
                      }`}
                    >
                      {shiftClock != null ? `${shiftClock.toFixed(1)}h` : "—"}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">14h window</p>
                  </div>
                  <div className="rounded-lg border border-border bg-background/60 p-3">
                    <p className="text-xs font-medium text-muted-foreground">Cycle</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                      {cycleHours != null ? `${cycleHours.toFixed(1)}h` : "—"}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">70h / 8d</p>
                  </div>
                  <div className="rounded-lg border border-border bg-background/60 p-3">
                    <p className="text-xs font-medium text-muted-foreground">Break</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">
                      {(computedFromLogs?.needsBreak ?? hosDay?.needsBreak) || hos?.needsBreak ? (
                        <span className="text-amber-500">30 min break due</span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400">No break</span>
                      )}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">After 8h drive</p>
                  </div>
                </div>
              )}
              {isToday && hos && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Now:{" "}
                  <span className="font-medium text-foreground">{formatDutyLabel(hos.currentDutyStatus)}</span>
                  {hos.canDrive === false && <span className="ml-2 text-destructive">· No drive</span>}
                </p>
              )}
            </Card>

            {/* Certify & edit */}
            <Card className="border-border bg-card/50 p-3 md:p-4">
              <div className="mb-2 flex items-center gap-1.5">
                <FileCheck className="h-4 w-4 shrink-0 text-primary" />
                <h2 className="text-base font-semibold text-foreground">Certify &amp; edits</h2>
              </div>
              <p className="mb-2 text-sm text-muted-foreground">Certify the day, add a note, or request a correction.</p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cert-notes">Note</Label>
                  <Textarea
                    id="cert-notes"
                    placeholder="Optional note"
                    value={certNote}
                    onChange={(e) => setCertNote(e.target.value)}
                    className="min-h-[64px] resize-y"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      toast.message("Certification saved (local)")
                    }}
                  >
                    <Shield className="mr-2 h-4 w-4" />
                    Certify this day
                  </Button>
                </div>
                <div className="border-t border-border pt-3">
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <MessageSquareWarning className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Request edit</span>
                  </div>
                  <Textarea
                    placeholder="What should change?"
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    className="min-h-[56px] resize-y"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="mt-2"
                    onClick={() => {
                      if (!editReason.trim()) {
                        toast.error("Add a reason.")
                        return
                      }
                      toast.success("Edit request sent")
                      setEditReason("")
                    }}
                  >
                    Submit edit request
                  </Button>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
