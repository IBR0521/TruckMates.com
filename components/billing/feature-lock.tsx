"use client"

import type { ComponentProps } from "react"
import { useEffect, useState } from "react"
import Image from "next/image"
import { Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { getPlanFeatureGate } from "@/app/actions/plan-usage"
import { planTierLabel, type PlanFeatures } from "@/lib/plan-limits"
import { UpgradeModal } from "@/components/billing/upgrade-modal"

type UpgradeFeatureKey = ComponentProps<typeof UpgradeModal>["feature"]

function upgradeFeatureForPlanFeature(feature: keyof PlanFeatures): UpgradeFeatureKey {
  if (feature === "edi_receiving") return "edi"
  if (feature === "hazmat_module") return "hazmat"
  if (
    feature === "eld_harsh_events" ||
    feature === "eld_idle_tracking" ||
    feature === "driver_safety_scorecards" ||
    feature === "trip_replay" ||
    feature === "geofencing_automation" ||
    feature === "geofencing_load_automation" ||
    feature === "eld_fault_codes_basic" ||
    feature === "eld_fault_codes_advanced"
  ) {
    return "driver_scorecards"
  }
  if (
    feature === "public_api" ||
    feature === "multi_terminal" ||
    feature === "ltl_shipments" ||
    feature === "permit_management" ||
    feature === "lease_management"
  ) {
    return "api_keys"
  }
  if (feature === "sso") {
    return "api_keys"
  }
  if (feature === "ap_vendor_invoicing" || feature === "bank_reconciliation" || feature === "gl_quickbooks_sync") {
    return "quickbooks"
  }
  if (feature === "ai_chat" || feature === "ai_chat_unlimited" || feature === "ai_advanced_actions") {
    return "drivers_limit"
  }
  return "api_keys"
}

export interface FeatureLockProps {
  /** Plan feature gate from `lib/plan-limits` `PlanFeatures`. */
  featureKey: keyof PlanFeatures
  title: string
  description: string
  /** Shown inside the gated page when unlocked. */
  children: React.ReactNode
  screenshotSrc?: string
  screenshotAlt?: string
}

/**
 * Locked UI for plan-gated areas: keeps route discoverability while prompting upgrade.
 */
export function FeatureLock({
  featureKey,
  title,
  description,
  children,
  screenshotSrc,
  screenshotAlt,
}: FeatureLockProps) {
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [requiredTierLabel, setRequiredTierLabel] = useState("")
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  useEffect(() => {
    let active = true
    getPlanFeatureGate(featureKey)
      .then((res) => {
        if (!active || !res.data) return
        setAllowed(res.data.allowed)
        setRequiredTierLabel(planTierLabel(res.data.minimumTier))
      })
      .catch(() => {
        if (active) setAllowed(false)
      })
    return () => {
      active = false
    }
  }, [featureKey])

  if (allowed === null) {
    return <div className="p-8 text-muted-foreground text-sm">Checking plan access…</div>
  }

  if (allowed) {
    return <>{children}</>
  }

  const upgradeHint = upgradeFeatureForPlanFeature(featureKey)

  return (
    <>
      <div className="max-w-2xl mx-auto py-12 px-4">
        <Card className="p-8 border-border shadow-sm space-y-4">
          <div className="flex items-start gap-3">
            <div className="mt-1 rounded-lg bg-muted p-2">
              <Lock className="w-5 h-5 text-muted-foreground" aria-hidden />
            </div>
            <div className="space-y-2">
              <Badge variant="secondary" className="w-fit font-normal">
                Available on {requiredTierLabel} and above
              </Badge>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
              <p className="text-muted-foreground leading-relaxed">{description}</p>
              <Button type="button" className="mt-2" onClick={() => setUpgradeOpen(true)}>
                Upgrade to {requiredTierLabel}
              </Button>
            </div>
          </div>
          {screenshotSrc ? (
            <div className="relative rounded-lg border border-border overflow-hidden bg-muted/40 aspect-video">
              <Image
                src={screenshotSrc}
                alt={screenshotAlt || `${title} preview`}
                fill
                className="object-cover object-top"
                sizes="(max-width: 768px) 100vw, 672px"
                priority={false}
              />
            </div>
          ) : null}
        </Card>
      </div>
      <UpgradeModal feature={upgradeHint} open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </>
  )
}
