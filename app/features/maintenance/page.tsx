import Link from "next/link"
import { Wrench, TrendingUp, Calendar, DollarSign, CheckCircle2, ArrowLeft } from "lucide-react"

export default function MaintenanceFeaturesPage() {
  const features = [
    {
      icon: TrendingUp,
      title: "Predictive Maintenance",
      description: "AI-powered maintenance predictions based on mileage, usage patterns, and service history.",
      details: [
        "Automatic maintenance predictions",
        "Mileage-based scheduling",
        "Priority-based alerts",
        "Cost optimization"
      ]
    },
    {
      icon: Calendar,
      title: "Service History",
      description: "Complete service history tracking for all vehicles in your fleet.",
      details: [
        "Service record management",
        "Maintenance scheduling",
        "Service reminders",
        "History tracking"
      ]
    },
    {
      icon: DollarSign,
      title: "Cost Tracking",
      description: "Track and analyze maintenance costs to optimize your fleet expenses.",
      details: [
        "Maintenance cost tracking",
        "Cost analysis and reports",
        "Budget management",
        "ROI calculations"
      ]
    },
    {
      icon: Wrench,
      title: "Parts Inventory",
      description: "Manage parts inventory with tracking, reorder alerts, and usage history.",
      details: [
        "Parts inventory management",
        "Low stock alerts",
        "Reorder management",
        "Usage tracking"
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
                <Wrench className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground">
                Maintenance Management
              </h1>
            </div>
            <p className="text-xl text-muted-foreground">
              Predictive maintenance scheduling, service history tracking, and cost management to keep your fleet running smoothly.
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




