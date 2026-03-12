import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, ArrowRight } from "lucide-react"
import { Logo } from "@/components/logo"

export const metadata = {
  title: "Pricing | TruckMates",
  description: "Start with 3 months free. Simple pricing for fleet and logistics management.",
}

const tiers = [
  {
    name: "Starter",
    priceMonthly: 29,
    description: "For small fleets getting started",
    limits: "Up to 10 vehicles, 15 drivers, 10 users",
    features: [
      "Basic fleet tracking",
      "Driver & route management",
      "Load management & basic reports",
      "Invoicing & expense tracking",
      "Maintenance scheduling",
      "Document storage",
    ],
    cta: "Get Started",
    href: "/register",
    highlighted: false,
  },
  {
    name: "Professional",
    priceMonthly: 59,
    description: "For growing operations",
    limits: "Up to 30 vehicles, 40 drivers, 25 users",
    features: [
      "Everything in Starter",
      "ELD service integration",
      "Real-time GPS & HOS compliance",
      "IFTA reporting with ELD data",
      "Advanced analytics & route optimization",
      "Priority email support",
    ],
    cta: "Get Started",
    href: "/register",
    highlighted: true,
  },
  {
    name: "Enterprise",
    priceMonthly: 99,
    description: "For large fleets",
    limits: "Unlimited vehicles, drivers & users",
    features: [
      "Everything in Professional",
      "Advanced ELD features",
      "Custom integrations",
      "Dedicated account manager",
      "24/7 priority support",
      "Custom training",
    ],
    cta: "Contact Sales",
    href: "/register",
    highlighted: false,
  },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/">
            <Logo size="sm" />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/features">
              <Button variant="ghost">Features</Button>
            </Link>
            <Link href="/login">
              <Button variant="ghost">Login</Button>
            </Link>
            <Link href="/register">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <Badge variant="outline" className="mb-4">Pricing</Badge>
        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
          Simple, transparent pricing
        </h1>
        <p className="text-xl text-muted-foreground mb-6">
          Start with <strong className="text-primary">3 months free</strong>. No credit card required. Cancel anytime.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
          <span className="text-sm font-medium text-primary">3 months free on any plan — then choose your tier</span>
        </div>
      </section>

      {/* Tiers */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="grid md:grid-cols-3 gap-8">
          {tiers.map((tier) => (
            <Card
              key={tier.name}
              className={`p-6 flex flex-col ${
                tier.highlighted
                  ? "border-primary shadow-lg ring-2 ring-primary/20"
                  : "border-border"
              }`}
            >
              {tier.highlighted && (
                <Badge className="w-fit mb-4">Most popular</Badge>
              )}
              <h2 className="text-xl font-bold text-foreground">{tier.name}</h2>
              <p className="text-sm text-muted-foreground mt-1">{tier.description}</p>
              <p className="text-xs text-muted-foreground mt-2">{tier.limits}</p>
              <div className="mt-4 mb-6">
                <span className="text-3xl font-bold text-foreground">${tier.priceMonthly}</span>
                <span className="text-muted-foreground">/month</span>
                <p className="text-xs text-muted-foreground mt-1">after 3 months free</p>
              </div>
              <ul className="space-y-3 flex-1">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link href={tier.href} className="mt-6 block">
                <Button
                  className="w-full"
                  variant={tier.highlighted ? "default" : "outline"}
                >
                  {tier.cta}
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
            </Card>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          All plans include full access to the platform during your free trial. You can change or cancel your plan at any time.
        </p>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
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
