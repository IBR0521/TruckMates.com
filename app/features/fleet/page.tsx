import Link from "next/link"
import { Truck, Users, MapPin, Route, CheckCircle2, ArrowLeft } from "lucide-react"

export default function FleetFeaturesPage() {
  const features = [
    {
      icon: Users,
      title: "Driver Management",
      description: "Comprehensive driver management with profiles, certifications, and performance tracking.",
      details: [
        "Driver profiles and documentation",
        "License and certification tracking",
        "Performance metrics and scorecards",
        "Driver assignment and scheduling"
      ]
    },
    {
      icon: Truck,
      title: "Vehicle Tracking",
      description: "Real-time GPS tracking and vehicle management for your entire fleet.",
      details: [
        "Real-time GPS location tracking",
        "Vehicle status monitoring",
        "Maintenance history and scheduling",
        "Vehicle assignment and routing"
      ]
    },
    {
      icon: Route,
      title: "Route Management",
      description: "Plan, optimize, and track routes for maximum efficiency.",
      details: [
        "Multi-stop route planning",
        "Route optimization algorithms",
        "Real-time route tracking",
        "Route history and analytics"
      ]
    },
    {
      icon: MapPin,
      title: "Real-Time GPS",
      description: "Live tracking of all vehicles with detailed location data and history.",
      details: [
        "Live GPS tracking",
        "Historical route playback",
        "Geofencing and alerts",
        "Location-based notifications"
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
                <Truck className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground">
                Fleet Management
              </h1>
            </div>
            <p className="text-xl text-muted-foreground">
              Comprehensive fleet management with driver, vehicle, and route tracking. Real-time visibility into your entire operation.
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

      {/* GPS Hardware & Performance */}
      <div className="border-t border-border bg-card/50">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-foreground mb-8 text-center">
              GPS Hardware & Performance
            </h2>
            
            {/* Supported Hardware Vendors */}
            <div className="mb-12">
              <h3 className="text-xl font-semibold text-foreground mb-4">Supported ELD Hardware Vendors</h3>
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                {[
                  { name: "KeepTruckin", desc: "Full API integration with KeepTruckin ELD devices" },
                  { name: "Samsara", desc: "Complete Samsara telematics and ELD integration" },
                  { name: "Geotab", desc: "Geotab GO devices with real-time data sync" },
                  { name: "Rand McNally", desc: "Rand McNally ELD integration support" },
                  { name: "TruckMates Mobile", desc: "Native mobile app (iOS/Android) - No hardware required" },
                  { name: "Custom Integration", desc: "API support for custom GPS/ELD devices" }
                ].map((vendor) => (
                  <div key={vendor.name} className="p-4 rounded-lg border border-border bg-card">
                    <h4 className="font-semibold text-foreground mb-1">{vendor.name}</h4>
                    <p className="text-sm text-muted-foreground">{vendor.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Data Latency & Accuracy */}
            <div className="mb-12">
              <h3 className="text-xl font-semibold text-foreground mb-4">Data Latency & Accuracy</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="p-6 rounded-lg border border-border bg-card">
                  <h4 className="font-semibold text-foreground mb-3">Real-Time Updates</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span><strong>Update Frequency:</strong> Real-time (last 5 minutes for map view)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span><strong>Location Accuracy:</strong> 10-meter GPS accuracy</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span><strong>Distance Filter:</strong> 10 meters minimum for updates</span>
                    </li>
                  </ul>
                </div>
                <div className="p-6 rounded-lg border border-border bg-card">
                  <h4 className="font-semibold text-foreground mb-3">Offline Support</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span><strong>Offline Storage:</strong> Mobile app stores locations locally</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span><strong>Batch Upload:</strong> Automatic sync when connection restored</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span><strong>Data Integrity:</strong> No data loss during offline periods</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Benefits */}
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-8 text-center">
                Benefits
              </h2>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="p-6 rounded-lg border border-border bg-card">
                  <h3 className="font-semibold text-foreground mb-2">Visibility</h3>
                  <p className="text-sm text-muted-foreground">
                    Real-time visibility into your entire fleet operations
                  </p>
                </div>
                <div className="p-6 rounded-lg border border-border bg-card">
                  <h3 className="font-semibold text-foreground mb-2">Efficiency</h3>
                  <p className="text-sm text-muted-foreground">
                    Optimize routes and assignments for maximum efficiency
                  </p>
                </div>
                <div className="p-6 rounded-lg border border-border bg-card">
                  <h3 className="font-semibold text-foreground mb-2">Control</h3>
                  <p className="text-sm text-muted-foreground">
                    Complete control over drivers, vehicles, and routes
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

