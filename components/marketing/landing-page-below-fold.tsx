"use client"

import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import {
  Truck,
  BarChart3,
  Users,
  MapPin,
  Route,
  DollarSign,
  Shield,
  Clock,
  FileText,
  Package,
  Bot,
  AlertTriangle,
  Check,
} from "lucide-react"
import Link from "next/link"
import { MarketingSiteFooter } from "@/components/marketing/marketing-site-footer"
import {
  AIAssistantPreview,
  CompliancePreview,
  DispatchPreview,
  InvoicePreview,
  PreviewTheme,
  ReportsPreview,
} from "@/components/marketing/previews"
import {
  DotBg,
  MarketingFinalCta,
  WBody,
  WEyebrow,
  WGhostButton,
  WSectionHeading,
} from "@/components/marketing/marketing-ui"

type Feature = {
  icon: LucideIcon
  title: string
  desc: string
}

const FEATURES: Feature[] = [
  { icon: Package, title: "Loads & dispatch", desc: "Create and track loads, assign drivers, coordinate dispatch." },
  { icon: Route, title: "Routes & maps", desc: "Plan routes with Google Maps — platform-managed keys." },
  { icon: Clock, title: "IFTA", desc: "Fuel tax workflows, jurisdiction mileage, and reporting." },
  { icon: DollarSign, title: "Invoicing & settlements", desc: "Invoices and driver settlements from operational data." },
  { icon: FileText, title: "BOLs & documents", desc: "BOL and document storage tied to loads and customers." },
  { icon: Truck, title: "Maintenance", desc: "Work orders, reminders, and vehicle records." },
  { icon: Users, title: "Drivers & DVIR", desc: "Driver profiles, assignments, and inspection records." },
  { icon: Shield, title: "ELD & telematics", desc: "Samsara, Motive, or Geotab — HOS, GPS, safety, fault codes." },
  { icon: MapPin, title: "Fleet map & geofencing", desc: "Live map, geofences, arrival/departure, dwell time." },
  { icon: BarChart3, title: "Reports & analytics", desc: "Operations, finance, safety, and detention dashboards." },
  { icon: Bot, title: "AI Assistant", desc: "Fleet Q&A, morning briefing, action tools on higher plans." },
  { icon: Users, title: "Driver safety", desc: "Scorecards, leaderboard, coaching, harsh events from ELD." },
  { icon: Route, title: "Trip replay", desc: "Replay completed loads — route, stops, on-time performance." },
  { icon: AlertTriangle, title: "Vehicle health", desc: "Fault codes in plain English with severity and next steps." },
]

const PRICING_TEASER = [
  { name: "Owner-Operator", price: "$49", bullets: ["2 trucks", "50 loads/mo", "Core TMS"] },
  { name: "Starter", price: "$149", bullets: ["10 trucks", "200 loads/mo", "+ AI chat"] },
  { name: "Professional", price: "$499", bullets: ["35 trucks", "2,000 loads/mo", "+ AI actions"], popular: true },
  { name: "Fleet", price: "$899", bullets: ["100 trucks", "Unlimited loads", "+ Autonomous agent"] },
  { name: "Enterprise", price: "Custom", bullets: ["Unlimited", "Unlimited", "Custom everything"] },
]

const STEPS = [
  { num: "1", title: "Create an account", desc: "Sign up free, add your company, trucks, and users." },
  {
    num: "2",
    title: "Connect data",
    desc: "Run the ELD setup wizard to link your Samsara, Motive, or Geotab. The platform handles the API plumbing.",
  },
  { num: "3", title: "Run the day", desc: "Dispatch loads, track maintenance, and keep drivers and documents in one system." },
  { num: "4", title: "Close the loop", desc: "Invoice, settle, and file IFTA using the records you already captured." },
]

