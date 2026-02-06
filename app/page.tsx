"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  ArrowRight, 
  Truck, 
  BarChart3, 
  Users, 
  MapPin, 
  Route, 
  DollarSign,
  Shield,
  Clock,
  Zap,
  CheckCircle2,
  Smartphone,
  Gauge,
  AlertTriangle,
  TrendingUp,
  Database,
  Cloud,
  Star,
  Play,
  Award,
  Target,
  ArrowDown,
  Sparkles,
  FileText
} from "lucide-react"
import Link from "next/link"
import { Logo } from "@/components/logo"

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Logo size="sm" />
          <div className="flex items-center gap-4">
            <Link href="/features">
              <Button variant="ghost" className="hidden sm:flex">Features</Button>
            </Link>
            <Link href="/marketplace">
              <Button variant="ghost" className="hidden sm:flex">Marketplace</Button>
            </Link>
            <Link href="/login">
              <Button variant="ghost" className="hidden sm:flex">Login</Button>
            </Link>
            <Link href="/register">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent -z-10" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -z-10" />
        
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">All-in-One Fleet Management Platform</span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 leading-tight">
              Automated Fleet Management
              <span className="block text-primary mt-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                That Pays for Itself
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-6 max-w-3xl mx-auto leading-relaxed">
              The only platform that automates IFTA reporting (2-3 days → 5 minutes), generates invoices 
              instantly on delivery, and accelerates cash flow by 2-4 weeks. All while ensuring 100% compliance.
            </p>
            <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
              Join fleets saving $160K-$230K/year through automation. IFTA, settlements, invoicing, and 
              compliance - all automated with zero manual work.
            </p>

            {/* Stats */}
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

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link href="/register">
                <Button size="lg" className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground text-lg px-8 py-6 shadow-lg shadow-primary/25">
                  Get Started Free <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link href="/demo">
                <Button size="lg" variant="outline" className="w-full sm:w-auto border-2 border-primary text-primary hover:bg-primary/10 text-lg px-8 py-6">
                  <Play className="mr-2 w-5 h-5" />
                  View Demo
                </Button>
              </Link>
            </div>

          </div>

          {/* Scroll indicator */}
          <div className="flex justify-center mt-12">
            <div className="flex flex-col items-center gap-2 text-muted-foreground animate-bounce">
              <span className="text-sm">Scroll to explore</span>
              <ArrowDown className="w-5 h-5" />
            </div>
          </div>
        </div>
      </section>

      {/* What is TruckMates Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-background to-secondary/20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">About TruckMates</Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">What is TruckMates?</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              A comprehensive cloud-based platform that revolutionizes how logistics companies manage their operations
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="group">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition">
                    <Truck className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-foreground mb-3">Complete Operations Management</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      TruckMates provides everything you need to run a modern logistics operation. From vehicle 
                      tracking and driver management to route planning, load coordination, accounting, and compliance 
                      reporting - all integrated into one intuitive platform.
                    </p>
                  </div>
                </div>
              </div>
              <div className="group">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition">
                    <Shield className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-foreground mb-3">Automated IFTA & Compliance</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      <strong>IFTA reporting in 5 minutes</strong> (vs 2-3 days manually). 100% accurate GPS-based 
                      state-by-state mileage. Automatic fuel card import, real-time tax rates, and complete audit trail. 
                      Full ELD integration with HOS tracking and violation detection. <strong>Eliminates $5K-$10K/year in penalties.</strong>
                    </p>
                  </div>
                </div>
              </div>
              <div className="group">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition">
                    <DollarSign className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-foreground mb-3">Instant Invoicing & Cash Flow Acceleration</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      <strong>Invoice generated automatically when POD is captured</strong> - no manual work. BOL auto-populated 
                      from load data. <strong>2-4 weeks faster payment</strong> = $200K-$500K/year in improved cash flow. 
                      Automated settlements with complex pay rules. PDF statements generated automatically. 
                      <strong> Zero data entry errors.</strong>
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="hidden md:flex justify-center">
              <div className="relative w-full max-w-lg">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent rounded-3xl blur-2xl" />
                <div className="relative w-full h-[500px] bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-3xl border border-primary/20 flex items-center justify-center backdrop-blur-sm">
                  <div className="text-center space-y-4">
                    <div className="w-24 h-24 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto">
                      <Truck className="w-12 h-12 text-primary" />
                    </div>
                    <Logo size="lg" showText={false} />
                    <p className="text-sm text-muted-foreground">Complete Fleet Management</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features - Detailed */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Features</Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Powerful Features</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-6">
              Everything you need to manage your fleet efficiently and profitably
            </p>
            <Link href="/features">
              <Button variant="outline" size="lg">
                View All Features <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Fleet Tracking */}
            <Card className="bg-card border-border p-6 hover:border-primary/50 hover:shadow-lg transition-all group">
              <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/20 transition">
                <MapPin className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">Real-Time Fleet Tracking</h3>
              <p className="text-muted-foreground mb-4">
                Track all your vehicles in real-time with GPS integration. See exact locations, 
                speeds, routes, and vehicle status instantly on an interactive map.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Live GPS tracking for all vehicles</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Historical route playback</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Geofencing and alerts</span>
                </li>
              </ul>
            </Card>

            {/* IFTA Automation */}
            <Card className="bg-card border-border p-6 hover:border-primary/50 hover:shadow-lg transition-all group">
              <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/20 transition">
                <Clock className="w-7 h-7 text-primary" />
              </div>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-xl font-bold text-foreground">Automated IFTA Reporting</h3>
                <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
                  GPS-Based
                </Badge>
              </div>
              <p className="text-muted-foreground mb-4">
                <strong>2-3 days → 5 minutes per quarter.</strong> 100% accurate GPS-based state-by-state mileage. 
                Automatic fuel card import, real-time tax rates, complete audit trail.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>5 minutes per quarter (vs 2-3 days)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>100% accurate GPS-based mileage</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Automatic fuel card import</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Eliminates $5K-$10K/year in penalties</span>
                </li>
              </ul>
            </Card>

            {/* Driver Management */}
            <Card className="bg-card border-border p-6 hover:border-primary/50 hover:shadow-lg transition-all group">
              <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/20 transition">
                <Users className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">Driver & Employee Management</h3>
              <p className="text-muted-foreground mb-4">
                Comprehensive driver profiles, scheduling, performance tracking, and employee 
                management tools to keep your team organized.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Complete driver profiles</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Schedule and assignment management</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Performance metrics and scoring</span>
                </li>
              </ul>
            </Card>

            {/* Route Optimization */}
            <Card className="bg-card border-border p-6 hover:border-primary/50 hover:shadow-lg transition-all group">
              <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/20 transition">
                <Route className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">Route Planning & Optimization</h3>
              <p className="text-muted-foreground mb-4">
                Intelligent route planning with multi-stop optimization, real-time traffic updates, 
                and delivery point management to reduce fuel costs and improve efficiency.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Multi-stop route optimization</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Real-time traffic integration</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Delivery point tracking</span>
                </li>
              </ul>
            </Card>

            {/* Load Management & External Boards */}
            <Card className="bg-card border-border p-6 hover:border-primary/50 hover:shadow-lg transition-all group">
              <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/20 transition">
                <Truck className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">Load Management & External Boards</h3>
              <p className="text-muted-foreground mb-4">
                Full lifecycle load management with <strong>external load board integration</strong> (DAT, Truckstop, 123Loadboard). 
                One-click load import. Auto-populated BOLs. Instant invoicing on delivery.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>External load board integration (DAT, Truckstop, 123Loadboard)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>One-click load import from major boards</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>BOL auto-populated from load data</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Multi-delivery point support</span>
                </li>
              </ul>
            </Card>

            {/* Analytics & Reports */}
            <Card className="bg-card border-border p-6 hover:border-primary/50 hover:shadow-lg transition-all group">
              <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/20 transition">
                <BarChart3 className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">Analytics & Reporting</h3>
              <p className="text-muted-foreground mb-4">
                Powerful analytics and customizable reports to gain insights into your operation. 
                Track KPIs, analyze performance, and make data-driven decisions.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Performance dashboards</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Custom report builder</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Revenue and profit analysis</span>
                </li>
              </ul>
            </Card>

            {/* Automated Invoicing & Cash Flow */}
            <Card className="bg-card border-border p-6 hover:border-primary/50 hover:shadow-lg transition-all group">
              <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/20 transition">
                <DollarSign className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">Instant Invoicing & Cash Flow</h3>
              <p className="text-muted-foreground mb-4">
                <strong>Invoice generated automatically on POD capture.</strong> BOL auto-populated from load data. 
                <strong> 2-4 weeks faster payment</strong> = $200K-$500K/year improved cash flow.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Instant invoice on POD (zero manual work)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>BOL auto-populated (15-20 min → 2-3 min)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>2-4 weeks faster payment</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Automated settlements with pay rules</span>
                </li>
              </ul>
            </Card>

            {/* Maintenance Management */}
            <Card className="bg-card border-border p-6 hover:border-primary/50 hover:shadow-lg transition-all group">
              <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/20 transition">
                <Gauge className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">Vehicle Maintenance</h3>
              <p className="text-muted-foreground mb-4">
                Preventive and predictive maintenance scheduling, service history tracking, 
                and cost management to keep your fleet running efficiently.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Scheduled maintenance reminders</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Service history tracking</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Predictive maintenance insights</span>
                </li>
              </ul>
            </Card>

            {/* Security & Compliance */}
            <Card className="bg-card border-border p-6 hover:border-primary/50 hover:shadow-lg transition-all group">
              <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/20 transition">
                <Shield className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">Security & Compliance</h3>
              <p className="text-muted-foreground mb-4">
                Enterprise-grade security with role-based access control, data encryption, 
                audit logs, and full compliance with industry regulations.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Role-based access control</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>End-to-end encryption</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Compliance reporting</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* Mobile App Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-background to-secondary/20">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="outline" className="mb-4">Mobile App</Badge>
              <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
                ELD Compliance on Your Phone
              </h2>
              <p className="text-xl text-muted-foreground mb-6">
                Our native mobile app integrates with vehicle OBD-II or certified ELD devices for HOS tracking and compliance. 
                Available for iOS and Android.
              </p>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg mt-0.5">
                    <Smartphone className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Real-Time GPS Tracking</h3>
                    <p className="text-muted-foreground text-sm">
                      Automatic location updates with 10-meter accuracy. Works offline and syncs when connected.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg mt-0.5">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Automatic HOS Logging</h3>
                    <p className="text-muted-foreground text-sm">
                      Detects driving, on-duty, and off-duty status automatically. FMCSA-compliant logs.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg mt-0.5">
                    <AlertTriangle className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Violation Alerts</h3>
                    <p className="text-muted-foreground text-sm">
                      Instant notifications for HOS violations, speeding, and safety events.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg mt-0.5">
                    <Shield className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">FMCSA Compliant</h3>
                    <p className="text-muted-foreground text-sm">
                      Integrates with DOT-certified ELD devices for FMCSA compliance. Export logs for inspections.
                    </p>
                  </div>
                </li>
              </ul>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  <Smartphone className="mr-2 w-5 h-5" />
                  Download for iOS
                </Button>
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  <Smartphone className="mr-2 w-5 h-5" />
                  Download for Android
                </Button>
              </div>
            </div>
            <div className="relative">
              <div className="relative bg-gradient-to-br from-primary/10 to-primary/5 rounded-3xl p-8 border border-primary/20">
                <div className="space-y-6">
                  {/* App Explanation */}
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold text-foreground mb-4">Native Mobile ELD App</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      The TruckMates ELD mobile app is a native iOS and Android application that provides 
                      FMCSA-compliant electronic logging for drivers. It automatically tracks Hours of Service (HOS), 
                      captures GPS locations in real-time, and syncs seamlessly with the TruckMates platform. 
                      Drivers can manage their logs, complete DVIR inspections, capture POD signatures, and access 
                      DOT inspection mode—all from their smartphone.
                    </p>
                    <p className="text-muted-foreground leading-relaxed text-sm">
                      Works offline and syncs automatically when connected. Integrates with vehicle OBD-II devices 
                      or certified ELD hardware for complete compliance.
                    </p>
                  </div>

                  {/* Download Buttons */}
                  <div className="pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground mb-4 text-center">
                      Download the TruckMates ELD app
                    </p>
                    <div className="flex flex-col gap-3">
                      <Button size="lg" variant="outline" className="w-full border-2 border-primary/20 hover:border-primary/40">
                        <Smartphone className="mr-2 w-5 h-5" />
                        Download for iOS
                      </Button>
                      <Button size="lg" variant="outline" className="w-full border-2 border-primary/20 hover:border-primary/40">
                        <Smartphone className="mr-2 w-5 h-5" />
                        Download for Android
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Automation Highlights */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-background to-secondary/20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Automation</Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              What Gets Automated
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Everything that used to take hours or days now happens automatically
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <Card className="bg-card border-border p-6 hover:border-primary/50 transition-all">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Clock className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-2">IFTA Reporting</h3>
                  <p className="text-muted-foreground mb-3">
                    <strong>Before:</strong> 2-3 days per quarter manually compiling reports<br/>
                    <strong>After:</strong> 5 minutes per quarter, 100% accurate GPS-based
                  </p>
                  <div className="text-sm text-primary font-semibold">Saves $15K-$33K/year</div>
                </div>
              </div>
            </Card>

            <Card className="bg-card border-border p-6 hover:border-primary/50 transition-all">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <DollarSign className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-2">Invoice Generation</h3>
                  <p className="text-muted-foreground mb-3">
                    <strong>Before:</strong> Manual invoice creation after POD (5-10 min each)<br/>
                    <strong>After:</strong> Automatic invoice on POD capture (instant)
                  </p>
                  <div className="text-sm text-primary font-semibold">2-4 weeks faster payment</div>
                </div>
              </div>
            </Card>

            <Card className="bg-card border-border p-6 hover:border-primary/50 transition-all">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-2">BOL Creation</h3>
                  <p className="text-muted-foreground mb-3">
                    <strong>Before:</strong> 15-20 minutes manual data entry per BOL<br/>
                    <strong>After:</strong> 2-3 minutes (auto-populated from load data)
                  </p>
                  <div className="text-sm text-primary font-semibold">Saves 3-5 hours/day</div>
                </div>
              </div>
            </Card>

            <Card className="bg-card border-border p-6 hover:border-primary/50 transition-all">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-2">Settlement Calculation</h3>
                  <p className="text-muted-foreground mb-3">
                    <strong>Before:</strong> 8-12 hours/week manual calculations<br/>
                    <strong>After:</strong> 5 minutes/week with complex pay rules
                  </p>
                  <div className="text-sm text-primary font-semibold">Saves $44K-$60K/year</div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* ROI & Business Impact */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-secondary/20 to-background">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Results</Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              ROI That Pays for Itself
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Average fleet saves $160K-$230K/year. Payback in 10 days to 1.3 months.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <Card className="bg-card border-border p-8 text-center hover:border-primary/50 hover:shadow-xl transition-all relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -z-10" />
              <div className="text-5xl font-bold text-primary mb-2">$160K-$230K</div>
              <h3 className="text-xl font-bold text-foreground mb-3">Annual Savings</h3>
              <p className="text-muted-foreground mb-6">
                Direct cost savings from automation: IFTA (2-3 days → 5 min), settlements (8-12 hrs → 5 min), 
                eBOL (15-20 min → 2-3 min), fuel optimization, and more.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground text-left">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>IFTA automation: $15K-$33K/year</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Settlement automation: $44K-$60K/year</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Fuel optimization: $76K-$80K/year</span>
                </li>
              </ul>
            </Card>

            <Card className="bg-card border-border p-8 text-center hover:border-primary/50 hover:shadow-xl transition-all relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -z-10" />
              <div className="text-5xl font-bold text-primary mb-2">2-4 Weeks</div>
              <h3 className="text-xl font-bold text-foreground mb-3">Faster Payment</h3>
              <p className="text-muted-foreground mb-6">
                Instant invoice generation on POD capture. BOL auto-populated. No manual work. 
                <strong> $200K-$500K/year in improved cash flow</strong> for average fleet.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground text-left">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Invoice generated automatically on POD</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>BOL auto-populated (zero manual entry)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Customer notified same day</span>
                </li>
              </ul>
            </Card>

            <Card className="bg-card border-border p-8 text-center hover:border-primary/50 hover:shadow-xl transition-all relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -z-10" />
              <div className="text-5xl font-bold text-primary mb-2">60-80 Hrs</div>
              <h3 className="text-xl font-bold text-foreground mb-3">Saved Per Month</h3>
              <p className="text-muted-foreground mb-6">
                Complete automation eliminates manual work: IFTA (8-12 days/year → 20 min), 
                settlements (8-12 hrs/week → 5 min), BOL creation, invoicing, and more.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground text-left">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>IFTA: 2-3 days → 5 minutes per quarter</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Settlements: 8-12 hrs → 5 minutes per week</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>BOL: 15-20 min → 2-3 min per load</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Getting Started</Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">How It Works</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Get started in minutes and see results immediately
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              { num: "1", title: "Sign Up & Setup", desc: "Create your account and complete the quick setup wizard. Add your company information, vehicles, and drivers in minutes." },
              { num: "2", title: "Connect Your Fleet", desc: "Integrate GPS tracking devices and ELD systems. Connect via APIs or use our mobile ELD app. Everything syncs automatically." },
              { num: "3", title: "Manage Operations", desc: "Start managing routes, loads, drivers, and schedules from the unified dashboard. Get real-time visibility and automate workflows." },
              { num: "4", title: "Analyze & Optimize", desc: "Use analytics and reports to identify opportunities, reduce costs, improve efficiency, and grow your business with data-driven insights." }
            ].map((step, i) => (
              <div key={i} className="text-center relative">
                <div className="w-20 h-20 bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-primary/20">
                  <span className="text-3xl font-bold text-primary">{step.num}</span>
                </div>
                {i < 3 && (
                  <div className="hidden md:block absolute top-10 left-full w-full h-0.5 bg-gradient-to-r from-primary/20 to-transparent" style={{ width: 'calc(100% - 5rem)', marginLeft: '2.5rem' }} />
                )}
                <h3 className="text-xl font-bold text-foreground mb-3">{step.title}</h3>
                <p className="text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Award className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Trusted by Logistics Companies</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Ready to Transform Your Fleet Operations?
          </h2>
          <p className="text-xl text-muted-foreground mb-10 leading-relaxed">
            Join logistics companies that have streamlined their operations, reduced costs, and 
            improved compliance with TruckMates. Get started today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground text-lg px-8 py-6 shadow-lg shadow-primary/25">
                Get Started Free <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="/demo">
              <Button size="lg" variant="outline" className="w-full sm:w-auto border-2 border-primary text-primary hover:bg-primary/10 text-lg px-8 py-6">
                <Play className="mr-2 w-5 h-5" />
                Try Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-4 sm:px-6 lg:px-8 bg-secondary/30">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <Logo size="sm" />
              <p className="text-sm text-muted-foreground mt-4">
                Complete fleet management platform for modern logistics companies.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/marketplace" className="hover:text-primary transition">Marketplace</Link></li>
                <li><Link href="/demo" className="hover:text-primary transition">Demo</Link></li>
                <li><Link href="/register" className="hover:text-primary transition">Sign Up</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Features</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/features" className="hover:text-primary transition">All Features</Link></li>
                <li><Link href="/features/eld" className="hover:text-primary transition">ELD Compliance</Link></li>
                <li><Link href="/features/routing" className="hover:text-primary transition">Route Optimization</Link></li>
                <li><Link href="/features/accounting" className="hover:text-primary transition">Accounting</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/about" className="hover:text-primary transition">About</Link></li>
                <li><Link href="/partners" className="hover:text-primary transition">Partners</Link></li>
                <li><Link href="/security" className="hover:text-primary transition">Security</Link></li>
                <li><Link href="/compliance" className="hover:text-primary transition">Compliance</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-8 flex flex-col sm:flex-row items-center justify-between">
            <p className="text-sm text-muted-foreground">© 2025 TruckMates. All rights reserved.</p>
            <div className="flex gap-6 mt-4 sm:mt-0">
              <Link href="/privacy" className="text-sm text-muted-foreground hover:text-primary transition">Privacy</Link>
              <Link href="/terms" className="text-sm text-muted-foreground hover:text-primary transition">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
