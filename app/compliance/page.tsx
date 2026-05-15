import Link from "next/link"
import { FileCheck, Shield, CheckCircle2 } from "lucide-react"
import { MarketingPageHeader } from "@/components/marketing/marketing-page-header"
import { MarketingSiteFooter } from "@/components/marketing/marketing-site-footer"

export default function CompliancePage() {
  const complianceAreas = [
    {
      title: "Operational tools (FMCSA-style workflows)",
      description:
        "The app includes features that help you run HOS, DVIR, IFTA, and related workflows. When you connect an ELD, supported telemetry can feed logs, safety events, geofencing, and trip records. You remain responsible for compliance with FMCSA and state rules; TruckMates provides software — not legal advice.",
      items: [
        "ELD setup wizard and HOS tooling where applicable to your operation",
        "IFTA fuel tax reporting features",
        "Geofencing, dwell, and detention support for operational records",
        "Driver safety scorecards and trip replay on eligible plans",
        "Records and exports intended to support your audits and processes",
      ],
    },
    {
      title: "Data handling",
      description:
        "We take data protection seriously at the product level: hosted infrastructure (Supabase), HTTPS, authentication, and access controls. ELD API credentials are stored for sync and are not logged in application error output. This is not the same as a formal GDPR certification or SOC 2 report issued to TruckMates as a vendor.",
      items: [
        "Encryption in transit (HTTPS) for the web application",
        "Access controlled by accounts and roles in the app",
        "Data stored in our configured cloud database and storage",
      ],
    },
    {
      title: "Payments & accounting",
      description:
        "When you connect Stripe, PayPal, or QuickBooks, their terms and compliance posture apply to those connections.",
      items: ["Payment processors: Stripe, PayPal (when you enable them)", "Accounting: QuickBooks Online (optional)"],
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <MarketingPageHeader
        icon={FileCheck}
        title="Compliance & regulations"
        subtitle="What the software helps you with — and what we don't claim on your behalf."
      />

      <div className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-4xl space-y-8">
          {complianceAreas.map((area) => (
            <div key={area.title} className="rounded-lg border border-border bg-card p-8">
              <div className="mb-4 flex items-center gap-3">
                <Shield className="h-6 w-6 text-primary" />
                <h2 className="text-2xl font-semibold text-foreground">{area.title}</h2>
              </div>
              <p className="mb-4 text-muted-foreground">{area.description}</p>
              <ul className="space-y-2">
                {area.items.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="rounded-lg border border-border bg-muted/30 p-8">
            <p className="text-sm text-muted-foreground">
              For how your data is secured, see{" "}
              <Link href="/security" className="text-primary hover:underline">
                Security
              </Link>
              . For ELD and AI connections, see{" "}
              <Link href="/integrations" className="text-primary hover:underline">
                Integrations
              </Link>
              . We do not host a separate data residency policy PDF here unless we publish one; ask directly if your legal
              team needs something specific.
            </p>
          </div>
        </div>
      </div>

      <MarketingSiteFooter />
    </div>
  )
}
