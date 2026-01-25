"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Users, Truck, BarChart3, Radio, MapPin, Contact, Building2, DollarSign, Wrench, FileCheck, Shield, Receipt, FolderOpen, Bell, Calendar, FileText, Upload, UserCog, Store, Settings } from "lucide-react"
import Link from "next/link"
import { Logo } from "@/components/logo"

const ALL_FEATURES = [
  { name: "Dashboard", href: "/dashboard", icon: BarChart3, description: "Overview of your fleet operations" },
  { name: "Drivers", href: "/dashboard/drivers", icon: Users, description: "Manage driver profiles and assignments" },
  { name: "Vehicles", href: "/dashboard/trucks", icon: Truck, description: "Fleet vehicle management and tracking" },
  { name: "Routes", href: "/dashboard/routes", icon: BarChart3, description: "Route planning and optimization" },
  { name: "Loads", href: "/dashboard/loads", icon: Truck, description: "Load management and tracking" },
  { name: "Dispatch Board", href: "/dashboard/dispatches", icon: Radio, description: "Real-time dispatch operations" },
  { name: "Fleet Map & Zones", href: "/dashboard/fleet-map", icon: MapPin, description: "Geographic fleet visualization" },
  { name: "Address Book", href: "/dashboard/address-book", icon: Contact, description: "Customer and vendor addresses" },
  { name: "CRM", href: "/dashboard/customers", icon: Building2, description: "Customer relationship management" },
  { name: "Accounting", href: "/dashboard/accounting/invoices", icon: DollarSign, description: "Financial management and invoicing" },
  { name: "Maintenance", href: "/dashboard/maintenance", icon: Wrench, description: "Vehicle maintenance scheduling" },
  { name: "DVIR Reports", href: "/dashboard/dvir", icon: FileCheck, description: "Driver vehicle inspection reports" },
  { name: "ELD Service", href: "/dashboard/eld", icon: Shield, description: "Electronic logging device management" },
  { name: "IFTA Reports", href: "/dashboard/ifta", icon: Receipt, description: "Fuel tax reporting" },
  { name: "Reports", href: "/dashboard/reports/analytics", icon: BarChart3, description: "Analytics and business intelligence" },
  { name: "Documents", href: "/dashboard/documents", icon: FolderOpen, description: "Document management" },
  { name: "Alerts", href: "/dashboard/alerts", icon: Bell, description: "System alerts and notifications" },
  { name: "Reminders", href: "/dashboard/reminders", icon: Calendar, description: "Task and deadline reminders" },
  { name: "Bill of Lading", href: "/dashboard/bols", icon: FileText, description: "BOL document management" },
  { name: "Employees", href: "/dashboard/employees", icon: UserCog, description: "Employee management" },
  { name: "Marketplace", href: "/dashboard/marketplace", icon: Store, description: "Load marketplace" },
  { name: "Settings", href: "/dashboard/settings", icon: Settings, description: "Platform configuration" },
]

export default function AllFeaturesPage() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link href="/dashboard">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-foreground mb-2">All Platform Features</h1>
          <p className="text-muted-foreground">
            Explore all available features in TruckMates. Your role determines which features you can access.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {ALL_FEATURES.map((feature) => {
            const Icon = feature.icon
            return (
              <Link key={feature.href} href={feature.href}>
                <Card className="p-6 hover:border-primary hover:bg-primary/5 transition cursor-pointer h-full">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-foreground mb-1">{feature.name}</h3>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </div>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

