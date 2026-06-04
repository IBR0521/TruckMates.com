import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  FileText,
  Package,
  ShieldAlert,
  Sparkles,
  SunMedium,
  Timer,
  Users,
  Wrench,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PreviewMetricCard } from "./preview-metric-card"
import { cn } from "@/lib/utils"

function severityTone(sev: "critical" | "high" | "neutral") {
  if (sev === "critical") return "border-rose-500/40 bg-rose-500/10"
  if (sev === "high") return "border-amber-500/40 bg-amber-500/10"
  return "border-border bg-muted/40"
}

const BRIEFING_ALERTS = [
  {
    severity: "critical" as const,
    title: "Overdue invoices",
    description: "2 invoices overdue 60+ days — $8,400",
    action: "Review invoices",
  },
  {
    severity: "high" as const,
    title: "Insurance expiring",
    description: "Unit 089 insurance expires in 4 days",
    action: "Open compliance",
  },
  {
    severity: "neutral" as const,
    title: "Drivers on duty",
    description: "14 drivers on duty, all HOS compliant",
    action: "View roster",
  },
]

export function DashboardPreview() {
  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Morning Operations View</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1.5 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
          <span className="font-medium text-foreground">Live</span>
          <span>•</span>
          <span>Updated 4m ago</span>
        </div>
      </div>

      {/* Max 3 cols — hero preview content area is narrow beside the sidebar */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <PreviewMetricCard
          title="Loads Today"
          icon={Package}
          tone="good"
          primary="8"
          secondary={[
            { label: "Scheduled", value: 5 },
            { label: "Delivered", value: 12, tone: "good" },
            { label: "Cancelled", value: 0 },
          ]}
        />
        <PreviewMetricCard
          title="Driver Coverage"
          icon={Users}
          tone="good"
          primary="14 active"
          secondary={[
            { label: "Total", value: 18 },
            { label: "Idle", value: 4, tone: "warning" },
            { label: "Coverage", value: "78%" },
          ]}
        />
        <PreviewMetricCard
          title="Receivables"
          icon={FileText}
          tone="warning"
          primary="$42.8k"
          secondary={[
            { label: "Revenue", value: "$248.5k", tone: "good" },
            { label: "Expenses", value: "$176.2k" },
            { label: "Net", value: "$72.3k", tone: "good" },
          ]}
        />
        <PreviewMetricCard
          title="Exceptions"
          icon={AlertCircle}
          tone="danger"
          primary="3 total"
          secondary={[
            { label: "Invoices", value: 2, tone: "danger" },
            { label: "Deliveries", value: 1, tone: "warning" },
            { label: "Maintenance", value: 0 },
          ]}
        />
        <PreviewMetricCard
          title="Fleet Readiness"
          icon={Wrench}
          tone="good"
          primary="16/18"
          secondary={[
            { label: "Utilization", value: "89%", tone: "good" },
            { label: "Maint.", value: 1, tone: "warning" },
            { label: "Routes", value: "6/8" },
          ]}
        />
      </div>

      <Card className="relative overflow-hidden border-primary/25 bg-gradient-to-br from-card via-card to-primary/5 shadow-md">
        <div className="space-y-4 p-4 md:p-6">
          <div className="flex items-start gap-3">
            <div className="shrink-0 rounded-lg border border-primary/30 bg-primary/10 p-2">
              <Sparkles className="h-5 w-5 text-primary" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold tracking-tight text-foreground">Morning Briefing</h3>
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  <Sparkles className="h-3 w-3" aria-hidden />
                  AI
                </span>
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <SunMedium className="h-4 w-4 text-amber-500" aria-hidden />
                Tuesday, June 2, 2026
              </p>
            </div>
          </div>

          <ul className="space-y-2">
            {BRIEFING_ALERTS.map((alert) => (
              <li
                key={alert.title}
                className={cn("rounded-md border px-3 py-2 text-xs", severityTone(alert.severity))}
              >
                <div className="flex justify-between gap-2">
                  <span className="font-medium text-foreground">{alert.title}</span>
                  <Button type="button" variant="link" className="h-auto p-0 text-xs" tabIndex={-1}>
                    {alert.action}
                  </Button>
                </div>
                <p className="mt-1 text-muted-foreground">{alert.description}</p>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <div className="hidden gap-4 md:grid sm:grid-cols-2 xl:grid-cols-3">
        <Card className="border-border/70 bg-card/70 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/90">
                Safety — last 7 days
              </p>
              <p className="mt-2 text-2xl font-bold text-foreground">12</p>
              <p className="mt-1 text-xs text-muted-foreground">4 harsh brakes · 3 speeding · 5 other</p>
              <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                vs prior 7 days:{" "}
                <span className="inline-flex items-center text-emerald-500">
                  <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />
                  lower
                </span>
              </p>
            </div>
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-rose-400">
              <ShieldAlert className="h-4 w-4" aria-hidden />
            </div>
          </div>
        </Card>

        <Card className="border-border/70 bg-card/70 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/90">
                Idle — last 7 days
              </p>
              <p className="mt-2 text-2xl font-bold text-foreground">38 h</p>
              <p className="mt-1 text-xs text-muted-foreground">Est. fuel 142 gal · ~$512</p>
            </div>
            <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-2 text-sky-400">
              <Timer className="h-4 w-4" aria-hidden />
            </div>
          </div>
        </Card>

        <Card className="border-border/80 bg-card/80 p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/90">
            Safety scorecards
          </p>
          <p className="mt-2 text-2xl font-bold text-foreground">
            87.4 <span className="text-lg font-semibold text-muted-foreground">/ B</span>
          </p>
          <div className="mt-4 grid gap-4 border-t border-border/40 pt-4 md:grid-cols-2">
            <div>
              <p className="text-[11px] font-medium uppercase text-muted-foreground">Top performers</p>
              <ol className="mt-2 space-y-1 text-sm">
                <li className="flex justify-between gap-2">
                  <span className="truncate text-foreground">1. R. Okafor</span>
                  <span className="shrink-0 font-medium text-emerald-400">94.2</span>
                </li>
                <li className="flex justify-between gap-2">
                  <span className="truncate text-foreground">2. M. Delgado</span>
                  <span className="shrink-0 font-medium text-emerald-400">91.8</span>
                </li>
              </ol>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase text-muted-foreground">Coaching support</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li className="flex justify-between gap-2">
                  <span className="truncate">T. Vasquez</span>
                  <span className="shrink-0">72.1</span>
                </li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
