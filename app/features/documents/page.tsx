import Link from "next/link"
import { FileText, Brain, Clock, Shield, CheckCircle2, ArrowLeft } from "lucide-react"

export default function DocumentsFeaturesPage() {
  const features = [
    {
      icon: Brain,
      title: "AI Document Analysis",
      description: "Automatically extract and organize data from documents using AI-powered analysis.",
      details: [
        "Automatic data extraction",
        "Document type recognition",
        "Smart routing to appropriate records",
        "Manual routing options"
      ]
    },
    {
      icon: Clock,
      title: "Expiry Tracking",
      description: "Never miss an important deadline with automated expiry tracking and alerts.",
      details: [
        "Automatic expiry date detection",
        "Expiring soon alerts",
        "Expired document notifications",
        "Renewal reminders"
      ]
    },
    {
      icon: Shield,
      title: "Secure Storage",
      description: "Your documents are stored securely with encrypted access and backup.",
      details: [
        "Encrypted document storage",
        "Secure access controls",
        "Automatic backups",
        "Version history"
      ]
    },
    {
      icon: FileText,
      title: "Bulk Operations",
      description: "Manage multiple documents efficiently with bulk operations.",
      details: [
        "Bulk document upload",
        "Multi-select and delete",
        "Bulk status updates",
        "Batch export"
      ]
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-16">
          <Link href="/features" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Features
          </Link>
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <FileText className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground">
                Document Management
              </h1>
            </div>
            <p className="text-xl text-muted-foreground">
              Secure document storage with AI-powered analysis, expiry tracking, and automated organization.
            </p>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto space-y-12">
          {features.map((feature) => {
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
    </div>
  )
}





