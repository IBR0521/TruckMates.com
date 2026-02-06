import Link from "next/link"
import { ArrowLeft, Building2, Users, Target, Award } from "lucide-react"

export default function AboutPage() {
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
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              About TruckMates
            </h1>
            <p className="text-xl text-muted-foreground">
              Empowering logistics companies with comprehensive fleet management solutions
            </p>
          </div>
        </div>
      </div>

      {/* Mission */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="p-8 rounded-lg border border-border bg-card mb-12">
            <div className="flex items-center gap-3 mb-4">
              <Target className="w-8 h-8 text-primary" />
              <h2 className="text-3xl font-bold text-foreground">Our Mission</h2>
            </div>
            <p className="text-lg text-muted-foreground leading-relaxed">
              TruckMates was founded with a simple mission: to make fleet management easier, more efficient, and more profitable for logistics companies of all sizes. We believe that technology should simplify operations, not complicate them.
            </p>
          </div>

          {/* Company Info */}
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div className="p-8 rounded-lg border border-border bg-card">
              <div className="flex items-center gap-3 mb-4">
                <Building2 className="w-6 h-6 text-primary" />
                <h3 className="text-2xl font-semibold text-foreground">Company</h3>
              </div>
              <p className="text-muted-foreground mb-4">
                TruckMates is a leading provider of fleet management and logistics software solutions.
              </p>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p><strong className="text-foreground">Founded:</strong> 2024</p>
                <p><strong className="text-foreground">Headquarters:</strong> United States</p>
                <p><strong className="text-foreground">Industry:</strong> Logistics & Transportation Technology</p>
                <p><strong className="text-foreground">Mission:</strong> Simplify fleet management for logistics companies of all sizes</p>
                <p><strong className="text-foreground">Focus:</strong> All-in-one platform for fleet operations, compliance, and growth</p>
              </div>
            </div>

            <div className="p-8 rounded-lg border border-border bg-card">
              <div className="flex items-center gap-3 mb-4">
                <Users className="w-6 h-6 text-primary" />
                <h3 className="text-2xl font-semibold text-foreground">Team</h3>
              </div>
              <p className="text-muted-foreground mb-4">
                Our team consists of experienced developers, logistics experts, and customer success professionals dedicated to helping your business succeed.
              </p>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p><strong className="text-foreground">Team Size:</strong> Growing team of experts</p>
                <p><strong className="text-foreground">Expertise:</strong> Software development, logistics operations, customer success</p>
                <p><strong className="text-foreground">Focus:</strong> Customer Success & Product Innovation</p>
                <p><strong className="text-foreground">Values:</strong> Innovation, Reliability, Support, Transparency</p>
              </div>
            </div>
          </div>

          {/* Values */}
          <div className="p-8 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-3 mb-6">
              <Award className="w-8 h-8 text-primary" />
              <h2 className="text-3xl font-bold text-foreground">Our Values</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <h3 className="font-semibold text-foreground mb-2">Innovation</h3>
                <p className="text-sm text-muted-foreground">
                  We continuously innovate to provide cutting-edge solutions that keep your fleet ahead of the competition.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">Reliability</h3>
                <p className="text-sm text-muted-foreground">
                  Your operations depend on us. We ensure 99.9% uptime and reliable service you can count on.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">Support</h3>
                <p className="text-sm text-muted-foreground">
                  Our dedicated support team is here to help you succeed, with fast response times and expert guidance.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

