"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { UpgradeModal } from "@/components/billing/upgrade-modal"
import { getAiQuotaBannerContext } from "@/app/actions/plan-usage"

const SESSION_WARN = "tm:dismiss-ai-quota-banner-warn"
const SESSION_CAP = "tm:dismiss-ai-quota-banner-cap"

function nextUtcMonthPhrase(): string {
  const now = new Date()
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  return d.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
}

export function AiQuotaBanner() {
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [dismissWarn, setDismissWarn] = useState(false)
  const [dismissCap, setDismissCap] = useState(false)
  const [payload, setPayload] = useState<Awaited<ReturnType<typeof getAiQuotaBannerContext>>["data"]>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    setDismissWarn(sessionStorage.getItem(SESSION_WARN) === "1")
    setDismissCap(sessionStorage.getItem(SESSION_CAP) === "1")
    let active = true
    void (async () => {
      try {
        const res = await getAiQuotaBannerContext()
        if (!active) return
        setPayload(res.data)
      } catch {
        if (active) setPayload(null)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  function dismiss(kind: "warn" | "cap") {
    try {
      sessionStorage.setItem(kind === "warn" ? SESSION_WARN : SESSION_CAP, "1")
    } catch {
      //
    }
    if (kind === "warn") setDismissWarn(true)
    else setDismissCap(true)
  }

  if (!payload || !("eligible" in payload) || !payload.eligible) return null

  const ai = payload.ai
  const percentUsed = ai.percentUsed
  const atQuotaCap = ai.hardCap && typeof ai.limit === "number" && ai.limit > 0
  const nearLimit =
    ai.warningThreshold && typeof ai.limit === "number" && ai.limit > 0 && percentUsed >= 80 && percentUsed < 100

  let inner: React.ReactNode = null
  if (atQuotaCap && !dismissCap) {
    inner = (
      <div className="shrink-0 mx-4 md:mx-8 mb-2 mt-2 flex flex-wrap items-start gap-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-foreground">
        <p className="flex-1 min-w-[240px]">
          AI quota exceeded. AI features are paused until{" "}
          <span className="font-medium">{nextUtcMonthPhrase()}</span> or upgrade your plan.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <Button type="button" size="sm" variant="destructive" onClick={() => setUpgradeOpen(true)}>
            Upgrade
          </Button>
          <button
            type="button"
            className="p-1 rounded-md text-muted-foreground hover:bg-background/80"
            aria-label="Dismiss AI quota notice"
            onClick={() => dismiss("cap")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  } else if (nearLimit && !dismissWarn) {
    const nextTier = payload.nextTierLabel
    const nextCalls =
      typeof payload.nextTierAiCalls === "number" && payload.nextTierAiCalls > 0
        ? payload.nextTierAiCalls.toLocaleString()
        : "more"

    inner = (
      <div className="shrink-0 mx-4 md:mx-8 mb-2 mt-2 flex flex-wrap items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/12 px-4 py-3 text-sm text-foreground">
        <p className="flex-1 min-w-[240px]">
          You&apos;ve used {percentUsed}% of your monthly AI quota.
          {nextTier
            ? ` Consider upgrading to ${nextTier} for ${nextCalls} AI calls per month.`
            : " Consider upgrading for a higher AI allowance."}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <Button type="button" size="sm" variant="secondary" onClick={() => setUpgradeOpen(true)}>
            Upgrade
          </Button>
          <button
            type="button"
            className="p-1 rounded-md text-muted-foreground hover:bg-background/80"
            aria-label="Dismiss AI quota reminder"
            onClick={() => dismiss("warn")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  if (!inner) return null

  return (
    <>
      {inner}
      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} feature="driver_scorecards" />
    </>
  )
}
