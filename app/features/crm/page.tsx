import Link from "next/link"
import { Users, Building2, History, Handshake, CheckCircle2, ArrowLeft } from "lucide-react"

export default function CRMFeaturesPage() {
  const features = [
    {
      icon: Building2,
      title: "Customer Management",
      description: "Comprehensive customer profiles with contact information, history, and preferences.",
      details: [
        "Customer profiles and contacts",
        "Company information management",
        "Contact history tracking",
        "Customer preferences and notes"
      ]
    },
    {
      icon: Users,
      title: "Vendor Tracking",
      description: "Manage vendor relationships and track vendor performance.",
      details: [
        "Vendor profiles",
        "Vendor performance tracking",
        "Purchase history",
        "Vendor ratings and reviews"
      ]
    },
    {
      icon: History,
      title: "Contact History",
      description: "Track all interactions and communications with customers and vendors.",
      details: [
        "Communication history",
        "Interaction tracking",
        "Note management",
        "Follow-up reminders"
      ]
    },
    {
      icon: Handshake,
      title: "Relationship Management",
      description: "Build and maintain strong business relationships with integrated CRM tools.",
      details: [
        "Relationship tracking",
        "Opportunity management",
        "Pipeline management",
        "Sales forecasting"
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
                <Users className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground">
                CRM & Customer Management
              </h1>
            </div>
            <p className="text-xl text-muted-foreground">
              Manage customers, vendors, and business relationships with integrated CRM functionality.
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




