"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FeatureLock } from "@/components/billing/feature-lock"
import {
  acknowledgeFaultCode,
  getFaultCodeStats,
  listActiveFaultCodes,
  type FaultCode,
} from "@/app/actions/fault-codes"
import { FaultResolutionDialog } from "@/components/eld/fault-resolution-dialog"
import { toast } from "sonner"
import { AlertTriangle, Wrench } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function severityBadge(severity: string) {
  const s = severity.toLowerCase()
  if (s === "critical") return "bg-red-500/15 text-red-600 border-red-500/40"
  if (s === "high") return "bg-orange-500/15 text-orange-600 border-orange-500/40"
  if (s === "medium") return "bg-amber-500/15 text-amber-700 border-amber-500/40"
  if (s === "low") return "bg-slate-500/15 text-slate-600 border-slate-500/40"
  return "bg-muted text-muted-foreground border-border"
}

export function FleetFaultCodesDashboard() {
  const [rows, setRows] = useState<FaultCode[]>([])
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getFaultCodeStats>>["data"]>(null)
  const [loading, setLoading] = useState(true)
  const [severityFilter, setSeverityFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<"active" | "acknowledged" | "resolved" | "all">("active")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [resolveTarget, setResolveTarget] = useState<FaultCode | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const sev =
      severityFilter === "all" ? undefined : [severityFilter]
    const [listR, statsR] = await Promise.all([
      listActiveFaultCodes({
        severity: sev,
        status: statusFilter,
        limit: 300,
      }),
      getFaultCodeStats({ daysBack: 30 }),
    ])
    if (listR.error) toast.error(listR.error)
    else setRows(listR.data ?? [])
    if (statsR.data) setStats(statsR.data)
    setLoading(false)
  }, [severityFilter, statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  const criticalCount = stats?.by_severity?.critical ?? 0
  const highCount = stats?.by_severity?.high ?? 0

  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const order = { critical: 0, high: 1, medium: 2, low: 3, unknown: 4 }
        const sa = order[a.severity as keyof typeof order] ?? 5
        const sb = order[b.severity as keyof typeof order] ?? 5
        if (sa !== sb) return sa - sb
        return new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime()
      }),
    [rows],
  )

  const ack = async (id: string) => {
    const r = await acknowledgeFaultCode({ faultCodeId: id })
    if (r.error) toast.error(r.error)
    else {
      toast.success("Acknowledged")
      void load()
    }
  }

  return (
    <FeatureLock
      featureKey="eld_fault_codes_basic"
      title="Engine fault codes"
      description="Starter shows raw ECM codes. Professional adds plain-English translations, severity, and automatic maintenance for critical faults."
    >
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border p-4">
            <p className="text-xs text-muted-foreground">Active faults</p>
            <p className="text-2xl font-bold">{stats?.total_active ?? "—"}</p>
          </Card>
          <Card className="border-red-500/30 p-4">
            <p className="text-xs text-muted-foreground">Critical</p>
            <p className="text-2xl font-bold text-red-600">{criticalCount}</p>
          </Card>
          <Card className="border-orange-500/30 p-4">
            <p className="text-xs text-muted-foreground">High</p>
            <p className="text-2xl font-bold text-orange-600">{highCount}</p>
          </Card>
          <Card className="border-border p-4">
            <p className="text-xs text-muted-foreground">Trucks with faults</p>
            <p className="text-2xl font-bold">{stats?.trucks_with_issues ?? "—"}</p>
          </Card>
        </div>

        <Card className="border-border p-4">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severity</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(v) =>
                setStatusFilter(v as "active" | "acknowledged" | "resolved" | "all")
              }
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="acknowledged">Acknowledged</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Refresh
            </Button>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading fault codes…</p>
          ) : sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No fault codes match this filter. Sync runs every 30 minutes when ELD devices are connected.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2">Code</th>
                    <th className="px-2 py-2">Description</th>
                    <th className="px-2 py-2">Truck</th>
                    <th className="px-2 py-2">Severity</th>
                    <th className="px-2 py-2">First seen</th>
                    <th className="px-2 py-2">Count</th>
                    <th className="px-2 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row) => (
                    <Fragment key={row.id}>
                      <tr
                        className="border-b border-border/50 cursor-pointer hover:bg-muted/30"
                        onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                      >
                        <td className="px-2 py-2 font-mono text-xs">{row.code}</td>
                        <td className="px-2 py-2 max-w-[200px] truncate">
                          {row.description ?? (
                            <span className="text-muted-foreground italic">Upgrade to Pro for translation</span>
                          )}
                        </td>
                        <td className="px-2 py-2">{row.truck_number ?? "—"}</td>
                        <td className="px-2 py-2">
                          <Badge variant="outline" className={severityBadge(row.severity)}>
                            {row.severity}
                          </Badge>
                        </td>
                        <td className="px-2 py-2 text-muted-foreground">
                          {row.first_seen_at ? new Date(row.first_seen_at).toLocaleString() : "—"}
                        </td>
                        <td className="px-2 py-2">{row.occurrence_count}</td>
                        <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1">
                            {!row.acknowledged_at && !row.resolved_at && (
                              <Button variant="ghost" size="sm" onClick={() => void ack(row.id)}>
                                Ack
                              </Button>
                            )}
                            {!row.resolved_at && (
                              <Button variant="ghost" size="sm" onClick={() => setResolveTarget(row)}>
                                Resolve
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expandedId === row.id && (
                        <tr key={`${row.id}-detail`} className="bg-muted/20">
                          <td colSpan={7} className="px-4 py-3 text-sm">
                            <div className="space-y-2">
                              <p>
                                <span className="font-medium">Protocol:</span> {row.code_protocol}
                              </p>
                              {row.recommended_action ? (
                                <p>
                                  <span className="font-medium">Recommended:</span> {row.recommended_action}
                                </p>
                              ) : (
                                <p className="text-muted-foreground flex items-center gap-1">
                                  <AlertTriangle className="h-4 w-4" />
                                  Pro plan unlocks recommended actions and repair cost estimates.
                                </p>
                              )}
                              {row.linked_maintenance_id && (
                                <Link
                                  href={`/dashboard/maintenance/${row.linked_maintenance_id}`}
                                  className="inline-flex items-center gap-1 text-primary hover:underline"
                                >
                                  <Wrench className="h-4 w-4" />
                                  View linked maintenance
                                </Link>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <FaultResolutionDialog
        fault={resolveTarget}
        open={!!resolveTarget}
        onOpenChange={(o) => !o && setResolveTarget(null)}
        onResolved={() => void load()}
      />
    </FeatureLock>
  )
}
