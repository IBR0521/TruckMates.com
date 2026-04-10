"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, X, ArrowRight } from "lucide-react"
import { Logo } from "@/components/logo"
import { createClient } from "@/lib/supabase/client"
import { startPlanTrial } from "@/app/actions/subscription-onboarding"
import { toast } from "sonner"
import { useRouter, useSearchParams } from "next/navigation"

const PLANS = [
  {
    name: "Operator",
    internalName: "starter",
    description: "Owner-operators needing full ops + compliance from day one",
    priceMonthly: 89,
    priceYearly: 828,
    limits: "Up to 5 trucks · 2 users",
    included: [
      "Loads, dispatch, BOLs, invoicing, settlements",
      "IFTA, ELD logs, DVIR, maintenance, reminders",
      "Revenue, P&L, and fuel analytics",
      "14-day free trial (no credit card)",
      "2 users included",
    ],
    excluded: [
      "QuickBooks sync",
      "Driver scorecards",
      "API & webhooks",
      "Predictive maintenance",
      "Geofencing & route optimizer",
    ],
    cta: "Start 14-day trial",
    href: "/register",
    highlighted: false,
  },
  {
    name: "Fleet",
    internalName: "professional",
    description: "Growing fleets needing accounting depth and team coordination",
    priceMonthly: 219,
    priceYearly: 2148,
    limits: "Up to 20 trucks · 8 users",
    included: [
      "Everything in Operator",
      "Full six-role team permissions (Fleet tier)",
      "IFTA reporting + PDF",
      "QuickBooks sync + advanced reporting",
      "Driver scorecards",
      "Predictive maintenance + geofencing + route optimizer",
      "CRM, detention/on-time reports, factoring integration",
      "API & webhooks",
      "8 users included",
      "14-day free trial (no credit card)",
    ],
    excluded: [],
    cta: "Start 14-day trial",
    href: "/register",
    highlighted: true,
  },
  {
    name: "Enterprise",
    internalName: "enterprise",
    description: "Large operations needing full control",
    priceMonthly: 429,
    priceYearly: 4188,
    limits: "Unlimited trucks",
    included: [
      "Everything in Fleet",
      "Unlimited users",
      "Multi-company RBAC",
      "Audit logs",
      "Custom Integrations",
      "Receipt OCR (AI)",
      "White-label portal",
      "Dedicated support",
    ],
    excluded: [],
    cta: "Contact us",
    href: "/register",
    highlighted: false,
  },
]

const ADDONS = [
  { name: "Extra trucks", description: "Overage beyond plan truck limit without full tier upgrade", price: "$8 / truck / mo" },
  { name: "ELD hardware sync", description: "Samsara, Motive, or Geotab webhook integration", price: "$24 / mo" },
  { name: "Toll routing", description: "Commercial toll lookups and route costing via TollGuru", price: "$19 / mo" },
  { name: "Portal branding", description: "Custom logo and colors on customer-facing portal", price: "$39 / mo" },
]

export default function PricingPage() {
  const [billingAnnual, setBillingAnnual] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isChoosingPlan, setIsChoosingPlan] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const onboarding = searchParams.get("onboarding") === "1"

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then((result) => {
      setIsAuthenticated(!!result.data.user)
    })
  }, [])

  const handlePlanChoose = async (planInternalName: "starter" | "professional" | "enterprise") => {
    if (!isAuthenticated) {
      router.push("/register")
      return
    }
    setIsChoosingPlan(planInternalName)
    try {
      const result = await startPlanTrial(planInternalName)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Trial started", {
        description: "Your 14-day trial is now active.",
      })
      router.push("/dashboard")
    } finally {
      setIsChoosingPlan(null)
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

      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        {onboarding && (
          <p className="mb-4 text-sm text-primary font-medium">
            Choose your plan to activate your 14-day free trial.
          </p>
        )}
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
          Simple, transparent pricing
        </h1>
        <div className="flex items-center justify-center gap-3 mb-2">
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
          <span className="text-xs text-muted-foreground ml-1">Save 2 months</span>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const effectiveMonthly =
              billingAnnual && plan.priceYearly > 0
                ? Math.round(plan.priceYearly / 12)
                : plan.priceMonthly
            return (
              <Card
                key={plan.name}
                className={`p-6 flex flex-col ${
                  plan.highlighted ? "border-primary shadow-lg ring-2 ring-primary/20" : "border-border"
                }`}
              >
                {plan.highlighted && (
                  <Badge className="w-fit mb-3">Most popular</Badge>
                )}
                <h2 className="text-lg font-bold text-foreground">{plan.name}</h2>
                <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                <p className="text-xs text-muted-foreground mt-2">{plan.limits}</p>
                <div className="mt-4 mb-4">
                  {plan.priceMonthly === 0 ? (
                    <span className="text-2xl font-bold text-foreground">$0</span>
                  ) : (
                    <>
                      <span className="text-2xl font-bold text-foreground">${effectiveMonthly}</span>
                      <span className="text-muted-foreground text-sm"> per month</span>
                      {billingAnnual && plan.priceYearly > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          billed annually (${plan.priceYearly.toLocaleString()}/year)
                        </p>
                      )}
                    </>
                  )}
                  {plan.priceMonthly === 0 && <p className="text-xs text-muted-foreground mt-0.5">forever free</p>}
                </div>
                <ul className="space-y-2 flex-1 text-sm">
                  {plan.included.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-muted-foreground">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                  {plan.excluded.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-muted-foreground/70">
                      <X className="w-4 h-4 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 block">
                  <Button
                    className="w-full"
                    variant={plan.highlighted ? "default" : "outline"}
                    size="sm"
                    disabled={isChoosingPlan !== null}
                    onClick={() => handlePlanChoose(plan.internalName)}
                  >
                    {plan.cta}
                    <ArrowRight className="ml-2 w-3 h-3" />
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>

        <div className="mt-16">
          <h2 className="text-xl font-bold text-foreground mb-4">ADD-ONS</h2>
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
            <Link href="/" className="text-sm text-muted-foreground hover:text-primary">Home</Link>
            <Link href="/terms" className="text-sm text-muted-foreground hover:text-primary">Terms</Link>
            <Link href="/privacy" className="text-sm text-muted-foreground hover:text-primary">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
