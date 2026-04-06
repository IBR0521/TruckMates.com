import Link from "next/link"
import { ArrowLeft, Shield, Lock, Database, Users } from "lucide-react"

export default function SecurityPage() {
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
              <Shield className="w-8 h-8 text-primary" />
              <h1 className="text-4xl md:text-5xl font-bold text-foreground">Security</h1>
            </div>
            <p className="text-xl text-muted-foreground">
              How TruckMates handles data today — accurate, not marketing certifications we don&apos;t hold.
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="p-8 rounded-lg border border-border bg-card">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Database className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-foreground mb-2">Infrastructure (Supabase)</h2>
                <p className="text-muted-foreground mb-4">
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

          <div className="p-8 rounded-lg border border-border bg-card">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Lock className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-foreground mb-2">Access & authentication</h2>
                <ul className="space-y-2 text-muted-foreground list-disc pl-5">
                  <li>Sign-in is handled through Supabase Auth (email/password and supported providers you enable).</li>
                  <li>Sessions use secure cookies in the browser as implemented by the framework and Supabase client.</li>
                  <li>
                    <strong className="text-foreground">Role-based access</strong> in the app limits what each user can see
                    and do (fleet vs driver, etc.).
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="p-8 rounded-lg border border-border bg-card">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-foreground mb-2">Row-level security (RLS)</h2>
                <p className="text-muted-foreground">
                  Database access is designed around PostgreSQL row-level security so tenant and user data are separated
                  according to the policies we ship with the product. This is application-enforced data isolation, not a
                  substitute for your own legal or compliance review.
                </p>
              </div>
            </div>
          </div>

          <div className="p-8 rounded-lg border border-amber-500/30 bg-amber-500/5">
            <h2 className="text-lg font-semibold text-foreground mb-2">What we don&apos;t claim</h2>
            <p className="text-sm text-muted-foreground">
              TruckMates does <strong className="text-foreground">not</strong> advertise SOC 2 Type II, ISO 27001
              certification, a public bug bounty, 24/7 dedicated security operations center, or penetration-test reports
              specific to this product unless we publish them explicitly. If you need formal attestations for procurement,
              contact us with your requirements and we&apos;ll be honest about what exists today.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
