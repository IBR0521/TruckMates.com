"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { 
  CreditCard, 
  Save,
  Building2,
  Mail,
  Phone,
  Receipt,
  History,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
} from "lucide-react"
import { toast } from "sonner"
import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { getBillingInfo, updateBillingInfo } from "@/app/actions/settings-billing"
import {
  getSubscription,
  getPaymentHistory,
  getPaymentMethods,
  savePaymentMethod,
  deletePaymentMethod,
  getMonthlyApiUsageOverview,
} from "@/app/actions/settings-billing-enhanced"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { UpgradeModal } from "@/components/billing/upgrade-modal"
import {
  cancelPaddleBillingSubscription,
  getBillingPlanContext,
  getCompanyPlanUsageSnapshot,
  openPaddleBillingPortal,
} from "@/app/actions/plan-usage"
import { cn } from "@/lib/utils"
import type { PlanTier } from "@/lib/plan-limits"

type BillingSubscription = {
  plan_display_name?: string | null
  plan_name?: string | null
  amount?: number | null
  billing_cycle?: string | null
  status?: string | null
  currency_symbol?: string | null
  end_date?: string | null
}

type UsageRow = {
  key: string
  label: string
  used: number
  limit: number | null
  percent?: number | null
}

type PaymentHistoryRow = {
  id: string
  currency_symbol?: string | null
  amount: number
  status: string
  payment_date: string
  payment_method?: string | null
  payment_method_last4?: string | null
  invoice_number?: string | null
}

type PlanUsageSnapshot = NonNullable<Awaited<ReturnType<typeof getCompanyPlanUsageSnapshot>>["data"]>

type BillingPlanContext = NonNullable<Awaited<ReturnType<typeof getBillingPlanContext>>["data"]>

type PaymentMethodRow = {
  id?: string
  type: "card" | "ach" | "wire" | "check"
  card_brand?: string | null
  card_last4?: string | null
  account_last4?: string | null
  card_exp_month?: number | null
  card_exp_year?: number | null
  cardholder_name?: string | null
  is_default?: boolean | null
}

const asPaymentHistoryRow = (value: unknown): PaymentHistoryRow | null => {
  if (!value || typeof value !== "object") return null
  const obj = value as Record<string, unknown>
  if (typeof obj.id !== "string" || typeof obj.status !== "string" || typeof obj.payment_date !== "string") {
    return null
  }
  return {
    id: obj.id,
    amount: Number(obj.amount) || 0,
    status: obj.status,
    payment_date: obj.payment_date,
    currency_symbol: typeof obj.currency_symbol === "string" ? obj.currency_symbol : null,
    payment_method: typeof obj.payment_method === "string" ? obj.payment_method : null,
    payment_method_last4: typeof obj.payment_method_last4 === "string" ? obj.payment_method_last4 : null,
    invoice_number: typeof obj.invoice_number === "string" ? obj.invoice_number : null,
  }
}

const asPaymentMethodRow = (value: unknown): PaymentMethodRow | null => {
  if (!value || typeof value !== "object") return null
  const obj = value as Record<string, unknown>
  const type = obj.type
  if (type !== "card" && type !== "ach" && type !== "wire" && type !== "check") return null
  return {
    id: typeof obj.id === "string" ? obj.id : undefined,
    type,
    card_brand: typeof obj.card_brand === "string" ? obj.card_brand : null,
    card_last4: typeof obj.card_last4 === "string" ? obj.card_last4 : null,
    account_last4: typeof obj.account_last4 === "string" ? obj.account_last4 : null,
    card_exp_month: typeof obj.card_exp_month === "number" ? obj.card_exp_month : null,
    card_exp_year: typeof obj.card_exp_year === "number" ? obj.card_exp_year : null,
    cardholder_name: typeof obj.cardholder_name === "string" ? obj.cardholder_name : null,
    is_default: typeof obj.is_default === "boolean" ? obj.is_default : null,
  }
}

