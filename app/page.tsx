"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowRight, Truck, BarChart3, Users, Lock } from "lucide-react"
import Link from "next/link"
import { Logo } from "@/components/logo"

// VERSION: 2.0 - Latest deployment
export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Logo size="sm" />
          <Link href="/login">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">Login</Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
              Unified Fleet <span className="text-primary">Management</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              Streamline your logistics operations with real-time tracking, driver management, and intelligent route
              optimization for your fleet.
            </p>
            <Link href="/login">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                Get Started <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
          <div className="hidden lg:flex justify-center">
            <div className="w-full h-96 bg-gradient-to-br from-primary/20 to-transparent rounded-2xl border border-primary/30 flex items-center justify-center">
              <Logo size="lg" showText={false} />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-secondary/50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-foreground mb-12 text-center">Features</h2>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { icon: Truck, title: "Fleet Tracking", desc: "Real-time GPS tracking of all vehicles" },
              { icon: Users, title: "Driver Management", desc: "Complete driver profiles and schedules" },
              { icon: BarChart3, title: "Analytics", desc: "Detailed performance metrics and insights" },
              { icon: Lock, title: "Secure", desc: "Enterprise-grade security and encryption" },
            ].map((feature, i) => (
              <Card key={i} className="bg-card border-border p-6">
                <feature.icon className="w-10 h-10 text-primary mb-4" />
                <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-foreground mb-6">Ready to optimize your fleet?</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join hundreds of logistics companies managing their operations with TruckMates
          </p>
          <Link href="/login">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Start Free Trial
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4 sm:px-6 lg:px-8 bg-secondary/30">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Logo size="sm" />
          <p className="text-sm text-muted-foreground">© 2025 TruckMates. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
// Force redeploy - Wed Dec 10 00:54:43 +05 2025
