import Link from "next/link"
import { BarChart3, TrendingUp, FileText, Download, CheckCircle2, ArrowLeft } from "lucide-react"

export default function AnalyticsFeaturesPage() {
  const features = [
    {
      icon: TrendingUp,
      title: "Performance Metrics",
      description: "Track key performance indicators and metrics for your fleet operations.",
      details: [
        "Real-time performance dashboards",
        "Custom KPI tracking",
        "Performance trends and analysis",
        "Benchmark comparisons"
      ]
    },
    {
      icon: BarChart3,
      title: "Cost Analysis",
      description: "Comprehensive cost analysis and financial reporting for your fleet.",
      details: [
        "Fuel cost analysis",
        "Maintenance cost tracking",
        "Driver cost analysis",
        "Profit and loss reports"
      ]
    },
    {
      icon: FileText,
      title: "Custom Reports",
      description: "Create custom reports tailored to your business needs.",
      details: [
        "Report builder",
        "Scheduled reports",
        "Custom date ranges",
        "Multi-metric reports"
      ]
    },
    {
      icon: Download,
      title: "Export Options",
      description: "Export your data in multiple formats for external analysis.",
      details: [
        "Excel export",
        "CSV export",
        "PDF reports",
        "API access"
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
                <BarChart3 className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground">
                Analytics & Reporting
              </h1>
            </div>
            <p className="text-xl text-muted-foreground">
              Powerful analytics and reporting tools to gain insights into your fleet performance, costs, and efficiency.
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

      {/* Sample Dashboards */}
      <div className="border-t border-border bg-card/50">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-foreground mb-8 text-center">
              Sample Dashboards
            </h2>
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="p-6 rounded-lg border border-border bg-card">
                <h3 className="text-xl font-semibold text-foreground mb-3">Executive Dashboard</h3>
                <p className="text-muted-foreground mb-4 text-sm">
                  High-level overview of fleet performance, revenue, and key metrics at a glance.
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Total revenue and profit margins</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Active loads and completion rates</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Fleet utilization metrics</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>On-time delivery percentage</span>
                  </li>
                </ul>
              </div>
              <div className="p-6 rounded-lg border border-border bg-card">
                <h3 className="text-xl font-semibold text-foreground mb-3">Operations Dashboard</h3>
                <p className="text-muted-foreground mb-4 text-sm">
                  Real-time operational metrics for dispatchers and fleet managers.
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Active routes and load status</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Driver and vehicle assignments</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>HOS compliance status</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Upcoming maintenance alerts</span>
                  </li>
                </ul>
              </div>
              <div className="p-6 rounded-lg border border-border bg-card">
                <h3 className="text-xl font-semibold text-foreground mb-3">Financial Dashboard</h3>
                <p className="text-muted-foreground mb-4 text-sm">
                  Comprehensive financial analysis and revenue tracking.
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Revenue trends and forecasts</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Expense breakdown by category</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Profit and loss statements</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Invoice and payment status</span>
                  </li>
                </ul>
              </div>
              <div className="p-6 rounded-lg border border-border bg-card">
                <h3 className="text-xl font-semibold text-foreground mb-3">Compliance Dashboard</h3>
                <p className="text-muted-foreground mb-4 text-sm">
                  ELD compliance, HOS tracking, and safety metrics.
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>HOS violation rates and trends</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Driver compliance scores</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>IFTA reporting status</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Document expiry alerts</span>
                  </li>
                </ul>
              </div>
            </div>
            <div className="text-center mt-8">
              <p className="text-muted-foreground mb-4">
                All dashboards are customizable and can be exported in multiple formats (PDF, Excel, CSV).
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link href="/docs/features/kpi-definitions">
                  <button className="text-primary hover:underline font-medium">
                    View KPI Definitions →
                  </button>
                </Link>
                <Link href="/docs/features/export-formats">
                  <button className="text-primary hover:underline font-medium">
                    View Export Formats →
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

