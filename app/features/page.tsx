import Link from "next/link"
import { Truck, Route, FileText, DollarSign, Shield, BarChart3, Users, Wrench, MapPin, Clock, CheckCircle2 } from "lucide-react"

export default function FeaturesPage() {
  const features = [
    {
      icon: Truck,
      title: "Fleet Management",
      description: "Comprehensive fleet management with driver, vehicle, and route tracking. Real-time visibility into your entire operation.",
      link: "/features/fleet",
      highlights: ["Driver Management", "Vehicle Tracking", "Route Optimization", "Real-time GPS"]
    },
    {
      icon: Shield,
      title: "ELD Compliance",
      description: "ELD-compliant software that integrates with DOT-certified ELD devices. Hours of Service tracking, violation detection, and automated reporting.",
      link: "/features/eld",
      highlights: ["HOS Tracking", "Violation Detection", "DOT Compliance", "Mobile ELD App"]
    },
    {
      icon: Route,
      title: "Route Optimization",
      description: "AI-powered route optimization that minimizes distance, travel time, and fuel costs while considering traffic and constraints.",
      link: "/features/routing",
      highlights: ["Multi-stop Optimization", "Traffic-Aware Routing", "Time Windows", "Priority-Based"]
    },
    {
      icon: DollarSign,
      title: "Accounting & Finance",
      description: "Complete financial management with invoicing, expense tracking, driver settlements, and QuickBooks integration.",
      link: "/features/accounting",
      highlights: ["Invoicing", "Expense Tracking", "Driver Settlements", "QuickBooks Sync"]
    },
    {
      icon: FileText,
      title: "Document Management",
      description: "Secure document storage with AI-powered analysis, expiry tracking, and automated organization.",
      link: "/features/documents",
      highlights: ["AI Document Analysis", "Expiry Tracking", "Secure Storage", "Bulk Operations"]
    },
    {
      icon: Wrench,
      title: "Maintenance Management",
      description: "Predictive maintenance scheduling, service history tracking, and cost management to keep your fleet running smoothly.",
      link: "/features/maintenance",
      highlights: ["Predictive Maintenance", "Service History", "Cost Tracking", "Parts Inventory"]
    },
    {
      icon: BarChart3,
      title: "Analytics & Reporting",
      description: "Powerful analytics and reporting tools to gain insights into your fleet performance, costs, and efficiency.",
      link: "/features/analytics",
      highlights: ["Performance Metrics", "Cost Analysis", "Custom Reports", "Export Options"]
    },
    {
      icon: Users,
      title: "CRM & Customer Management",
      description: "Manage customers, vendors, and business relationships with integrated CRM functionality.",
      link: "/features/crm",
      highlights: ["Customer Management", "Vendor Tracking", "Contact History", "Relationship Management"]
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Powerful Features for Your Fleet
            </h1>
            <p className="text-xl text-muted-foreground">
              Everything you need to manage your logistics operation efficiently and profitably
            </p>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <Link
                key={feature.title}
                href={feature.link}
                className="group block p-6 rounded-lg border border-border bg-card hover:border-primary hover:shadow-lg transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      {feature.description}
                    </p>
                    <ul className="space-y-2">
                      {feature.highlights.map((highlight) => (
                        <li key={highlight} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                          {highlight}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* CTA Section */}
      <div className="border-t border-border bg-card/50">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-muted-foreground mb-8">
              Join thousands of fleets using TruckMates to streamline their operations
            </p>
            <div className="flex gap-4 justify-center">
              <Link
                href="/register"
                className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
              >
                Start Free Trial
              </Link>
              <Link
                href="/demo"
                className="px-6 py-3 rounded-lg border border-border bg-card text-foreground font-semibold hover:bg-muted transition-colors"
              >
                View Demo
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

