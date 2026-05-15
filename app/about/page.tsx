import Link from "next/link"
import { Building2, Bot, Shield, Truck, CheckCircle2 } from "lucide-react"
import { MarketingPageHeader } from "@/components/marketing/marketing-page-header"
import { MarketingSiteFooter } from "@/components/marketing/marketing-site-footer"

export default function AboutPage() {
  const platformAreas = [
    {
      icon: Truck,
      title: "Transportation management",
      body: "Loads, dispatch, routes, drivers, trucks and trailers, maintenance, BOLs, documents, IFTA, invoicing, and settlements — the day-to-day TMS workflows in one web app.",
    },
    {
      icon: Shield,
      title: "ELD & telematics",
      body: "Connect your existing Samsara, Motive, or Geotab through a guided setup wizard. We read HOS, GPS, safety events, idle time, and fault codes where your plan and provider allow. TruckMates is not a certified ELD hardware partner; we integrate alongside your provider.",
    },
    {
      icon: Bot,
      title: "AI built in",
      body: "Fleet Q&A, document extraction, dispatch suggestions, and a daily morning briefing on eligible plans. Professional and above can use action tools and smart notification prioritization — always with human approval where actions affect your operation.",
    },
    {
      icon: Building2,
      title: "Scale by plan",
      body: "Five tiers from Owner-Operator (1–2 trucks) through Fleet (up to 100 trucks on the published cap). Enterprise is custom for larger carriers. Limits and features are listed on the pricing page — no hidden caps in marketing copy.",
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <MarketingPageHeader
        title="About TruckMates"
        subtitle="The complete TMS for fleets from 1 to 100 trucks — dispatch, compliance, finance, AI, and ELD integration in one platform."
      />

      <div className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-3xl space-y-8">
          <div className="rounded-lg border border-border bg-card p-8">
            <h2 className="text-2xl font-semibold text-foreground">What TruckMates is</h2>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              TruckMates is a web-based fleet management system for carriers who want professional operations without
              juggling spreadsheets and disconnected tools. You run loads and dispatch, keep drivers and equipment
              organized, handle IFTA and billing, and — when you connect an ELD — pull telemetry into maps, safety
              scorecards, trip replay, geofencing, and fault-code workflows.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              We describe features plainly on the{" "}
              <Link href="/#features" className="font-medium text-primary hover:underline">
                home page
              </Link>
              , in the app, and on{" "}
              <Link href="/pricing" className="font-medium text-primary hover:underline">
                pricing
              </Link>
              . We do not claim partnerships with Samsara, Motive, Geotab, or other vendors unless we publish a formal
              agreement.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {platformAreas.map((area) => {
              const Icon = area.icon
              return (
                <div key={area.title} className="rounded-lg border border-border bg-card p-6">
                  <Icon className="mb-3 h-6 w-6 text-primary" />
                  <h3 className="text-lg font-semibold text-foreground">{area.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{area.body}</p>
                </div>
              )
            })}
          </div>

          <div className="rounded-lg border border-border bg-card p-8">
            <h2 className="text-2xl font-semibold text-foreground">Who it&apos;s for</h2>
            <ul className="mt-4 space-y-3">
              {[
                "Owner-operators and small fleets starting on Owner-Operator or Starter plans",
                "Growing carriers on Professional (live ELD API sync, safety scorecards, trip replay, advanced fault codes)",
                "Mid-size fleets on Fleet (up to 100 trucks, public API, EDI, multi-terminal, and related modules per plan)",
                "Larger operations evaluating Enterprise for custom limits and support",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-primary/20 bg-primary/[0.04] p-6 dark:bg-primary/10">
            <p className="text-sm leading-relaxed text-muted-foreground">
              <strong className="text-foreground">Try before you buy the story:</strong> open the{" "}
              <Link href="/demo" className="font-medium text-primary hover:underline">
                interactive demo
              </Link>{" "}
              or start a{" "}
              <Link href="/register" className="font-medium text-primary hover:underline">
                free account
              </Link>{" "}
              (14-day Starter trial, no card). See{" "}
              <Link href="/integrations" className="font-medium text-primary hover:underline">
                integrations
              </Link>{" "}
              and{" "}
              <Link href="/security" className="font-medium text-primary hover:underline">
                security
              </Link>{" "}
              for how connections and data work today.
            </p>
          </div>
        </div>
      </div>

      <MarketingSiteFooter />
    </div>
  )
}
