"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, MapPin, Clock, User, Edit2, Package, Truck as TruckIcon, Building2 } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { use } from "react"
import { getRoute } from "@/app/actions/routes"
import { getRouteStops, getRouteSummary } from "@/app/actions/route-stops"
import { TruckMap } from "@/components/truck-map"
import { getDrivers } from "@/app/actions/drivers"
import { getTrucks } from "@/app/actions/trucks"

export default function RouteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)
  const [route, setRoute] = useState<any>(null)
  const [stops, setStops] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [driver, setDriver] = useState<any>(null)
  const [truck, setTruck] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (id === "add") {
      router.replace("/dashboard/routes/add")
      return
    }

    async function loadData() {
      setIsLoading(true)
      try {
        const [routeResult, stopsResult, summaryResult] = await Promise.all([
          getRoute(id),
          getRouteStops(id),
          getRouteSummary(id),
        ])

        if (routeResult.data) {
          setRoute(routeResult.data)

          // Load driver and truck details
          if (routeResult.data.driver_id) {
            const driversResult = await getDrivers()
            const foundDriver = driversResult.data?.find((d: any) => d.id === routeResult.data.driver_id)
            setDriver(foundDriver)
          }

          if (routeResult.data.truck_id) {
            const trucksResult = await getTrucks()
            const foundTruck = trucksResult.data?.find((t: any) => t.id === routeResult.data.truck_id)
            setTruck(foundTruck)
          }
        }

        if (stopsResult.data) {
          setStops(stopsResult.data)
        }

        if (summaryResult.data) {
          setSummary(summaryResult.data)
        }
      } catch (error) {
        console.error("Error loading route data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [id])

  if (id === "add") {
    return null
  }

  if (isLoading) {
    return (
      <div className="w-full">
        <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4">
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Route Details</h1>
        </div>
        <div className="p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            <Card className="p-4 md:p-8 text-center">
              <p className="text-muted-foreground">Loading route details...</p>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  if (!route) {
    return (
      <div className="w-full">
        <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4">
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Route Details</h1>
        </div>
        <div className="p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            <Card className="p-4 md:p-8 text-center">
              <p className="text-muted-foreground">Route not found</p>
              <Link href="/dashboard/routes">
                <Button className="mt-4">Back to Routes</Button>
              </Link>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  // Format time window
  const formatTimeWindow = (open: string | null, close: string | null) => {
    if (!open || !close) return "N/A"
    return `${open} - ${close}`
  }

  // Format duration
  const formatDuration = (minutes: number | null) => {
    if (!minutes) return "N/A"
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  }

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/routes">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Route Details</h1>
        </div>
        {id && typeof id === 'string' && id.trim() !== '' ? (
          <Link href={`/dashboard/routes/${id}/edit`}>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Edit2 className="w-4 h-4 mr-2" />
              Edit Route
            </Button>
          </Link>
        ) : null}
      </div>

      <div className="p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Route Header */}
          <Card className="border-border p-4 md:p-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-foreground">{route.name}</h2>
                {route.depot_name && (
                  <p className="text-sm text-muted-foreground mt-1">
                    <Building2 className="w-4 h-4 inline mr-1" />
                    Depot: {route.depot_name}
                  </p>
                )}
              </div>
              <span
                className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  route.priority === "high" ? "bg-red-500/20 text-red-400" : 
                  route.priority === "low" ? "bg-gray-500/20 text-gray-400" : 
                  "bg-blue-500/20 text-blue-400"
                }`}
              >
                {route.priority?.charAt(0).toUpperCase() + route.priority?.slice(1) || "Normal"} Priority
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

          {/* Route Map with Multi-Stops */}
          {route.origin && route.destination && (
            <Card className="border-border p-4 md:p-8">
              <h2 className="text-xl font-bold text-foreground mb-6">Route Map</h2>
              <TruckMap
                origin={route.origin}
                destination={route.destination}
                weight={0}
                truckHeight={4.0}
                stops={stops.map((stop) => ({
                  location_name: stop.location_name,
                  address: stop.address,
                  stop_number: stop.stop_number,
                  coordinates: stop.coordinates as { lat: number; lng: number } | undefined,
                  stop_type: stop.stop_type,
                }))}
              />
            </Card>
          )}

          {/* Route Summary */}
          {summary && (
            <Card className="border-border p-4 md:p-8">
              <h2 className="text-xl font-bold text-foreground mb-6">Route Summary</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Total Stops</p>
                  <p className="text-xl md:text-2xl font-bold text-foreground">{summary.total_stops}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Total Travel Time</p>
                  <p className="text-xl md:text-2xl font-bold text-foreground">{formatDuration(summary.total_travel_time_minutes)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Total Service Time</p>
                  <p className="text-xl md:text-2xl font-bold text-foreground">{formatDuration(summary.total_service_time_minutes)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Total Distance</p>
                  <p className="text-xl md:text-2xl font-bold text-foreground">{route.distance || "N/A"}</p>
                </div>
              </div>

              {/* Quantities Summary */}
              <div className="mt-6 pt-6 border-t border-border">
                <h3 className="text-lg font-semibold text-foreground mb-4">Quantities Summary</h3>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Total Carts</p>
                    <p className="text-lg font-bold text-foreground">
                      {summary.total_carts} 
                      {summary.delivery_carts > 0 && summary.pickup_carts > 0 && (
                        <span className="text-sm text-muted-foreground ml-2">
                          (D: {summary.delivery_carts}, P: {summary.pickup_carts})
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Total Boxes</p>
                    <p className="text-lg font-bold text-foreground">
                      {summary.total_boxes}
                      {summary.delivery_boxes > 0 && summary.pickup_boxes > 0 && (
                        <span className="text-sm text-muted-foreground ml-2">
                          (D: {summary.delivery_boxes}, P: {summary.pickup_boxes})
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Total Pallets</p>
                    <p className="text-lg font-bold text-foreground">
                      {summary.total_pallets}
                      {summary.delivery_pallets > 0 && summary.pickup_pallets > 0 && (
                        <span className="text-sm text-muted-foreground ml-2">
                          (D: {summary.delivery_pallets}, P: {summary.pickup_pallets})
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Total Orders</p>
                    <p className="text-lg font-bold text-foreground">
                      {summary.total_orders}
                      {summary.delivery_orders > 0 && summary.pickup_orders > 0 && (
                        <span className="text-sm text-muted-foreground ml-2">
                          (D: {summary.delivery_orders}, P: {summary.pickup_orders})
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Stop-by-Stop Breakdown */}
          {stops.length > 0 ? (
            <Card className="border-border p-4 md:p-8">
              <h2 className="text-xl font-bold text-foreground mb-6">Stop-by-Stop Breakdown</h2>
              <div className="space-y-4">
                {stops.map((stop, index) => (
                  <Card key={stop.id} className="border-border p-4 md:p-6 bg-secondary/30">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                          <span className="text-sm font-bold text-primary">{stop.stop_number}</span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{stop.location_name}</h3>
                          {stop.location_id && (
                            <p className="text-xs text-muted-foreground">ID: {stop.location_id}</p>
                          )}
                        </div>
                      </div>
                      {stop.priority && (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-500/20 text-yellow-400">
                          {stop.priority}
                        </span>
                      )}
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Address</p>
                        <p className="text-sm text-foreground">{stop.address}</p>
                        {stop.city && stop.state && (
                          <p className="text-xs text-muted-foreground">{stop.city}, {stop.state} {stop.zip}</p>
                        )}
                        {stop.phone && (
                          <p className="text-xs text-muted-foreground mt-1">📞 {stop.phone}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Timing</p>
                        <p className="text-sm text-foreground">
                          Arrive: {stop.arrive_time || "N/A"}
                        </p>
                        <p className="text-sm text-foreground">
                          Depart: {stop.depart_time || "N/A"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Service: {formatDuration(stop.service_time_minutes)}
                        </p>
                        {stop.travel_time_minutes && (
                          <p className="text-xs text-muted-foreground">
                            Travel: {formatDuration(stop.travel_time_minutes)}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Time Windows</p>
                        <p className="text-xs text-foreground">
                          TW1: {formatTimeWindow(stop.time_window_1_open, stop.time_window_1_close)}
                        </p>
                        {stop.time_window_2_open && stop.time_window_2_close && (
                          <p className="text-xs text-foreground">
                            TW2: {formatTimeWindow(stop.time_window_2_open, stop.time_window_2_close)}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Quantities</p>
                        <div className="space-y-1">
                          {stop.carts > 0 && (
                            <p className="text-xs text-foreground">Carts: {stop.carts}</p>
                          )}
                          {stop.boxes > 0 && (
                            <p className="text-xs text-foreground">Boxes: {stop.boxes}</p>
                          )}
                          {stop.pallets > 0 && (
                            <p className="text-xs text-foreground">Pallets: {stop.pallets}</p>
                          )}
                          {stop.orders > 0 && (
                            <p className="text-xs text-foreground">Orders: {stop.orders}</p>
                          )}
                          {stop.quantity_type && (
                            <p className="text-xs text-muted-foreground">Type: {stop.quantity_type}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {stop.special_instructions && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-1">Special Instructions</p>
                        <p className="text-sm text-foreground">{stop.special_instructions}</p>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </Card>
          ) : (
            <Card className="border-border p-4 md:p-8">
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No Stops Added</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  This route currently only has origin and destination. Add stops to create a multi-stop route.
                </p>
                {id && typeof id === 'string' && id.trim() !== '' ? (
                  <Link href={`/dashboard/routes/${id}/edit`}>
                    <Button variant="outline">Add Stops</Button>
                  </Link>
                ) : null}
              </div>
            </Card>
          )}

          {/* Trip Information */}
          <Card className="border-border p-4 md:p-8">
            <h2 className="text-xl font-bold text-foreground mb-6">Trip Information</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Distance</p>
                <p className="text-lg text-foreground font-bold">{route.distance || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Estimated Time</p>
                <p className="text-lg text-foreground font-bold">{route.estimated_time || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Stops</p>
                <p className="text-lg text-foreground font-bold">{stops.length}</p>
              </div>
            </div>

            {/* Depot Timing */}
            {(route.pre_route_time_minutes || route.post_route_time_minutes || route.route_start_time) && (
              <div className="mt-6 pt-6 border-t border-border">
                <h3 className="text-lg font-semibold text-foreground mb-4">Depot Timing</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  {route.pre_route_time_minutes && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Pre-Route Time</p>
                      <p className="text-sm font-medium text-foreground">{formatDuration(route.pre_route_time_minutes)}</p>
                    </div>
                  )}
                  {route.route_start_time && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Route Start Time</p>
                      <p className="text-sm font-medium text-foreground">{route.route_start_time}</p>
                    </div>
                  )}
                  {route.route_departure_time && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Route Departure Time</p>
                      <p className="text-sm font-medium text-foreground">{route.route_departure_time}</p>
                    </div>
                  )}
                  {route.route_complete_time && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Route Complete Time</p>
                      <p className="text-sm font-medium text-foreground">{route.route_complete_time}</p>
                    </div>
                  )}
                  {route.post_route_time_minutes && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Post-Route Time</p>
                      <p className="text-sm font-medium text-foreground">{formatDuration(route.post_route_minutes)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* Assignment */}
          <Card className="border-border p-4 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <User className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Assignment</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Driver</p>
                <p className="text-foreground font-medium">{driver?.name || "Not assigned"}</p>
                {driver?.phone && (
                  <p className="text-xs text-muted-foreground mt-1">📞 {driver.phone}</p>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Vehicle</p>
                <p className="text-foreground font-medium">
                  {truck ? `${truck.truck_number}${truck.make && truck.model ? ` - ${truck.make} ${truck.model}` : ''}` : "Not assigned"}
                </p>
                {truck?.license_plate && (
                  <p className="text-xs text-muted-foreground mt-1">Plate: {truck.license_plate}</p>
                )}
              </div>
            </div>
          </Card>

          {/* Status */}
          <Card className="border-border p-4 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <Clock className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Status</h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <span className="text-foreground">Current Status</span>
                <span className={`px-3 py-1 rounded text-sm font-medium ${
                  route.status === "completed" ? "bg-green-400/20 text-green-400" :
                  route.status === "in_progress" ? "bg-blue-400/20 text-blue-400" :
                  route.status === "cancelled" ? "bg-red-400/20 text-red-400" :
                  "bg-yellow-400/20 text-yellow-400"
                }`}>
                  {route.status?.charAt(0).toUpperCase() + route.status?.slice(1) || "Pending"}
                </span>
              </div>
              {route.estimated_arrival && (
                <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                  <span className="text-foreground">Est. Arrival</span>
                  <span className="text-muted-foreground">
                    {new Date(route.estimated_arrival).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
