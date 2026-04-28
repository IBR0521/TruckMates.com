"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { createUpgradeCheckoutSession, getUpgradeOffer } from "@/app/actions/subscription-upgrade"

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

export function UpgradeModal({
  open,
  onOpenChange,
  feature,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  feature: UpgradeFeatureKey
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckoutStarting, setIsCheckoutStarting] = useState(false)
  const [offer, setOffer] = useState<any>(null)

  useEffect(() => {
    let active = true
    if (!open) return

    setIsLoading(true)
    getUpgradeOffer(feature)
      .then((result) => {
        if (!active) return
        if (result.error) toast.error(result.error)
        else setOffer(result.data)
      })
      .catch(() => {
        if (active) toast.error("Could not load upgrade options")
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [feature, open])

  const startCheckout = async () => {
    setIsCheckoutStarting(true)
    const result = await createUpgradeCheckoutSession(feature, offer?.target_plan?.name)
    setIsCheckoutStarting(false)

    if (result.error || !result.data?.checkout_url) {
      toast.error(result.error || "Could not start checkout")
      return
    }

    const popup = window.open(result.data.checkout_url, "truckmates-upgrade", "popup=yes,width=1120,height=860")
    if (!popup) {
      toast.error("Popup blocked. Allow popups and try again.")
      return
    }

    toast.success("Checkout opened. Complete payment to unlock features.")
  }

  const formatMoney = (value: number) => `$${Number(value || 0).toFixed(0)}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upgrade to continue</DialogTitle>
          <DialogDescription>
            You hit a plan limit for {FEATURE_LABEL[feature]}. Upgrade now and continue without leaving your current flow.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading upgrade options...</p>
        ) : offer ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-xs text-muted-foreground">Current plan</p>
                <p className="font-medium">{offer.current_plan.display_name}</p>
              </div>
              <Badge variant="secondary">{formatMoney(offer.current_plan.price_monthly)}/mo</Badge>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-xs text-muted-foreground">Recommended plan</p>
                <p className="font-medium">{offer.target_plan.display_name}</p>
              </div>
              <Badge>{formatMoney(offer.target_plan.price_monthly)}/mo</Badge>
            </div>

            <div className="rounded-md bg-muted p-3 text-sm">
              Price difference: <span className="font-semibold">{formatMoney(offer.price_difference_monthly)}/month</span>
            </div>

            <Separator />

            <div className="space-y-1">
              <p className="text-sm font-medium">What unlocks</p>
              {(offer.unlocks || []).slice(0, 5).map((item: string) => (
                <p key={item} className="text-sm text-muted-foreground">
                  - {item}
                </p>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Upgrade details are currently unavailable.</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <Button onClick={startCheckout} disabled={isLoading || isCheckoutStarting || !offer}>
            {isCheckoutStarting ? "Opening..." : "Upgrade now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