function CheckBullets({ items }: { items: string[] }) {
  return (
    <ul className="mt-6 space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5 text-[15px] text-[var(--w-text-2)]">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--w-green)]" />
          <span style={{ fontFamily: "var(--font-jakarta), sans-serif" }}>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function ProductSection({
  eyebrow,
  headline,
  body,
  bullets,
  cta,
  mockup,
  reverse = false,
  bg = "var(--w-bg)",
}: {
  eyebrow: string
  headline: string
  body: string
  bullets?: string[]
  cta?: ReactNode
  mockup: ReactNode
  reverse?: boolean
  bg?: string
}) {
  return (
    <section className="overflow-hidden py-20 sm:py-24" style={{ background: bg }}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div
          className={`flex flex-col items-start gap-10 xl:gap-14 ${
            reverse ? "xl:flex-row-reverse" : "xl:flex-row"
          }`}
        >
          <div className="min-w-0 flex-1 xl:max-w-[520px]">
            <WEyebrow>{eyebrow}</WEyebrow>
            <h2
              className="text-[clamp(30px,4vw,44px)] font-bold leading-[1.12] tracking-[-0.02em] text-[var(--w-text)]"
              style={{ fontFamily: "var(--font-bricolage), sans-serif" }}
            >
              {headline}
            </h2>
            <WBody className="mt-4 text-base">{body}</WBody>
            {bullets ? <CheckBullets items={bullets} /> : null}
            {cta ? <div className="mt-8">{cta}</div> : null}
          </div>
          <div className="w-full min-w-0 xl:w-[min(100%,540px)] xl:shrink-0">{mockup}</div>
        </div>
      </div>
    </section>
  )
}

