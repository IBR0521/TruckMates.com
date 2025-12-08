"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, MapPin, Clock, User, Edit2 } from "lucide-react"
import Link from "next/link"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { use } from "react"

export default function RouteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)

  useEffect(() => {
    if (id === "add") {
      router.replace("/dashboard/routes/add")
    }
  }, [id, router])

  if (id === "add") {
    return null
  }

  const route = {
    id: id,
    name: "NY-PA Route",
    origin: "New York",
    destination: "Pennsylvania",
    distance: "180 mi",
    time: "3h 30m",
    priority: "High",
    driver: "John Smith",
    truck: "TR-001",
    status: "In Progress",
    waypoints: 5,
    estimatedArrival: "2024-12-07 18:00",
    currentLocation: "Trenton, NJ",
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="border-b border-border bg-card/50 backdrop-blur px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/routes">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Route Details</h1>
        </div>
        <Link href={`/dashboard/routes/${id}/edit`}>
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Edit2 className="w-4 h-4 mr-2" />
            Edit Route
          </Button>
        </Link>
      </div>

      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <Card className="border-border p-8">
            <div className="flex items-start justify-between mb-6">
              <h2 className="text-2xl font-bold text-foreground">{route.name}</h2>
              <span
                className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  route.priority === "High" ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400"
                }`}
              >
                {route.priority} Priority
              </span>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground font-medium">From</p>
                  <p className="text-foreground">{route.origin}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground font-medium">To</p>
                  <p className="text-foreground">{route.destination}</p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="border-border p-8">
            <h2 className="text-xl font-bold text-foreground mb-6">Trip Information</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Distance</p>
                <p className="text-lg text-foreground font-bold">{route.distance}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Estimated Time</p>
                <p className="text-lg text-foreground font-bold">{route.time}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Waypoints</p>
                <p className="text-lg text-foreground font-bold">{route.waypoints}</p>
              </div>
            </div>
          </Card>

          <Card className="border-border p-8">
            <div className="flex items-center gap-3 mb-6">
              <User className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Assignment</h2>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Driver</p>
                <p className="text-foreground font-medium">{route.driver}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Vehicle</p>
                <p className="text-foreground font-medium">{route.truck}</p>
              </div>
            </div>
          </Card>

          <Card className="border-border p-8">
            <div className="flex items-center gap-3 mb-6">
              <Clock className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Status</h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <span className="text-foreground">Current Status</span>
                <span className="px-3 py-1 rounded text-sm font-medium bg-green-400/20 text-green-400">
                  {route.status}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <span className="text-foreground">Current Location</span>
                <span className="text-muted-foreground">{route.currentLocation}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <span className="text-foreground">Est. Arrival</span>
                <span className="text-muted-foreground">{route.estimatedArrival}</span>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}
