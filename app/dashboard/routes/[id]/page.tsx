"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  ArrowLeft,
  MapPin,
  Clock,
  User,
  Edit2,
  Package,
  Truck as TruckIcon,
  Building2,
  ArrowRight,
  Navigation,
  RotateCw,
  Info,
  MoreHorizontal,
  Copy,
  Archive,
  Phone,
} from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { use } from "react"
import { getRoute } from "@/app/actions/routes"
import { getRouteStops, getRouteSummary } from "@/app/actions/route-stops"
import { GoogleMapsRoute } from "@/components/google-maps-route"
import { getDrivers } from "@/app/actions/drivers"
import { getTrucks } from "@/app/actions/trucks"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { toast } from "sonner"

export default function RouteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)
  const [route, setRoute] = useState<any>(null)
  const [stops, setStops] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [driver, setDriver] = useState<any>(null)
  const [truck, setTruck] = useState<any>(null)
  const [mapRefreshKey, setMapRefreshKey] = useState(0)
  const [mapRouteData, setMapRouteData] = useState<any>(null)
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

  const getRouteStatusClasses = (status?: string | null) => {
    switch (status) {
      case "completed":
        return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      case "in_progress":
        return "border-blue-500/30 bg-blue-500/10 text-blue-300"
      case "cancelled":
        return "border-zinc-500/40 bg-zinc-500/15 text-zinc-300"
      default:
        return "border-amber-500/30 bg-amber-500/10 text-amber-300"
    }
  }

  const getPriorityClasses = (priority?: string | null) => {
    switch (priority) {
      case "high":
        return "border-amber-500/35 bg-amber-500/10 text-amber-300"
      case "low":
        return "border-zinc-500/35 bg-zinc-500/10 text-zinc-400"
      default:
        return "border-blue-500/30 bg-blue-500/10 text-blue-300"
    }
  }

  const cleanedRouteName = route.name?.replace(/\s*\(copy\)\s*$/i, "").trim() || route.name
  const looksLikeCopy = /\(copy\)/i.test(route.name || "")
  const totalStops = stops.length + 2
  const derivedDistance =
    route.distance ||
    mapRouteData?.distance ||
    (route.traffic_distance_meters ? `${(route.traffic_distance_meters / 1609.34).toFixed(1)} miles` : "N/A")
  const derivedDriveTime =
    route.estimated_time ||
    mapRouteData?.duration ||
    (route.traffic_duration_minutes ? formatDuration(route.traffic_duration_minutes) : "N/A")
  const missingStopTiming = !summary?.total_travel_time_minutes || !summary?.total_service_time_minutes

  return (
    <div className="w-full">
      <div className="sticky top-0 z-30 border-b border-border/70 bg-card/85 backdrop-blur px-4 py-2.5 md:px-8 md:py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <Link href="/dashboard/routes">
              <Button variant="ghost" size="sm" className="mt-0.5">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div className="min-w-0 pt-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-bold text-foreground md:text-2xl">{cleanedRouteName || "Route Details"}</h1>
                {looksLikeCopy && (
                  <span className="inline-flex items-center rounded-md border border-border/70 bg-muted/20 px-2 py-0.5 text-xs text-muted-foreground">
                    Copy
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9 border-border/70 bg-transparent">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/dashboard/routes/add?duplicateId=${id}`}>
                    <Copy className="mr-2 h-4 w-4" />
                    Duplicate
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast.info("Use Edit Route to change status for archive/cancel.")}>
                  <Archive className="mr-2 h-4 w-4" />
                  Archive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {id && typeof id === 'string' && id.trim() !== '' ? (
              <Link href={`/dashboard/routes/${id}/edit`}>
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit Route
                </Button>
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <div className="p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Route Header */}
          <Card className="border-border/70 bg-card/80 p-4 md:p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg md:text-xl font-semibold text-foreground">Route Path</h2>
                {route.depot_name && (
                  <p className="text-sm text-muted-foreground mt-1">
                    <Building2 className="w-4 h-4 inline mr-1" />
                    Depot: {route.depot_name}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`inline-flex items-center rounded-md border px-2 py-1 font-medium ${getPriorityClasses(route.priority)}`}>
                  {(route.priority?.charAt(0).toUpperCase() + route.priority?.slice(1)) || "Normal"} Priority
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/20 px-2 py-1 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {derivedDistance}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/20 px-2 py-1 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {derivedDriveTime}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/20 px-2 py-1 text-muted-foreground">
                  <Package className="h-3.5 w-3.5" />
                  {totalStops} stops
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-1.5 text-foreground">
                <MapPin className="h-4 w-4 text-primary" />
                {route.origin}
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-1.5 text-foreground">
                <MapPin className="h-4 w-4 text-primary" />
                {route.destination}
              </span>
            </div>
          </Card>

          {/* Assignment */}
          <Card className="border-border/70 bg-card/80 p-4 md:p-6">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-wider text-zinc-500">Assignment</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-md border border-border/60 bg-background/50 p-3">
                  <p className="text-xs text-muted-foreground">Driver</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{driver?.name || "Not assigned"}</p>
                  {driver?.phone && (
                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      {driver.phone}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    HOS: {driver?.hos_status || "Unknown"}
                  </p>
                </div>
                <div className="rounded-md border border-border/60 bg-background/50 p-3">
                  <p className="text-xs text-muted-foreground">Vehicle</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {truck ? `${truck.truck_number}${truck.make && truck.model ? ` - ${truck.make} ${truck.model}` : ""}` : "Not assigned"}
                  </p>
                  {truck?.license_plate && (
                    <p className="mt-1 text-xs text-muted-foreground">Plate: {truck.license_plate}</p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Link href={`/dashboard/routes/${id}/edit`} className="flex-1">
                  <Button variant="outline" size="sm" className="h-8 w-full border-border/70">
                    Assign Driver
                  </Button>
                </Link>
                <Link href={`/dashboard/routes/${id}/edit`} className="flex-1">
                  <Button variant="outline" size="sm" className="h-8 w-full border-border/70">
                    Assign Vehicle
                  </Button>
                </Link>
              </div>
            </div>
          </Card>

          {/* Trip Information (merged summary) */}
          <Card className="border-border/70 bg-card/80 p-4 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-foreground">Trip Information</h2>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${getRouteStatusClasses(route.status)}`}>
                  {route.status?.replace("_", " ") || "Pending"}
                </span>
                {missingStopTiming && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Info className="h-3.5 w-3.5" />
                          Why N/A?
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Add stops with timing data to calculate travel and service time.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-500">Total Stops</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{summary?.total_stops ?? totalStops}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-500">Distance</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{derivedDistance}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-500">Drive Time</p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {summary?.total_travel_time_minutes ? formatDuration(summary.total_travel_time_minutes) : derivedDriveTime}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-500">Service Time</p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {summary?.total_service_time_minutes ? formatDuration(summary.total_service_time_minutes) : "N/A"}
                </p>
              </div>
            </div>
          </Card>

          {/* Route Map with Multi-Stops */}
          {route.origin && route.destination && (
            <Card className="border-border/70 bg-card/80 p-4 md:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-semibold text-foreground">Route Map</h2>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 border-border/70"
                    onClick={() => setMapRefreshKey((prev) => prev + 1)}
                  >
                    <RotateCw className="mr-2 h-3.5 w-3.5" />
                    Recalculate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 border-border/70"
                    onClick={() => {
                      const mapsUrl = stops.length > 0
                        ? `https://www.google.com/maps/dir/${encodeURIComponent(route.origin)}/${stops.map((s) => encodeURIComponent(s.address || s.location_name)).join("/")}/${encodeURIComponent(route.destination)}`
                        : `https://www.google.com/maps/dir/${encodeURIComponent(route.origin)}/${encodeURIComponent(route.destination)}`
                      window.open(mapsUrl, "_blank")
                    }}
                  >
                    <Navigation className="mr-2 h-3.5 w-3.5" />
                    Open in Google Maps
                  </Button>
                </div>
              </div>
              <GoogleMapsRoute
                key={`${id}-${mapRefreshKey}`}
                origin={route.origin}
                destination={route.destination}
                originCoordinates={route.origin_coordinates as { lat: number; lng: number } | undefined}
                destinationCoordinates={route.destination_coordinates as { lat: number; lng: number } | undefined}
                weight={0}
                truckHeight={4.0}
                showNavigationButton={false}
                onRouteDataChange={setMapRouteData}
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
            <Card className="border-border/70 bg-card/80 p-4 md:p-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">Route Summary</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Total Stops</p>
                  <p className="text-xl md:text-2xl font-semibold text-foreground">{summary.total_stops}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Total Travel Time</p>
                  <p className="text-xl md:text-2xl font-semibold text-foreground">
                    {summary.total_travel_time_minutes ? formatDuration(summary.total_travel_time_minutes) : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Total Service Time</p>
                  <p className="text-xl md:text-2xl font-semibold text-foreground">
                    {summary.total_service_time_minutes ? formatDuration(summary.total_service_time_minutes) : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Total Distance</p>
                  <p className="text-xl md:text-2xl font-semibold text-foreground">{derivedDistance}</p>
                </div>
              </div>
              {missingStopTiming && (
                <p className="mt-4 text-xs text-muted-foreground">
                  Add stops with travel/service timing to fully calculate summary metrics.
                </p>
              )}

              {/* Quantities Summary */}
              <details className="mt-6 rounded-md border border-border/60 bg-muted/10 p-3">
                <summary className="cursor-pointer text-sm font-medium text-foreground">Cargo Quantities</summary>
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
              </details>
            </Card>
          )}

          {/* Stop-by-Stop Breakdown */}
          {stops.length > 0 ? (
            <Card className="border-border p-4 md:p-8">
              <h2 className="text-xl font-bold text-foreground mb-6">Stop-by-Stop Breakdown</h2>
              <div className="space-y-4">
                {stops.map((stop) => (
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
                    <Button>Add Stops</Button>
                  </Link>
                ) : null}
              </div>
            </Card>
          )}

        </div>
      </div>
    </div>
  )
}
