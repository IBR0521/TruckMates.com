"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CreditCard, Calendar, AlertCircle, CheckCircle2, XCircle } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import Link from "next/link"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { getCurrentSubscription, cancelSubscription, reactivateSubscription, getBillingHistory } from "@/app/actions/subscriptions"
import { checkTrialEndingSoon } from "@/app/actions/subscriptions-trial"

export function SubscriptionSection() {
  const [subscription, setSubscription] = useState<any>(null)
  const [invoices, setInvoices] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [isCanceling, setIsCanceling] = useState(false)

  useEffect(() => {
    loadSubscriptionData()
  }, [])

  async function loadSubscriptionData() {
    setIsLoading(true)
    try {
      const [subResult, invoicesResult] = await Promise.all([
        getCurrentSubscription(),
        getBillingHistory(),
      ])

      if (subResult.data) {
        setSubscription(subResult.data)
      }

      if (invoicesResult.data) {
        setInvoices(invoicesResult.data)
      }
    } catch (error) {
      toast.error("Failed to load subscription data")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCancel() {
    setIsCanceling(true)
    const result = await cancelSubscription()
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Subscription will be canceled at the end of the billing period")
      setShowCancelDialog(false)
      loadSubscriptionData()
    }
    setIsCanceling(false)
  }

  async function handleReactivate() {
    const result = await reactivateSubscription()
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Subscription reactivated successfully")
      loadSubscriptionData()
    }
  }

  if (isLoading) {
    return (
      <Card className="border-border p-6">
        <div className="flex items-center gap-3 mb-6">
          <CreditCard className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold text-foreground">Billing & Subscription</h2>
        </div>
        <p className="text-muted-foreground">Loading...</p>
      </Card>
    )
  }

  if (!subscription) {
    return (
      <Card className="border-border p-6">
        <div className="flex items-center gap-3 mb-6">
          <CreditCard className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold text-foreground">Billing & Subscription</h2>
        </div>
        <div className="space-y-4">
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-foreground font-medium mb-2">No Active Subscription</p>
            <p className="text-sm text-muted-foreground mb-4">
              Subscribe to a plan to access all features
            </p>
            <Link href="/plans">
              <Button className="w-full">Choose a Plan</Button>
            </Link>
          </div>
        </div>
      </Card>
    )
  }

  const plan = subscription.subscription_plans
  const isTrial = subscription.status === "trialing"
  const isActive = subscription.status === "active"
  const isPastDue = subscription.status === "past_due"
  const isCanceled = subscription.status === "canceled" || subscription.cancel_at_period_end

  const trialEndDate = subscription.trial_end
    ? new Date(subscription.trial_end).toLocaleDateString()
    : null
  const periodEndDate = subscription.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString()
    : null

  return (
    <>
      <Card className="border-border p-6">
        <div className="flex items-center gap-3 mb-6">
          <CreditCard className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold text-foreground">Billing & Subscription</h2>
        </div>
        <div className="space-y-4">
          {/* Current Plan */}
          <div className="p-4 bg-secondary/50 rounded-lg">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-foreground font-medium mb-1">Current Plan</p>
                <p className="text-2xl font-bold text-primary">{plan?.display_name || "N/A"}</p>
                <p className="text-sm text-muted-foreground">
                  ${plan?.price_monthly || 0}/month
                </p>
              </div>
              <div>
                {isTrial && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/10 text-blue-500 text-xs font-medium rounded border border-blue-500/20">
                    <Calendar className="w-3 h-3" />
                    Trial
                  </span>
                )}
                {isActive && !isCanceled && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-500 text-xs font-medium rounded border border-green-500/20">
                    <CheckCircle2 className="w-3 h-3" />
                    Active
                  </span>
                )}
                {isPastDue && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/10 text-red-500 text-xs font-medium rounded border border-red-500/20">
                    <AlertCircle className="w-3 h-3" />
                    Past Due
                  </span>
                )}
                {isCanceled && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-500/10 text-gray-500 text-xs font-medium rounded border border-gray-500/20">
                    <XCircle className="w-3 h-3" />
                    Canceling
                  </span>
                )}
              </div>
            </div>

            {/* Trial Info */}
            {isTrial && trialEndDate && (
              <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded">
                <p className="text-sm text-foreground">
                  <strong>Free trial ends:</strong> {trialEndDate}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Your subscription will automatically start after the trial period.
                </p>
              </div>
            )}

            {/* Cancel Info */}
            {isCanceled && periodEndDate && (
              <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded">
                <p className="text-sm text-foreground">
                  <strong>Subscription ends:</strong> {periodEndDate}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  You'll continue to have access until the end of your billing period.
                </p>
              </div>
            )}

            {/* Period End */}
            {isActive && !isCanceled && periodEndDate && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground">
                  Next billing date: {periodEndDate}
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Link href="/plans" className="flex-1">
              <Button variant="outline" className="w-full">
                Change Plan
              </Button>
            </Link>
            {isCanceled ? (
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleReactivate}
              >
                Reactivate
              </Button>
            ) : (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowCancelDialog(true)}
              >
                Cancel Subscription
              </Button>
            )}
          </div>

          {/* Billing History */}
          {invoices.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-foreground mb-3">Billing History</h3>
              <div className="space-y-2">
                {invoices.slice(0, 5).map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-3 bg-secondary/30 rounded border border-border"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        ${invoice.amount.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {invoice.period_start
                          ? new Date(invoice.period_start).toLocaleDateString()
                          : "N/A"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {invoice.status === "paid" ? (
                        <span className="text-xs text-green-500 font-medium">Paid</span>
                      ) : (
                        <span className="text-xs text-yellow-500 font-medium">{invoice.status}</span>
                      )}
                      {invoice.hosted_invoice_url && (
                        <a
                          href={invoice.hosted_invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          View
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel your subscription? You'll continue to have access until{" "}
              {periodEndDate || "the end of your billing period"}. After that, you'll lose access to
              premium features.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={isCanceling}
              className="bg-red-500 hover:bg-red-600"
            >
              {isCanceling ? "Canceling..." : "Cancel Subscription"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

