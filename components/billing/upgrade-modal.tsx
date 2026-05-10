"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  PLAN_LIMITS,
  PLAN_FEATURES,
  PLAN_TIER_ORDER,
  type PlanFeatures,
  type PlanTier,
  isUnlimited,
  planTierLabel,
} from "@/lib/plan-limits"
import { getBillingPlanContext, startPlanCheckout } from "@/app/actions/plan-usage"

type UpgradeFeatureKey =
  | "drivers_limit"
  | "vehicles_limit"
  | "users_limit"
  | "api_keys"
  | "quickbooks"
  | "edi"
  | "hazmat"
  | "crm"
  | "geofencing"
  | "driver_scorecards"
  | "route_optimization"

const FEATURE_LABEL: Record<UpgradeFeatureKey, string> = {
  drivers_limit: "Driver limits",
  vehicles_limit: "Vehicle limits",
  users_limit: "Team member limits",
  api_keys: "Public API key access",
  quickbooks: "QuickBooks integration",
  edi: "EDI integration",
  hazmat: "HAZMAT operations",
  crm: "CRM workflows",
  geofencing: "Geofencing",
  driver_scorecards: "Driver scorecards",
  route_optimization: "Route optimization",
}

const COMPARE_KEYS: (keyof PlanFeatures)[] = [
  "ai_document_extraction",
  "public_api",
  "edi_receiving",
  "multi_terminal",
  "hazmat_module",
  "predictive_maintenance",
]

export function UpgradeModal({
  open,
  onOpenChange,
  feature,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  feature: UpgradeFeatureKey
}) {
  const [isLoadingCtx, setIsLoadingCtx] = useState(false)
  const [currentTier, setCurrentTier] = useState<PlanTier | null>(null)
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly")
  const [checkoutTier, setCheckoutTier] = useState<PlanTier | null>(null)

  useEffect(() => {
    let active = true
    if (!open) return

    setIsLoadingCtx(true)
    getBillingPlanContext()
      .then((result) => {
        if (!active) return
        if (result.data?.tier) setCurrentTier(result.data.tier)
      })
      .catch(() => {
        if (active) toast.error("Could not load current plan")
      })
      .finally(() => {
        if (active) setIsLoadingCtx(false)
      })

    return () => {
      active = false
    }
  }, [open])

  const runCheckout = async (tier: PlanTier) => {
    if (tier === "enterprise") {
      window.location.href = "mailto:sales@truckmates.com?subject=TruckMates%20Enterprise%20plan"
      return
    }
    setCheckoutTier(tier)
    const result = await startPlanCheckout({ tier, billingCycle })
    setCheckoutTier(null)

    if (result.error || !result.data?.checkout_url) {
      toast.error(result.error || "Could not start checkout")
      return
    }

    const popup = window.open(result.data.checkout_url, "truckmates-upgrade", "popup=yes,width=1120,height=860")
    if (!popup) {
      toast.error("Popup blocked. Allow popups or try again.")
      return
    }

    toast.success("Checkout opened in a new window.")
  }

  const formatPrice = (tier: PlanTier) => {
    const row = PLAN_LIMITS[tier]
    if (tier === "enterprise") return "Custom"
    const v = billingCycle === "annual" ? row.price_annual : row.price_monthly
    if (v < 0) return "Custom"
    return `$${v}/mo`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Plans & pricing</DialogTitle>
          <DialogDescription>
            You reached a limit for {FEATURE_LABEL[feature]}. Choose a plan below (Paddle checkout). Enterprise includes
            a dedicated team — contact sales for a quote.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Billing</span>
          <Button
            type="button"
            size="sm"
            variant={billingCycle === "monthly" ? "default" : "outline"}
            onClick={() => setBillingCycle("monthly")}
          >
            Monthly
          </Button>
          <Button
            type="button"
            size="sm"
            variant={billingCycle === "annual" ? "default" : "outline"}
            onClick={() => setBillingCycle("annual")}
          >
            Annual
          </Button>
          {currentTier && (
            <Badge variant="secondary" className="ml-auto">
              Current: {planTierLabel(currentTier)}
            </Badge>
          )}
        </div>

        {isLoadingCtx ? (
          <p className="text-sm text-muted-foreground">Loading your plan…</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PLAN_TIER_ORDER.map((tier) => {
              const lim = PLAN_LIMITS[tier]
              const isCurrent = currentTier === tier
              return (
                <div
                  key={tier}
                  className={cn(
                    "rounded-lg border p-4 flex flex-col gap-2",
                    isCurrent && "border-primary ring-1 ring-primary/30",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{planTierLabel(tier)}</p>
                    {isCurrent && <Badge variant="outline">Current</Badge>}
                  </div>
                  <p className="text-2xl font-bold">{formatPrice(tier)}</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>Trucks: {isUnlimited(lim.trucks) ? "Unlimited" : lim.trucks}</li>
                    <li>Loads / mo: {isUnlimited(lim.loads_per_month) ? "Unlimited" : lim.loads_per_month}</li>
                    <li>SMS / mo: {isUnlimited(lim.sms_per_month) ? "Unlimited" : lim.sms_per_month}</li>
                  </ul>
                  <div className="flex-1" />
                  {tier === "enterprise" ? (
                    <Button variant="outline" onClick={() => runCheckout("enterprise")} type="button">
                      Contact Sales
                    </Button>
                  ) : (
                    <Button
                      onClick={() => runCheckout(tier)}
                      disabled={checkoutTier === tier}
                      type="button"
                    >
                      {checkoutTier === tier ? "Opening…" : isCurrent ? "Manage upgrade" : "Upgrade"}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <Separator />

        <div className="space-y-2">
          <p className="text-sm font-medium">Feature highlights</p>
          <div className="grid gap-2 text-xs sm:grid-cols-2">
            {COMPARE_KEYS.map((k) => (
              <div key={k} className="flex flex-col rounded border p-2">
                <span className="text-muted-foreground">{k.replace(/_/g, " ")}</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {PLAN_TIER_ORDER.map((t) => (
                    <Badge key={t} variant={PLAN_FEATURES[t][k] ? "default" : "secondary"} className="text-[10px]">
                      {planTierLabel(t)}: {PLAN_FEATURES[t][k] ? "Yes" : "—"}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} type="button">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
