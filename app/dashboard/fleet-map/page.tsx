"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, MapPin, Truck, User, Navigation } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { FleetMap } from "@/components/fleet-map"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function FleetMapPage() {
  const [vehicles, setVehicles] = useState<any[]>([])
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [mapCenter, setMapCenter] = useState<[number, number]>([37.7749, -122.4194]) // Default: San Francisco
  const [zoom, setZoom] = useState(6)

  useEffect(() => {
    loadFleetData()
    // Refresh every 30 seconds for GPS location updates only
    // Note: Fuel level, mileage, and other static data are NOT updated here
    // They only update when manually edited or via ELD integration
    const interval = setInterval(loadFleetData, 30000)
    return () => clearInterval(interval)
  }, [])

  async function loadFleetData() {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { data: userData } = await supabase
        .from("users")
        .select("company_id")
        .eq("id", user.id)
        .single()

      if (!userData?.company_id) return

      // Get trucks
      const { data: trucksData, error: trucksError } = await supabase
        .from("trucks")
        .select("*")
        .eq("company_id", userData.company_id)

      if (trucksError) {
        toast.error("Failed to load fleet data")
        return
      }

      // Get latest locations for each truck from ELD locations
      const truckIds = trucksData?.map((t) => t.id) || []
      if (truckIds.length > 0) {
        const { data: locationsData } = await supabase
          .from("eld_locations")
          .select("truck_id, latitude, longitude, timestamp, speed, heading")
          .in("truck_id", truckIds)
          .order("timestamp", { ascending: false })

        // Get the latest location for each truck
        const latestLocations: Record<string, any> = {}
        locationsData?.forEach((loc) => {
          if (!latestLocations[loc.truck_id] || new Date(loc.timestamp) > new Date(latestLocations[loc.truck_id].timestamp)) {
            latestLocations[loc.truck_id] = loc
          }
        })

        // Combine truck data with locations
        const vehiclesWithLocations = trucksData?.map((truck) => ({
          ...truck,
          location: latestLocations[truck.id] || null,
          driver: Array.isArray(truck.drivers) ? truck.drivers[0] : truck.drivers,
        })) || []

        setVehicles(vehiclesWithLocations)

        // Set map center to first vehicle location if available
        const firstLocation = vehiclesWithLocations.find((v) => v.location)
        if (firstLocation?.location) {
          setMapCenter([Number(firstLocation.location.latitude), Number(firstLocation.location.longitude)])
        }
      } else {
        // Get drivers for trucks without locations
        const truckDriverIds = trucksData?.filter(t => t.driver_id).map(t => t.driver_id) || []
        let driversMap: Record<string, any> = {}
        
        if (truckDriverIds.length > 0) {
          const { data: driversData } = await supabase
            .from("drivers")
            .select("id, name, status")
            .in("id", truckDriverIds)
          
          if (driversData) {
            driversMap = driversData.reduce((acc, driver) => {
              acc[driver.id] = driver
              return acc
            }, {} as Record<string, any>)
          }
        }

        setVehicles(trucksData?.map((truck) => ({
          ...truck,
          location: null,
          driver: truck.driver_id ? driversMap[truck.driver_id] : null,
        })) || [])
      }
    } catch (error) {
      toast.error("Failed to load fleet data")
    } finally {
      setIsLoading(false)
    }
  }

  const vehiclesWithLocation = vehicles.filter((v) => v.location)
  const vehiclesWithoutLocation = vehicles.filter((v) => !v.location)

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Fleet Map</h1>
            <p className="text-muted-foreground text-sm mt-1">Real-time vehicle tracking</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
            {vehiclesWithLocation.length} Active
          </Badge>
          <Badge variant="outline">
            {vehicles.length} Total
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-8">
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Sidebar - Vehicle List */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="border-border p-4">
              <h3 className="font-semibold text-foreground mb-4">Fleet Vehicles</h3>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : vehicles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No vehicles found</p>
                ) : (
                  <>
                    {vehiclesWithLocation.map((vehicle) => (
                      <Card
                        key={vehicle.id}
                        className={`border-border p-3 cursor-pointer transition ${
                          selectedVehicle === vehicle.id
                            ? "border-primary bg-primary/5"
                            : "hover:bg-secondary/50"
                        }`}
                        onClick={() => {
                          setSelectedVehicle(vehicle.id)
                          if (vehicle.location) {
                            setMapCenter([
                              Number(vehicle.location.latitude),
                              Number(vehicle.location.longitude),
                            ])
                            setZoom(12)
                          }
                        }}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Truck className="w-4 h-4 text-primary" />
                            <span className="font-medium text-foreground">{vehicle.truck_number}</span>
                          </div>
                          <Badge
                            className={
                              vehicle.status === "in_use" || vehicle.status === "in-use"
                                ? "bg-green-500/20 text-green-400"
                                : vehicle.status === "maintenance"
                                  ? "bg-yellow-500/20 text-yellow-400"
                                  : "bg-gray-500/20 text-gray-400"
                            }
                          >
                            {vehicle.status || "available"}
                          </Badge>
                        </div>
                        {vehicle.driver && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <User className="w-3 h-3" />
                            <span>{vehicle.driver.name}</span>
                          </div>
                        )}
                        {vehicle.location && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <MapPin className="w-3 h-3" />
                            <span>
                              {vehicle.location.speed ? `${vehicle.location.speed} mph` : "Stopped"}
                            </span>
                            <span>•</span>
                            <span>
                              {new Date(vehicle.location.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                        )}
                      </Card>
                    ))}
                    {vehiclesWithoutLocation.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs text-muted-foreground mb-2 font-semibold">
                          No Location Data
                        </p>
                        {vehiclesWithoutLocation.map((vehicle) => (
                          <Card
                            key={vehicle.id}
                            className="border-border/50 p-3 opacity-60"
                          >
                            <div className="flex items-center gap-2">
                              <Truck className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium text-foreground">{vehicle.truck_number}</span>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </Card>
          </div>

          {/* Map Area */}
          <div className="lg:col-span-3">
            <Card className="border-border p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">Live Map View</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    loadFleetData()
                    toast.success("Map refreshed")
                  }}
                >
                  <Navigation className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>
              <div className="h-[600px] bg-secondary/20 rounded-lg border border-border overflow-hidden">
                {vehiclesWithLocation.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <MapPin className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground mb-2">No vehicles with location data</p>
                      <p className="text-sm text-muted-foreground">
                        Vehicles will appear here when they have active ELD devices
                      </p>
                    </div>
                  </div>
                ) : (
                  <FleetMap
                    vehicles={vehiclesWithLocation}
                    selectedVehicle={selectedVehicle}
                    onVehicleClick={(vehicleId) => {
                      setSelectedVehicle(vehicleId)
                      const vehicle = vehiclesWithLocation.find((v) => v.id === vehicleId)
                      if (vehicle?.location) {
                        setMapCenter([
                          Number(vehicle.location.latitude),
                          Number(vehicle.location.longitude),
                        ])
                        setZoom(15)
                      }
                    }}
                    center={mapCenter}
                    zoom={zoom}
                  />
                )}
              </div>

              {vehiclesWithLocation.length > 0 && (
                <div className="mt-4 p-4 bg-secondary/30 rounded-lg border border-border">
                  <p className="text-sm font-semibold text-foreground mb-2">Map Info</p>
                  <p className="text-xs text-muted-foreground">
                    Showing {vehiclesWithLocation.length} vehicle{vehiclesWithLocation.length !== 1 ? "s" : ""} with GPS tracking.
                    {!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
                      <span className="block mt-1 text-amber-400">
                        ⚠️ To enable the map, add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your .env.local file
                      </span>
                    )}
                  </p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

