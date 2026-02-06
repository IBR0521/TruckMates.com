import Link from "next/link"
import { ArrowLeft, Handshake, Shield, Route, DollarSign, Smartphone } from "lucide-react"

export default function PartnersPage() {
  const partners = [
    {
      icon: Shield,
      name: "ELD Providers",
      description: "Integrated with leading ELD providers for seamless compliance",
      partners: ["KeepTruckin", "Samsara", "Geotab", "Rand McNally"]
    },
    {
      icon: DollarSign,
      name: "Financial Services",
      description: "Connect with accounting and payment platforms",
      partners: ["Stripe", "PayPal"]
    },
    {
      icon: Route,
      name: "Mapping Services",
      description: "Powered by industry-leading mapping and routing services",
      partners: ["Google Maps"]
    },
    {
      icon: Smartphone,
      name: "Mobile Platforms",
      description: "Native apps for iOS and Android",
      partners: ["Apple App Store", "Google Play Store"]
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
              <Handshake className="w-8 h-8 text-primary" />
              <h1 className="text-4xl md:text-5xl font-bold text-foreground">
                Partners & Integrations
              </h1>
            </div>
            <p className="text-xl text-muted-foreground">
              We partner with industry leaders to provide you with the best tools and services
            </p>
          </div>
        </div>
      </div>

      {/* Partners */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto space-y-8">
          {partners.map((partner) => {
            const Icon = partner.icon
            return (
              <div key={partner.name} className="p-8 rounded-lg border border-border bg-card">
                <div className="flex items-start gap-4 mb-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-semibold text-foreground mb-2">
                      {partner.name}
                    </h2>
                    <p className="text-muted-foreground mb-4">
                      {partner.description}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {partner.partners.map((name) => (
                        <span
                          key={name}
                          className="px-3 py-1 rounded-full bg-muted text-foreground text-sm font-medium"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Partnership Info */}
      <div className="border-t border-border bg-card/50">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-foreground mb-8 text-center">
              Become a Partner
            </h2>
            <div className="p-8 rounded-lg border border-border bg-card">
              <p className="text-muted-foreground mb-4">
                Interested in partnering with TruckMates? We're always looking to expand our integration ecosystem and work with innovative companies in the logistics and transportation industry.
              </p>
              <p className="text-muted-foreground">
                Contact us at <a href="mailto:partners@truckmates.com" className="text-primary hover:underline">partners@truckmates.com</a> to discuss partnership opportunities.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

