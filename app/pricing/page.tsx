"use client"

import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, X, ArrowRight } from "lucide-react"
import { Logo } from "@/components/logo"

const PLANS = [
  {
    name: "Free",
    description: "Owner operators testing the waters",
    priceMonthly: 0,
    priceYearly: 0,
    limits: "Up to 2 trucks",
    included: [
      "Up to 2 trucks",
      "GPS & fleet map",
      "Dispatch",
      "ELD compliance tools",
      "IFTA reporting",
      "Invoicing & settlements (fair-use limits)",
      "1 user",
    ],
    excluded: ["AI assistant", "API access", "Marketplace", "Priority support"],
    cta: "Get started free",
    href: "/register",
    highlighted: false,
  },
  {
    name: "Starter",
    description: "Small fleets getting serious about operations",
    priceMonthly: 149,
    priceYearly: 1490, // 10 months
    limits: "Up to 10 trucks",
    included: [
      "Everything in Free",
      "IFTA reporting + PDF",
      "Invoicing & settlements",
      "Fuel analytics",
      "Maintenance tracking",
      "Driver scorecards",
      "3 users",
      "API & webhooks",
    ],
    excluded: [],
    cta: "Start free trial",
    href: "/register",
    highlighted: false,
  },
  {
    name: "Professional",
    description: "Growing fleets that need everything connected",
    priceMonthly: 299,
    priceYearly: 2990, // 10 months
    limits: "Up to 30 trucks",
    included: [
      "Everything in Starter",
      "Full six-role team permissions (Fleet tier)",
      "AI dispatch assistant",
      "Marketplace access",
      "Customer portal",
      "Backhaul optimization",
      "API keys & webhooks",
      "10 users",
      "Priority support",
    ],
    excluded: [],
    cta: "Start free trial",
    href: "/register",
    highlighted: true,
  },
  {
    name: "Enterprise",
    description: "Large operations needing full control",
    priceMonthly: 499,
    priceYearly: 4990, // 10 months
    limits: "Unlimited trucks",
    included: [
      "Everything in Pro",
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
  { name: "Extra trucks", description: "Go over your plan limit without upgrading", price: "$5 / truck / mo" },
  { name: "AI features pack", description: "Receipt OCR, document analysis, TruckMates AI chat", price: "$29 / mo" },
]

export default function PricingPage() {
  const [billingAnnual, setBillingAnnual] = useState(true)

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS.map((plan) => {
            const price = billingAnnual && plan.priceYearly > 0 ? plan.priceYearly / 12 : plan.priceMonthly
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
                      <span className="text-2xl font-bold text-foreground">${Math.round(price)}</span>
                      <span className="text-muted-foreground text-sm"> per month</span>
                      {billingAnnual && plan.priceYearly > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">billed annually</p>
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
                <Link href={plan.href} className="mt-6 block">
                  <Button className="w-full" variant={plan.highlighted ? "default" : "outline"} size="sm">
                    {plan.cta}
                    <ArrowRight className="ml-2 w-3 h-3" />
                  </Button>
                </Link>
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
