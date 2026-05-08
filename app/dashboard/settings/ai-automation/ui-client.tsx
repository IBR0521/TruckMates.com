"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertTriangle, ChevronDown, Pause, Play, Settings2, Clock, CheckCircle2, XCircle, RotateCcw } from "lucide-react"
import { createClient as createBrowserClient } from "@/lib/supabase/client"
import { loadCompanyAutomationSettings, saveAutomationConfig } from "./actions"
import type { AutomationConfig } from "@/lib/ai/agent/types"
import { cn } from "@/lib/utils"
import Link from "next/link"

type Mode = "off" | "notify" | "approval" | "autonomous"

type AutomationMeta = {
  key: string
  name: string
  description: string
}

type AutomationCategory = {
  title: string
  items: AutomationMeta[]
}

type AutomationLogRow = {
  id: string
  automation_type: string
  triggered: boolean
  approved: boolean | null
  action_taken: string | null
  reversed_at: string | null
  created_at: string
}

const GLOBAL_OVERRIDE_KEY = "__company_pause_override__"

const CATEGORIES: AutomationCategory[] = [
  {
    title: "Dispatch & Loads",
    items: [
      { key: "driver_assignment", name: "Driver Assignment", description: "Suggests and assigns the best available driver for newly created or unassigned loads." },
      { key: "load_status_auto_update", name: "Load Status Auto-Update", description: "Advances load status when operational events indicate dispatch, transit, or delivery milestones." },
      { key: "detention_clock", name: "Detention Clock", description: "Monitors dwell time and triggers detention tracking when free-time thresholds are exceeded." },
      { key: "backhaul_matching", name: "Backhaul Matching", description: "Finds compatible return loads to reduce empty miles and improve truck utilization." },
    ],
  },
  {
    title: "Fleet & Maintenance",
    items: [
      { key: "predictive_maintenance", name: "Predictive Maintenance Work Orders", description: "Flags high-risk vehicles and recommends proactive maintenance before failures occur." },
      { key: "fuel_anomaly", name: "Fuel Anomaly Detection", description: "Detects unusual fuel spend or product patterns that may indicate waste, error, or misuse." },
      { key: "idle_time_alert", name: "Idle Time Alerts", description: "Alerts when extended idling is detected to reduce fuel waste and operating costs." },
      { key: "unresponsive_driver", name: "Unresponsive Driver Alert", description: "Escalates when expected driver updates or check-ins are missing for active loads." },
    ],
  },
  {
    title: "Finance",
    items: [
      { key: "invoice_auto_generation", name: "Invoice Auto-Generation", description: "Creates customer invoices automatically when delivery and billing conditions are met." },
      { key: "payment_followup", name: "Payment Follow-Up Sequence", description: "Schedules collection follow-ups as invoices move into aging buckets." },
      { key: "credit_hold", name: "Credit Hold Trigger", description: "Recommends or applies credit holds when account risk crosses policy limits." },
      { key: "cash_flow_alert", name: "Cash Flow Alert", description: "Warns when projected short-term cash position approaches unsafe thresholds." },
    ],
  },
  {
    title: "Compliance",
    items: [
      { key: "document_expiry_alert", name: "Document Expiry Alerts", description: "Tracks expiring compliance documents and notifies operations before expiration." },
      { key: "csa_threshold_alert", name: "CSA Score Monitoring", description: "Flags CSA BASIC score threshold crossings to trigger early warning or intervention." },
      { key: "hos_violation_prevention", name: "HOS Violation Prevention", description: "Prevents assignments likely to cause hours-of-service violations based on duty time." },
    ],
  },
  {
    title: "Customer",
    items: [
      { key: "churn_risk", name: "Churn Risk Detection", description: "Identifies account behavior patterns that suggest elevated customer churn risk." },
    ],
  },
]

const AUTOMATION_KEYS = CATEGORIES.flatMap((c) => c.items.map((i) => i.key))

