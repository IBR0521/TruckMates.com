import Link from "next/link"
import { ArrowLeft, FileCheck, Shield, CheckCircle2 } from "lucide-react"

export default function CompliancePage() {
  const complianceAreas = [
    {
      title: "Operational tools (FMCSA-style workflows)",
      description:
        "The app includes features that help you run HOS, DVIR, IFTA, and related workflows. You remain responsible for compliance with FMCSA and state rules; TruckMates provides software — not legal advice.",
      items: [
        "ELD / HOS tooling in the product where applicable to your operation",
        "IFTA fuel tax reporting features",
        "Records and exports intended to support your audits and processes",
      ],
    },
    {
      title: "Data handling",
      description:
        "We take data protection seriously at the product level: hosted infrastructure (Supabase), HTTPS, authentication, and access controls. This is not the same as a formal GDPR certification or SOC 2 report issued to TruckMates as a vendor.",
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
      <div className="border-b border-border bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-16">
          <Link href="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <FileCheck className="w-8 h-8 text-primary" />
              <h1 className="text-4xl md:text-5xl font-bold text-foreground">Compliance &amp; regulations</h1>
            </div>
            <p className="text-xl text-muted-foreground">
              What the software helps you with — and what we don&apos;t claim on your behalf.
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto space-y-8">
          {complianceAreas.map((area) => (
            <div key={area.title} className="p-8 rounded-lg border border-border bg-card">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-semibold text-foreground">{area.title}</h2>
              </div>
              <p className="text-muted-foreground mb-4">{area.description}</p>
              <ul className="space-y-2">
                {area.items.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="p-8 rounded-lg border border-border bg-muted/30">
            <p className="text-sm text-muted-foreground">
              For questions about how your data is secured, see{" "}
              <Link href="/security" className="text-primary hover:underline">
                Security
              </Link>
              . We do not host a separate &quot;data residency policy&quot; or compliance PDF here unless we publish one;
              ask directly if your legal team needs something specific.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
