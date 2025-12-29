"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, Phone, Mail, Truck, Calendar, Edit2 } from "lucide-react"
import Link from "next/link"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { use } from "react"

export default function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)

  useEffect(() => {
    if (id === "add") {
      router.replace("/dashboard/drivers/add")
    }
  }, [id, router])

  if (id === "add") {
    return null
  }

  const driver = {
    id: id,
    name: "John Smith",
    email: "john@company.com",
    phone: "+1 (555) 0101",
    license: "DL12345678",
    truck: "TR-001",
    status: "On Route",
    joinDate: "Jan 15, 2024",
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/drivers">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Driver Details</h1>
        </div>
        {/* Edit Button */}
        <Link href={`/dashboard/drivers/${id}/edit`}>
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Edit2 className="w-4 h-4 mr-2" />
            Edit Driver
          </Button>
        </Link>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Basic Info */}
          <Card className="border-border p-8">
            <h2 className="text-xl font-bold text-foreground mb-6">Profile Information</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Full Name</p>
                <p className="text-lg text-foreground font-medium">{driver.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Status</p>
                <p className="text-lg text-foreground font-medium">
                  <span className="px-3 py-1 rounded-full text-sm bg-green-400/20 text-green-400">{driver.status}</span>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Email</p>
                  <p className="text-foreground">{driver.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Phone</p>
                  <p className="text-foreground">{driver.phone}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Vehicle Info */}
          <Card className="border-border p-8">
            <div className="flex items-center gap-3 mb-6">
              <Truck className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Vehicle Assignment</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-2">Assigned Truck</p>
            <p className="text-2xl text-foreground font-bold">{driver.truck}</p>
          </Card>

          {/* Schedule */}
          <Card className="border-border p-8">
            <div className="flex items-center gap-3 mb-6">
              <Calendar className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Schedule</h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <span className="text-foreground">Monday - Friday</span>
                <span className="text-muted-foreground">08:00 - 17:00</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <span className="text-foreground">Saturday</span>
                <span className="text-muted-foreground">Off</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <span className="text-foreground">Sunday</span>
                <span className="text-muted-foreground">Off</span>
              </div>
            </div>
          </Card>

          {/* License Info */}
          <Card className="border-border p-8">
            <h2 className="text-xl font-bold text-foreground mb-6">License Information</h2>
            <div>
              <p className="text-sm text-muted-foreground mb-2">License Number</p>
              <p className="text-lg text-foreground font-mono font-medium">{driver.license}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-4">License expires: Dec 31, 2026</p>
          </Card>
        </div>
      </main>
    </div>
  )
}
