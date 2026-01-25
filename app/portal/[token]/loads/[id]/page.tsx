"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Loader2, 
  Package, 
  MapPin, 
  Calendar, 
  Truck, 
  User, 
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  Download,
  Navigation
} from "lucide-react"
import { getCustomerPortalLoad } from "@/app/actions/customer-portal"
import { toast } from "sonner"
import Link from "next/link"

export default function CustomerPortalLoadPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string
  const loadId = params.id as string
  const [isLoading, setIsLoading] = useState(true)
  const [load, setLoad] = useState<any>(null)

  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      try {
        const result = await getCustomerPortalLoad(token, loadId)
        if (result.error || !result.data) {
          toast.error(result.error || "Load not found")
          router.push(`/portal/${token}`)
          return
        }
        setLoad(result.data)
      } catch (error: any) {
        toast.error("Failed to load load details")
        console.error(error)
      } finally {
        setIsLoading(false)
      }
    }

    if (token && loadId) {
      loadData()
    }
  }, [token, loadId, router])

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "delivered":
      case "completed":
        return "bg-green-500"
      case "in_transit":
      case "in_progress":
        return "bg-blue-500"
      case "pending":
        return "bg-yellow-500"
      case "cancelled":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  const formatDate = (date: string | null) => {
    if (!date) return "N/A"
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading load details...</p>
        </div>
      </div>
    )
  }

  if (!load) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="p-8 max-w-md w-full">
          <div className="text-center">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Load Not Found</h1>
            <p className="text-muted-foreground mb-4">The requested load could not be found.</p>
            <Link href={`/portal/${token}`}>
              <Button>Back to Portal</Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Link href={`/portal/${token}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Package className="w-6 h-6" />
                {load.shipment_number || "Load Details"}
              </h1>
              {load.contents && (
                <p className="text-sm text-muted-foreground mt-1">{load.contents}</p>
              )}
            </div>
            <Badge className={getStatusColor(load.status)}>
              {load.status?.replace("_", " ").toUpperCase() || "UNKNOWN"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Load Information */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Load Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-2">
                  <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Origin</p>
                    <p className="text-sm font-medium">{load.origin || "N/A"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Destination</p>
                    <p className="text-sm font-medium">{load.destination || "N/A"}</p>
                  </div>
                </div>
                {load.load_date && (
                  <div className="flex items-start gap-2">
                    <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Pickup Date</p>
                      <p className="text-sm font-medium">{formatDate(load.load_date)}</p>
                    </div>
                  </div>
                )}
                {load.estimated_delivery && (
                  <div className="flex items-start gap-2">
                    <Clock className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Est. Delivery</p>
                      <p className="text-sm font-medium">{formatDate(load.estimated_delivery)}</p>
                    </div>
                  </div>
                )}
                {load.weight && (
                  <div className="flex items-start gap-2">
                    <Package className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Weight</p>
                      <p className="text-sm font-medium">{load.weight} lbs</p>
                    </div>
                  </div>
                )}
                {load.rate && (
                  <div className="flex items-start gap-2">
                    <FileText className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Rate</p>
                      <p className="text-sm font-medium">${parseFloat(load.rate || 0).toFixed(2)}</p>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Driver & Truck Information */}
            {(load.driver || load.truck) && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">Driver & Vehicle</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {load.driver && (
                    <div className="flex items-start gap-2">
                      <User className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Driver</p>
                        <p className="text-sm font-medium">{load.driver.name || "N/A"}</p>
                        {load.driver.phone && (
                          <p className="text-xs text-muted-foreground">{load.driver.phone}</p>
                        )}
                      </div>
                    </div>
                  )}
                  {load.truck && (
                    <div className="flex items-start gap-2">
                      <Truck className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Truck</p>
                        <p className="text-sm font-medium">
                          {load.truck.truck_number || "N/A"}
                        </p>
                        {load.truck.make && load.truck.model && (
                          <p className="text-xs text-muted-foreground">
                            {load.truck.make} {load.truck.model}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Real-time Location */}
            {load.driver_location && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Navigation className="w-5 h-5" />
                  Current Location
                </h2>
                <div className="space-y-2">
                  {load.driver_location.address && (
                    <p className="text-sm font-medium">{load.driver_location.address}</p>
                  )}
                  {load.driver_location.timestamp && (
                    <p className="text-xs text-muted-foreground">
                      Last updated: {formatDate(load.driver_location.timestamp)}
                    </p>
                  )}
                  {load.driver_location.latitude && load.driver_location.longitude && (
                    <a
                      href={`https://www.google.com/maps?q=${load.driver_location.latitude},${load.driver_location.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      View on Google Maps
                    </a>
                  )}
                </div>
              </Card>
            )}

            {/* Route Information */}
            {load.route && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">Route Information</h2>
                <div className="space-y-2">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Route:</span>{" "}
                    <span className="font-medium">{load.route.name || "N/A"}</span>
                  </p>
                  {load.route.status && (
                    <Badge variant="outline">{load.route.status}</Badge>
                  )}
                </div>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status Card */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Status</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Current Status</span>
                  <Badge className={getStatusColor(load.status)}>
                    {load.status?.replace("_", " ").toUpperCase() || "UNKNOWN"}
                  </Badge>
                </div>
                {load.delivery_date && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Delivered</span>
                    <span className="text-sm font-medium">{formatDate(load.delivery_date)}</span>
                  </div>
                )}
              </div>
            </Card>

            {/* Quick Actions */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start" asChild>
                  <a href={`/portal/${token}/loads/${loadId}/documents`}>
                    <FileText className="w-4 h-4 mr-2" />
                    View Documents
                  </a>
                </Button>
                {load.driver_location && (
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <a
                      href={`https://www.google.com/maps?q=${load.driver_location.latitude},${load.driver_location.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Navigation className="w-4 h-4 mr-2" />
                      Track on Map
                    </a>
                  </Button>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}






