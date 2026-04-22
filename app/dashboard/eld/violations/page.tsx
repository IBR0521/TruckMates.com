"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { 
  AlertTriangle, 
  CheckCircle2,
  Plus,
  ShieldCheck,
  User,
  Clock3
} from "lucide-react"
import { getELDEvents, resolveELDEvent } from "@/app/actions/eld"
import { getViolationRepeatOffendersLast30Days } from "@/app/actions/eld-advanced"
import { getDrivers } from "@/app/actions/drivers"
import { toast } from "sonner"
import Link from "next/link"

export default function ELDViolationsPage() {
  const [violations, setViolations] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [repeatOffenders, setRepeatOffenders] = useState<
    { driverId: string; driverName: string; count: number }[]
  >([])
  const [isLoading, setIsLoading] = useState(true)
  const [showResolveDialog, setShowResolveDialog] = useState(false)
  const [selectedViolation, setSelectedViolation] = useState<any>(null)
  const [resolutionNotes, setResolutionNotes] = useState("")
  const [filters, setFilters] = useState({
    driver_id: "",
    status: "open",
    severity: "",
    start_date: "",
    end_date: "",
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadRepeat() {
      const res = await getViolationRepeatOffendersLast30Days()
      if (cancelled) return
      if (res.data) setRepeatOffenders(res.data)
    }
    void loadRepeat()
    return () => {
      cancelled = true
    }
  }, [])

  // Use primitive deps so Radix Select / setFilters identity changes cannot retrigger an infinite load loop.
  useEffect(() => {
    loadViolations()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filters is expanded below
  }, [
    filters.driver_id,
    filters.status,
    filters.severity,
    filters.start_date,
    filters.end_date,
  ])

  async function loadData() {
    try {
      const driversResult = await getDrivers()
      if (driversResult.data) setDrivers(driversResult.data)
    } catch (error) {
      toast.error("Failed to load data")
    }
  }

  function resolvedFilterForStatus(status: string): boolean | undefined {
    if (status === "resolved") return true
    if (status === "open") return false
    // acknowledged / dismissed / all — no resolved column in DB; load client-neutral and filter later if needed
    return undefined
  }

  async function loadViolations() {
    setIsLoading(true)
    try {
      const result = await getELDEvents({
        event_type: "hos_violation",
        driver_id: filters.driver_id || undefined,
        severity: filters.severity || undefined,
        resolved: resolvedFilterForStatus(filters.status),
        start_date: filters.start_date || undefined,
        end_date: filters.end_date || undefined,
      })

      if (result.error) {
        toast.error(result.error)
        setViolations([])
      } else {
        setViolations(result.data || [])
      }
    } catch (error) {
      toast.error("Failed to load violations")
      setViolations([])
    } finally {
      setIsLoading(false)
    }
  }

  async function handleResolveViolation() {
    if (!selectedViolation) return
    try {
      const result = await resolveELDEvent(selectedViolation.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Violation resolved successfully")
        setShowResolveDialog(false)
        setSelectedViolation(null)
        setResolutionNotes("")
        loadViolations()
      }
    } catch (error) {
      toast.error("Failed to resolve violation")
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500/20 text-red-400 border-red-500/50"
      case "serious":
        return "bg-orange-500/20 text-orange-400 border-orange-500/50"
      case "minor":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/50"
      default:
        return "bg-blue-500/20 text-blue-400 border-blue-500/50"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-red-500/20 text-red-400"
      case "acknowledged":
        return "bg-yellow-500/20 text-yellow-400"
      case "resolved":
        return "bg-green-500/20 text-green-400"
      default:
        return "bg-gray-500/20 text-gray-400"
    }
  }

  const complianceScore = violations.length === 0 ? 100 : Math.max(0, 100 - violations.length * 5)

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 md:px-8 py-4 md:py-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">ELD Violations</h1>
          <p className="text-sm text-muted-foreground mt-1">View and manage HOS violations</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/eld/violations/add">
            <Button className="font-medium">
              <Plus className="w-4 h-4 mr-2" />
              Add Event/Violation
            </Button>
          </Link>
          <Link href="/dashboard/eld">
            <Button variant="outline" className="border-border/70 bg-transparent font-medium">Back to ELD</Button>
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {repeatOffenders.length > 0 && (
            <Card className="border-border bg-card p-4 md:p-6">
              <h2 className="mb-1 text-lg font-semibold text-foreground">Repeat offenders (30 days)</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Drivers with two or more HOS violation events in the last 30 days — review patterns before they escalate.
              </p>
              <div className="flex flex-wrap gap-2">
                {repeatOffenders.map((r) => (
                  <button
                    key={r.driverId}
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-left text-sm transition hover:bg-muted/70"
                    onClick={() =>
                      setFilters((f) => ({
                        ...f,
                        driver_id: r.driverId,
                        status: "all",
                        start_date: "",
                        end_date: "",
                      }))
                    }
                  >
                    <span className="font-medium text-foreground">{r.driverName}</span>
                    <span className="tabular-nums text-muted-foreground">{r.count} violations</span>
                  </button>
                ))}
              </div>
            </Card>
          )}

          {/* Filters */}
          <Card className="border-border/70 bg-card/80 p-4 shadow-none">
            <div className="flex flex-wrap gap-2">
              <div className="min-w-[180px] rounded-lg border border-border/60 bg-muted/20 px-3 py-1.5">
                <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Driver</p>
                <Select value={filters.driver_id || "all"} onValueChange={(value) => setFilters({ ...filters, driver_id: value === "all" ? "" : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Drivers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Drivers</SelectItem>
                    {drivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        {driver.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[150px] rounded-lg border border-border/60 bg-muted/20 px-3 py-1.5">
                <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Status</p>
                <Select value={filters.status || "all"} onValueChange={(value) => setFilters({ ...filters, status: value === "all" ? "" : value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="acknowledged">Acknowledged</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="dismissed">Dismissed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[160px] rounded-lg border border-border/60 bg-muted/20 px-3 py-1.5">
                <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Severity</p>
                <Select value={filters.severity || "all"} onValueChange={(value) => setFilters({ ...filters, severity: value === "all" ? "" : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Severities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="serious">Serious</SelectItem>
                    <SelectItem value="minor">Minor</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-1.5">
                <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Start</p>
                <Input
                  type="date"
                  value={filters.start_date}
                  onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                />
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-1.5">
                <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">End</p>
                <Input
                  type="date"
                  value={filters.end_date}
                  onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                />
              </div>
            </div>
          </Card>

          {/* Violations List */}
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Loading violations...</p>
          ) : violations.length === 0 ? (
            <Card className="border-border/70 bg-card/80 p-12 text-center shadow-none">
              <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-500" />
              <p className="text-xl font-medium text-foreground">No violations in this period</p>
              <p className="mt-1 text-sm text-muted-foreground">Fleet compliance is on track.</p>
              <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/8 px-4 py-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <span className="text-sm text-muted-foreground">Compliance Score</span>
                <span className="font-medium text-emerald-500">{complianceScore}/100</span>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {violations.map((violation) => {
                const displayStatus = violation.resolved ? "resolved" : "open"
                const headline =
                  violation.title ||
                  (violation.event_type ? String(violation.event_type).replace(/_/g, " ") : "HOS violation")
                return (
                <Card key={violation.id} className="overflow-hidden border border-border/70 bg-card/80 shadow-none">
                  <div className="flex items-start justify-between">
                    <div className="flex flex-1 items-start gap-3 p-4">
                      <div className={`mt-0.5 h-16 w-0.5 rounded-full ${violation.severity === "critical" ? "bg-red-500/80" : "bg-amber-500/80"}`} />
                      <div className="flex-1">
                        <div className="mb-2 flex items-center gap-3">
                          <AlertTriangle className="h-5 w-5 text-amber-500" />
                          <h3 className="font-medium text-foreground">
                          {headline}
                        </h3>
                        <span className={`px-2 py-1 rounded-md text-xs font-medium ${getSeverityColor(violation.severity)}`}>
                          {violation.severity || "—"}
                        </span>
                        <span className={`px-2 py-1 rounded-md text-xs font-medium ${getStatusColor(displayStatus)}`}>
                          {displayStatus}
                        </span>
                      </div>
                      {violation.event_type ? (
                        <p className="text-xs text-muted-foreground mb-1 capitalize">
                          {String(violation.event_type).replace(/_/g, " ")}
                        </p>
                      ) : null}
                        <p className="mb-2 text-sm text-muted-foreground">{violation.description || "—"}</p>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <User className="h-3.5 w-3.5" />
                            {violation.drivers?.name || "Unknown Driver"}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="h-3.5 w-3.5" />
                          {violation.event_time
                            ? new Date(violation.event_time).toLocaleString()
                            : "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="p-4">
                      {!violation.resolved && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedViolation(violation)
                            setShowResolveDialog(true)
                          }}
                        >
                          Resolve
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Resolve Dialog */}
      <Dialog open={showResolveDialog} onOpenChange={setShowResolveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Violation</DialogTitle>
            <DialogDescription>
              Add resolution notes for this violation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Resolution Notes</Label>
              <Textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Enter resolution details..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResolveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleResolveViolation}>
              Mark as Resolved
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

