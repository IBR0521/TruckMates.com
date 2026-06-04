import Link from "next/link"
import type { Metadata } from "next"
import { Plug, Map, CreditCard, BookOpen, Truck, Bot } from "lucide-react"
import { MarketingSiteFooter } from "@/components/marketing/marketing-site-footer"
import {
  DotBg,
  MarketingFinalCta,
  WBody,
  WEyebrow,
  WSectionHeading,
} from "@/components/marketing/marketing-ui"

export const metadata: Metadata = {
  title: "Integrations | TruckMates",
  description:
    "Maps, payments, accounting, ELD providers (Samsara, Motive, Geotab), and AI — what TruckMates connects to and how.",
}

const pillStyle = {
  background: "var(--w-blue-dim)",
  border: "1px solid rgba(59,130,246,0.15)",
  color: "var(--w-blue)",
  fontFamily: "var(--font-jakarta), sans-serif",
  fontWeight: 600,
  fontSize: 13,
} as const

export default function IntegrationsPage() {
  const sections = [
    {
      icon: Map,
      title: "Maps & routing",
      body: "Address lookup, directions, and map views use Google Maps. The platform supplies the Maps API keys for normal use — you don't need to create or paste a Google Cloud key to get started.",
      items: ["Google Maps (platform-managed API keys)"],
      eldNote: false,
    },
    {
      icon: Truck,
      title: "ELD & telematics",
      body: "Use the ELD setup wizard in the app to connect Samsara, Motive, or Geotab with API credentials. We test the connection, discover vehicles, and map them to your TruckMates trucks. Continuous live API sync is included on Professional and higher plans.",
      items: [
        "Samsara (API token)",
        "Motive / KeepTruckin (API key)",
        "Geotab (MyGeotab credentials)",
        "Vehicle mapping & health checks",
      ],
      eldNote: true,
    },
    {
      icon: Bot,
      title: "AI services",
      body: "AI features run on platform-managed models — document extraction, dispatch suggestions, morning briefings, fleet Q&A chat, and on Professional+ action tools with approval and smart notification prioritization.",
      items: [
        "Document & receipt extraction (Starter+)",
        "AI assistant & briefing (Starter+)",
        "Actions & smart notifications (Professional+)",
      ],
      eldNote: false,
    },
    {
      icon: CreditCard,
      title: "Payments",
      body: "Billing and checkout can use Stripe and PayPal when you connect accounts in the product.",
      items: ["Stripe", "PayPal"],
      eldNote: false,
    },
    {
      icon: BookOpen,
      title: "Accounting",
      body: "Optional QuickBooks Online connection for syncing accounting data when you set it up under Integrations.",
      items: ["QuickBooks Online (optional)"],
      eldNote: false,
    },
  ]

  return (
    <div className="min-h-screen" style={{ background: "var(--w-bg)" }}>
      <section className="relative overflow-hidden border-b pb-16" style={{ borderColor: "var(--w-border)" }}>
        <DotBg />
        <div className="relative mx-auto max-w-3xl px-6 pt-[130px] text-center">
          <div
            className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-[14px] border"
            style={{ background: "var(--w-blue-dim)", borderColor: "var(--w-blue-border)" }}
          >
            <Plug className="h-6 w-6 text-[var(--w-blue)]" />
          </div>
          <WEyebrow>Integrations</WEyebrow>
          <WSectionHeading>What TruckMates connects to.</WSectionHeading>
          <WBody className="mx-auto mt-4">
            Listed plainly — no implied partnerships. Every integration works through your existing account or
            platform-managed keys.
          </WBody>
        </div>
      </section>

      <section className="py-20" style={{ background: "var(--w-bg-2)" }}>
        <div className="mx-auto max-w-[1100px] space-y-6 px-6">
          {sections.map((section) => {
            const Icon = section.icon
            return (
              <div
                key={section.title}
                className="rounded-[14px] border p-8"
                style={{ background: "var(--w-card)", borderColor: "var(--w-border)" }}
              >
                <div className="flex flex-col gap-6 md:flex-row md:items-start">
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: "var(--w-blue-dim)" }}
                  >
                    <Icon className="h-7 w-7 text-[var(--w-blue)]" />
                  </div>
                  <div className="flex-1">
                    <h2
                      className="text-[22px] font-bold text-[var(--w-text)]"
                      style={{ fontFamily: "var(--font-bricolage), sans-serif" }}
                    >
                      {section.title}
                    </h2>
                    <p
                      className="mt-2 text-[15px] leading-relaxed text-[var(--w-text-2)]"
                      style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
                    >
                      {section.body}
                    </p>
                    {section.eldNote ? (
                      <div
                        className="mt-4 rounded-r-lg px-4 py-3 text-[13px] leading-relaxed"
                        style={{
                          background: "rgba(245,158,11,0.06)",
                          borderLeft: "3px solid #F59E0B",
                          color: "rgba(241,245,249,0.55)",
                          fontFamily: "var(--font-jakarta), sans-serif",
                        }}
                      >
                        Note: TruckMates is not a certified ELD hardware partner. We integrate alongside your
                        existing Samsara, Motive, or Geotab account via their API.
                      </div>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {section.items.map((name) => (
                        <span key={name} className="rounded-full px-3.5 py-1" style={pillStyle}>
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <MarketingFinalCta />
      <MarketingSiteFooter />
    </div>
  )
}