export default function LandingPageBelowFold() {
  return (
    <>
      {/* Trust strip */}
      <section
        className="border-y py-5"
        style={{ background: "var(--w-bg-2)", borderColor: "var(--w-border)" }}
      >
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-center gap-3 px-4 sm:flex-row sm:gap-6">
          <span
            className="text-center text-[12px]"
            style={{ color: "var(--w-text-3)", fontFamily: "var(--font-mono-display), monospace" }}
          >
            Works with the tools you already run
          </span>
          <div className="flex flex-wrap justify-center gap-2">
            {["Samsara", "Motive", "Geotab"].map((name) => (
              <span
                key={name}
                className="rounded-full border px-3.5 py-1 text-[12px]"
                style={{
                  borderColor: "var(--w-border-md)",
                  color: "var(--w-text-2)",
                  fontFamily: "var(--font-jakarta), sans-serif",
                }}
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      <ProductSection
        eyebrow="Dispatch"
        headline="See every load in motion."
        body="Create, assign, and track loads from one board. HOS and endorsements are checked before you assign — not after."
        bullets={[
          "Load board with live status and ETAs",
          "Driver assignment with HOS pre-check",
          "Rate and broker fields on every load",
        ]}
        mockup={<DispatchPreview />}
      />

      <ProductSection
        eyebrow="AI Built In"
        headline="An assistant that actually knows trucking."
        body="TruckMates AI has FMCSA regulatory knowledge built in. It reads your operational data and takes action with your approval — never blindly."
        bullets={[
          "HOS-aware assignment recommendations",
          "Rate con vs invoice discrepancy detection",
          "Morning briefing and fleet Q&A on eligible plans",
        ]}
        cta={<WGhostButton href="/#features">See AI features →</WGhostButton>}
        mockup={<AIAssistantPreview />}
        reverse
        bg="var(--w-bg-2)"
      />

      <ProductSection
        eyebrow="Compliance"
        headline="Catch problems before the DOT does."
        body="HOS clocks, document expiry, and CSA thresholds flagged proactively — so you're fixing issues before an audit, not during one."
        bullets={[
          "Live HOS remaining per driver",
          "Registration, medical, insurance expiry alerts",
          "CSA BASIC trend monitoring",
        ]}
        mockup={<CompliancePreview />}
      />

      <ProductSection
        eyebrow="Get Paid"
        headline="Invoice in seconds. Catch every shorted dollar."
        body="Generate invoices from load data. AI compares rate confirmations to invoices and flags discrepancies before you send."
        bullets={[
          "One-click invoicing from completed loads",
          "Automatic rate-con vs invoice checks",
          "Stripe / PayPal when connected",
        ]}
        mockup={<InvoicePreview />}
        reverse
        bg="var(--w-bg-2)"
      />

      <ProductSection
        eyebrow="At a glance"
        headline="Your numbers, live."
        body="Revenue, delivery performance, and compliance signals update from the same operational data your dispatch team uses every day."
        bullets={[
          "Revenue and load KPIs on the dashboard",
          "On-time and utilization trends",
          "Export-ready reports where your plan allows",
        ]}
        mockup={<ReportsPreview />}
      />

      <section id="features" className="py-24" style={{ background: "var(--w-bg-2)" }}>
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
          <WEyebrow>Everything else</WEyebrow>
          <WSectionHeading>The rest of the platform.</WSectionHeading>
          <PreviewTheme className="mt-12 rounded-xl border border-border/40 p-4 md:p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {FEATURES.map((f) => {
              const Icon = f.icon
              return (
                <div
                  key={f.title}
                  className="group rounded-xl border border-border/60 bg-card/70 p-[22px] shadow-sm transition-[border-color,background] duration-200 hover:border-border hover:bg-card"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
                    <Icon className="h-[18px] w-[18px] text-primary" strokeWidth={1.75} />
                  </div>
                  <h3
                    className="mt-3 text-base font-semibold text-[var(--w-text)]"
                    style={{ fontFamily: "var(--font-bricolage), sans-serif" }}
                  >
                    {f.title}
                  </h3>
                  <p
                    className="mt-2 text-[13px] leading-relaxed text-[var(--w-text-2)]"
                    style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
                  >
                    {f.desc}
                  </p>
                </div>
              )
            })}
          </div>
          </PreviewTheme>
        </div>
      </section>

      <section className="relative overflow-hidden py-24" style={{ background: "var(--w-bg)" }}>
        <DotBg />
        <div className="relative mx-auto max-w-[1100px] px-4 sm:px-6">
          <WEyebrow>Pricing</WEyebrow>
          <WSectionHeading>Built for operators, not enterprises.</WSectionHeading>
          <WBody className="mt-3">Five tiers from $49 to custom. Every limit published. No hidden caps.</WBody>
          <div className="-mx-4 mt-12 flex gap-4 overflow-x-auto px-4 pb-2">
            {PRICING_TEASER.map((tier) => (
              <div
                key={tier.name}
                className="relative min-w-[200px] flex-1 rounded-[14px] border p-7"
                style={{
                  background: "var(--w-card)",
                  borderColor: tier.popular ? "var(--w-blue-border)" : "var(--w-border)",
                  boxShadow: tier.popular ? "0 0 40px var(--w-blue-glow)" : undefined,
                }}
              >
                {tier.popular ? (
                  <span
                    className="absolute top-0 right-0 rounded-bl-lg rounded-tr-[14px] px-2.5 py-1 text-[11px] font-semibold text-white"
                    style={{ background: "var(--w-blue)", fontFamily: "var(--font-jakarta), sans-serif" }}
                  >
                    Most Popular
                  </span>
                ) : null}
                <h3
                  className="text-lg font-bold text-[var(--w-text)]"
                  style={{ fontFamily: "var(--font-bricolage), sans-serif" }}
                >
                  {tier.name}
                </h3>
                <div className="mt-3 flex items-end gap-1">
                  <span
                    className="text-[36px] leading-none text-[var(--w-green)]"
                    style={{ fontFamily: "var(--font-mono-display), monospace" }}
                  >
                    {tier.price}
                  </span>
                  {tier.price !== "Custom" ? (
                    <span
                      className="mb-1 text-sm text-[var(--w-text-3)]"
                      style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
                    >
                      /mo
                    </span>
                  ) : null}
                </div>
                <ul className="mt-6 space-y-2">
                  {tier.bullets.map((b) => (
                    <li key={b} className="flex gap-2 text-[13px] text-[var(--w-text-2)]">
                      <Check className="h-3.5 w-3.5 shrink-0 text-[var(--w-blue)]" />
                      <span style={{ fontFamily: "var(--font-jakarta), sans-serif" }}>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <WGhostButton href="/pricing">View full pricing →</WGhostButton>
          </div>
        </div>
      </section>

      <section className="py-24" style={{ background: "var(--w-bg-2)" }}>
        <div className="mx-auto max-w-[900px] px-4 sm:px-6">
          <div className="text-center">
            <WEyebrow>Getting Started</WEyebrow>
            <WSectionHeading>Up and running in a day.</WSectionHeading>
          </div>
          <div className="relative mt-14 grid gap-8 md:grid-cols-4">
            <div
              className="pointer-events-none absolute top-[18px] right-[12%] left-[12%] hidden border-t border-dashed md:block"
              style={{ borderColor: "var(--w-border-md)" }}
              aria-hidden
            />
            {STEPS.map((step) => (
              <div key={step.num} className="relative text-center">
                <div
                  className="mx-auto flex h-9 w-9 items-center justify-center rounded-full text-base font-bold text-white"
                  style={{ background: "var(--w-blue)", fontFamily: "var(--font-bricolage), sans-serif" }}
                >
                  {step.num}
                </div>
                <h3
                  className="mt-4 text-[17px] font-semibold text-[var(--w-text)]"
                  style={{ fontFamily: "var(--font-bricolage), sans-serif" }}
                >
                  {step.title}
                </h3>
                <p
                  className="mt-2 text-sm text-[var(--w-text-2)]"
                  style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
                >
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <MarketingFinalCta />
      <MarketingSiteFooter />
    </>
  )
}
