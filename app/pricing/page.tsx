"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, ArrowRight } from "lucide-react"
import { Logo } from "@/components/logo"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import {
  PLAN_FEATURES,
  PLAN_LIMITS,
  PLAN_TIER_ORDER,
  isUnlimited,
  planTierLabel,
  type PlanFeatures,
  type PlanTier,
} from "@/lib/plan-limits"
import { startPlanCheckout } from "@/app/actions/plan-usage"
import { getPaddleClient } from "@/lib/billing/paddle-client"

const TIER_SUMMARY: Record<PlanTier, string> = {
  owner_operator: "Designed for owner-operators and 1–2 trucks — TMS core loads, invoices, dispatch, limits without premium AI integrations.",
  starter: "3–10 trucks: core TMS plus essential AI assistants (documents, dispatch, morning briefing); no live ELD vendor feeds.",
  professional: "11–35 trucks: live ELD integrations, conversational & autonomous AI, AP, reconciliation, predictive maintenance.",
  fleet: "36–100 trucks: public API + EDI, multi-terminal, HAZMAT/LTL tooling, leases, permits, priority phone support.",
  enterprise: "100+ carriers: custom SLAs, SSO/white-label, dedicated success, bespoke AI tuning on your corpus.",
}

const FEATURE_SHOWCASE: { key: keyof PlanFeatures; label: string }[] = [
  { key: "ai_document_extraction", label: "AI document extraction" },
  { key: "ai_dispatch_suggestions", label: "AI dispatch suggestions" },
  { key: "ai_morning_briefing", label: "AI morning briefing" },
  { key: "ai_conversational", label: "Conversational AI" },
  { key: "ai_autonomous_agent", label: "Autonomous AI agent" },
  { key: "eld_live_integrations", label: "ELD live integrations" },
  { key: "ap_vendor_invoicing", label: "AP vendor invoicing" },
  { key: "bank_reconciliation", label: "Bank reconciliation" },
  { key: "gl_quickbooks_sync", label: "GL & QuickBooks sync" },
  { key: "factoring_api", label: "Factoring API integration" },
  { key: "predictive_maintenance", label: "Predictive maintenance AI" },
  { key: "public_api", label: "Public REST API" },
  { key: "edi_receiving", label: "EDI receiving" },
  { key: "multi_terminal", label: "Multi-terminal management" },
  { key: "hazmat_module", label: "HAZMAT module" },
  { key: "ltl_shipments", label: "LTL linehaul tooling" },
  { key: "lease_management", label: "Lease management" },
  { key: "permit_management", label: "Permit management" },
  { key: "custom_ai_training", label: "Custom AI training on your docs" },
  { key: "white_label", label: "White-label customer portal" },
  { key: "sso", label: "Enterprise SSO (SAML/OIDC)" },
  { key: "dedicated_account_manager", label: "Dedicated account director" },
  { key: "custom_sla", label: "Custom SLA" },
]

function tierFeatureBullets(tier: PlanTier, lim: (typeof PLAN_LIMITS)[PlanTier], maxItems = 5): string[] {
  if (tier === "enterprise") {
    return [
      ...FEATURE_SHOWCASE.filter((row) => PLAN_FEATURES.enterprise[row.key]).slice(0, maxItems).map((r) => r.label),
    ].slice(0, maxItems)
  }
  const feats = PLAN_FEATURES[tier]
  const lines: string[] = []
  for (const row of FEATURE_SHOWCASE) {
    if (feats[row.key]) {
      lines.push(row.label)
    }
    if (lines.length >= maxItems) return lines
  }
  const capLines = [
    `Up to ${isUnlimited(lim.trucks) ? "∞" : lim.trucks} active trucks`,
    `${isUnlimited(lim.loads_per_month) ? "Unlimited" : lim.loads_per_month.toLocaleString()} loads / month`,
    `${isUnlimited(lim.ai_calls_per_month) ? "Unlimited" : lim.ai_calls_per_month.toLocaleString()} AI calls / month`,
    `${isUnlimited(lim.storage_gb) ? "Unlimited" : lim.storage_gb} GB documents`,
    `${isUnlimited(lim.api_requests_per_day) ? "Unlimited daily" : lim.api_requests_per_day.toLocaleString()} API reqs / day`,
  ]
  for (const extra of capLines) {
    if (lines.includes(extra)) continue
    lines.push(extra)
    if (lines.length >= maxItems) break
  }
  return lines.slice(0, maxItems)
}

