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
  const [subscription, setSubscription] = useState<any>(null)
  const [usageRows, setUsageRows] = useState<any[]>([])
  const [paymentHistory, setPaymentHistory] = useState<any[]>([])
  const [paymentMethods, setPaymentMethods] = useState<any[]>([])
  const [showPaymentMethodDialog, setShowPaymentMethodDialog] = useState(false)
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<any>(null)
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

  useEffect(() => {
    if (!requestedUpgrade) return
    if (
      requestedUpgrade === "route_optimization" ||
      requestedUpgrade === "geofencing" ||
      requestedUpgrade === "crm" ||
      requestedUpgrade === "api_keys"
    ) {
      setUpgradeFeature(requestedUpgrade)
      setShowUpgradeModal(true)
    }
  }, [requestedUpgrade])

  useEffect(() => {
    async function loadSettings() {
      setIsLoading(true)
      try {
        const [billingResult, subscriptionResult, historyResult, methodsResult, usageResult] = await Promise.all([
          getBillingInfo(),
          getSubscription(),
          getPaymentHistory(),
          getPaymentMethods(),
          getMonthlyApiUsageOverview(),
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
          setPaymentHistory(historyResult.data)
        }

        if (methodsResult.data) {
          setPaymentMethods(methodsResult.data)
        }
        if (usageResult.data) {
          setUsageRows(usageResult.data)
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
            Manage your subscription and billing information
          </p>
          {paymentRequired && (
            <p className="mt-2 text-sm text-destructive">
              Billing is required before access can continue. Add payment to activate your subscription.
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

        {/* Subscription */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Subscription
          </h2>
          
          {subscription ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{subscription.plan_display_name || subscription.plan_name || "Free"}</p>
                  <p className="text-sm text-muted-foreground">
                    {subscription.plan_name === "free" || subscription.amount === 0
                      ? "Free plan — upgrade for higher limits and team size."
                      : `${subscription.billing_cycle === "monthly" ? "Monthly" : "Yearly"} billing`}
                  </p>
                </div>
                <Badge variant={subscription.status === "active" ? "default" : "secondary"}>
                  {subscription.status === "active" ? "Active" : subscription.status}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Amount</p>
                  <p className="font-medium">
                    {subscription.amount === 0 
                      ? "Free" 
                      : `${subscription.currency_symbol || "$"}${(subscription.amount || 0).toFixed(2)}`}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {subscription.plan_name === "free" || subscription.amount === 0 ? "Status" : "Next Billing"}
                  </p>
                  <p className="font-medium">
                    {subscription.plan_name === "free" || subscription.amount === 0
                      ? "No payment required"
                      : subscription.end_date 
                        ? new Date(subscription.end_date).toLocaleDateString() 
                        : "N/A"}
                  </p>
                </div>
              </div>
              {(subscription.plan_name === "free" || subscription.amount === 0) && (
                <div className="pt-2">
                  <Button variant="outline" size="sm" className="rounded-lg" asChild>
                    <Link href="/pricing">View plans & pricing</Link>
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Could not load subscription details.</p>
              <p className="text-xs text-muted-foreground">
                If this persists, confirm your database has <code className="text-xs">subscriptions</code> and{" "}
                <code className="text-xs">subscription_plans</code> (run the subscription migration).
              </p>
              <Button variant="outline" size="sm" className="rounded-lg mt-2" asChild>
                <Link href="/pricing">View plans & pricing</Link>
              </Button>
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
                    <span className="text-muted-foreground">
                      {row.limit == null ? `${row.used} calls` : `${row.used} / ${row.limit}`}
                    </span>
                  </div>
                  {row.limit != null ? (
                    <Progress value={row.percent || 0} />
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
              Manage Credit Card
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
          
          {paymentMethods.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No payment methods saved. Add a credit card to use for automatic payments.
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
                              setPaymentMethods(methodsResult.data)
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
                onValueChange={(value: any) => setPaymentMethodForm({ ...paymentMethodForm, type: value })}
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
                    setPaymentMethods(methodsResult.data)
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
    {upgradeFeature && (
      <UpgradeModal open={showUpgradeModal} onOpenChange={setShowUpgradeModal} feature={upgradeFeature} />
    )}
    </>
  )
}

