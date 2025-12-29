"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, Fuel, Wrench, User, Edit2 } from "lucide-react"
import Link from "next/link"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { use } from "react"

export default function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)

  useEffect(() => {
    if (id === "add") {
      router.replace("/dashboard/trucks/add")
    }
  }, [id, router])

  if (id === "add") {
    return null
  }

  const truck = {
    id: id,
    plate: "TR-001",
    model: "Volvo FH16",
    year: 2021,
    driver: "John Smith",
    location: "NY-PA Route",
    fuel: "75%",
    status: "Active",
    mileage: "245000 km",
    lastMaintenance: "2024-11-15",
    capacity: "25 tons",
    licenseExpiry: "2025-06-30",
    insuranceExpiry: "2025-08-15",
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="border-b border-border bg-card/50 backdrop-blur px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/trucks">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Vehicle Details</h1>
        </div>
        <Link href={`/dashboard/trucks/${id}/edit`}>
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Edit2 className="w-4 h-4 mr-2" />
            Edit Vehicle
          </Button>
        </Link>
      </div>

      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <Card className="border-border p-8">
            <h2 className="text-xl font-bold text-foreground mb-6">Basic Information</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Plate Number</p>
                <p className="text-lg text-foreground font-bold">{truck.plate}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Model</p>
                <p className="text-lg text-foreground font-medium">{truck.model}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Year</p>
                <p className="text-lg text-foreground font-medium">{truck.year}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Capacity</p>
                <p className="text-lg text-foreground font-medium">{truck.capacity}</p>
              </div>
            </div>
          </Card>

          <Card className="border-border p-8">
            <div className="flex items-center gap-3 mb-6">
              <User className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Driver Assignment</h2>
            </div>
            <p className="text-lg text-foreground font-medium">{truck.driver}</p>
            <p className="text-sm text-muted-foreground mt-2">Current Location: {truck.location}</p>
          </Card>

          <Card className="border-border p-8">
            <div className="flex items-center gap-3 mb-6">
              <Fuel className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Fuel & Mileage</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Fuel Level</p>
                <p className="text-2xl text-foreground font-bold">{truck.fuel}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Mileage</p>
                <p className="text-2xl text-foreground font-bold">{truck.mileage}</p>
              </div>
            </div>
          </Card>

          <Card className="border-border p-8">
            <div className="flex items-center gap-3 mb-6">
              <Wrench className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Maintenance & Expiry</h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <span className="text-foreground">Last Maintenance</span>
                <span className="text-muted-foreground">{truck.lastMaintenance}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <span className="text-foreground">License Expiry</span>
                <span className="text-muted-foreground">{truck.licenseExpiry}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <span className="text-foreground">Insurance Expiry</span>
                <span className="text-muted-foreground">{truck.insuranceExpiry}</span>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}
