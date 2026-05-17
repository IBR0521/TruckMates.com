"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ChevronDown,
  DollarSign,
  Loader2,
  RefreshCw,
  Sparkles,
  SunMedium,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { getPlanFeatureGate } from "@/app/actions/plan-usage"
import {
  dismissBriefing,
  generateBriefingOnDemand,
  getTodaysBriefing,
  markBriefingItemActioned,
} from "@/app/actions/ai-briefing"
import type { BriefingAlert } from "@/lib/ai/briefing"
import { cn } from "@/lib/utils"

function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    Number.isFinite(n) ? n : 0,
  )
}

function severityTone(sev: BriefingAlert["severity"]): string {
  if (sev === "critical") return "border-rose-500/40 bg-rose-500/10"
  if (sev === "high") return "border-amber-500/40 bg-amber-500/10"
  return "border-border bg-muted/40"
}

function ActionLink({ href, label }: { href: string; label: string }) {
  const isInternal = href.startsWith("/")
  if (isInternal) {
    return (
      <Button asChild variant="link" className="h-auto p-0 text-xs">
        <Link href={href}>{label}</Link>
      </Button>
    )
  }
  return (
    <Button asChild variant="link" className="h-auto p-0 text-xs">
      <a href={href} target="_blank" rel="noopener noreferrer">
        {label}
      </a>
    </Button>
  )
}

