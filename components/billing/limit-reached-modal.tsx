"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { planTierLabel, nextPlanTier, type PlanTier } from "@/lib/plan-limits"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  body: string
  currentTier: PlanTier | null
  onUpgrade?: () => void
}

/**
 * Explain a hard-cap or metered 100% block and route to checkout via parent `onUpgrade`.
 */
export function LimitReachedModal({
  open,
  onOpenChange,
  title,
  body,
  currentTier,
  onUpgrade,
}: Props) {
  const next = currentTier ? nextPlanTier(currentTier) : null
  const nextLabel = next ? planTierLabel(next) : "a higher tier"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-left space-y-2">
            <span>{body}</span>
            {currentTier ? (
              <span className="block text-muted-foreground">
                You are on the <strong>{planTierLabel(currentTier)}</strong> plan. Upgrade to{" "}
                <strong>{nextLabel}</strong> for higher limits.
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            type="button"
            onClick={() => {
              onUpgrade?.()
              onOpenChange(false)
            }}
          >
            Upgrade now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
