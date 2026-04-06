import Link from "next/link"
import type { Metadata } from "next"
import { ArrowLeft, Plug, Map, CreditCard, BookOpen, Truck } from "lucide-react"

export const metadata: Metadata = {
  title: "Integrations | TruckMates",
  description:
    "Integrations for maps, payments, and accounting. Core vendor API keys are platform-managed; you connect your own merchant accounts where required.",
}

export default function IntegrationsPage() {
  const sections = [
    {
      icon: Map,
      title: "Maps & routing",
      body: "Address lookup, directions, and map views use Google Maps. The platform supplies the Maps API keys for normal use — you don’t need to create or paste a Google Cloud key to get started.",
      items: ["Google Maps (platform-managed API keys)"],
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
    {
      icon: Truck,
      title: "ELD & telematics data",
      body: "TruckMates is not a certified ELD hardware partner of Motive, Samsara, Geotab, or others. You can work with logs and data in the app; where supported, data may be imported or connected according to your provider's export or integration options — not a formal partnership or endorsement.",
      items: ["Use your existing ELD exports / data where the product supports them"],
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="border-b border-border bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-16">
          <Link href="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <Plug className="w-8 h-8 text-primary" />
              <h1 className="text-4xl md:text-5xl font-bold text-foreground">Integrations</h1>
            </div>
            <p className="text-xl text-muted-foreground">
              Third-party services the product can connect to — not &quot;partnerships&quot; unless we say so explicitly.
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-5 text-sm leading-relaxed text-muted-foreground dark:bg-primary/10">
            <p>
              <strong className="text-foreground">API keys:</strong> The platform supplies almost all vendor API keys needed
              for core features (e.g. maps, email delivery) — you don&apos;t bring your own Google or Resend keys for
              day-to-day use. You still connect <strong className="text-foreground">your</strong> Stripe, PayPal, or
              QuickBooks accounts where those products require your merchant or org login. Separately, paid plans may offer{" "}
              <strong className="text-foreground">your own API keys</strong> to call TruckMates programmatically — that is
              access to <em>your</em> data, not third-party service keys.
            </p>
          </div>
          {sections.map((section) => {
            const Icon = section.icon
            return (
              <div key={section.title} className="p-8 rounded-lg border border-border bg-card">
                <div className="flex items-start gap-4 mb-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-semibold text-foreground mb-2">{section.title}</h2>
                    <p className="text-muted-foreground mb-4">{section.body}</p>
                    <div className="flex flex-wrap gap-2">
                      {section.items.map((name) => (
                        <span
                          key={name}
                          className="px-3 py-1 rounded-full bg-muted text-foreground text-sm font-medium"
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

          <div className="p-6 rounded-lg border border-dashed border-border bg-muted/30">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">App stores:</strong> A native listing on the Apple App Store or Google Play
              is not published under the TruckMates name today. Access is through the web application (and any install flow we
              document separately, if applicable).
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
