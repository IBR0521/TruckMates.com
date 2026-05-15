import Link from "next/link"
import { Shield, Lock, Database, Users } from "lucide-react"
import { MarketingPageHeader } from "@/components/marketing/marketing-page-header"
import { MarketingSiteFooter } from "@/components/marketing/marketing-site-footer"

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <MarketingPageHeader
        icon={Shield}
        title="Security"
        subtitle="How TruckMates handles data today — accurate, not marketing certifications we don't hold."
      />

      <div className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-4xl space-y-8">
          <div className="rounded-lg border border-border bg-card p-8">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-primary/10 p-3">
                <Database className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="mb-2 text-2xl font-semibold text-foreground">Infrastructure (Supabase)</h2>
                <p className="text-muted-foreground">
                  Application data is stored in{" "}
                  <a
                    href="https://supabase.com/security"
                    className="text-primary hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Supabase
                  </a>
                  — managed PostgreSQL, authentication, and storage. Connection to the app uses HTTPS. Supabase provides
                  encryption at rest and in transit as described in their documentation; we don&apos;t run our own data
                  centers or claim independent SOC 2 / ISO audits for TruckMates as a separate product.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-8">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-primary/10 p-3">
                <Lock className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="mb-2 text-2xl font-semibold text-foreground">Access & authentication</h2>
                <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
                  <li>Sign-in is handled through Supabase Auth (email/password and supported providers you enable).</li>
                  <li>Sessions use secure cookies in the browser as implemented by the framework and Supabase client.</li>
                  <li>
                    <strong className="text-foreground">Role-based access</strong> limits what each user can see and do
                    (fleet vs driver, etc.).
                  </li>
                  <li>
                    ELD provider API keys and passwords are stored to enable sync; they are not written to application logs
                    or client-side error reports.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-8">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-primary/10 p-3">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="mb-2 text-2xl font-semibold text-foreground">Row-level security (RLS)</h2>
                <p className="text-muted-foreground">
                  Database access is designed around PostgreSQL row-level security so tenant and user data are separated
                  according to the policies we ship with the product. This is application-enforced data isolation, not a
                  substitute for your own legal or compliance review.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-8">
            <h2 className="mb-2 text-lg font-semibold text-foreground">What we don&apos;t claim</h2>
            <p className="text-sm text-muted-foreground">
              TruckMates does <strong className="text-foreground">not</strong> advertise SOC 2 Type II, ISO 27001
              certification, a public bug bounty, 24/7 dedicated security operations center, or penetration-test reports
              specific to this product unless we publish them explicitly. If you need formal attestations for procurement,
              contact us with your requirements and we&apos;ll be honest about what exists today.
            </p>
          </div>
        </div>
      </div>

      <MarketingSiteFooter />
    </div>
  )
}
