"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, AlertTriangle, RefreshCw, Sparkles } from "lucide-react"
import { createClient as createBrowserClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type ActivityRow = {
  id: string
  automation_type: string
  triggered: boolean | null
  approved: boolean | null
  action_taken: string | null
  reversed_at: string | null
  reasoning: string | null
  confidence: number | null
  created_at: string | null
}

const AUTOMATION_LABELS: Record<string, string> = {
  load_status_auto_update: "Load Status Auto-Update",
  detention_clock: "Detention Clock",
  hos_violation_prevention: "HOS Violation Prevention",
  driver_assignment: "Driver Assignment",
  backhaul_matching: "Backhaul Matching",
  predictive_maintenance: "Predictive Maintenance",
  invoice_auto_generation: "Invoice Auto-Generation",
  payment_followup: "Payment Follow-Up",
  credit_hold: "Credit Hold",
  document_expiry_alert: "Document Expiry Alerts",
  csa_threshold_alert: "CSA Score Monitoring",
  fuel_anomaly: "Fuel Anomaly Detection",
  idle_time_alert: "Idle Time Alerts",
  unresponsive_driver: "Unresponsive Driver Alert",
  churn_risk: "Churn Risk Detection",
  cash_flow_alert: "Cash Flow Alert",
}

function labelFor(type: string): string {
  return AUTOMATION_LABELS[type] || type.replace(/_/g, " ")
}

type Tone = "done" | "approved" | "pending" | "rejected" | "reversed" | "none" | "error"

// The AI (or its data call) failed — this is an outage, not automation "activity". Surface it honestly
// instead of mislabeling it "reviewed, no action needed".
const SYSTEM_ERROR_RE =
  /credit balance|too low to access|connection timeout|failed to connect|ai unavailable|ai quota|check your internet|temporarily unavailable|database server error/i

function isSystemError(row: ActivityRow): boolean {
  return SYSTEM_ERROR_RE.test(String(row.reasoning || ""))
}

function outcomeFor(row: ActivityRow): { label: string; tone: Tone } {
  if (isSystemError(row)) return { label: "AI unavailable", tone: "error" }
  if (row.reversed_at) return { label: "Reversed", tone: "reversed" }
  if (row.approved === false) return { label: "Rejected", tone: "rejected" }
  if (row.approved === true) return { label: "Approved & ran", tone: "approved" }
  if (row.action_taken === "pending_approval") return { label: "Awaiting approval", tone: "pending" }
  if (!row.triggered) return { label: "Reviewed — no action needed", tone: "none" }
  return { label: "Done automatically", tone: "done" }
}

function toneClass(tone: Tone): string {
  switch (tone) {
    case "done":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    case "approved":
      return "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400"
    case "pending":
      return "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
    case "rejected":
      return "border-destructive/40 bg-destructive/10 text-destructive"
    case "reversed":
      return "border-muted-foreground/30 bg-muted/40 text-muted-foreground"
    case "error":
      return "border-destructive/40 bg-destructive/10 text-destructive"
    default:
      return "border-border bg-muted/30 text-muted-foreground"
  }
}

function timeAgo(iso: string | null): string {
  if (!iso) return ""
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return "just now"
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

export function AutomationActivityClientPage({ companyId }: { companyId: string }) {
  const supabase = useMemo(() => createBrowserClient(), [])
  const [rows, setRows] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [onlyActions, setOnlyActions] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("ai_automation_logs")
        .select("id, automation_type, triggered, approved, action_taken, reversed_at, reasoning, confidence, created_at")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(200)
      if (error) {
        toast.error("Failed to load automation activity")
        return
      }
      setRows((data || []) as ActivityRow[])
    } finally {
      setLoading(false)
    }
  }, [supabase, companyId])

  useEffect(() => {
    load()
  }, [load])

  const visible = useMemo(
    () => (onlyActions ? rows.filter((r) => r.triggered || r.action_taken === "pending_approval") : rows),
    [rows, onlyActions],
  )

  const autoCount = useMemo(
    () =>
      rows.filter(
        (r) => r.triggered && r.approved !== false && !r.reversed_at && r.action_taken !== "pending_approval",
      ).length,
    [rows],
  )

  const systemErrorCount = useMemo(() => rows.filter(isSystemError).length, [rows])

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Link href="/dashboard/settings/ai-automation">
                <Button variant="ghost" size="sm" className="h-7 px-2">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <h1 className="text-2xl font-bold text-foreground">Automation Activity</h1>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Everything TruckMates AI has handled, evaluated, or flagged for you.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant={onlyActions ? "default" : "outline"} size="sm" onClick={() => setOnlyActions((v) => !v)}>
              {onlyActions ? "Showing actions only" : "Actions only"}
            </Button>
            <Button variant="outline" size="sm" disabled={loading} onClick={() => void load()}>
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-8">
        <div className="mx-auto max-w-3xl space-y-6">
          {!loading && systemErrorCount > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
              <div>
                <p className="text-sm font-semibold text-destructive">
                  AI couldn&apos;t run for {systemErrorCount} of these {rows.length} events
                </p>
                <p className="text-sm text-destructive/80">
                  The automation hit an API or connection error — most often a low Anthropic API credit balance.
                  Autonomous actions stay paused until it&apos;s restored. Check your Anthropic API billing (console.anthropic.com → Plans &amp; Billing).
                </p>
              </div>
            </div>
          )}
          {!loading && (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3.5">
              <Sparkles className="h-4 w-4 flex-shrink-0 text-emerald-500" />
              <p className="text-sm text-foreground">
                <span className="font-semibold">{autoCount}</span> action{autoCount === 1 ? "" : "s"} handled
                automatically across the last {rows.length} events.
              </p>
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/30" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">
              No automation activity yet. Turn on autopilot and TruckMates AI will start handling work here.
            </div>
          ) : (
            <div className="space-y-2.5">
              {visible.map((row) => {
                const outcome = outcomeFor(row)
                return (
                  <div key={row.id} className="rounded-lg border border-border bg-card/40 p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{labelFor(row.automation_type)}</span>
                          <Badge
                            variant="outline"
                            className={cn("h-5 rounded-full px-2 py-0 text-[10px] font-medium", toneClass(outcome.tone))}
                          >
                            {outcome.label}
                          </Badge>
                        </div>
                        {row.reasoning ? (
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{row.reasoning}</p>
                        ) : null}
                      </div>
                      <span className="flex-shrink-0 whitespace-nowrap text-[11px] text-muted-foreground">
                        {timeAgo(row.created_at)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