const parsePaymentMethods = (rows: unknown[]): PaymentMethodRow[] =>
  rows.map(asPaymentMethodRow).filter((row): row is PaymentMethodRow => !!row)

function tierBadgeAccentClass(tier: PlanTier): string {
  switch (tier) {
    case "owner_operator":
      return "border-border bg-muted text-muted-foreground"
    case "starter":
      return "border-teal-500/35 bg-teal-500/15 text-teal-900 dark:text-teal-100"
    case "professional":
      return "border-primary/55 bg-primary/15 text-primary"
    case "fleet":
      return "border-violet-500/45 bg-violet-500/12 text-violet-950 dark:text-violet-100"
    default:
      return "border-amber-600/45 bg-amber-600/12 text-amber-950 dark:text-amber-100"
  }
}

function meterProgressIndicatorToneClass(rawPct: number): string | undefined {
  const pct = Math.max(0, Math.min(100, Number(rawPct) || 0))
  if (pct >= 100) return "[&_[data-slot=progress-indicator]]:!bg-destructive [&_[data-slot=progress]]:!bg-destructive/25"
  if (pct >= 80)
    return "[&_[data-slot=progress-indicator]]:!bg-amber-600 [&_[data-slot=progress]]:!bg-amber-600/25 dark:[&_[data-slot=progress-indicator]]:!bg-amber-400 dark:[&_[data-slot=progress]]:!bg-amber-400/20"
  return undefined
}

function resourceUsageTextClass(current: number, limit: number): string | undefined {
  if (limit <= 0) return undefined
  const pct = Math.min(100, Math.round((current / limit) * 100))
  if (pct >= 100) return "text-destructive font-semibold"
  if (pct >= 80) return "text-amber-700 dark:text-amber-300 font-medium"
  return undefined
}