function toModeLabel(value: Mode): string {
  if (value === "off") return "Off"
  if (value === "notify") return "Notify Only"
  if (value === "approval") return "Needs Approval"
  return "Autonomous"
}

function modeBadgeClass(value: Mode): string {
  if (value === "autonomous") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
  if (value === "approval") return "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
  if (value === "notify") return "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400"
  return "border-muted-foreground/25 bg-muted/30 text-muted-foreground"
}

function logOutcomeIcon(log: AutomationLogRow) {
  if (log.reversed_at) return <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
  if (log.approved === true) return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
  if (log.approved === false) return <XCircle className="h-3.5 w-3.5 text-destructive" />
  if (!log.triggered) return <Clock className="h-3.5 w-3.5 text-muted-foreground" />
  return <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
}

function logOutcomeLabel(log: AutomationLogRow): string {
  if (log.reversed_at) return "Reversed"
  if (log.approved === true) return "Approved"
  if (log.approved === false) return "Rejected"
  if (!log.triggered) return "Evaluated — no action"
  return log.action_taken ?? "Executed"
}

export function AiAutomationClientPage({ companyId }: { companyId: string }) {
  const [configs, setConfigs] = useState<Record<string, AutomationConfig>>({})
  const [logsByType, setLogsByType] = useState<Record<string, AutomationLogRow[]>>({})
  const [loading, setLoading] = useState(true)
  const [savingKeys, setSavingKeys] = useState<Record<string, boolean>>({})
  const [pauseAll, setPauseAll] = useState(false)
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({})

  const loadPageData = useCallback(async () => {
    setLoading(true)
    try {
      const settingsResult = await loadCompanyAutomationSettings(companyId)
      if (settingsResult.error) toast.error(settingsResult.error)

      const nextConfigs: Record<string, AutomationConfig> = {}
      for (const config of settingsResult.data || []) {
        nextConfigs[config.automationType] = config
      }

      const globalConfig = nextConfigs[GLOBAL_OVERRIDE_KEY]
      const paused = Boolean(globalConfig?.config?.pausedAll)

      const supabase = createBrowserClient()
      const { data: logs } = await supabase
        .from("ai_automation_logs")
        .select("id, automation_type, triggered, approved, action_taken, reversed_at, created_at")
        .eq("company_id", companyId)
        .in("automation_type", AUTOMATION_KEYS)
        .order("created_at", { ascending: false })
        .limit(300)

      const grouped: Record<string, AutomationLogRow[]> = {}
      for (const key of AUTOMATION_KEYS) grouped[key] = []
      for (const row of (logs || []) as AutomationLogRow[]) {
        if (!grouped[row.automation_type]) grouped[row.automation_type] = []
        if (grouped[row.automation_type].length < 5) grouped[row.automation_type].push(row)
      }

      setPauseAll(paused)
      setConfigs(nextConfigs)
      setLogsByType(grouped)
    } catch {
      toast.error("Failed to load AI automation settings")
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => { loadPageData() }, [loadPageData])

  const upsertConfigOptimistic = useCallback(
    async (
      automationType: string,
      patch: Partial<Pick<AutomationConfig, "enabled" | "level" | "confidenceThreshold" | "config">>,
    ) => {
      const prev = configs[automationType]
      if (!prev) return

      const optimistic: AutomationConfig = {
        ...prev,
        ...patch,
        config: patch.config ? { ...prev.config, ...patch.config } : prev.config,
      }

      setConfigs((c) => ({ ...c, [automationType]: optimistic }))
      setSavingKeys((c) => ({ ...c, [automationType]: true }))

      const result = await saveAutomationConfig(companyId, automationType, {
        enabled: optimistic.enabled,
        level: optimistic.level,
        confidenceThreshold: optimistic.confidenceThreshold,
        config: optimistic.config,
      })

      setSavingKeys((c) => ({ ...c, [automationType]: false }))
      if (result.error) {
        setConfigs((c) => ({ ...c, [automationType]: prev }))
        toast.error(result.error)
      }
    },
    [companyId, configs],
  )

  const handlePauseAllToggle = useCallback(
    async (checked: boolean) => {
      const previous = pauseAll
      setPauseAll(checked)
      setSavingKeys((c) => ({ ...c, [GLOBAL_OVERRIDE_KEY]: true }))

      const result = await saveAutomationConfig(companyId, GLOBAL_OVERRIDE_KEY, {
        enabled: true,
        level: "notify",
        confidenceThreshold: 70,
        config: { pausedAll: checked },
      })

      setSavingKeys((c) => ({ ...c, [GLOBAL_OVERRIDE_KEY]: false }))
      if (result.error) {
        setPauseAll(previous)
        toast.error(result.error)
      }
    },
    [companyId, pauseAll],
  )

  const activeCount = useMemo(
    () => AUTOMATION_KEYS.filter((key) => configs[key]?.enabled && configs[key]?.level !== "off").length,
    [configs],
  )

  return (
    <div className="w-full">
      {/* Page header */}
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">AI Automation</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Configure what TruckMates AI does automatically and when it asks for approval
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/settings/ai-automation/pending-approvals">
              <Button variant="outline" size="sm">
                Pending approvals
              </Button>
            </Link>
            <Button
              size="sm"
              variant={pauseAll ? "default" : "outline"}
              disabled={Boolean(savingKeys[GLOBAL_OVERRIDE_KEY])}
              onClick={() => handlePauseAllToggle(!pauseAll)}
              className={pauseAll ? "bg-amber-500 hover:bg-amber-600 border-amber-500 text-white" : ""}
            >
              {pauseAll ? (
                <><Play className="h-3.5 w-3.5 mr-1.5" /> Resume all</>
              ) : (
                <><Pause className="h-3.5 w-3.5 mr-1.5" /> Pause all</>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-8">
        <div className="mx-auto max-w-5xl space-y-8">

          {/* Active pause banner */}
          {pauseAll && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
              <div>
                <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">All automations paused</p>
                <p className="text-sm text-amber-600/70 dark:text-amber-400/70">
                  No AI actions will execute until you resume. Existing logs and settings are preserved.
                </p>
              </div>
            </div>
          )}

          {/* Stats bar */}
          {!loading && (
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span>
                <span className="font-semibold text-foreground">{activeCount}</span> of {AUTOMATION_KEYS.length} automations active
              </span>
              <span className="h-4 w-px bg-border" />
              <span>Changes save automatically</span>
            </div>
          )}

          {loading ? (
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border border-border overflow-hidden">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className={cn("h-16 animate-pulse bg-muted/30", j > 1 && "border-t border-border")} />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            CATEGORIES.map((category) => (
              <section key={category.title} className="space-y-3">
                {/* Category label */}
                <div className="flex items-center gap-3 px-0.5">
                  <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground/70">
                    {category.title}
                  </h2>
                  <div className="h-px flex-1 bg-border/60" />
                </div>

                {/* Automation rows */}
                <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
                  {category.items.map((item) => {
                    const config = configs[item.key]
                    if (!config) return null

                    const logs = logsByType[item.key] || []
                    const expanded = Boolean(expandedKeys[item.key])
                    const isSaving = Boolean(savingKeys[item.key])
                    const disabled = isSaving || pauseAll

                    return (
                      <div key={item.key}>
                        {/* Main row */}
                        <div className={cn(
                          "flex items-center gap-4 px-5 py-4 transition-colors",
                          !config.enabled && "opacity-60",
                        )}>
                          {/* Name + description */}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-foreground leading-tight">
                                {item.name}
                              </span>
                              <Badge
                                variant="outline"
                                className={cn("text-[11px] font-medium px-2 py-0 h-5 rounded-full", modeBadgeClass(config.level as Mode))}
                              >
                                {toModeLabel(config.level as Mode)}
                              </Badge>
                              {isSaving && (
                                <span className="text-xs text-muted-foreground animate-pulse">Saving…</span>
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed hidden sm:block">
                              {item.description}
                            </p>
                          </div>

                          {/* Inline controls */}
                          <div className="flex items-center gap-3 flex-shrink-0">
                            {/* Mode — hidden on mobile */}
                            <div className="hidden md:block">
                              <Select
                                value={config.level}
                                onValueChange={(v) => void upsertConfigOptimistic(item.key, { level: v as Mode })}
                                disabled={disabled}
                              >
                                <SelectTrigger className="h-8 w-40 text-xs border-border/70">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="off">Off</SelectItem>
                                  <SelectItem value="notify">Notify Only</SelectItem>
                                  <SelectItem value="approval">Needs Approval</SelectItem>
                                  <SelectItem value="autonomous">Autonomous</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Confidence */}
                            <div className="hidden lg:flex items-center gap-1 text-xs text-muted-foreground">
                              <span className="w-14 text-right font-medium text-foreground">
                                {config.confidenceThreshold}%
                              </span>
                              <span>min</span>
                            </div>

                            {/* Enable toggle */}
                            <Switch
                              checked={config.enabled}
                              disabled={disabled}
                              onCheckedChange={(v) => void upsertConfigOptimistic(item.key, { enabled: v })}
                              aria-label={`${item.name} enabled`}
                            />

                            {/* Expand */}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => setExpandedKeys((c) => ({ ...c, [item.key]: !expanded }))}
                              aria-label="Expand settings"
                            >
                              <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", expanded && "rotate-180")} />
                            </Button>
                          </div>
                        </div>

                        {/* Expanded panel */}
                        {expanded && (
                          <div className="border-t border-border/50 bg-muted/20 px-5 py-5 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Mode (full with descriptions) */}
                              <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  Automation Mode
                                </label>
                                <Select
                                  value={config.level}
                                  onValueChange={(v) => void upsertConfigOptimistic(item.key, { level: v as Mode })}
                                  disabled={disabled}
                                >
                                  <SelectTrigger className="h-9 border-border/70">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="off">Off — AI never acts on this</SelectItem>
                                    <SelectItem value="notify">Notify Only — alert, no action taken</SelectItem>
                                    <SelectItem value="approval">Needs Approval — queues for human review</SelectItem>
                                    <SelectItem value="autonomous">Autonomous — executes automatically</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Confidence threshold */}
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Confidence Threshold
                                  </label>
                                  <span className="text-sm font-semibold text-foreground tabular-nums">
                                    {config.confidenceThreshold}%
                                  </span>
                                </div>
                                <Slider
                                  min={50}
                                  max={95}
                                  step={5}
                                  value={[config.confidenceThreshold]}
                                  disabled={disabled}
                                  onValueChange={(v) =>
                                    setConfigs((c) => ({
                                      ...c,
                                      [item.key]: { ...c[item.key], confidenceThreshold: Number(v[0] || 70) },
                                    }))
                                  }
                                  onValueCommit={(v) =>
                                    void upsertConfigOptimistic(item.key, { confidenceThreshold: Number(v[0] || 70) })
                                  }
                                />
                                <div className="flex justify-between text-[11px] text-muted-foreground">
                                  <span>50% — acts more often</span>
                                  <span>95% — acts only when certain</span>
                                </div>
                              </div>
                            </div>

                            {/* Recent activity */}
                            <div className="space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Recent Activity
                              </p>
                              {logs.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-1">No recent activity for this automation.</p>
                              ) : (
                                <div className="rounded-lg border border-border/50 overflow-hidden divide-y divide-border/40">
                                  {logs.map((log) => (
                                    <div key={log.id} className="flex items-center justify-between gap-4 bg-background px-4 py-2.5">
                                      <div className="flex items-center gap-2.5">
                                        {logOutcomeIcon(log)}
                                        <span className="text-sm text-foreground">{logOutcomeLabel(log)}</span>
                                      </div>
                                      <span className="text-xs text-muted-foreground flex-shrink-0 tabular-nums">
                                        {new Date(log.created_at).toLocaleString(undefined, {
                                          month: "short", day: "numeric",
                                          hour: "2-digit", minute: "2-digit",
                                        })}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
