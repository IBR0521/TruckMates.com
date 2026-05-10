"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getBillingPlanContext, getCompanyPlanUsageSnapshot } from "@/app/actions/plan-usage"

const TRIAL_BANNER_KEY = "tm:dismiss-trial-banner"
const WARN_PREFIX = "tm:dismiss-quota-warning:"

export function DashboardBillingBanners() {
  const [trialDismissed, setTrialDismissed] = useState(true)
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null)
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null)
  const [quotaMsgs, setQuotaMsgs] = useState<string[]>([])

  useEffect(() => {
    if (typeof window === "undefined") return
    setTrialDismissed(sessionStorage.getItem(TRIAL_BANNER_KEY) === "1")

    let active = true
    void (async () => {
      try {
        const [ctxSnap, usageSnap] = await Promise.all([getBillingPlanContext(), getCompanyPlanUsageSnapshot()])
        if (!active) return
        const st = ctxSnap.data?.subscription_status
        const ends = ctxSnap.data?.trial_ends_at
        if (st === "trial" && ends && new Date(ends).getTime() > Date.now()) {
          setTrialEndsAt(ends)
          const days = Math.max(1, Math.ceil((new Date(ends).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
          setTrialDaysLeft(days)
        } else {
          setTrialEndsAt(null)
          setTrialDaysLeft(null)
        }

        const warnings: string[] = []
        if (usageSnap.data?.metered) {
          const m = usageSnap.data.metered
          ;(
            [
              ["loads", "Loads this month", m.loads],
              ["sms", "SMS this month", m.sms],
              ["ai_calls", "AI calls this month", m.ai],
            ] as const
          ).forEach(([id, label, snap]) => {
            if (
              typeof snap.limit === "number" &&
              snap.limit > 0 &&
              snap.warningThreshold &&
              !snap.hardCap &&
              sessionStorage.getItem(WARN_PREFIX + id) !== "1"
            ) {
              warnings.push(
                `${label}: ${snap.percentUsed}% of your monthly quota (${snap.used}/${snap.limit}). Consider upgrading.`,
              )
            }
            if (
              typeof snap.limit === "number" &&
              snap.limit > 0 &&
              snap.hardCap &&
              sessionStorage.getItem(WARN_PREFIX + id + ":cap") !== "1"
            ) {
              warnings.push(`${label}: quota exhausted (${snap.used}/${snap.limit}). Upgrade to continue.` )
            }
          })
        }
        setQuotaMsgs(warnings)
      } catch {
        if (active) {
          setTrialEndsAt(null)
          setTrialDaysLeft(null)
          setQuotaMsgs([])
        }
      }
    })()

    return () => {
      active = false
    }
  }, [])

  function dismissTrial() {
    try {
      sessionStorage.setItem(TRIAL_BANNER_KEY, "1")
    } catch {
      //
    }
    setTrialDismissed(true)
  }

  const showTrial = !trialDismissed && trialEndsAt && trialDaysLeft !== null && trialDaysLeft > 0

  return (
    <div className="shrink-0 space-y-2 px-4 md:px-8 pt-3 pb-2">
      {showTrial ? (
        <div className="flex flex-wrap items-start gap-3 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
          <p className="flex-1 min-w-[220px] text-foreground">
            <span className="font-medium">{trialDaysLeft} days left</span> in your free Starter trial. Add a payment method
            in Paddle to keep full access after trial.
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" asChild variant="secondary">
              <Link href="/dashboard/settings/billing">Add Payment</Link>
            </Button>
            <button
              type="button"
              className="p-1 rounded-md text-muted-foreground hover:bg-background/80"
              aria-label="Dismiss trial reminder"
              onClick={dismissTrial}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : null}

      {quotaMsgs.map((msg, i) => (
        <div
          key={i}
          className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-2 text-sm text-foreground"
        >
          <p className="flex-1">{msg}</p>
          <Button size="sm" variant="outline" asChild className="shrink-0">
            <Link href="/dashboard/settings/billing">View billing</Link>
          </Button>
        </div>
      ))}
    </div>
  )
}
