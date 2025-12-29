"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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
  Cloud
} from "lucide-react"
import Link from "next/link"
import { Logo } from "@/components/logo"

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Logo size="sm" />
          <div className="flex items-center gap-4">
            <Link href="/plans">
              <Button variant="ghost" className="hidden sm:flex">Pricing</Button>
            </Link>
            <Link href="/login">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">Login</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 leading-tight">
              Complete Fleet Management
              <span className="block text-primary mt-2">All in One Platform</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-4 max-w-3xl mx-auto leading-relaxed">
              TruckMates is the ultimate logistics management platform that combines fleet tracking, 
              ELD compliance, route optimization, accounting, and driver management into a single, 
              powerful solution.
            </p>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Designed for modern logistics companies, TruckMates helps you streamline operations, 
              reduce costs, ensure compliance, and grow your business with intelligent automation 
              and real-time insights.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register">
                <Button size="lg" className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground text-lg px-8">
                  Start Free Trial <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link href="/demo">
                <Button size="lg" variant="outline" className="w-full sm:w-auto border-2 border-primary text-primary hover:bg-primary/10 text-lg px-8">
                  View Demo
                </Button>
              </Link>
            </div>
            <p className="text-sm text-muted-foreground mt-4">7-day free trial • No credit card required • Cancel anytime</p>
          </div>
        </div>
      </section>

      {/* What is TruckMates Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-secondary/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">What is TruckMates?</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              A comprehensive cloud-based platform that revolutionizes how logistics companies manage their operations
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-bold text-foreground mb-3">Complete Operations Management</h3>
                <p className="text-muted-foreground leading-relaxed">
                  TruckMates provides everything you need to run a modern logistics operation. From vehicle 
                  tracking and driver management to route planning, load coordination, accounting, and compliance 
                  reporting - all integrated into one intuitive platform.
                </p>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-foreground mb-3">ELD Integration & Compliance</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Full Electronic Logging Device (ELD) integration ensures your fleet stays compliant with 
                  DOT regulations. Automatic Hours of Service (HOS) tracking, violation detection, and seamless 
                  IFTA reporting help you avoid costly fines and keep your drivers safe.
                </p>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-foreground mb-3">Real-Time Visibility</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Get instant visibility into every aspect of your operation. Track vehicles in real-time, 
                  monitor driver status, view route progress, manage loads, and access comprehensive analytics 
                  - all from a single dashboard.
                </p>
              </div>
            </div>
            <div className="hidden md:flex justify-center">
              <div className="w-full h-96 bg-gradient-to-br from-primary/20 to-transparent rounded-2xl border border-primary/30 flex items-center justify-center">
                <Logo size="lg" showText={false} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features - Detailed */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Powerful Features</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Everything you need to manage your fleet efficiently and profitably
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Fleet Tracking */}
            <Card className="bg-card border-border p-6 hover:border-primary/50 transition-colors">
              <MapPin className="w-12 h-12 text-primary mb-4" />
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

            {/* ELD & Compliance */}
            <Card className="bg-card border-border p-6 hover:border-primary/50 transition-colors">
              <Clock className="w-12 h-12 text-primary mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-3">ELD & HOS Compliance</h3>
              <p className="text-muted-foreground mb-4">
                Complete Electronic Logging Device integration with automatic Hours of Service 
                tracking, violation detection, and DOT compliance reporting.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Automatic HOS log generation</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Real-time violation alerts</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>IFTA reporting with ELD data</span>
                </li>
              </ul>
            </Card>

            {/* Driver Management */}
            <Card className="bg-card border-border p-6 hover:border-primary/50 transition-colors">
              <Users className="w-12 h-12 text-primary mb-4" />
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
            <Card className="bg-card border-border p-6 hover:border-primary/50 transition-colors">
              <Route className="w-12 h-12 text-primary mb-4" />
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

            {/* Load Management */}
            <Card className="bg-card border-border p-6 hover:border-primary/50 transition-colors">
              <Truck className="w-12 h-12 text-primary mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-3">Load & Delivery Management</h3>
              <p className="text-muted-foreground mb-4">
                Full lifecycle load management from creation to delivery. Track loads, manage 
                multi-delivery routes, update statuses, and coordinate with customers seamlessly.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>End-to-end load tracking</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Multi-delivery point support</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Status updates and notifications</span>
                </li>
              </ul>
            </Card>

            {/* Analytics & Reports */}
            <Card className="bg-card border-border p-6 hover:border-primary/50 transition-colors">
              <BarChart3 className="w-12 h-12 text-primary mb-4" />
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

            {/* Accounting & Finance */}
            <Card className="bg-card border-border p-6 hover:border-primary/50 transition-colors">
              <DollarSign className="w-12 h-12 text-primary mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-3">Accounting & Finance</h3>
              <p className="text-muted-foreground mb-4">
                Complete financial management including invoicing, expense tracking, settlements, 
                driver payments, and profit/loss analysis.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Automated invoice generation</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Expense and settlement tracking</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Driver payment calculations</span>
                </li>
              </ul>
            </Card>

            {/* Maintenance Management */}
            <Card className="bg-card border-border p-6 hover:border-primary/50 transition-colors">
              <Gauge className="w-12 h-12 text-primary mb-4" />
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
            <Card className="bg-card border-border p-6 hover:border-primary/50 transition-colors">
              <Shield className="w-12 h-12 text-primary mb-4" />
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

      {/* How It Works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-secondary/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">How It Works</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Get started in minutes and see results immediately
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">1</span>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">Sign Up & Setup</h3>
              <p className="text-muted-foreground">
                Create your account and complete the quick setup wizard. Add your company information, 
                vehicles, and drivers in minutes.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">2</span>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">Connect Your Fleet</h3>
              <p className="text-muted-foreground">
                Integrate GPS tracking devices and ELD systems. Connect via APIs or use our mobile 
                ELD app. Everything syncs automatically.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">3</span>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">Manage Operations</h3>
              <p className="text-muted-foreground">
                Start managing routes, loads, drivers, and schedules from the unified dashboard. 
                Get real-time visibility and automate workflows.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">4</span>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">Analyze & Optimize</h3>
              <p className="text-muted-foreground">
                Use analytics and reports to identify opportunities, reduce costs, improve efficiency, 
                and grow your business with data-driven insights.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Technology & Integrations */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Modern Technology</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Built with the latest technology for reliability, speed, and scalability
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="bg-card border-border p-6 text-center">
              <Cloud className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-3">Cloud-Based Platform</h3>
              <p className="text-muted-foreground">
                Access your fleet data from anywhere, anytime. No hardware installation required. 
                Automatic updates and backups keep your data safe and secure.
              </p>
            </Card>

            <Card className="bg-card border-border p-6 text-center">
              <Smartphone className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-3">Mobile-First Design</h3>
              <p className="text-muted-foreground">
                Responsive web interface works perfectly on desktop, tablet, and mobile devices. 
                Plus, our dedicated mobile ELD app for drivers keeps them connected on the road.
              </p>
            </Card>

            <Card className="bg-card border-border p-6 text-center">
              <Database className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-3">Seamless Integrations</h3>
              <p className="text-muted-foreground">
                Connect with ELD providers, GPS devices, accounting software, and more through 
                our robust API. Easy data import/export keeps your workflow smooth.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-secondary/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Why Choose TruckMates?</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              The benefits that help you run a more efficient and profitable operation
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: TrendingUp,
                title: "Reduce Operating Costs",
                desc: "Optimize routes, reduce fuel consumption, minimize idle time, and improve fleet utilization to significantly lower your operating expenses."
              },
              {
                icon: Shield,
                title: "Stay Compliant",
                desc: "Automatic HOS tracking, violation alerts, and compliance reporting help you avoid costly DOT fines and keep your fleet legal."
              },
              {
                icon: Zap,
                title: "Save Time",
                desc: "Automate manual tasks, streamline workflows, and eliminate paperwork. Focus on growing your business instead of managing spreadsheets."
              },
              {
                icon: BarChart3,
                title: "Make Better Decisions",
                desc: "Access real-time data and comprehensive analytics to identify opportunities, spot problems early, and make informed business decisions."
              },
              {
                icon: Users,
                title: "Improve Driver Satisfaction",
                desc: "Better scheduling, clear communication, fair payment tracking, and support tools help you attract and retain quality drivers."
              },
              {
                icon: CheckCircle2,
                title: "Scale Your Business",
                desc: "As your fleet grows, TruckMates grows with you. Add vehicles, drivers, and routes without worrying about system limitations."
              }
            ].map((benefit, i) => (
              <Card key={i} className="bg-card border-border p-6">
                <benefit.icon className="w-10 h-10 text-primary mb-4" />
                <h3 className="text-xl font-bold text-foreground mb-3">{benefit.title}</h3>
                <p className="text-muted-foreground">{benefit.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Ready to Transform Your Fleet Operations?
          </h2>
          <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
            Join logistics companies that have streamlined their operations, reduced costs, and 
            improved compliance with TruckMates. Start your free trial today - no credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground text-lg px-8">
                Start Free Trial <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="/plans">
              <Button size="lg" variant="outline" className="w-full sm:w-auto border-2 border-primary text-primary hover:bg-primary/10 text-lg px-8">
                View Pricing
              </Button>
            </Link>
          </div>
          <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground flex-wrap">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span>7-day free trial</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span>Cancel anytime</span>
            </div>
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
                <li><Link href="/plans" className="hover:text-primary">Pricing</Link></li>
                <li><Link href="/demo" className="hover:text-primary">Demo</Link></li>
                <li><Link href="/register" className="hover:text-primary">Sign Up</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Features</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Fleet Tracking</li>
                <li>ELD Integration</li>
                <li>Route Optimization</li>
                <li>Analytics & Reports</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/login" className="hover:text-primary">Login</Link></li>
                <li>Support</li>
                <li>Documentation</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-8 flex flex-col sm:flex-row items-center justify-between">
            <p className="text-sm text-muted-foreground">© 2025 TruckMates. All rights reserved.</p>
            <div className="flex gap-6 mt-4 sm:mt-0">
              <Link href="/privacy" className="text-sm text-muted-foreground hover:text-primary">Privacy</Link>
              <Link href="/terms" className="text-sm text-muted-foreground hover:text-primary">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
