"use client"

import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import {
  ArrowRight,
  Sparkles,
  TrendingUp,
  Clock,
  Zap,
  Shield,
  Play,
  ArrowDown,
} from "lucide-react"
import Link from "next/link"
import { Logo } from "@/components/logo"

const LandingPageBelowFold = dynamic(() => import("./landing-page-below-fold"), {
  loading: () => (
    <div
      className="min-h-[45vh] w-full animate-pulse bg-gradient-to-b from-muted/15 to-transparent"
      aria-hidden
    />
  ),
})

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background" suppressHydrationWarning>
      {/* Navigation */}
      <nav
        className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border/50"
        suppressHydrationWarning
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Logo size="sm" />
          <div className="flex items-center gap-4">
            <Link href="/pricing" suppressHydrationWarning>
              <Button variant="ghost" className="hidden sm:flex">
                Pricing
              </Button>
            </Link>
            <Link href="/login" suppressHydrationWarning>
              <Button variant="ghost" className="hidden sm:flex">
                Login
              </Button>
            </Link>
            <Link href="/register" suppressHydrationWarning>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section
        className="relative pt-32 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden"
        suppressHydrationWarning
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent -z-10" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -z-10" />

        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">
                All-in-One Fleet Management Platform
              </span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 leading-tight">
              Automated Fleet Management
              <span className="block text-primary mt-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                That Pays for Itself
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-6 max-w-3xl mx-auto leading-relaxed">
              The only platform that automates IFTA reporting (2-3 days → 5 minutes), generates invoices
              instantly on delivery, and accelerates cash flow by 2-4 weeks. All while ensuring 100%
              compliance.
            </p>
            <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
              Join fleets saving $160K-$230K/year through automation. IFTA, settlements, invoicing, and
              compliance - all automated with zero manual work.
            </p>

            <div className="flex flex-wrap justify-center gap-6 mb-10 text-sm">
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border">
                <TrendingUp className="w-5 h-5 text-primary" />
                <span className="font-semibold text-foreground">$160K-$230K</span>
                <span className="text-muted-foreground">Saved/Year</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border">
                <Clock className="w-5 h-5 text-primary" />
                <span className="font-semibold text-foreground">2-4 Weeks</span>
                <span className="text-muted-foreground">Faster Payment</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border">
                <Zap className="w-5 h-5 text-primary" />
                <span className="font-semibold text-foreground">60-80 Hrs</span>
                <span className="text-muted-foreground">Saved/Month</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border">
                <Shield className="w-5 h-5 text-primary" />
                <span className="font-semibold text-foreground">100%</span>
                <span className="text-muted-foreground">IFTA Accurate</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8" suppressHydrationWarning>
              <Link href="/register">
                <Button
                  size="lg"
                  className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground text-lg px-8 py-6 shadow-lg shadow-primary/25"
                >
                  Get Started Free <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link href="/login">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto border-2 border-border text-foreground hover:bg-secondary/50 text-lg px-8 py-6"
                >
                  Login
                </Button>
              </Link>
              <Link href="/demo">
                <Button
                  size="lg"
                  variant="ghost"
                  className="w-full sm:w-auto text-primary hover:bg-primary/10 text-lg px-8 py-6"
                >
                  <Play className="mr-2 w-5 h-5" />
                  View Demo
                </Button>
              </Link>
            </div>
          </div>

          <div className="flex justify-center mt-12">
            <div className="flex flex-col items-center gap-2 text-muted-foreground animate-bounce">
              <span className="text-sm">Scroll to explore</span>
              <ArrowDown className="w-5 h-5" />
            </div>
          </div>
        </div>
      </section>

      <LandingPageBelowFold />
    </div>
  )
}
