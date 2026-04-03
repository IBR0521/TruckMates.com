"use client"

import { Suspense } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  ClipboardCheck,
  FolderOpen,
  Package,
  Shield,
  Sparkles,
} from "lucide-react"
import type { DriverDashboardSnapshot, DriverHosSeverity } from "@/lib/types/driver-dashboard"
import { RemindersWidget } from "@/components/dashboard/reminders-widget"

function formatDutyLabel(status: string): string {
  const s = status.replace(/_/g, " ")
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatHours(h: number): string {
  if (!Number.isFinite(h)) return "—"
  const whole = Math.floor(h)
  const mins = Math.round((h - whole) * 60)
  if (whole <= 0 && mins === 0) return "0h"
  return mins > 0 ? `${whole}h ${mins}m` : `${whole}h`
}

function metricTone(severity: DriverHosSeverity | null): string {
  if (!severity) return "text-foreground"
  switch (severity) {
    case "violation":
      return "text-red-400"
    case "warning":
      return "text-yellow-400"
    default:
      return "text-green-400"
  }
}

type Props = {
  snapshot: DriverDashboardSnapshot | null
  companyName: string | null | undefined
}

/**
 * Driver home — matches `fleet-dashboard-page` shell: same header, max-w-7xl, Card grid.
 */
export function DriverDashboardHome({ snapshot, companyName }: Props) {
  const hos = snapshot?.hos
  const load = snapshot?.activeLoad
  const dvir = snapshot?.dvir
  const viol = snapshot?.violations24h

  const hosTone = hos ? metricTone(hos.severity) : "text-muted-foreground"

  return (
    <div className="w-full min-h-full bg-background" data-testid="driver-dashboard">
      {/* Same page header pattern as fleet dashboard */}
      <div className="border-b border-border bg-card/80 backdrop-blur-sm px-4 md:px-8 py-4 md:py-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dashboard</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Driver view — hours of service, assigned load, and inspections.
              </p>
              {companyName ? (
                <p className="text-muted-foreground text-xs mt-0.5" data-testid="dashboard-company">
                  Viewing: <span className="font-medium text-foreground">{companyName}</span>
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/dashboard/loads">
                <Button variant="outline" className="w-full sm:w-auto">
                  My loads
                </Button>
              </Link>
              <Link href="/dashboard/eld">
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto">
                  Open ELD
                  <ArrowRight className="w-4 h-4 ml-2" aria-hidden />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Same content shell as fleet: max-w-7xl mx-auto space-y-6 */}
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Metric strip — mirrors financial overview row (4 cards) */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-border bg-card/50 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium mb-2">Drive remaining</p>
                  <p className={`text-2xl font-bold tabular-nums ${hos ? hosTone : "text-muted-foreground"}`}>
                    {hos ? formatHours(hos.remainingDriveHours) : "—"}
                  </p>
                </div>
                <Shield className="w-5 h-5 text-primary opacity-70" aria-hidden />
              </div>
              <p className="text-xs text-muted-foreground mt-2">11-hour window</p>
            </Card>

            <Card className="border-border bg-card/50 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium mb-2">Shift remaining</p>
                  <p className={`text-2xl font-bold tabular-nums ${hos ? hosTone : "text-muted-foreground"}`}>
                    {hos ? formatHours(hos.remainingShiftHours) : "—"}
                  </p>
                </div>
                <Shield className="w-5 h-5 text-blue-400 opacity-70" aria-hidden />
              </div>
              <p className="text-xs text-muted-foreground mt-2">14-hour on-duty</p>
            </Card>

            <Card className="border-border bg-card/50 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium mb-2">Cycle remaining</p>
                  <p className={`text-2xl font-bold tabular-nums ${hos ? hosTone : "text-muted-foreground"}`}>
                    {hos ? formatHours(hos.remainingCycleHours) : "—"}
                  </p>
                </div>
                <Shield className="w-5 h-5 text-purple-400 opacity-70" aria-hidden />
              </div>
              <p className="text-xs text-muted-foreground mt-2">70-hour / 8-day</p>
            </Card>

            <Card className="border-border bg-card/50 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium mb-2">Duty status</p>
                  {hos ? (
                    <p className="text-2xl font-bold text-foreground capitalize">
                      {formatDutyLabel(hos.currentDutyStatus)}
                    </p>
                  ) : (
                    <p className="text-2xl font-bold text-muted-foreground">—</p>
                  )}
                </div>
                <Shield className="w-5 h-5 text-green-400 opacity-70" aria-hidden />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {hos ? "From today's ELD logs" : "Add ELD logs to update"}
              </p>
            </Card>
          </div>

          {!hos ? (
            <Card className="border-border bg-card/50 p-4 md:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  No HOS clocks for today yet. Open ELD to record duty or verify your driver profile.
                </p>
                <Link href="/dashboard/eld">
                  <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto shrink-0">
                    Go to ELD
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </Card>
          ) : null}

          {hos?.needsBreak ? (
            <Card className="border-amber-500/30 bg-amber-500/5 p-4">
              <p className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
                <Sparkles className="h-4 w-4 shrink-0" />
                30-minute break required after 8 hours driving.
              </p>
            </Card>
          ) : null}

          {/* Reminders — same widget as fleet dashboard (half-width on md+) */}
          <div className="grid md:grid-cols-2 gap-6">
            <Suspense
              fallback={
                <div className="h-48 animate-pulse bg-muted rounded-lg" aria-label="Loading reminders" />
              }
            >
              <RemindersWidget />
            </Suspense>
          </div>

          {/* Second row — two cards like trucks/drivers on fleet dashboard */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="border-border bg-card/50 p-6 hover:shadow-lg transition-shadow flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Package className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Current load</p>
                    <p className="text-xl font-bold text-foreground truncate">
                      {load?.shipment_number || "No assignment"}
                    </p>
                  </div>
                </div>
              </div>
              {load ? (
                <>
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {load.origin || "—"} → {load.destination || "—"}
                  </p>
                  <div className="flex-1" />
                  <Link href={`/dashboard/loads/${load.id}`} className="mt-auto">
                    <Button variant="outline" size="sm" className="w-full">
                      View load details
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </>
              ) : (
                <p className="text-sm text-muted-foreground italic flex-1">
                  Your dispatcher will attach loads here when assigned.
                </p>
              )}
            </Card>

            <Card className="border-border bg-card/50 p-6 hover:shadow-lg transition-shadow flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-500/10 rounded-lg">
                    <ClipboardCheck className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">DVIR</p>
                    <p className="text-xl font-bold text-foreground">Inspection</p>
                  </div>
                </div>
              </div>
              <div className="flex-1 flex flex-col justify-center">
                {dvir?.preTripCompletedToday ? (
                  <p className="flex items-center gap-2 text-sm text-green-400">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    Pre-trip completed today
                  </p>
                ) : (
                  <p className="text-sm text-yellow-400 mb-4">Pre-trip not completed for today.</p>
                )}
                {dvir?.postTripPrompt ? (
                  <Link href="/dashboard/dvir/new" className="mb-2">
                    <Button variant="outline" size="sm" className="w-full">
                      Post-trip DVIR
                    </Button>
                  </Link>
                ) : null}
                {!dvir?.preTripCompletedToday ? (
                  <Link href="/dashboard/dvir/new" className="mt-auto">
                    <Button size="sm" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                      Start pre-trip DVIR
                    </Button>
                  </Link>
                ) : null}
              </div>
            </Card>
          </div>

          {/* Compliance — single wide card, fleet “alerts” feel */}
          <Card
            className={`border-border bg-card/50 p-6 ${
              viol && viol.count > 0 ? "border-red-500/40" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <AlertTriangle
                    className={`w-5 h-5 ${viol && viol.count > 0 ? "text-red-400" : "text-green-400"}`}
                  />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm font-medium mb-1">Compliance (24h)</p>
                  <p className="text-lg font-bold text-foreground">
                    {viol && viol.count > 0 ? `${viol.count} open item(s)` : "All clear"}
                  </p>
                  {viol && viol.count > 0 ? (
                    <ul className="mt-3 space-y-2 text-sm text-foreground">
                      {viol.items.slice(0, 5).map((v, i) => (
                        <li key={i} className="border-l-2 border-red-500/50 pl-3">
                          {v.title}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">No active HOS violations in the last 24 hours.</p>
                  )}
                </div>
              </div>
              <Link href="/dashboard/eld/violations">
                <Button variant="outline" size="sm">
                  History
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </Card>

          {/* Quick links — same card row pattern */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="border-border bg-card/50 p-6 hover:shadow-lg transition-shadow">
              <Link href="/dashboard/documents" className="flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <FolderOpen className="w-5 h-5 text-primary opacity-70" />
                  <div>
                    <p className="font-medium text-foreground">Documents</p>
                    <p className="text-xs text-muted-foreground">BOLs, PODs, uploads</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </Card>
            <Card className="border-border bg-card/50 p-6 hover:shadow-lg transition-shadow">
              <Link href="/dashboard/notifications" className="flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-primary opacity-70" />
                  <div>
                    <p className="font-medium text-foreground">Notifications</p>
                    <p className="text-xs text-muted-foreground">Alerts for your account</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
