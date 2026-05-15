import Link from "next/link"
import type { Metadata } from "next"
import { Plug, Map, CreditCard, BookOpen, Truck, Bot } from "lucide-react"
import { MarketingPageHeader } from "@/components/marketing/marketing-page-header"
import { MarketingSiteFooter } from "@/components/marketing/marketing-site-footer"

export const metadata: Metadata = {
  title: "Integrations | TruckMates",
  description:
    "Maps, payments, accounting, ELD providers (Samsara, Motive, Geotab), and AI — what TruckMates connects to and how.",
}

export default function IntegrationsPage() {
  const sections = [
    {
      icon: Map,
      title: "Maps & routing",
      body: "Address lookup, directions, and map views use Google Maps. The platform supplies the Maps API keys for normal use — you don't need to create or paste a Google Cloud key to get started.",
      items: ["Google Maps (platform-managed API keys)"],
    },
    {
      icon: Truck,
      title: "ELD & telematics",
      body: "Use the ELD setup wizard in the app to connect Samsara, Motive, or Geotab with API credentials. We test the connection, discover vehicles, and map them to your TruckMates trucks. We are not a certified ELD hardware partner — this is software integration alongside your existing provider. Continuous live API sync is included on Professional and higher plans; lower tiers may use the wizard and supported data paths per your plan.",
      items: [
        "Samsara (API token)",
        "Motive / KeepTruckin (API key)",
        "Geotab (MyGeotab credentials)",
        "Vehicle mapping & health checks",
      ],
    },
    {
      icon: Bot,
      title: "AI services",
      body: "AI features run on platform-managed models — document extraction, dispatch suggestions, morning briefings, fleet Q&A chat, and on Professional+ action tools with approval and smart notification prioritization. Limits follow your plan's AI call allowance.",
      items: [
        "Document & receipt extraction (Starter+)",
        "AI assistant & briefing (Starter+)",
        "Actions & smart notifications (Professional+)",
      ],
    },
    {
      icon: CreditCard,
      title: "Payments",
      body: "Billing and checkout can use Stripe and PayPal when you connect accounts in the product.",
      items: ["Stripe", "PayPal"],
    },
    {
      icon: BookOpen,
      title: "Accounting",
      body: "Optional QuickBooks Online connection for syncing accounting data when you set it up under Integrations.",
      items: ["QuickBooks Online (optional)"],
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <MarketingPageHeader
        icon={Plug}
        title="Integrations"
        subtitle="Third-party services the product connects to — not formal partnerships unless we say so explicitly."
      />

      <div className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-4xl space-y-8">
          <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-5 text-sm leading-relaxed text-muted-foreground dark:bg-primary/10">
            <p>
              <strong className="text-foreground">API keys:</strong> The platform supplies almost all vendor API keys
              needed for core features (e.g. maps, email delivery) — you don&apos;t bring your own Google or Resend keys
              for day-to-day use. You connect <strong className="text-foreground">your</strong> Stripe, PayPal,
              QuickBooks, or ELD provider credentials where those products require your account. Paid plans may also
              offer <strong className="text-foreground">TruckMates API keys</strong> (Fleet+) to call our REST API —
              that is access to <em>your</em> data, not third-party service keys.
            </p>
          </div>

          {sections.map((section) => {
            const Icon = section.icon
            return (
              <div key={section.title} className="rounded-lg border border-border bg-card p-8">
                <div className="mb-4 flex items-start gap-4">
                  <div className="rounded-lg bg-primary/10 p-3">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h2 className="mb-2 text-2xl font-semibold text-foreground">{section.title}</h2>
                    <p className="mb-4 text-muted-foreground">{section.body}</p>
                    <div className="flex flex-wrap gap-2">
                      {section.items.map((name) => (
                        <span
                          key={name}
                          className="rounded-full bg-muted px-3 py-1 text-sm font-medium text-foreground"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">App stores:</strong> A native listing on the Apple App Store or Google
              Play is not published under the TruckMates name today. Access is through the web application. See{" "}
              <Link href="/pricing" className="text-primary hover:underline">
                pricing
              </Link>{" "}
              for which modules your tier includes.
            </p>
          </div>
        </div>
      </div>

      <MarketingSiteFooter />
    </div>
  )
}
