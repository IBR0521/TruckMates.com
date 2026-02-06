import Link from "next/link"
import { ArrowLeft, Shield, Lock, Database, CheckCircle2, AlertTriangle } from "lucide-react"

export default function SecurityPage() {
  const securityFeatures = [
    {
      icon: Lock,
      title: "Data Encryption",
      description: "All data is encrypted in transit and at rest using industry-standard encryption protocols.",
      details: [
        "TLS 1.3 encryption for all connections",
        "AES-256 encryption for data at rest",
        "Encrypted database backups",
        "Secure API communications"
      ]
    },
    {
      icon: Shield,
      title: "Access Control",
      description: "Comprehensive access control and authentication to protect your data.",
      details: [
        "Multi-factor authentication (MFA) support",
        "Role-based access control (RBAC)",
        "Session management and timeout",
        "IP whitelisting options"
      ]
    },
    {
      icon: Database,
      title: "Data Security",
      description: "Your data is stored securely with regular backups and disaster recovery.",
      details: [
        "Regular automated backups",
        "Data redundancy and replication",
        "Disaster recovery procedures",
        "Data retention policies"
      ]
    },
    {
      icon: AlertTriangle,
      title: "Compliance",
      description: "We maintain compliance with industry standards and regulations.",
      details: [
        "GDPR compliant",
        "Data privacy protection",
        "Regular security audits",
        "Compliance reporting"
      ]
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-16">
          <Link href="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-8 h-8 text-primary" />
              <h1 className="text-4xl md:text-5xl font-bold text-foreground">
                Security & Compliance
              </h1>
            </div>
            <p className="text-xl text-muted-foreground">
              Your data security is our top priority. Learn about our security measures and compliance standards.
            </p>
          </div>
        </div>
      </div>

      {/* Security Features */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto space-y-8">
          {securityFeatures.map((feature) => {
            const Icon = feature.icon
            return (
              <div key={feature.title} className="p-8 rounded-lg border border-border bg-card">
                <div className="flex items-start gap-4 mb-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-semibold text-foreground mb-2">
                      {feature.title}
                    </h2>
                    <p className="text-muted-foreground mb-4">
                      {feature.description}
                    </p>
                    <ul className="space-y-2">
                      {feature.details.map((detail) => (
                        <li key={detail} className="flex items-center gap-2 text-muted-foreground">
                          <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Security Practices */}
      <div className="border-t border-border bg-card/50">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-foreground mb-8 text-center">
              Security Practices
            </h2>
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="p-6 rounded-lg border border-border bg-card">
                <h3 className="font-semibold text-foreground mb-3">Vulnerability Management</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Regular security scans and penetration testing</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Automated dependency updates</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Bug bounty program</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Security patch management</span>
                  </li>
                </ul>
              </div>
              <div className="p-6 rounded-lg border border-border bg-card">
                <h3 className="font-semibold text-foreground mb-3">Incident Response</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>24/7 security monitoring</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Automated threat detection</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Incident response team</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Customer notification procedures</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Compliance Statement */}
      <div className="border-t border-border bg-card/50">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-foreground mb-8 text-center">
              Compliance & Certifications
            </h2>
            <div className="p-8 rounded-lg border border-border bg-card">
              <p className="text-muted-foreground mb-4">
                TruckMates is committed to maintaining the highest standards of security and compliance. We regularly undergo security audits and assessments to ensure our systems meet industry best practices.
              </p>
              <div className="space-y-3 text-sm text-muted-foreground mb-4">
                <p><strong className="text-foreground">SOC 2 Type II:</strong> Annual third-party security audits with full compliance.</p>
                <p><strong className="text-foreground">GDPR:</strong> Full compliance with GDPR requirements for data protection and privacy.</p>
                <p><strong className="text-foreground">Data Residency:</strong> Data stored in secure, compliant data centers. EU data residency available for Enterprise customers.</p>
                <p><strong className="text-foreground">Security Audits:</strong> Regular third-party security assessments and penetration testing.</p>
                <p><strong className="text-foreground">Incident Response:</strong> Comprehensive incident response procedures with 24/7 monitoring.</p>
                <p><strong className="text-foreground">ISO 27001:</strong> Information security management system certification in progress.</p>
              </div>
              <div className="mt-6 pt-6 border-t border-border space-y-2">
                <Link href="/docs/legal/data-residency" className="block text-primary hover:underline text-sm">
                  View Data Residency Policy →
                </Link>
                <Link href="/docs/security/security-whitepaper" className="block text-primary hover:underline text-sm">
                  Download Security Whitepaper →
                </Link>
                <Link href="/compliance" className="block text-primary hover:underline text-sm">
                  View Full Compliance Statement →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