function planCtaLabel(tier: PlanTier, isAuthenticated: boolean, checkoutTier: PlanTier | null): string {
  if (tier === "enterprise") return "Contact sales"
  if (checkoutTier === tier) return "Opening…"
  if (isAuthenticated) return "Upgrade now"
  if (tier === "starter") return "Start free trial"
  return "Subscribe now"
}

const ADDONS = [
  { name: "Extra trucks", description: "Overage beyond plan truck limit without full tier upgrade", price: "Contact sales" },
  { name: "Toll routing", description: "Commercial toll lookups via TollGuru", price: "Add at checkout" },
  { name: "Portal branding", description: "Custom logo and colors on customer portal", price: "Fleet tier+" },
]

export default function PricingPage() {
  const [billingAnnual, setBillingAnnual] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [checkoutTier, setCheckoutTier] = useState<PlanTier | null>(null)
  const [onboarding, setOnboarding] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    async function loadUser() {
      const response = await supabase.auth.getUser()
      setIsAuthenticated(!!response.data.user)
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search)
        setOnboarding(params.get("onboarding") === "1")
      }
    }
    void loadUser()
  }, [])

  const handlePlanChoose = async (tier: PlanTier) => {
    if (tier === "enterprise") {
      window.location.href =
        "mailto:sales@truckmates.com?subject=TruckMates%20Enterprise%20plan"
      return
    }
    if (!isAuthenticated) {
      router.push(`/register?tier=${encodeURIComponent(tier)}`)
      return
    }

    setCheckoutTier(tier)
    try {
      const result = await startPlanCheckout({
        tier,
        billingCycle: billingAnnual ? "annual" : "monthly",
      })
      if (result.error || !result.data) {
        toast.error(result.error || "Checkout unavailable.")
        return
      }

      const paddle = await getPaddleClient()
      if (!paddle) {
        toast.error("Payment system not available. Please refresh and try again.")
        return
      }

      paddle.Checkout.open({
        items: [{ priceId: result.data.priceId, quantity: 1 }],
        customer: result.data.customerId
          ? { id: result.data.customerId }
          : result.data.customerEmail
            ? { email: result.data.customerEmail }
            : undefined,
        customData: result.data.customData,
        settings: {
          displayMode: "overlay",
          theme: "dark",
          locale: "en",
          successUrl: `${window.location.origin}/dashboard/settings/billing?upgraded=1`,
        },
      })
      toast.success("Secure checkout opened — complete payment in the window above.")
    } catch (e) {
      console.error(e)
      toast.error("Failed to open checkout. Please try again.")
    } finally {
      setTimeout(() => setCheckoutTier(null), 1000)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/">
            <Logo size="sm" />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Login</Button>
            </Link>
            <Link href="/register">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        {onboarding && (
          <p className="mb-4 text-sm text-primary font-medium">
            Choose your plan — billing runs securely through Paddle.
          </p>
        )}
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
          Plans built for every carrier size
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
          Same core TMS on every tier — AI, integrations, and scale unlock as you grow. Annual pricing is about 20% off
          the monthly rate.
        </p>
        <div className="flex items-center justify-center gap-3 mb-10">
          <span className={`text-sm font-medium ${!billingAnnual ? "text-foreground" : "text-muted-foreground"}`}>
            Monthly
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={billingAnnual}
            onClick={() => setBillingAnnual((v) => !v)}
            className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
                billingAnnual ? "translate-x-5" : "translate-x-1"
              }`}
            />
          </button>
          <span className={`text-sm font-medium ${billingAnnual ? "text-foreground" : "text-muted-foreground"}`}>
            Annual
          </span>
          <Badge variant="secondary" className="text-xs">
            ~20% savings
          </Badge>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {PLAN_TIER_ORDER.map((tier) => {
            const lim = PLAN_LIMITS[tier]
            const isEnterprise = tier === "enterprise"
            const monthlyPrice = isEnterprise ? null : lim.price_monthly
            const annualPrice = isEnterprise ? null : lim.price_annual
            const highlighted = tier === "professional"

            return (
              <Card
                key={tier}
                className={`p-5 flex flex-col ${
                  highlighted ? "border-primary shadow-lg ring-2 ring-primary/20 xl:scale-[1.02]" : "border-border"
                }`}
              >
                {highlighted && <Badge className="w-fit mb-2">Most popular</Badge>}
                <h2 className="text-lg font-bold text-foreground">{planTierLabel(tier)}</h2>
                <p className="text-xs text-muted-foreground mt-1 min-h-[2.5rem]">{TIER_SUMMARY[tier]}</p>
                <div className="mt-4 mb-3">
                  {!isEnterprise &&
                    (!billingAnnual ? (
                      <>
                        <span className="text-2xl font-bold text-foreground">${monthlyPrice}</span>
                        <span className="text-muted-foreground text-sm"> /mo</span>
                        <p className="text-xs text-muted-foreground mt-2">
                          or{" "}
                          <span className="font-semibold text-foreground">
                            ${annualPrice}/mo billed annually (~20% off)
                          </span>
                        </p>
                      </>
                    ) : (
                      <>
                        <span className="text-2xl font-bold text-foreground">${annualPrice}</span>
                        <span className="text-muted-foreground text-sm"> /mo</span>
                        <p className="text-xs text-muted-foreground mt-2">
                          Billed annually • compared with ${monthlyPrice}/mo month‑to‑month
                        </p>
                      </>
                    ))}
                  {isEnterprise && (
                    <p className="text-2xl font-bold text-foreground pt-1">Custom</p>
                  )}
                </div>
                <ul className="space-y-1.5 flex-1 text-xs text-left text-muted-foreground">
                  {tierFeatureBullets(tier, lim, 5).map((line) => (
                    <li key={line} className="flex gap-2">
                      <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      {line}
                    </li>
                  ))}
                  <li className="flex gap-2 pt-1 border-t border-border/60 mt-2">
                    <Check className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <span>
                      Capacity: {isUnlimited(lim.trucks) ? "∞" : lim.trucks} trucks ·{" "}
                      {isUnlimited(lim.loads_per_month) ? "∞" : lim.loads_per_month.toLocaleString()} loads/mo ·{" "}
                      {isUnlimited(lim.user_seats) ? "∞" : lim.user_seats} seats
                    </span>
                  </li>
                </ul>
                <div className="mt-5">
                  <Button
                    className="w-full"
                    variant={highlighted ? "default" : "outline"}
                    size="sm"
                    disabled={checkoutTier !== null}
                    onClick={() => handlePlanChoose(tier)}
                  >
                    {planCtaLabel(tier, isAuthenticated, checkoutTier)}
                    <ArrowRight className="ml-2 w-3 h-3" />
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8 max-w-3xl mx-auto">
          Subscription and tax receipts are handled by Paddle. Manage or cancel anytime from Settings → Billing.
        </p>

        <div className="mt-16">
          <h2 className="text-xl font-bold text-foreground mb-4">Add-ons</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {ADDONS.map((addon) => (
              <Card key={addon.name} className="p-4 border-border">
                <h3 className="font-semibold text-foreground">{addon.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{addon.description}</p>
                <p className="text-sm font-medium text-primary mt-2">{addon.price}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8 px-4 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo size="sm" />
          <div className="flex gap-6">
            <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
              Home
            </Link>
            <Link href="/terms" className="text-sm text-muted-foreground hover:text-primary">
              Terms
            </Link>
            <Link href="/privacy" className="text-sm text-muted-foreground hover:text-primary">
              Privacy
            </Link>
            <Link href="/refund-policy" className="text-sm text-muted-foreground hover:text-primary">
              Refund Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