export default function BillingSettingsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [billing, setBilling] = useState({
    billing_company_name: "",
    billing_email: "",
    billing_phone: "",
    billing_address: "",
    tax_id: "",
    tax_exempt: false,
    payment_method: "card",
    payment_terms: "Net 30",
    billing_notes: "",
  })
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null)
  const [usageRows, setUsageRows] = useState<UsageRow[]>([])
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryRow[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRow[]>([])
  const [showPaymentMethodDialog, setShowPaymentMethodDialog] = useState(false)
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<PaymentMethodRow | null>(null)
  const [paymentMethodForm, setPaymentMethodForm] = useState({
    type: "card" as "card" | "ach" | "wire" | "check",
    card_last4: "",
    card_exp_month: "",
    card_exp_year: "",
    cardholder_name: "",
    is_default: false,
  })
  const searchParams = useSearchParams()
  const paymentRequired = searchParams.get("payment_required") === "1"
  const requestedUpgrade = searchParams.get("upgrade")
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [upgradeFeature, setUpgradeFeature] = useState<
    "route_optimization" | "geofencing" | "crm" | "api_keys" | null
  >(null)
  const [planUsage, setPlanUsage] = useState<PlanUsageSnapshot | null>(null)
  const [billingCtx, setBillingCtx] = useState<BillingPlanContext | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelBusy, setCancelBusy] = useState(false)
  const [portalBusy, setPortalBusy] = useState(false)

  useEffect(() => {
    if (searchParams.get("upgraded") !== "1") return
    toast.success("Subscription updated! Your new plan is active.")
    const url = new URL(window.location.href)
    url.searchParams.delete("upgraded")
    url.searchParams.delete("upgrade")
    url.searchParams.delete("payment_required")
    const qs = url.searchParams.toString()
    window.history.replaceState({}, "", `${url.pathname}${qs ? `?${qs}` : ""}`)
  }, [searchParams])

  useEffect(() => {
    if (!requestedUpgrade) return
    if (searchParams.get("upgraded") === "1") return
    if (
      requestedUpgrade === "route_optimization" ||
      requestedUpgrade === "geofencing" ||
      requestedUpgrade === "crm" ||
      requestedUpgrade === "api_keys"
    ) {
      setUpgradeFeature(requestedUpgrade)
      setShowUpgradeModal(true)
    }
    const url = new URL(window.location.href)
    url.searchParams.delete("upgrade")
    const qs = url.searchParams.toString()
    window.history.replaceState({}, "", `${url.pathname}${qs ? `?${qs}` : ""}`)
  }, [requestedUpgrade, searchParams])

  useEffect(() => {
    async function loadSettings() {
      setIsLoading(true)
      try {
        const [
          billingResult,
          subscriptionResult,
          historyResult,
          methodsResult,
          usageResult,
          planUsageResult,
          paddleCtxResult,
        ] =
          await Promise.all([
          getBillingInfo(),
          getSubscription(),
          getPaymentHistory(),
          getPaymentMethods(),
          getMonthlyApiUsageOverview(),
          getCompanyPlanUsageSnapshot(),
          getBillingPlanContext(),
        ])

        if (billingResult.error) {
          toast.error(billingResult.error)
        } else if (billingResult.data) {
          setBilling({
            billing_company_name: billingResult.data.billing_company_name || "",
            billing_email: billingResult.data.billing_email || "",
            billing_phone: billingResult.data.billing_phone || "",
            billing_address: billingResult.data.billing_address || "",
            tax_id: billingResult.data.tax_id || "",
            tax_exempt: billingResult.data.tax_exempt || false,
            payment_method: billingResult.data.payment_method || "card",
            payment_terms: billingResult.data.payment_terms || "Net 30",
            billing_notes: billingResult.data.billing_notes || "",
          })
        }

        if (subscriptionResult.data) {
          setSubscription(subscriptionResult.data)
        }

        if (historyResult.data) {
          setPaymentHistory(
            (historyResult.data as unknown[])
              .map(asPaymentHistoryRow)
              .filter((row): row is PaymentHistoryRow => !!row),
          )
        }

        if (methodsResult.data) {
          setPaymentMethods(parsePaymentMethods(methodsResult.data as unknown[]))
        }
        if (usageResult.data) {
          setUsageRows(usageResult.data)
        }
        if (planUsageResult.data) {
          setPlanUsage(planUsageResult.data)
        }
        if (paddleCtxResult.data) {
          setBillingCtx(paddleCtxResult.data)
        }
      } catch (error) {
        toast.error("Failed to load billing settings")
      } finally {
        setIsLoading(false)
      }
    }
    loadSettings()
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const result = await updateBillingInfo({
        billing_company_name: billing.billing_company_name,
        billing_email: billing.billing_email,
        billing_phone: billing.billing_phone,
        billing_address: billing.billing_address,
        tax_id: billing.tax_id,
        tax_exempt: billing.tax_exempt,
        payment_method: billing.payment_method,
        payment_terms: billing.payment_terms,
        billing_notes: billing.billing_notes,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Billing settings saved successfully")
      }
    } catch (error) {
      toast.error("Failed to save billing settings")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
    <div className="w-full p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <CreditCard className="w-6 h-6" />
            Billing Settings
          </h1>
          <p className="text-muted-foreground mt-2">
            TruckMates plans and renewals run through Paddle. Update company billing details below; upgrades open a secure
            Paddle checkout.
          </p>
          {paymentRequired && (
            <p className="mt-2 text-sm text-destructive">
              Billing is required before access can continue. Choose a plan and complete Paddle checkout from Plan usage →
              Change plan.
            </p>
          )}
        </div>

        {isLoading ? (
          <Card className="p-6">
            <p className="text-muted-foreground">Loading...</p>
          </Card>
        ) : (
          <>
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Billing Information</h2>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input
                value={billing.billing_company_name}
                onChange={(e) => setBilling({ ...billing, billing_company_name: e.target.value })}
                placeholder="Enter company name"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={billing.billing_email}
                  onChange={(e) => setBilling({ ...billing, billing_email: e.target.value })}
                  placeholder="billing@company.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  type="tel"
                  value={billing.billing_phone}
                  onChange={(e) => setBilling({ ...billing, billing_phone: e.target.value })}
                  placeholder="+1 (555) 000-0000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Billing Address</Label>
              <Input
                value={billing.billing_address}
                onChange={(e) => setBilling({ ...billing, billing_address: e.target.value })}
                placeholder="Enter billing address"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tax ID</Label>
                <Input
                  value={billing.tax_id}
                  onChange={(e) => setBilling({ ...billing, tax_id: e.target.value })}
                  placeholder="Enter tax ID"
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Terms</Label>
                <Input
                  value={billing.payment_terms}
                  onChange={(e) => setBilling({ ...billing, payment_terms: e.target.value })}
                  placeholder="Net 30"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Tax Exempt</Label>
                <p className="text-sm text-muted-foreground">Mark if company is tax exempt</p>
              </div>
              <Switch
                checked={billing.tax_exempt}
                onCheckedChange={(checked) => setBilling({ ...billing, tax_exempt: checked })}
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </Card>

        {planUsage && (
          <Card className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold flex flex-wrap items-center gap-2">
                  Plan usage
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-normal capitalize",
                      tierBadgeAccentClass(planUsage.tier),
                    )}
                  >
                    {planUsage.tierLabel}
                  </Badge>
                  {!billingCtx ? null : billingCtx.billing_cycle === "annual" ? (
                    <span className="text-xs font-normal text-muted-foreground">Annual billing cycle</span>
                  ) : (
                    <span className="text-xs font-normal text-muted-foreground">Monthly billing cycle</span>
                  )}
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() => {
                    setUpgradeFeature("route_optimization")
                    setShowUpgradeModal(true)
                  }}
                >
                  Change plan
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={portalBusy}
                  onClick={async () => {
                    setPortalBusy(true)
                    try {
                      const r = await openPaddleBillingPortal()
                      if (r.error || !r.portalUrl) {
                        toast.error(r.error || "Could not open Paddle customer portal")
                        return
                      }
                      window.location.href = r.portalUrl
                    } finally {
                      setPortalBusy(false)
                    }
                  }}
                >
                  {portalBusy ? "Opening portal…" : "Manage billing"}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setCancelOpen(true)}>
                  Cancel subscription
                </Button>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {(
                [
                  ["Loads (month)", planUsage.metered.loads.used, planUsage.metered.loads.limit],
                  ["SMS (month)", planUsage.metered.sms.used, planUsage.metered.sms.limit],
                  ["AI calls (month)", planUsage.metered.ai.used, planUsage.metered.ai.limit],
                ] as const
              ).map(([label, used, limit]) => (
                <div key={label} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{label}</span>
                    <span
                      className={cn(
                        "text-muted-foreground",
                        limit > 0 && resourceUsageTextClass(used, limit),
                      )}
                    >
                      {limit < 0 ? `${used}` : `${used} / ${limit}`}
                    </span>
                  </div>
                  {limit > 0 ? (
                    <Progress
                      className={meterProgressIndicatorToneClass(Math.min(100, Math.round((used / limit) * 100)))}
                      value={Math.min(100, Math.round((used / limit) * 100))}
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground">Unlimited</p>
                  )}
                </div>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 text-sm">
              {(
                [
                  ["Trucks", planUsage.resources.trucks.current, planUsage.resources.trucks.limit],
                  ["Trailers", planUsage.resources.trailers.current, planUsage.resources.trailers.limit],
                  ["Drivers", planUsage.resources.drivers.current, planUsage.resources.drivers.limit],
                  ["Seats", planUsage.resources.user_seats.current, planUsage.resources.user_seats.limit],
                  ["Customers", planUsage.resources.customers.current, planUsage.resources.customers.limit],
                  ["Vendors", planUsage.resources.vendors.current, planUsage.resources.vendors.limit],
                ] as const
              ).map(([label, current, lim]) => (
                <p key={label} className={resourceUsageTextClass(current, lim)}>
                  {label}: {current} / {lim < 0 ? "∞" : lim}
                </p>
              ))}
            </div>
          </Card>
        )}

        {/* Subscription (Paddle + company tier — source of truth) */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Subscription (Paddle)
          </h2>

          {billingCtx ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={cn("capitalize", tierBadgeAccentClass(billingCtx.tier))}>
                      {billingCtx.tierLabel}
                    </Badge>
                    <Badge
                      variant={
                        billingCtx.subscription_status === "active" || billingCtx.subscription_status === "trial"
                          ? "default"
                          : "secondary"
                      }
                      className="capitalize"
                    >
                      {billingCtx.subscription_status?.replace(/_/g, " ") || "—"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {billingCtx.billing_cycle === "annual" ? "Annual" : "Monthly"} billing cadence • Payments via Paddle
                  </p>
                  {billingCtx.subscription_status === "trial" && billingCtx.trial_ends_at ? (
                    (() => {
                      const ms = new Date(billingCtx.trial_ends_at).getTime() - Date.now()
                      const days = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
                      return ms > 0 ? (
                        <p className="text-sm font-medium text-primary">
                          Trial ends in {days} day{days === 1 ? "" : "s"} — add a payment method to keep Starter-tier
                          access.
                        </p>
                      ) : null
                    })()
                  ) : billingCtx.subscription_ends_at && billingCtx.subscription_status === "active" ? (
                    <p className="text-sm text-muted-foreground">
                      Next renewal: {new Date(billingCtx.subscription_ends_at).toLocaleDateString()}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Paddle subscription</p>
                  <p className="font-medium">{billingCtx.paddle_subscription_id ? "Linked" : "Not linked yet"}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Use <strong>Change plan</strong> above to subscribe or upgrade.
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {billingCtx.subscription_status === "trial" ? "Trial ends" : "Current period ends"}
                  </p>
                  <p className="font-medium">
                    {billingCtx.subscription_status === "trial" && billingCtx.trial_ends_at
                      ? new Date(billingCtx.trial_ends_at).toLocaleString()
                      : billingCtx.subscription_ends_at
                        ? new Date(billingCtx.subscription_ends_at).toLocaleDateString()
                        : "—"}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="rounded-lg" asChild>
                  <Link href="/pricing">Public pricing page</Link>
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="rounded-lg"
                  disabled={portalBusy}
                  onClick={async () => {
                    setPortalBusy(true)
                    try {
                      const r = await openPaddleBillingPortal()
                      if (r.error || !r.portalUrl) {
                        toast.error(r.error || "Could not open Paddle customer portal")
                        return
                      }
                      window.location.href = r.portalUrl
                    } finally {
                      setPortalBusy(false)
                    }
                  }}
                >
                  {portalBusy ? "Opening portal…" : "Manage billing (Paddle)"}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Could not load Paddle billing context.</p>
          )}

          {/* Legacy Stripe subscription row (if present) */}
          {subscription &&
            subscription.plan_name !== "free" &&
            subscription.amount !== 0 &&
            subscription.status === "active" && (
              <div className="mt-6 pt-4 border-t border-border space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Legacy Stripe record
                </p>
                <p className="text-sm text-muted-foreground">
                  {subscription.plan_display_name || subscription.plan_name} —{" "}
                  {(subscription.currency_symbol || "$") + (subscription.amount || 0).toFixed(2)} (
                  {subscription.billing_cycle === "monthly" ? "Monthly" : "Yearly"})
                </p>
              </div>
            )}
        </Card>

        {/* Usage */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Monthly API Usage</h2>
          {usageRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No usage data yet for this month.</p>
          ) : (
            <div className="space-y-4">
              {usageRows.map((row) => (
                <div key={row.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{row.label}</span>
                    <span
                      className={cn(
                        "text-muted-foreground",
                        row.limit != null &&
                          (row.percent ?? 0) >= 100 &&
                          "text-destructive font-semibold",
                        row.limit != null &&
                          (row.percent ?? 0) >= 80 &&
                          (row.percent ?? 0) < 100 &&
                          "text-amber-700 dark:text-amber-300 font-medium",
                      )}
                    >
                      {row.limit == null ? `${row.used} calls` : `${row.used} / ${row.limit}`}
                    </span>
                  </div>
                  {row.limit != null ? (
                    <Progress
                      className={meterProgressIndicatorToneClass(row.percent || 0)}
                      value={row.percent || 0}
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Tracking only (no plan cap configured yet).
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Payment History */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <History className="w-5 h-5" />
            Payment History
          </h2>
          
          {paymentHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payment history available</p>
          ) : (
            <div className="space-y-2">
              {paymentHistory.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {payment.currency_symbol || "$"}{payment.amount.toFixed(2)}
                      </span>
                      <Badge variant={payment.status === "completed" ? "default" : "secondary"}>
                        {payment.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {new Date(payment.payment_date).toLocaleDateString()} • {payment.payment_method}
                      {payment.payment_method_last4 && ` • •••• ${payment.payment_method_last4}`}
                    </p>
                  </div>
                  {payment.invoice_number && (
                    <span className="text-xs text-muted-foreground">{payment.invoice_number}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Manage Credit Card */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Payment methods (TMS)
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingPaymentMethod(null)
                setPaymentMethodForm({
                  type: "card",
                  card_last4: "",
                  card_exp_month: "",
                  card_exp_year: "",
                  cardholder_name: "",
                  is_default: false,
                })
                setShowPaymentMethodDialog(true)
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Payment Method
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground mb-4 rounded-md border border-border bg-muted/40 p-3">
            <strong>Subscription charges</strong> use Paddle at checkout — not the cards stored here. This section is for
            optional on-file methods for other workflows (e.g. freight billing records).
          </p>
          {paymentMethods.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No optional payment methods saved for TMS workflows.
            </p>
          ) : (
            <div className="space-y-2">
              {paymentMethods.map((method) => (
                <div
                  key={method.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {method.card_brand ? `${method.card_brand.toUpperCase()} •••• ${method.card_last4}` : `•••• ${method.card_last4 || method.account_last4}`}
                        </span>
                        {method.is_default && (
                          <Badge variant="outline" className="text-xs">Default</Badge>
                        )}
                      </div>
                      {method.card_exp_month && method.card_exp_year && (
                        <p className="text-xs text-muted-foreground">
                          Expires {method.card_exp_month}/{method.card_exp_year}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingPaymentMethod(method)
                        setPaymentMethodForm({
                          type: method.type,
                          card_last4: method.card_last4 || "",
                          card_exp_month: method.card_exp_month?.toString() || "",
                          card_exp_year: method.card_exp_year?.toString() || "",
                          cardholder_name: method.cardholder_name || "",
                          is_default: method.is_default || false,
                        })
                        setShowPaymentMethodDialog(true)
                      }}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        if (method.id && confirm("Are you sure you want to delete this payment method?")) {
                          const result = await deletePaymentMethod(method.id)
                          if (result.error) {
                            toast.error(result.error)
                          } else {
                            toast.success("Payment method deleted")
                            const methodsResult = await getPaymentMethods()
                            if (methodsResult.data) {
                              setPaymentMethods(parsePaymentMethods(methodsResult.data as unknown[]))
                            }
                          }
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
          </>
        )}
      </div>

      {/* Payment Method Dialog */}
      <Dialog open={showPaymentMethodDialog} onOpenChange={setShowPaymentMethodDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPaymentMethod ? "Edit Payment Method" : "Add Payment Method"}</DialogTitle>
            <DialogDescription>
              {editingPaymentMethod ? "Update your payment method details" : "Add a new credit card for automatic payments"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="pm_type">Payment Method Type</Label>
              <Select
                value={paymentMethodForm.type}
                onValueChange={(value: "card" | "ach" | "wire" | "check") => setPaymentMethodForm({ ...paymentMethodForm, type: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="card">Credit Card</SelectItem>
                  <SelectItem value="ach">ACH (Bank Account)</SelectItem>
                  <SelectItem value="wire">Wire Transfer</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {paymentMethodForm.type === "card" && (
              <>
                <div>
                  <Label htmlFor="cardholder_name">Cardholder Name</Label>
                  <Input
                    id="cardholder_name"
                    value={paymentMethodForm.cardholder_name}
                    onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, cardholder_name: e.target.value })}
                    placeholder="John Doe"
                    className="mt-1"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="card_last4">Last 4 Digits</Label>
                    <Input
                      id="card_last4"
                      value={paymentMethodForm.card_last4}
                      onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, card_last4: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                      placeholder="1234"
                      className="mt-1"
                      maxLength={4}
                    />
                  </div>
                  <div>
                    <Label htmlFor="card_exp_month">Exp Month</Label>
                    <Input
                      id="card_exp_month"
                      value={paymentMethodForm.card_exp_month}
                      onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, card_exp_month: e.target.value.replace(/\D/g, "").slice(0, 2) })}
                      placeholder="12"
                      className="mt-1"
                      maxLength={2}
                    />
                  </div>
                  <div>
                    <Label htmlFor="card_exp_year">Exp Year</Label>
                    <Input
                      id="card_exp_year"
                      value={paymentMethodForm.card_exp_year}
                      onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, card_exp_year: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                      placeholder="2025"
                      className="mt-1"
                      maxLength={4}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Note: For security, only the last 4 digits are stored. Full card details are handled by payment processors.
                </p>
              </>
            )}

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="pm_default"
                checked={paymentMethodForm.is_default}
                onCheckedChange={(checked) => setPaymentMethodForm({ ...paymentMethodForm, is_default: checked as boolean })}
              />
              <Label htmlFor="pm_default" className="cursor-pointer">Set as default payment method</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentMethodDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (paymentMethodForm.type === "card" && (!paymentMethodForm.card_last4 || !paymentMethodForm.cardholder_name)) {
                  toast.error("Please fill in all required card fields")
                  return
                }

                const result = await savePaymentMethod({
                  id: editingPaymentMethod?.id,
                  type: paymentMethodForm.type,
                  card_last4: paymentMethodForm.card_last4 || undefined,
                  card_exp_month: paymentMethodForm.card_exp_month ? parseInt(paymentMethodForm.card_exp_month) : undefined,
                  card_exp_year: paymentMethodForm.card_exp_year ? parseInt(paymentMethodForm.card_exp_year) : undefined,
                  cardholder_name: paymentMethodForm.cardholder_name || undefined,
                  is_default: paymentMethodForm.is_default,
                })

                if (result.error) {
                  toast.error(result.error)
                } else {
                  toast.success(editingPaymentMethod ? "Payment method updated" : "Payment method added")
                  setShowPaymentMethodDialog(false)
                  const methodsResult = await getPaymentMethods()
                  if (methodsResult.data) {
                    setPaymentMethods(parsePaymentMethods(methodsResult.data as unknown[]))
                  }
                }
              }}
            >
              {editingPaymentMethod ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel subscription?</DialogTitle>
            <DialogDescription>
              Cancels at the end of the current Paddle billing period. You can resubscribe any time from this page.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setCancelOpen(false)}>
              Keep subscription
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={cancelBusy}
              onClick={async () => {
                setCancelBusy(true)
                const r = await cancelPaddleBillingSubscription()
                setCancelBusy(false)
                if (!r.success) {
                  toast.error(r.error || "Could not cancel")
                  return
                }
                toast.success("Cancellation scheduled with Paddle.")
                setCancelOpen(false)
              }}
            >
              {cancelBusy ? "Working…" : "Confirm cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        feature={upgradeFeature ?? "route_optimization"}
      />
    </>
  )
}

