import Link from "next/link"
import { Building2, Bot, Shield, Truck, CheckCircle2 } from "lucide-react"
import { MarketingSiteFooter } from "@/components/marketing/marketing-site-footer"
import {
  DotBg,
  MarketingFinalCta,
  WBody,
  WEyebrow,
  WSectionHeading,
} from "@/components/marketing/marketing-ui"

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

  const isList = [
    "A web-based fleet management system for carriers who want professional operations without juggling spreadsheets and disconnected tools.",
    "Loads, dispatch, drivers, equipment, IFTA, billing, and ELD telemetry in one system when you connect a provider.",
    "Features described plainly on the home page, in the app, and on pricing.",
  ]

  const isNotList = [
    "A formal partnership with Samsara, Motive, Geotab, or other vendors unless we publish an agreement.",
    "A certified ELD hardware manufacturer — we integrate alongside your existing provider.",
    "Made-up ROI claims or enterprise theater — we show actual plan limits.",
  ]

  return (
    <div className="min-h-screen" style={{ background: "var(--w-bg)" }}>
      <section className="relative overflow-hidden border-b pb-[72px]" style={{ borderColor: "var(--w-border)" }}>
        <DotBg />
        <div className="relative mx-auto max-w-3xl px-6 pt-[130px] text-center">
          <WEyebrow>About TruckMates</WEyebrow>
          <WSectionHeading>Built for the people who keep America moving.</WSectionHeading>
          <WBody className="mx-auto mt-4">
            TruckMates is a fleet management platform for US trucking carriers — from the owner-operator who
            dispatches alone to the operations manager coordinating a fleet.
          </WBody>
        </div>
      </section>

      <section className="py-20" style={{ background: "var(--w-bg-2)" }}>
        <div className="mx-auto max-w-[1100px] px-6">
          <WEyebrow>The Platform</WEyebrow>
          <WSectionHeading>One platform. Every workflow.</WSectionHeading>
          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {platformAreas.map((area) => {
              const Icon = area.icon
              return (
                <div
                  key={area.title}
                  className="rounded-[14px] border p-7"
                  style={{ background: "var(--w-card)", borderColor: "var(--w-border)" }}
                >
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ background: "var(--w-blue-dim)" }}
                  >
                    <Icon className="h-5 w-5 text-[var(--w-blue)]" />
                  </div>
                  <h3
                    className="mt-4 text-[19px] font-bold text-[var(--w-text)]"
                    style={{ fontFamily: "var(--font-bricolage), sans-serif" }}
                  >
                    {area.title}
                  </h3>
                  <p
                    className="mt-2 text-[15px] leading-relaxed text-[var(--w-text-2)]"
                    style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
                  >
                    {area.body}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-[900px] px-6">
          <div
            className="rounded-xl border border-l-[3px] p-10"
            style={{
              background: "var(--w-card)",
              borderColor: "var(--w-border)",
              borderLeftColor: "var(--w-blue)",
            }}
          >
            <h2
              className="text-[28px] font-bold text-[var(--w-text)]"
              style={{ fontFamily: "var(--font-bricolage), sans-serif" }}
            >
              What we are. What we&apos;re not.
            </h2>
            <div className="mt-8 grid gap-12 md:grid-cols-2">
              <div>
                <h3
                  className="text-[13px] font-semibold uppercase tracking-wider text-[var(--w-green)]"
                  style={{ fontFamily: "var(--font-bricolage), sans-serif" }}
                >
                  What TruckMates is
                </h3>
                <ul className="mt-4 space-y-3">
                  {isList.map((item) => (
                    <li key={item} className="flex gap-2 text-[15px] text-[var(--w-text)]">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--w-blue)]" />
                      <span style={{ fontFamily: "var(--font-jakarta), sans-serif" }}>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3
                  className="text-[13px] font-semibold uppercase tracking-wider text-[var(--w-text-3)]"
                  style={{ fontFamily: "var(--font-bricolage), sans-serif" }}
                >
                  What TruckMates is not
                </h3>
                <ul className="mt-4 space-y-3">
                  {isNotList.map((item) => (
                    <li
                      key={item}
                      className="flex gap-2 text-[15px] text-[var(--w-text-2)]"
                      style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
                    >
                      <span className="text-[var(--w-text-3)]">—</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <p
            className="mt-8 text-sm leading-relaxed text-[var(--w-text-2)]"
            style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
          >
            <strong className="text-[var(--w-text)]">Try before you buy the story:</strong> open the{" "}
            <Link href="/demo" className="text-[var(--w-blue)] hover:underline">
              interactive demo
            </Link>{" "}
            or start a{" "}
            <Link href="/register" className="text-[var(--w-blue)] hover:underline">
              free account
            </Link>
            . See{" "}
            <Link href="/integrations" className="text-[var(--w-blue)] hover:underline">
              integrations
            </Link>{" "}
            and{" "}
            <Link href="/security" className="text-[var(--w-blue)] hover:underline">
              security
            </Link>{" "}
            for how connections and data work today.
          </p>
        </div>
      </section>

      <MarketingFinalCta />
      <MarketingSiteFooter />
    </div>
  )
}
