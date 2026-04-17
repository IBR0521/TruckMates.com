"use client"

import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ArrowRight,
  Truck,
  BarChart3,
  Users,
  MapPin,
  Route,
  DollarSign,
  Shield,
  Clock,
  CheckCircle2,
  Play,
  FileText,
  Package,
} from "lucide-react"
import Link from "next/link"
import { Logo } from "@/components/logo"

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  className = "",
}: {
  eyebrow: string
  title: string
  subtitle: string
  className?: string
}) {
  return (
    <div className={`mx-auto mb-12 max-w-3xl text-center md:mb-16 ${className}`}>
      <Badge
        variant="outline"
        className="mb-4 border-primary/25 bg-primary/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary"
      >
        {eyebrow}
      </Badge>
      <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-[2.35rem] lg:leading-tight">
        {title}
      </h2>
      <p className="mt-4 text-lg leading-relaxed text-muted-foreground md:text-xl">{subtitle}</p>
    </div>
  )
}

export default function LandingPageBelowFold() {
  return (
    <>
      {/* Intro — subtle band */}
      <section
        className="relative border-y border-border/60 bg-gradient-to-b from-muted/40 via-background to-background py-20 dark:from-muted/15"
        suppressHydrationWarning
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow="What it is"
            title="Operations in one place"
            subtitle="Web software for loads, dispatch, maintenance, drivers, documents, IFTA, and invoicing. Core integrations (maps, email delivery, and more) use platform-managed API keys — you’re not hunting for dozens of vendor keys on day one."
          />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 md:py-24" suppressHydrationWarning>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow="Features"
            title="What's in the product"
            subtitle="These areas exist in the app today — described plainly, without made-up ROI."
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            <FeatureCard
              icon={Package}
              title="Loads & dispatch"
              desc="Create and track loads, assign drivers, and coordinate dispatch from the dashboard."
              bullets={["Load lifecycle", "Dispatch views", "Customer / broker fields you configure"]}
            />
            <FeatureCard
              icon={Route}
              title="Routes & maps"
              desc="Plan routes and visualize trips with Google Maps — the platform supplies the API keys for core mapping; you don’t paste keys for day-to-day use."
              bullets={["Multi-stop planning", "Map-based views", "Maps powered by platform-managed keys"]}
            />
            <FeatureCard
              icon={Clock}
              title="IFTA"
              desc="Fuel tax workflows, jurisdiction mileage, and reporting tools — you remain responsible for filing accuracy."
              bullets={["Quarterly workflows", "Fuel and mileage inputs", "PDFs / exports where supported"]}
            />
            <FeatureCard
              icon={DollarSign}
              title="Invoicing & settlements"
              desc="Generate invoices and driver settlements from operational data instead of retyping everything."
              bullets={["Invoices", "Settlement tools", "Stripe / PayPal when connected"]}
            />
            <FeatureCard
              icon={FileText}
              title="BOLs & documents"
              desc="Bill of lading and document storage tied to loads and customers."
              bullets={["BOL creation", "Document library", "Signatures where implemented"]}
            />
            <FeatureCard
              icon={Truck}
              title="Maintenance"
              desc="Work orders, reminders, and vehicle records to stay ahead of breakdowns."
              bullets={["Scheduled reminders", "Service history", "Fault code tooling where enabled"]}
            />
            <FeatureCard
              icon={Users}
              title="Drivers & DVIR"
              desc="Driver profiles, assignments, and inspection records."
              bullets={["Driver records", "DVIR flows", "Role-appropriate access"]}
            />
            <FeatureCard
              icon={Shield}
              title="ELD & HOS (dashboard)"
              desc="HOS and ELD data in the product for many workflows. We are not a certified hardware partner of Motive, Samsara, etc."
              bullets={["Log review in app", "Violations / alerts where supported", "No DOT device vendor claim"]}
            />
            <FeatureCard
              icon={MapPin}
              title="Fleet map & GPS"
              desc="See vehicle positions when tracking data is available."
              bullets={["Live map", "History where configured", "Geofencing in product"]}
            />
            <FeatureCard
              icon={BarChart3}
              title="Reports & analytics"
              desc="Built-in dashboards and reports — not a blank-slate custom report builder unless your plan includes it."
              bullets={["Dashboard KPIs", "Standard reports", "Export where available"]}
            />
          </div>
        </div>
      </section>

      {/* Free plan */}
      <section
        id="free-plan"
        className="relative isolate overflow-hidden border-y border-primary/15 bg-gradient-to-br from-primary/[0.07] via-primary/[0.03] to-transparent py-16 dark:from-primary/10 dark:via-primary/5"
      >
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,var(--primary)_0%,transparent_55%)] opacity-[0.09] dark:opacity-[0.14]" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl rounded-3xl border border-border/80 bg-card/80 p-8 text-center shadow-lg shadow-black/5 backdrop-blur-md dark:border-border/60 dark:bg-card/50 md:p-10">
            <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">What&apos;s included in Free</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              The free tier is meant to be usable — not a bait-and-switch. Typical inclusions: up to{" "}
              <strong className="text-foreground">2 trucks</strong>, GPS and dispatch, ELD compliance tooling, IFTA, and
              invoicing, with <strong className="text-foreground">one user</strong> and fair-use limits. Higher tiers add
              users, AI, API access, and more. Details can change —{" "}
              <Link href="/pricing" className="font-medium text-primary underline decoration-primary/30 underline-offset-4">
                read live pricing
              </Link>{" "}
              before you commit.
            </p>
            <Link href="/register" className="mt-8 inline-block">
              <Button size="lg" className="h-12 rounded-xl px-8 font-semibold shadow-md shadow-primary/20">
                Start free — no card
                </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border/60 bg-gradient-to-b from-muted/30 to-background py-20 dark:from-muted/10 md:py-24" suppressHydrationWarning>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow="How it works"
            title="Get going in four steps"
            subtitle="Straightforward setup — no enterprise sales theater."
          />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {[
              {
                num: "1",
                title: "Create an account",
                desc: "Sign up free, add your company, trucks, and users.",
              },
              {
                num: "2",
                title: "Connect data",
                desc: "Bring in ELD or GPS data the way your operation already works — imports, APIs, or provider exports where supported.",
              },
              {
                num: "3",
                title: "Run the day",
                desc: "Dispatch loads, track maintenance, and keep drivers and documents in one system.",
              },
              {
                num: "4",
                title: "Close the loop",
                desc: "Invoice, settle, and file IFTA using the records you already captured.",
              },
            ].map((step) => (
              <div
                key={step.num}
                className="group relative rounded-2xl border border-border/80 bg-card/80 p-6 shadow-sm transition hover:border-primary/25 hover:shadow-md dark:bg-card/40"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-sm font-bold text-primary-foreground shadow-md">
                  {step.num}
                </div>
                <h3 className="text-lg font-semibold tracking-tight text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section
        className="relative overflow-hidden py-20 md:py-24"
        suppressHydrationWarning
      >
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent dark:from-primary/20" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_100%_80%_at_50%_100%,transparent_40%,var(--background)_100%)]" />
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Try it before you trust the copy
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Open the demo or create a free account. If it doesn&apos;t fit your fleet, you&apos;ll know quickly.
          </p>
          <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:mx-auto sm:max-w-lg sm:flex-row sm:items-center">
            <Link href="/demo" className="sm:flex-1">
              <Button size="lg" className="h-12 w-full rounded-xl font-semibold shadow-lg shadow-primary/25">
                <Play className="mr-2 h-5 w-5" />
                Try demo
              </Button>
            </Link>
            <Link href="/register" className="sm:flex-1">
              <Button size="lg" variant="outline" className="h-12 w-full rounded-xl border-2 font-semibold">
                Start free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            Already registered?{" "}
            <Link href="/login" className="font-medium text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary">
              Log in
            </Link>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/80 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            <div className="lg:col-span-1">
              <Logo size="sm" />
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
                Fleet operations for small carriers — honest scope, no fake enterprise claims.
              </p>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Product</h4>
              <ul className="mt-4 space-y-3 text-sm">
                {[
                  ["Pricing", "/pricing"],
                  ["Demo", "/demo"],
                  ["Start free", "/register"],
                  ["Log in", "/login"],
                ].map(([label, href]) => (
                  <li key={href}>
                    <Link href={href} className="text-foreground/90 transition hover:text-primary">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Learn</h4>
              <ul className="mt-4 space-y-3 text-sm">
                <li>
                  <Link href="/#features" className="text-foreground/90 transition hover:text-primary">
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="text-foreground/90 transition hover:text-primary">
                    Free plan details
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Company</h4>
              <ul className="mt-4 space-y-3 text-sm">
                {[
                  ["About", "/about"],
                  ["Integrations", "/integrations"],
                  ["Security", "/security"],
                  ["Compliance", "/compliance"],
                ].map(([label, href]) => (
                  <li key={href}>
                    <Link href={href} className="text-foreground/90 transition hover:text-primary">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border/60 pt-8 sm:flex-row">
            <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} TruckMates. All rights reserved.</p>
            <div className="flex gap-8">
              <Link href="/privacy" className="text-sm text-muted-foreground transition hover:text-foreground">
                Privacy
              </Link>
              <Link href="/terms" className="text-sm text-muted-foreground transition hover:text-foreground">
                Terms
              </Link>
              <Link href="/refund-policy" className="text-sm text-muted-foreground transition hover:text-foreground">
                Refund Policy
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}

function FeatureCard({
  icon: Icon,
  title,
  desc,
  bullets,
}: {
  icon: LucideIcon
  title: string
  desc: string
  bullets: string[]
}) {
  return (
    <Card className="group relative flex h-full flex-col overflow-hidden rounded-2xl border-border/70 bg-card/60 p-6 shadow-sm ring-1 ring-black/[0.03] transition duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 dark:bg-card/40 dark:ring-white/[0.04] lg:p-6">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/15 transition group-hover:from-primary/25 group-hover:to-primary/10">
        <Icon className="h-6 w-6 text-primary" strokeWidth={1.75} />
      </div>
      <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{desc}</p>
      <ul className="mt-4 space-y-2.5 border-t border-border/50 pt-4">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2.5 text-sm text-muted-foreground">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary/80" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
