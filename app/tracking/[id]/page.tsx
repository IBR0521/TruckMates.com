"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Package, MapPin, Calendar, Truck, CheckCircle, Clock, AlertCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { use } from "react"

export default function TrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [shipment, setShipment] = useState<any>(null)
  const [trackingId, setTrackingId] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>("")

  useEffect(() => {
    if (id && id !== "[id]") {
      setTrackingId(id)
      loadShipment(id)
    }
  }, [id])

  async function loadShipment(trackId: string) {
    setIsLoading(true)
    setError("")

    try {
      const supabase = createClient()

      // Search for shipment by tracking number or shipment number
      const { data: loads, error: loadsError } = await supabase
        .from("loads")
        .select("*")
        .or(`shipment_number.ilike.%${trackId}%,id.eq.${trackId}`)
        .limit(1)

      if (loadsError) {
        setError("Failed to load shipment information")
        setIsLoading(false)
        return
      }

      if (!loads || loads.length === 0) {
        setError("Shipment not found. Please check your tracking number.")
        setIsLoading(false)
        return
      }

      setShipment(loads[0])
    } catch (err: any) {
      setError(err.message || "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (trackingId) {
      loadShipment(trackingId)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "delivered":
        return <CheckCircle className="w-5 h-5 text-green-400" />
      case "in_transit":
        return <Truck className="w-5 h-5 text-blue-400" />
      case "scheduled":
        return <Clock className="w-5 h-5 text-yellow-400" />
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/50">Pending</Badge>
      case "scheduled":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50">Scheduled</Badge>
      case "in_transit":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50">In Transit</Badge>
      case "delivered":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/50">Delivered</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const getStatusTimeline = (status: string) => {
    const timeline = [
      { status: "pending", label: "Order Received", completed: true },
      { status: "scheduled", label: "Scheduled for Pickup", completed: status !== "pending" },
      { status: "in_transit", label: "In Transit", completed: status === "in_transit" || status === "delivered" },
      { status: "delivered", label: "Delivered", completed: status === "delivered" },
    ]

    return timeline
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Track Your Shipment</h1>
          <p className="text-muted-foreground">Enter your tracking number to view shipment status</p>
        </div>

        {/* Search Form */}
        <Card className="border-border p-6 mb-8">
          <form onSubmit={handleSearch} className="flex gap-4">
            <input
              type="text"
              value={trackingId}
              onChange={(e) => setTrackingId(e.target.value)}
              placeholder="Enter tracking number or shipment number"
              className="flex-1 px-4 py-2 bg-background border border-border rounded-md text-foreground"
            />
            <Button type="submit" disabled={isLoading} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {isLoading ? "Searching..." : "Track"}
            </Button>
          </form>
        </Card>

        {/* Error Message */}
        {error && (
          <Card className="border-red-500/50 bg-red-500/10 p-6 mb-8">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <p className="text-red-400">{error}</p>
            </div>
          </Card>
        )}

        {/* Shipment Details */}
        {shipment && !error && (
          <>
            {/* Status Overview */}
            <Card className="border-border p-6 mb-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  {getStatusIcon(shipment.status)}
                  <div>
                    <h2 className="text-xl font-bold text-foreground">Shipment #{shipment.shipment_number}</h2>
                    <p className="text-sm text-muted-foreground">Tracking Number</p>
                  </div>
                </div>
                {getStatusBadge(shipment.status)}
              </div>

              {/* Timeline */}
              <div className="space-y-4">
                <h3 className="font-semibold text-foreground mb-4">Shipment Timeline</h3>
                {getStatusTimeline(shipment.status).map((item, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      item.completed ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                    }`}>
                      {item.completed ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <div className="w-3 h-3 rounded-full bg-current" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`font-medium ${item.completed ? "text-foreground" : "text-muted-foreground"}`}>
                        {item.label}
                      </p>
                      {item.status === shipment.status && shipment.status !== "pending" && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Current status
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Shipment Details */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <Card className="border-border p-6">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground">Origin</h3>
                </div>
                <p className="text-foreground">{shipment.origin}</p>
                {shipment.load_date && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Pickup Date: {new Date(shipment.load_date).toLocaleDateString()}
                  </p>
                )}
              </Card>

              <Card className="border-border p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Package className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground">Destination</h3>
                </div>
                <p className="text-foreground">{shipment.destination}</p>
                {shipment.estimated_delivery && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Estimated Delivery: {new Date(shipment.estimated_delivery).toLocaleDateString()}
                  </p>
                )}
                {shipment.actual_delivery && (
                  <p className="text-sm text-green-400 mt-2">
                    Delivered: {new Date(shipment.actual_delivery).toLocaleDateString()}
                  </p>
                )}
              </Card>
            </div>

            {/* Additional Information */}
            <Card className="border-border p-6">
              <h3 className="font-semibold text-foreground mb-4">Shipment Details</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {shipment.contents && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Contents</p>
                    <p className="text-foreground">{shipment.contents}</p>
                  </div>
                )}
                {shipment.weight && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Weight</p>
                    <p className="text-foreground">{shipment.weight}</p>
                  </div>
                )}
                {shipment.carrier_type && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Carrier Type</p>
                    <p className="text-foreground capitalize">{shipment.carrier_type.replace("-", " ")}</p>
                  </div>
                )}
                {shipment.company_name && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Company</p>
                    <p className="text-foreground">{shipment.company_name}</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Contact Information */}
            <Card className="border-border p-6 mt-6">
              <h3 className="font-semibold text-foreground mb-4">Need Help?</h3>
              <p className="text-muted-foreground mb-4">
                If you have questions about your shipment or need assistance, please contact us.
              </p>
              <Button variant="outline">
                Contact Support
              </Button>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}

