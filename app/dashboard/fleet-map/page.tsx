"use client"

import { useState, useEffect, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, MapPin, Truck, User, Navigation, Plus, Edit2, Trash2, Circle, X } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { FleetMap } from "@/components/fleet-map"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getGeofences, createGeofence, updateGeofence, deleteGeofence } from "@/app/actions/geofencing"
import { getTrucks } from "@/app/actions/trucks"
import { getRoutes } from "@/app/actions/routes"

declare global {
  interface Window {
    google: any
  }
}

export default function FleetMapPage() {
  const [vehicles, setVehicles] = useState<any[]>([])
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [mapCenter, setMapCenter] = useState<[number, number]>([37.7749, -122.4194]) // Default: San Francisco
  const [zoom, setZoom] = useState(6)
  const [geofences, setGeofences] = useState<any[]>([])
  const [showGeofences, setShowGeofences] = useState(true)
  const [activeTab, setActiveTab] = useState<"vehicles" | "zones">("vehicles")
  const [showGeofenceDialog, setShowGeofenceDialog] = useState(false)
  const [editingGeofence, setEditingGeofence] = useState<any>(null)
  const [deleteGeofenceId, setDeleteGeofenceId] = useState<string | null>(null)
  const [trucks, setTrucks] = useState<any[]>([])
  const [routes, setRoutes] = useState<any[]>([])
  const [geofenceFormData, setGeofenceFormData] = useState({
    name: "",
    description: "",
    zone_type: "circle",
    center_latitude: "",
    center_longitude: "",
    radius_meters: "",
    is_active: true,
    alert_on_entry: true,
    alert_on_exit: true,
    alert_on_dwell: false,
    dwell_time_minutes: "",
    assigned_trucks: [] as string[],
    assigned_routes: [] as string[],
    address: "",
    city: "",
    state: "",
    zip_code: "",
  })
  const [isCreatingGeofence, setIsCreatingGeofence] = useState(false)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const circleRef = useRef<any>(null)

  useEffect(() => {
    loadFleetData()
    loadGeofences()
    loadTrucksAndRoutes()
    // Refresh every 30 seconds for GPS location updates only
    // Note: Fuel level, mileage, and other static data are NOT updated here
    // They only update when manually edited or via ELD integration
    const interval = setInterval(() => {
      loadFleetData()
      loadGeofences()
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  // Initialize map in dialog when it opens
  useEffect(() => {
    if (!showGeofenceDialog) {
      // Cleanup when dialog closes
      if (circleRef.current) {
        circleRef.current.setMap(null)
        circleRef.current = null
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current = null
      }
      return
    }

    // Wait for dialog to be fully rendered
    const timer = setTimeout(() => {
      if (!mapRef.current) return

      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      if (!apiKey) {
        console.warn("Google Maps API key not configured")
        return
      }

      // Wait for Google Maps to load
      const initMap = () => {
        if (!mapRef.current || !window.google || !window.google.maps) {
          console.warn("Google Maps not loaded yet")
          return
        }

        try {
          // Destroy existing map if any
          if (mapInstanceRef.current) {
            // Clear any existing listeners
            if (circleRef.current) {
              circleRef.current.setMap(null)
              circleRef.current = null
            }
          }

          const center = geofenceFormData.center_latitude && geofenceFormData.center_longitude
            ? { lat: parseFloat(geofenceFormData.center_latitude), lng: parseFloat(geofenceFormData.center_longitude) }
            : mapCenter[0] && mapCenter[1]
              ? { lat: mapCenter[0], lng: mapCenter[1] }
              : { lat: 37.7749, lng: -122.4194 }

          const map = new window.google.maps.Map(mapRef.current, {
            center: center,
            zoom: 12,
            mapTypeControl: true,
            streetViewControl: false,
            fullscreenControl: true,
          })

          mapInstanceRef.current = map

          // Add click listener to set center for circle zones
          if (geofenceFormData.zone_type === "circle") {
            map.addListener("click", (e: any) => {
              const lat = e.latLng.lat()
              const lng = e.latLng.lng()
              setGeofenceFormData((prev) => ({
                ...prev,
                center_latitude: lat.toString(),
                center_longitude: lng.toString(),
              }))
              if (geofenceFormData.radius_meters) {
                updateCircleZone(lat, lng, parseFloat(geofenceFormData.radius_meters))
              }
            })
          }

          // If editing and has existing zone, show it
          if (editingGeofence && geofenceFormData.center_latitude && geofenceFormData.center_longitude && geofenceFormData.radius_meters) {
            setTimeout(() => {
              updateCircleZone(
                parseFloat(geofenceFormData.center_latitude),
                parseFloat(geofenceFormData.center_longitude),
                parseFloat(geofenceFormData.radius_meters)
              )
            }, 200)
          }
        } catch (error) {
          console.error("Error initializing dialog map:", error)
        }
      }

      if (window.google && window.google.maps) {
        // Google Maps already loaded
        initMap()
      } else {
        // Load Google Maps script if not loaded
        const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`)
        if (existingScript) {
          existingScript.addEventListener("load", initMap)
        } else {
          const script = document.createElement("script")
          script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,drawing`
          script.async = true
          script.defer = true
          script.onload = initMap
          script.onerror = () => {
            console.error("Failed to load Google Maps")
          }
          document.head.appendChild(script)
        }

        // Also check periodically in case it loads before our listener
        const checkGoogle = setInterval(() => {
          if (window.google && window.google.maps) {
            clearInterval(checkGoogle)
            initMap()
          }
        }, 100)

        // Cleanup after 10 seconds
        setTimeout(() => clearInterval(checkGoogle), 10000)
      }
    }, 300) // Wait 300ms for dialog to render

    return () => {
      clearTimeout(timer)
    }
  }, [showGeofenceDialog])

  // Update circle when form data changes
  useEffect(() => {
    if (
      showGeofenceDialog &&
      mapInstanceRef.current &&
      geofenceFormData.zone_type === "circle" &&
      geofenceFormData.center_latitude &&
      geofenceFormData.center_longitude &&
      geofenceFormData.radius_meters
    ) {
      updateCircleZone(
        parseFloat(geofenceFormData.center_latitude),
        parseFloat(geofenceFormData.center_longitude),
        parseFloat(geofenceFormData.radius_meters)
      )
    }
  }, [geofenceFormData.center_latitude, geofenceFormData.center_longitude, geofenceFormData.radius_meters, showGeofenceDialog])

  async function loadTrucksAndRoutes() {
    const [trucksResult, routesResult] = await Promise.all([getTrucks(), getRoutes()])
    if (trucksResult.data) setTrucks(trucksResult.data)
    if (routesResult.data) setRoutes(routesResult.data)
  }

  async function loadGeofences() {
    try {
      const result = await getGeofences()
      if (result.data) {
        setGeofences(result.data)
      }
    } catch (error) {
      // Silently fail - geofences are optional
    }
  }

  const handleCreateGeofence = async () => {
    if (!geofenceFormData.name.trim()) {
      toast.error("Please enter a zone name")
      return
    }

    if (geofenceFormData.zone_type === "circle") {
      if (!geofenceFormData.center_latitude || !geofenceFormData.center_longitude || !geofenceFormData.radius_meters) {
        toast.error("Please set the zone center and radius on the map")
        return
      }
    }

    setIsCreatingGeofence(true)
    const result = editingGeofence
      ? await updateGeofence(editingGeofence.id, geofenceFormData)
      : await createGeofence({
          ...geofenceFormData,
          center_latitude: geofenceFormData.center_latitude ? parseFloat(geofenceFormData.center_latitude) : undefined,
          center_longitude: geofenceFormData.center_longitude ? parseFloat(geofenceFormData.center_longitude) : undefined,
          radius_meters: geofenceFormData.radius_meters ? parseInt(geofenceFormData.radius_meters) : undefined,
          dwell_time_minutes: geofenceFormData.dwell_time_minutes ? parseInt(geofenceFormData.dwell_time_minutes) : undefined,
        })

    if (result.error) {
      toast.error(result.error)
      setIsCreatingGeofence(false)
    } else {
      toast.success(editingGeofence ? "Geofence updated successfully" : "Geofence created successfully")
      setShowGeofenceDialog(false)
      setEditingGeofence(null)
      resetGeofenceForm()
      await loadGeofences()
      setIsCreatingGeofence(false)
    }
  }

  const handleDeleteGeofence = async () => {
    if (!deleteGeofenceId) return
    const result = await deleteGeofence(deleteGeofenceId)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Geofence deleted successfully")
      await loadGeofences()
    }
    setDeleteGeofenceId(null)
  }

  const resetGeofenceForm = () => {
    setGeofenceFormData({
      name: "",
      description: "",
      zone_type: "circle",
      center_latitude: "",
      center_longitude: "",
      radius_meters: "",
      is_active: true,
      alert_on_entry: true,
      alert_on_exit: true,
      alert_on_dwell: false,
      dwell_time_minutes: "",
      assigned_trucks: [],
      assigned_routes: [],
      address: "",
      city: "",
      state: "",
      zip_code: "",
    })
    if (circleRef.current) {
      circleRef.current.setMap(null)
      circleRef.current = null
    }
  }

  const openEditGeofence = (geofence: any) => {
    setEditingGeofence(geofence)
    setGeofenceFormData({
      name: geofence.name || "",
      description: geofence.description || "",
      zone_type: geofence.zone_type || "circle",
      center_latitude: geofence.center_latitude?.toString() || "",
      center_longitude: geofence.center_longitude?.toString() || "",
      radius_meters: geofence.radius_meters?.toString() || "",
      is_active: geofence.is_active ?? true,
      alert_on_entry: geofence.alert_on_entry ?? true,
      alert_on_exit: geofence.alert_on_exit ?? true,
      alert_on_dwell: geofence.alert_on_dwell ?? false,
      dwell_time_minutes: geofence.dwell_time_minutes?.toString() || "",
      assigned_trucks: geofence.assigned_trucks || [],
      assigned_routes: geofence.assigned_routes || [],
      address: geofence.address || "",
      city: geofence.city || "",
      state: geofence.state || "",
      zip_code: geofence.zip_code || "",
    })
    setShowGeofenceDialog(true)
  }

  const updateCircleZone = (lat: number, lng: number, radius: number) => {
    if (!mapInstanceRef.current || !window.google) return

    if (circleRef.current) {
      circleRef.current.setMap(null)
    }

    const circle = new window.google.maps.Circle({
      strokeColor: "#3B82F6",
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: "#3B82F6",
      fillOpacity: 0.2,
      map: mapInstanceRef.current,
      center: { lat, lng },
      radius: radius,
      editable: true,
      draggable: true,
    })

    circleRef.current = circle

    circle.addListener("center_changed", () => {
      const center = circle.getCenter()
      setGeofenceFormData({
        ...geofenceFormData,
        center_latitude: center.lat().toString(),
        center_longitude: center.lng().toString(),
      })
    })

    circle.addListener("radius_changed", () => {
      setGeofenceFormData({
        ...geofenceFormData,
        radius_meters: Math.round(circle.getRadius()).toString(),
      })
    })
  }

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
          .select("truck_id, latitude, longitude, timestamp, speed, heading, engine_status")
          .in("truck_id", truckIds)
          .order("timestamp", { ascending: false })

        // Get active loads for trucks
        const { data: activeLoads } = await supabase
          .from("loads")
          .select("truck_id, status")
          .in("truck_id", truckIds)
          .in("status", ["scheduled", "in_progress", "in_transit", "arrived_at_shipper", "arrived_at_delivery"])

        // Get the latest location for each truck
        const latestLocations: Record<string, any> = {}
        locationsData?.forEach((loc) => {
          if (!latestLocations[loc.truck_id] || new Date(loc.timestamp) > new Date(latestLocations[loc.truck_id].timestamp)) {
            latestLocations[loc.truck_id] = loc
          }
        })

        // Calculate availability status for each truck
        const now = new Date()
        const OFFLINE_THRESHOLD_MINUTES = 15 // Consider offline if no location update in 15 minutes

        // Combine truck data with locations and availability status
        const vehiclesWithLocations = trucksData?.map((truck) => {
          const location = latestLocations[truck.id] || null
          const hasActiveLoad = activeLoads?.some(l => l.truck_id === truck.id) || false
          
          // Determine availability status
          let availabilityStatus: "available" | "loading" | "offline" = "available"
          
          if (!location) {
            availabilityStatus = "offline"
          } else {
            const lastUpdate = new Date(location.timestamp)
            const minutesSinceUpdate = (now.getTime() - lastUpdate.getTime()) / 60000
            
            if (minutesSinceUpdate > OFFLINE_THRESHOLD_MINUTES) {
              availabilityStatus = "offline"
            } else if (hasActiveLoad && (location.speed === 0 || location.speed < 5)) {
              // Truck has active load and is stationary = loading
              availabilityStatus = "loading"
            } else if (hasActiveLoad) {
              // Truck has active load and is moving = in transit (still available for new loads)
              availabilityStatus = "available"
            } else {
              availabilityStatus = "available"
            }
          }

          return {
            ...truck,
            location: location,
            driver: Array.isArray(truck.drivers) ? truck.drivers[0] : truck.drivers,
            availability_status: availabilityStatus,
          }
        }) || []

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
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Fleet Map & Zones</h1>
            <p className="text-muted-foreground text-sm mt-1">Real-time vehicle tracking and geofencing</p>
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
          {/* Sidebar - Vehicle List & Geofences */}
          <div className="lg:col-span-1">
            <Card className="border-border p-4 h-full flex flex-col">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "vehicles" | "zones")} className="flex flex-col h-full">
                <div className="flex items-center justify-between mb-4 flex-shrink-0">
                  <TabsList className="w-full">
                    <TabsTrigger value="vehicles" className="flex-1">Vehicles</TabsTrigger>
                    <TabsTrigger value="zones" className="flex-1">Zones</TabsTrigger>
                  </TabsList>
                </div>
                {activeTab === "zones" && (
                  <div className="mb-4 flex-shrink-0">
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        resetGeofenceForm()
                        setEditingGeofence(null)
                        setShowGeofenceDialog(true)
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create Zone
                    </Button>
                  </div>
                )}

                <TabsContent value="vehicles" className="mt-0 flex-1 overflow-hidden flex flex-col">
                  <div className="space-y-2 flex-1 overflow-y-auto">
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading vehicles...</p>
                ) : vehicles.length === 0 ? (
                  <div className="text-center py-8">
                    <Truck className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <p className="text-sm text-muted-foreground">No vehicles found</p>
                    <p className="text-xs text-muted-foreground mt-1">Add vehicles in the Vehicles section</p>
                  </div>
                ) : (
                  <>
                    {vehiclesWithLocation.length > 0 && (
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
                                setZoom(15)
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
                                <MapPin className="w-3 h-3 text-green-400" />
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
                      </>
                    )}
                    {vehiclesWithoutLocation.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs text-muted-foreground mb-2 font-semibold">
                          No GPS Location ({vehiclesWithoutLocation.length})
                        </p>
                        {vehiclesWithoutLocation.map((vehicle) => (
                          <Card
                            key={vehicle.id}
                            className={`border-border/50 p-3 cursor-pointer transition ${
                              selectedVehicle === vehicle.id
                                ? "border-primary/50 bg-primary/5"
                                : "hover:bg-secondary/30 opacity-75"
                            }`}
                            onClick={() => {
                              setSelectedVehicle(vehicle.id)
                              toast.info(`${vehicle.truck_number} has no GPS location data yet`)
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Truck className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium text-foreground">{vehicle.truck_number}</span>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                No GPS
                              </Badge>
                            </div>
                            {vehicle.driver && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                <User className="w-3 h-3" />
                                <span>{vehicle.driver.name}</span>
                              </div>
                            )}
                          </Card>
                        ))}
                      </div>
                    )}
                    {vehiclesWithLocation.length === 0 && vehiclesWithoutLocation.length === 0 && (
                      <div className="text-center py-8">
                        <Truck className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                        <p className="text-sm text-muted-foreground">No vehicles available</p>
                      </div>
                    )}
                  </>
                )}
                  </div>
                </TabsContent>

                <TabsContent value="zones" className="mt-0 flex-1 overflow-hidden flex flex-col">
                  <div className="space-y-2 flex-1 overflow-y-auto">
                    {geofences.length === 0 ? (
                      <div className="text-center py-8">
                        <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                        <p className="text-sm text-muted-foreground mb-3">No geofence zones yet</p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            resetGeofenceForm()
                            setEditingGeofence(null)
                            setShowGeofenceDialog(true)
                          }}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Create Zone
                        </Button>
                      </div>
                    ) : (
                      geofences.map((geofence) => (
                        <Card
                          key={geofence.id}
                          className={`border-border p-3 cursor-pointer transition ${
                            !geofence.is_active ? "opacity-60" : ""
                          }`}
                          onClick={() => {
                            if (geofence.center_latitude && geofence.center_longitude) {
                              setMapCenter([Number(geofence.center_latitude), Number(geofence.center_longitude)])
                              setZoom(geofence.radius_meters ? Math.max(10, 15 - Math.log10(geofence.radius_meters / 100)) : 12)
                            }
                          }}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Circle className="w-4 h-4 text-primary" />
                                <span className="font-medium text-foreground">{geofence.name}</span>
                              </div>
                              {geofence.description && (
                                <p className="text-xs text-muted-foreground mb-1">{geofence.description}</p>
                              )}
                              <div className="flex items-center gap-2 flex-wrap mt-2">
                                {geofence.is_active ? (
                                  <Badge className="bg-green-500/20 text-green-500 border-green-500/50 text-xs">Active</Badge>
                                ) : (
                                  <Badge className="bg-gray-500/20 text-gray-500 border-gray-500/50 text-xs">Inactive</Badge>
                                )}
                                {geofence.zone_type === "circle" && geofence.radius_meters && (
                                  <Badge variant="outline" className="text-xs">
                                    {(geofence.radius_meters / 1000).toFixed(1)} km
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openEditGeofence(geofence)
                                }}
                              >
                                <Edit2 className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-red-400 hover:text-red-500"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDeleteGeofenceId(geofence.id)
                                }}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </Card>
          </div>

          {/* Map Area */}
          <div className="lg:col-span-3">
            <Card className="border-border p-4">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h3 className="font-semibold text-foreground">Live Map View</h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="show-geofences"
                      checked={showGeofences}
                      onCheckedChange={(checked) => setShowGeofences(checked as boolean)}
                    />
                    <Label htmlFor="show-geofences" className="text-sm cursor-pointer whitespace-nowrap">
                      Show Zones
                    </Label>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      loadFleetData()
                      loadGeofences()
                      toast.success("Map refreshed")
                    }}
                  >
                    <Navigation className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </div>
              <div className="h-[600px] bg-secondary/20 rounded-lg border border-border overflow-hidden relative">
                {vehicles.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <Truck className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                      <p className="text-muted-foreground mb-2">No vehicles in fleet</p>
                      <p className="text-sm text-muted-foreground">
                        Add vehicles in the Vehicles section to see them on the map
                      </p>
                    </div>
                  </div>
                ) : vehiclesWithLocation.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <MapPin className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                      <p className="text-muted-foreground mb-2">No vehicles with GPS location data</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        {vehicles.length} vehicle{vehicles.length !== 1 ? "s" : ""} found, but none have active GPS tracking
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Vehicles will appear on the map when they have active ELD devices sending location data
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        You can still view and select vehicles in the sidebar
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
                    geofences={geofences}
                    showGeofences={showGeofences}
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

      {/* Create/Edit Geofence Dialog */}
      <Dialog open={showGeofenceDialog} onOpenChange={(open) => {
        setShowGeofenceDialog(open)
        if (!open) {
          setEditingGeofence(null)
          resetGeofenceForm()
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingGeofence ? "Edit Geofence Zone" : "Create Geofence Zone"}</DialogTitle>
            <DialogDescription>
              {editingGeofence ? "Update zone settings" : "Define a location zone for tracking and alerts"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Zone Name *</Label>
                <Input
                  value={geofenceFormData.name}
                  onChange={(e) => setGeofenceFormData({ ...geofenceFormData, name: e.target.value })}
                  placeholder="e.g., Main Warehouse"
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Zone Type *</Label>
                <Select
                  value={geofenceFormData.zone_type}
                  onValueChange={(value) => {
                    setGeofenceFormData({ ...geofenceFormData, zone_type: value })
                    if (circleRef.current) {
                      circleRef.current.setMap(null)
                      circleRef.current = null
                    }
                  }}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="circle">Circle</SelectItem>
                    <SelectItem value="rectangle">Rectangle</SelectItem>
                    <SelectItem value="polygon">Polygon</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={geofenceFormData.description}
                onChange={(e) => setGeofenceFormData({ ...geofenceFormData, description: e.target.value })}
                placeholder="Zone description"
                className="mt-2"
                rows={2}
              />
            </div>
            {geofenceFormData.zone_type === "circle" && (
              <>
                <div className="relative h-64 w-full rounded-lg overflow-hidden border border-border bg-secondary/20">
                  <div ref={mapRef} className="w-full h-full" style={{ minHeight: "256px" }} />
                  {!mapInstanceRef.current && (
                    <div className="absolute inset-0 flex items-center justify-center bg-secondary/50">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                        <p className="text-xs text-muted-foreground">Loading map...</p>
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm p-2 border-t border-border z-10">
                    <p className="text-xs text-muted-foreground text-center">
                      Click on the map to set center, then adjust radius below
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Center Latitude</Label>
                    <Input
                      type="number"
                      step="any"
                      value={geofenceFormData.center_latitude}
                      onChange={(e) => {
                        setGeofenceFormData({ ...geofenceFormData, center_latitude: e.target.value })
                        if (e.target.value && geofenceFormData.center_longitude && geofenceFormData.radius_meters) {
                          updateCircleZone(
                            parseFloat(e.target.value),
                            parseFloat(geofenceFormData.center_longitude),
                            parseFloat(geofenceFormData.radius_meters)
                          )
                        }
                      }}
                      placeholder="37.7749"
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label>Center Longitude</Label>
                    <Input
                      type="number"
                      step="any"
                      value={geofenceFormData.center_longitude}
                      onChange={(e) => {
                        setGeofenceFormData({ ...geofenceFormData, center_longitude: e.target.value })
                        if (geofenceFormData.center_latitude && e.target.value && geofenceFormData.radius_meters) {
                          updateCircleZone(
                            parseFloat(geofenceFormData.center_latitude),
                            parseFloat(e.target.value),
                            parseFloat(geofenceFormData.radius_meters)
                          )
                        }
                      }}
                      placeholder="-122.4194"
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label>Radius (meters) *</Label>
                    <Input
                      type="number"
                      value={geofenceFormData.radius_meters}
                      onChange={(e) => {
                        setGeofenceFormData({ ...geofenceFormData, radius_meters: e.target.value })
                        if (geofenceFormData.center_latitude && geofenceFormData.center_longitude && e.target.value) {
                          updateCircleZone(
                            parseFloat(geofenceFormData.center_latitude),
                            parseFloat(geofenceFormData.center_longitude),
                            parseFloat(e.target.value)
                          )
                        }
                      }}
                      placeholder="1000"
                      className="mt-2"
                    />
                    {geofenceFormData.radius_meters && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {(parseFloat(geofenceFormData.radius_meters) / 1000).toFixed(2)} km
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="alert_on_entry"
                  checked={geofenceFormData.alert_on_entry}
                  onCheckedChange={(checked) => setGeofenceFormData({ ...geofenceFormData, alert_on_entry: checked as boolean })}
                />
                <Label htmlFor="alert_on_entry" className="cursor-pointer">Alert on entry</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="alert_on_exit"
                  checked={geofenceFormData.alert_on_exit}
                  onCheckedChange={(checked) => setGeofenceFormData({ ...geofenceFormData, alert_on_exit: checked as boolean })}
                />
                <Label htmlFor="alert_on_exit" className="cursor-pointer">Alert on exit</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_active"
                  checked={geofenceFormData.is_active}
                  onCheckedChange={(checked) => setGeofenceFormData({ ...geofenceFormData, is_active: checked as boolean })}
                />
                <Label htmlFor="is_active" className="cursor-pointer">Zone is active</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowGeofenceDialog(false)
              setEditingGeofence(null)
              resetGeofenceForm()
            }}>
              Cancel
            </Button>
            <Button onClick={handleCreateGeofence} disabled={isCreatingGeofence}>
              {isCreatingGeofence ? "Saving..." : editingGeofence ? "Update Zone" : "Create Zone"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Geofence Confirmation */}
      <AlertDialog open={deleteGeofenceId !== null} onOpenChange={() => setDeleteGeofenceId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Geofence Zone</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this geofence zone? This action cannot be undone and will delete all associated visit records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGeofence}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

