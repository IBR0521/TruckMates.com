import Link from "next/link"
import { Route, MapPin, Clock, DollarSign, CheckCircle2, ArrowLeft } from "lucide-react"

export default function RoutingFeaturesPage() {
  const features = [
    {
      icon: MapPin,
      title: "Multi-Stop Optimization",
      description: "Optimize routes with multiple stops using advanced algorithms that minimize total distance and travel time.",
      details: [
        "Nearest neighbor algorithm",
        "Real road distances (not straight-line)",
        "Traffic-aware routing",
        "Automatic stop sequencing",
        "Distance and time calculations"
      ]
    },
    {
      icon: Clock,
      title: "Time Window Constraints",
      description: "Respect delivery and pickup time windows while optimizing routes for efficiency.",
      details: [
        "Time window support",
        "Arrival time estimation",
        "Route adjustment for time windows",
        "Priority-based routing",
        "Real-time traffic consideration"
      ]
    },
    {
      icon: DollarSign,
      title: "Traffic-Aware Routing",
      description: "Use real-time and historical traffic data to optimize routes and estimate accurate arrival times.",
      details: [
        "Google Maps traffic integration",
        "Real-time traffic conditions",
        "Historical traffic patterns",
        "Accurate time estimates",
        "Route alternatives"
      ]
    },
    {
      icon: Route,
      title: "Priority-Based Routing",
      description: "Assign priorities to stops and optimize routes accordingly, ensuring important deliveries are handled first.",
      details: [
        "Stop priority levels",
        "Priority-aware optimization",
        "Flexible priority system",
        "Distance optimization within priorities",
        "Custom priority rules"
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
                <Route className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground">
                Route Optimization
              </h1>
            </div>
            <p className="text-xl text-muted-foreground">
              AI-powered route optimization that minimizes distance, travel time, and fuel costs while considering traffic and constraints.
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
                <h3 className="font-semibold text-foreground mb-2">Save Time</h3>
                <p className="text-sm text-muted-foreground">
                  Reduce travel time by up to 30% with optimized routes
                </p>
              </div>
              <div className="p-6 rounded-lg border border-border bg-card">
                <h3 className="font-semibold text-foreground mb-2">Save Fuel</h3>
                <p className="text-sm text-muted-foreground">
                  Minimize distance traveled to reduce fuel costs
                </p>
              </div>
              <div className="p-6 rounded-lg border border-border bg-card">
                <h3 className="font-semibold text-foreground mb-2">Improve Service</h3>
                <p className="text-sm text-muted-foreground">
                  Meet time windows and improve customer satisfaction
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}





