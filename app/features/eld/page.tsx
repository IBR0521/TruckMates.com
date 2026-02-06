import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Shield, Clock, AlertTriangle, FileCheck, Smartphone, CheckCircle2, ArrowLeft } from "lucide-react"

export default function ELDFeaturesPage() {
  const features = [
    {
      icon: Clock,
      title: "Hours of Service Tracking",
      description: "Automatic HOS tracking with FMCSA-compliant calculations. Track driving time, on-duty time, and breaks in real-time.",
      details: [
        "11-hour driving limit tracking",
        "14-hour on-duty limit tracking",
        "30-minute break requirement",
        "Rolling window calculations",
        "Real-time remaining hours"
      ]
    },
    {
      icon: AlertTriangle,
      title: "Violation Detection",
      description: "Automatic detection of HOS violations, speeding, and safety events with instant alerts and resolution workflow.",
      details: [
        "Real-time violation detection",
        "Critical, warning, and info severity levels",
        "Automatic notification system",
        "Resolution workflow with audit trail",
        "Compliance reporting"
      ]
    },
    {
      icon: FileCheck,
      title: "FMCSA Compliance",
      description: "Software compliance with FMCSA regulations. Integrates with DOT-certified ELD devices for ELD mandate requirements, audit trails, and reporting.",
      details: [
        "Integrates with DOT-certified ELD devices",
        "FMCSA-compliant HOS calculations",
        "Complete audit trail",
        "DOT report generation",
        "IFTA reporting support",
        "Export for inspections"
      ]
    },
    {
      icon: Smartphone,
      title: "Mobile ELD App",
      description: "Native mobile app that can function as an ELD device when used with certified hardware. Integrates with vehicle OBD-II or certified ELD devices.",
      details: [
        "iOS and Android support",
        "Real-time GPS tracking",
        "Automatic status detection",
        "Offline support",
        "Battery optimized"
      ]
    },
    {
      icon: Shield,
      title: "ELD Provider Integration",
      description: "Integrate with leading ELD providers including KeepTruckin, Samsara, Geotab, and Rand McNally.",
      details: [
        "KeepTruckin integration",
        "Samsara integration",
        "Geotab integration",
        "Rand McNally integration",
        "Automatic data sync"
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
                <Shield className="w-8 h-8 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-4xl md:text-5xl font-bold text-foreground">
                    ELD Compliance
                  </h1>
                  <Badge variant="outline" className="text-sm px-3 py-1 bg-green-500/10 text-green-600 border-green-500/20">
                    FMCSA Compliant
                  </Badge>
                </div>
              </div>
            </div>
            <p className="text-xl text-muted-foreground">
              ELD-compliant software that integrates with DOT-certified ELD devices. Automatic Hours of Service tracking, violation detection, and FMCSA compliance reporting.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              <strong>Note:</strong> TruckMates integrates with DOT-certified ELD devices (KeepTruckin, Samsara, Geotab, Rand McNally) or our mobile app. The ELD devices themselves are DOT-certified.
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

      {/* Benefits */}
      <div className="border-t border-border bg-card/50">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-foreground mb-8 text-center">
              Benefits
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="p-6 rounded-lg border border-border bg-card">
                <h3 className="font-semibold text-foreground mb-2">Compliance</h3>
                <p className="text-sm text-muted-foreground">
                  Integrate with DOT-certified ELD devices to stay compliant with FMCSA regulations and avoid costly violations
                </p>
              </div>
              <div className="p-6 rounded-lg border border-border bg-card">
                <h3 className="font-semibold text-foreground mb-2">Safety</h3>
                <p className="text-sm text-muted-foreground">
                  Improve driver safety with real-time violation detection and alerts
                </p>
              </div>
              <div className="p-6 rounded-lg border border-border bg-card">
                <h3 className="font-semibold text-foreground mb-2">Efficiency</h3>
                <p className="text-sm text-muted-foreground">
                  Automate HOS tracking and reporting to save time and reduce errors
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