export function MorningBriefingCard() {
  const [eligible, setEligible] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [briefing, setBriefing] = useState<Awaited<ReturnType<typeof getTodaysBriefing>>["data"]>(null)
  const [actioned, setActioned] = useState<Set<string>>(new Set())
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    if (!isExpanded) return
    let active = true
    getPlanFeatureGate("ai_morning_briefing")
      .then((res) => {
        if (!active) return
        setEligible(Boolean(res.data?.allowed))
      })
      .catch(() => {
        if (active) setEligible(false)
      })
    return () => {
      active = false
    }
  }, [isExpanded])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getTodaysBriefing()
      if (res.error) {
        toast.error(res.error)
        setBriefing(null)
        return
      }
      setBriefing(res.data)
      if (res.data?.actioned_items?.length) {
        setActioned(new Set(res.data.actioned_items))
      } else {
        setActioned(new Set())
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (eligible !== true) return
    if (!isExpanded) return
    void load()
  }, [eligible, load, isExpanded])

  const handleDismiss = async () => {
    if (!briefing?.id) return
    const res = await dismissBriefing(briefing.id)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.message("Briefing dismissed for today.")
    setBriefing(null)
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const res = await generateBriefingOnDemand()
      if (res.error) {
        toast.error(res.error)
        return
      }
      if (res.quotaWarning) {
        toast.message("You are approaching your monthly AI usage limit.")
      }
      toast.success("Briefing refreshed.")
      await load()
    } finally {
      setRefreshing(false)
    }
  }

  const handleMarkActioned = async (itemId: string) => {
    if (!briefing?.id) return
    setActioned((prev) => new Set(prev).add(itemId))
    const res = await markBriefingItemActioned({ briefingId: briefing.id, itemId })
    if (res.error) {
      toast.error(res.error)
      setActioned((prev) => {
        const next = new Set(prev)
        next.delete(itemId)
        return next
      })
    }
  }

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  if (!isExpanded) {
    return (
      <Card className="relative overflow-hidden border-primary/25 bg-gradient-to-br from-card via-card to-primary/5 shadow-md">
        <div className="absolute right-2 top-2 flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            aria-label="Expand briefing"
            aria-expanded={false}
            onClick={() => setIsExpanded(true)}
          >
            <ChevronDown className="h-4 w-4 transition-transform duration-200" aria-hidden />
          </Button>
        </div>
        <div className="p-4 md:p-6 pr-24">
          <div className="flex items-start gap-3">
            <div className="rounded-lg border border-primary/30 bg-primary/10 p-2 shrink-0">
              <Sparkles className="h-5 w-5 text-primary" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Good morning! Here&apos;s your briefing for {todayLabel}
              </h2>
            </div>
          </div>
        </div>
      </Card>
    )
  }

  if (eligible === false) {
    return null
  }

  if (eligible !== true) {
    return (
      <Card className="relative overflow-hidden border-primary/25 bg-gradient-to-br from-card via-card to-primary/5 shadow-md">
        <div className="p-4 md:p-6 pr-24">
          <div className="flex items-start gap-3">
            <div className="rounded-lg border border-primary/30 bg-primary/10 p-2 shrink-0">
              <Sparkles className="h-5 w-5 text-primary" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Good morning! Here&apos;s your briefing for {todayLabel}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                Loading briefing…
              </p>
            </div>
          </div>
        </div>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card className="border-border/70 bg-card/50 p-4 md:p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-6 w-2/3 max-w-md" />
            <Skeleton className="h-4 w-full max-w-2xl" />
            <Skeleton className="h-4 w-5/6 max-w-xl" />
          </div>
          <Skeleton className="h-9 w-9 rounded-md shrink-0" />
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
      </Card>
    )
  }

  if (!briefing) {
    return (
      <Card className="border-dashed border-border/80 bg-muted/20 p-6 text-center shadow-sm">
        <SunMedium className="mx-auto h-10 w-10 text-muted-foreground mb-3" aria-hidden />
        <p className="text-sm font-medium text-foreground">Morning briefing</p>
        <p className="mt-2 text-sm text-muted-foreground max-w-lg mx-auto">
          Your briefing will be ready by 6am tomorrow (company time). After data is loaded, you can refresh manually—once per hour—and it will count toward AI usage.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="mt-4" disabled={refreshing}>
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Refresh briefing now
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Refresh morning briefing?</AlertDialogTitle>
              <AlertDialogDescription>
                This uses AI and counts toward your monthly AI quota. You can refresh at most once per hour.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
              <AlertDialogAction type="button" onClick={() => void handleRefresh()}>
                Generate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>
    )
  }

  const formattedDay = new Date(`${briefing.briefingDate}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  const alerts = briefing.critical_alerts || []

  return (
    <Card className="relative overflow-hidden border-primary/25 bg-gradient-to-br from-card via-card to-primary/5 shadow-md">
      <div className="absolute right-2 top-2 flex items-center gap-1">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          aria-label={isExpanded ? "Collapse briefing" : "Expand briefing"}
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isExpanded && "rotate-180")} aria-hidden />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label="Refresh briefing" disabled={refreshing}>
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Refresh morning briefing?</AlertDialogTitle>
              <AlertDialogDescription>
                This uses AI and counts toward your monthly AI quota. You can refresh at most once per hour.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
              <AlertDialogAction type="button" onClick={() => void handleRefresh()}>
                Generate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label="Dismiss briefing" onClick={() => void handleDismiss()}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 md:p-6 pr-24 space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg border border-primary/30 bg-primary/10 p-2 shrink-0">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Good morning! Here&apos;s your briefing for {formattedDay}</h2>
          </div>
        </div>

        {isExpanded && (
          <>
            <p className="text-sm text-muted-foreground leading-relaxed">{briefing.summary}</p>

            <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-border/80 bg-background/60 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4 text-rose-500" aria-hidden />
              Need attention
            </div>
            {alerts.length === 0 ? (
              <p className="text-xs text-muted-foreground">No critical issues surfaced — nice work.</p>
            ) : (
              <ul className="space-y-2">
                {alerts.map((a, i) => {
                  const id = `critical_alert:${i}`
                  const done = actioned.has(id)
                  return (
                    <li key={id} className={cn("rounded-md border px-3 py-2 text-xs", severityTone(a.severity), done && "opacity-60 line-through")}>
                      <div className="flex justify-between gap-2">
                        <span className="font-medium">{a.title}</span>
                        <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[10px] shrink-0" disabled={done} onClick={() => void handleMarkActioned(id)}>
                          Done
                        </Button>
                      </div>
                      <p className="mt-1 text-muted-foreground">{a.description}</p>
                      {a.action_url ? (
                        <div className="mt-1">
                          <ActionLink href={a.action_url} label="Open" />
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-border/80 bg-background/60 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <SunMedium className="h-4 w-4 text-amber-500" aria-hidden />
              Today&apos;s outlook
            </div>
            <dl className="grid grid-cols-2 gap-x-2 gap-y-2 text-xs">
              <dt className="text-muted-foreground">Loads scheduled</dt>
              <dd className="font-semibold text-right">{briefing.today_outlook.loads_scheduled}</dd>
              <dt className="text-muted-foreground">In transit</dt>
              <dd className="font-semibold text-right">{briefing.today_outlook.loads_in_transit}</dd>
              <dt className="text-muted-foreground">Drivers available</dt>
              <dd className="font-semibold text-right">{briefing.today_outlook.drivers_available}</dd>
              <dt className="text-muted-foreground">Drivers on duty</dt>
              <dd className="font-semibold text-right">{briefing.today_outlook.drivers_on_duty}</dd>
              <dt className="text-muted-foreground">Expected revenue today</dt>
              <dd className="font-semibold text-right">{formatUsd(briefing.today_outlook.expected_revenue_today)}</dd>
            </dl>
            {(briefing.today_outlook.notable_events || []).length > 0 ? (
              <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
                {(briefing.today_outlook.notable_events || []).map((ev, idx) => (
                  <li key={`${idx}-${ev.slice(0, 24)}`}>{ev}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="rounded-lg border border-border/80 bg-background/60 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <DollarSign className="h-4 w-4 text-emerald-500" aria-hidden />
              Financial pulse
            </div>
            <dl className="grid grid-cols-2 gap-x-2 gap-y-2 text-xs">
              <dt className="text-muted-foreground">Unpaid invoices</dt>
              <dd className="font-semibold text-right">{briefing.financial_highlights.unpaid_invoices_count}</dd>
              <dt className="text-muted-foreground">Unpaid total</dt>
              <dd className="font-semibold text-right">{formatUsd(briefing.financial_highlights.unpaid_invoices_total)}</dd>
              <dt className="text-muted-foreground">Due this week</dt>
              <dd className="font-semibold text-right">{briefing.financial_highlights.invoices_due_this_week}</dd>
              <dt className="text-muted-foreground">Overdue count</dt>
              <dd className="font-semibold text-right">{briefing.financial_highlights.overdue_invoices_count}</dd>
              <dt className="text-muted-foreground">Expected revenue (week)</dt>
              <dd className="font-semibold text-right">{formatUsd(briefing.financial_highlights.expected_revenue_this_week)}</dd>
            </dl>
          </div>
        </div>

        {(briefing.compliance_warnings || []).length > 0 ? (
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-4 space-y-2">
            <p className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />
              Compliance warnings
            </p>
            <ul className="space-y-2">
              {(briefing.compliance_warnings || []).map((w, i) => {
                const id = `compliance_warning:${i}`
                const done = actioned.has(id)
                return (
                  <li key={id} className={cn("text-xs rounded-md border px-3 py-2", severityTone(w.severity), done && "opacity-60 line-through")}>
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{w.title}</span>
                      <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[10px]" disabled={done} onClick={() => void handleMarkActioned(id)}>
                        Done
                      </Button>
                    </div>
                    <p className="mt-1 text-muted-foreground">{w.description}</p>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}

        {(briefing.recommendations || []).length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold">AI recommendations</p>
            <ul className="space-y-3">
              {(briefing.recommendations || [])
                .slice()
                .sort((a, b) => a.priority - b.priority)
                .map((r, i) => {
                  const id = `recommendation:${r.priority}:${i}`
                  const done = actioned.has(id)
                  return (
                    <li key={id} className={cn("rounded-lg border border-border/70 bg-background/80 px-4 py-3 text-sm", done && "opacity-60 line-through")}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Priority {r.priority}</span>
                          <p className="font-semibold mt-0.5">{r.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">{r.reasoning}</p>
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">{r.estimated_impact}</p>
                          {r.action_url ? (
                            <div className="mt-2">
                              <ActionLink href={r.action_url} label="Take action →" />
                            </div>
                          ) : null}
                        </div>
                        <Button type="button" variant="outline" size="sm" className="shrink-0 h-8 text-xs" disabled={done} onClick={() => void handleMarkActioned(id)}>
                          Mark handled
                        </Button>
                      </div>
                    </li>
                  )
                })}
            </ul>
          </div>
        ) : null}
          </>
        )}
      </div>
    </Card>
  )
}
