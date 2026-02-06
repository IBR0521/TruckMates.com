import Link from "next/link"
import { ArrowLeft, FileCheck, Shield, CheckCircle2, Award, Lock } from "lucide-react"

export default function CompliancePage() {
  const complianceAreas = [
    {
      title: "FMCSA Compliance",
      description: "Full compliance with Federal Motor Carrier Safety Administration regulations",
      items: [
        "ELD mandate compliance",
        "Hours of Service (HOS) tracking",
        "DOT reporting and audits",
        "IFTA fuel tax reporting"
      ]
    },
    {
      title: "Data Privacy",
      description: "Protection of personal and business data in accordance with privacy regulations",
      items: [
        "GDPR compliance",
        "Data encryption and security",
        "Right to data deletion",
        "Data access and portability"
      ]
    },
    {
      title: "Financial Compliance",
      description: "Compliance with financial and accounting standards",
      items: [
        "Secure payment processing",
        "Financial data protection",
        "Audit trail maintenance",
        "Tax reporting support"
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
              <FileCheck className="w-8 h-8 text-primary" />
              <h1 className="text-4xl md:text-5xl font-bold text-foreground">
                Compliance
              </h1>
            </div>
            <p className="text-xl text-muted-foreground">
              TruckMates helps you maintain compliance with industry regulations and standards
            </p>
          </div>
        </div>
      </div>

      {/* Compliance Areas */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto space-y-8">
          {complianceAreas.map((area) => (
            <div key={area.title} className="p-8 rounded-lg border border-border bg-card">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-semibold text-foreground">
                  {area.title}
                </h2>
              </div>
              <p className="text-muted-foreground mb-4">
                {area.description}
              </p>
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
        </div>
      </div>

      {/* Certifications */}
      <div className="border-t border-border bg-card/50">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-foreground mb-8 text-center">
              Certifications & Standards
            </h2>
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="p-6 rounded-lg border border-border bg-card text-center">
                <div className="text-4xl font-bold text-primary mb-2">SOC 2</div>
                <p className="text-sm text-muted-foreground">Type II Certified</p>
                <p className="text-xs text-muted-foreground mt-2">Annual security audits</p>
              </div>
              <div className="p-6 rounded-lg border border-border bg-card text-center">
                <div className="text-4xl font-bold text-primary mb-2">GDPR</div>
                <p className="text-sm text-muted-foreground">Fully Compliant</p>
                <p className="text-xs text-muted-foreground mt-2">EU data protection</p>
              </div>
              <div className="p-6 rounded-lg border border-border bg-card text-center">
                <div className="text-4xl font-bold text-primary mb-2">ISO</div>
                <p className="text-sm text-muted-foreground">27001 (In Progress)</p>
                <p className="text-xs text-muted-foreground mt-2">Information security</p>
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
              Our Commitment
            </h2>
            <div className="p-8 rounded-lg border border-border bg-card">
              <p className="text-muted-foreground mb-4">
                TruckMates is committed to helping our customers maintain compliance with all applicable regulations. Our platform is designed with compliance in mind, providing the tools and features you need to meet regulatory requirements.
              </p>
              <div className="space-y-3 text-sm text-muted-foreground mb-4">
                <p><strong className="text-foreground">Regular Audits:</strong> We undergo annual security and compliance audits to ensure we meet industry standards.</p>
                <p><strong className="text-foreground">Data Protection:</strong> All data is encrypted in transit and at rest, with regular backups and disaster recovery procedures.</p>
                <p><strong className="text-foreground">Compliance Support:</strong> Our team provides guidance on regulatory requirements and helps you maintain compliance.</p>
                <p><strong className="text-foreground">Documentation:</strong> All compliance documentation is available upon request for audits and certifications.</p>
              </div>
              <p className="text-muted-foreground">
                For specific compliance questions or documentation requests, please contact our compliance team at <a href="mailto:compliance@truckmates.com" className="text-primary hover:underline">compliance@truckmates.com</a>.
              </p>
              <div className="mt-6 pt-6 border-t border-border">
                <Link href="/docs/legal/data-residency" className="text-primary hover:underline text-sm">
                  View Data Residency Policy →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

