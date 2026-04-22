"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { errorMessage } from "@/lib/error-message"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, MapPin, Truck, Plus, Edit2, Trash2, X, RefreshCw, LocateFixed, Lock, Radar } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { FleetMap } from "@/components/fleet-map"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
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
import { getGeofences, deleteGeofence, createGeofence } from "@/app/actions/geofencing"
import { getTrucks } from "@/app/actions/trucks"
import { getRoutes } from "@/app/actions/routes"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { getPlanFeatureAccessStatus } from "@/app/actions/plan-feature-access"

export default function FleetMapPage() {
  const [vehicles, setVehicles] = useState<any[]>([])
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null)
  const [selectedGeofence, setSelectedGeofence] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [geofencingAllowed, setGeofencingAllowed] = useState(true)
  const [planName, setPlanName] = useState("starter")
  const [mapCenter, setMapCenter] = useState<[number, number]>([37.7749, -122.4194])
  const [zoom, setZoom] = useState(6)
  const [geofences, setGeofences] = useState<any[]>([])
  const [showGeofences, setShowGeofences] = useState(true)
  const [activeTab, setActiveTab] = useState<"vehicles" | "zones">("vehicles")
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
  const [deleteGeofenceId, setDeleteGeofenceId] = useState<string | null>(null)
  const [showGeofenceDialog, setShowGeofenceDialog] = useState(false)
  const [isCreatingGeofence, setIsCreatingGeofence] = useState(false)
  const [trucks, setTrucks] = useState<any[]>([])
  const [routes, setRoutes] = useState<any[]>([])
  const [geofenceFormData, setGeofenceFormData] = useState({
    name: "",
    description: "",
    zone_type: "circle" as "circle" | "polygon" | "rectangle",
    center_latitude: "",
    center_longitude: "",
    radius_meters: "",
    north_bound: "",
    south_bound: "",
    east_bound: "",
    west_bound: "",
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
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const drawingManagerRef = useRef<any>(null)
  const drawnShapeRef = useRef<any>(null)

  useEffect(() => {
    loadFleetData()
    loadGeofences()
    loadTrucks()
    loadRoutes()
  }, [])

  const loadTrucks = async () => {
    const result = await getTrucks()
    if (result.data) {
      setTrucks(result.data)
    }
  }

  const loadRoutes = async () => {
    const result = await getRoutes()
    if (result.data) {
      setRoutes(result.data)
    }
  }

  const loadFleetData = async () => {
    try {
      setIsLoading(true)
      // Fetch vehicles with GPS data from eld_locations instead of just trucks table
      try {
        const { getVehiclesInViewport } = await import("@/app/actions/map-optimization")
        const result = await getVehiclesInViewport(90, -90, 180, -180)
        if (result.data) {
          // Transform to Vehicle format with location data
          const vehiclesWithLocation = result.data.map((loc: any) => ({
            id: loc.truck_id,
            truck_number: loc.trucks?.truck_number || "Unknown",
            status: loc.trucks?.status,
            driver: loc.trucks?.drivers ? { name: loc.trucks.drivers.name } : undefined,
            location: {
              latitude: loc.latitude,
              longitude: loc.longitude,
              speed: loc.speed,
              heading: loc.heading,
              timestamp: loc.timestamp,
            }
          }))
          setVehicles(vehiclesWithLocation)
        } else if (result.error) {
          // Fallback to trucks if map-optimization fails
          const trucksResult = await getTrucks()
          if (trucksResult.data) {
            setVehicles(trucksResult.data || [])
          }
        }
      } catch (error) {
        // Fallback to trucks if getVehiclesInViewport doesn't exist
        const result = await getTrucks()
        if (result.error) {
          toast.error(result.error)
          return
        }
        setVehicles(result.data || [])
      }
      if (activeTab === "vehicles") {
        setLastUpdatedAt(new Date())
      }
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Failed to load vehicles"))
    } finally {
      setIsLoading(false)
    }
  }

  const loadGeofences = async () => {
    try {
      const access = await getPlanFeatureAccessStatus("geofencing")
      if (access.error) {
        toast.error(access.error)
        return
      }
      const allowed = !!access.data?.allowed
      setGeofencingAllowed(allowed)
      setPlanName(String(access.data?.plan_name || "starter"))
      if (!allowed) {
        setGeofences([])
        if (activeTab === "zones") {
          setLastUpdatedAt(new Date())
        }
        return
      }

      const result = await getGeofences()
      if (result.error) {
        toast.error(result.error)
        return
      }
      setGeofences(result.data || [])
      if (activeTab === "zones") {
        setLastUpdatedAt(new Date())
      }
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Failed to load geofences"))
    }
  }

  const handleDeleteGeofence = async () => {
    if (!deleteGeofenceId) return

    try {
    const result = await deleteGeofence(deleteGeofenceId)
    if (result.error) {
      toast.error(result.error)
        return
    }
      toast.success("Geofence deleted successfully")
    setDeleteGeofenceId(null)
      loadGeofences()
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Failed to delete geofence"))
    }
  }

  const handleGeofenceClick = (geofenceId: string) => {
    setSelectedGeofence(geofenceId)
    setSelectedVehicle(null)
    
    const geofence = geofences.find((g) => g.id === geofenceId)
    if (geofence) {
      if (geofence.zone_type === "circle" && geofence.center_latitude && geofence.center_longitude) {
        setMapCenter([Number(geofence.center_latitude), Number(geofence.center_longitude)])
        setZoom(geofence.radius_meters ? Math.max(12, 20 - Math.log10(geofence.radius_meters / 1000)) : 15)
      } else if (geofence.zone_type === "rectangle") {
        // Rectangle selection: center is the midpoint of bounds
        if (
          geofence.north_bound != null &&
          geofence.south_bound != null &&
          geofence.east_bound != null &&
          geofence.west_bound != null
        ) {
          const centerLat = (Number(geofence.north_bound) + Number(geofence.south_bound)) / 2
          const centerLng = (Number(geofence.east_bound) + Number(geofence.west_bound)) / 2
          setMapCenter([centerLat, centerLng])
          setZoom(13)
        }
      } else if (geofence.zone_type === "polygon" && geofence.polygon_coordinates && geofence.polygon_coordinates.length > 0) {
        // Calculate center of polygon (handle both {lat, lng} and [lat, lng] formats)
        const coords = geofence.polygon_coordinates.map((coord: any) => {
          if (typeof coord === 'object' && 'lat' in coord && 'lng' in coord) {
            return { lat: coord.lat, lng: coord.lng }
          } else if (Array.isArray(coord) && coord.length >= 2) {
            return { lat: coord[0], lng: coord[1] }
          }
          return null
        }).filter((c: any) => c !== null)
        
        if (coords.length === 0) return
        
        const lats = coords.map((c: any) => c.lat)
        const lngs = coords.map((c: any) => c.lng)
        const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2
        const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2
        setMapCenter([centerLat, centerLng])
        setZoom(13)
      }
    }
  }

  const handleVehicleClick = (vehicleId: string) => {
    setSelectedVehicle(vehicleId)
    setSelectedGeofence(null)
    
    const vehicle = vehicles.find((v) => v.id === vehicleId)
    if (vehicle?.location) {
      setMapCenter([Number(vehicle.location.latitude), Number(vehicle.location.longitude)])
      setZoom(15)
    }
  }

  // Filter vehicles with and without GPS
  const vehiclesWithLocation = vehicles.filter((v) => v.location)
  const vehiclesWithoutLocation = vehicles.filter((v) => !v.location)
  const showZonePaywall = activeTab === "zones" && !geofencingAllowed
  const showVehicleEmptyOverlay = activeTab === "vehicles" && !isLoading && vehiclesWithLocation.length === 0
  const showZoneEmptyOverlay = activeTab === "zones" && geofencingAllowed && !isLoading && geofences.length === 0

  const handleRefreshActiveView = () => {
    if (activeTab === "zones") {
      void loadGeofences()
      return
    }
    void loadFleetData()
  }

  const handleCenterOnFleet = () => {
    if (vehiclesWithLocation.length === 0) return
    const lats = vehiclesWithLocation.map((v) => Number(v.location.latitude))
    const lngs = vehiclesWithLocation.map((v) => Number(v.location.longitude))
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2
    setMapCenter([centerLat, centerLng])
    setZoom(6)
  }

  const handleDrawingShapeComplete = useCallback(
    (
      shape: any,
      payload?:
        | { kind: "circle"; center: { lat: number; lng: number }; radius: number }
        | { kind: "rectangle"; bounds: { north: number; south: number; east: number; west: number } }
        | { kind: "polygon" }
    ) => {
      if (drawnShapeRef.current && drawnShapeRef.current !== shape) {
        drawnShapeRef.current.setMap(null)
      }
      drawnShapeRef.current = shape

      if (payload?.kind === "circle") {
        setGeofenceFormData((prev) => ({
          ...prev,
          center_latitude: payload.center.lat.toString(),
          center_longitude: payload.center.lng.toString(),
          radius_meters: payload.radius.toString(),
          north_bound: "",
          south_bound: "",
          east_bound: "",
          west_bound: "",
        }))
      } else if (payload?.kind === "rectangle") {
        setGeofenceFormData((prev) => ({
          ...prev,
          center_latitude: "",
          center_longitude: "",
          radius_meters: "",
          north_bound: payload.bounds.north.toString(),
          south_bound: payload.bounds.south.toString(),
          east_bound: payload.bounds.east.toString(),
          west_bound: payload.bounds.west.toString(),
        }))
      }
    },
    []
  )

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Fleet Map & Zones</h1>
            <p className="text-muted-foreground">
              {geofencingAllowed
                ? "Real-time vehicle tracking and geofencing"
                : "Vehicle tracking available. Geofencing unlocks on paid plans."}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Vehicles and Zones List */}
        <div className="space-y-4">
          <Card className="p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">
                {activeTab === "vehicles" ? `Vehicles (${vehicles.length})` : `Zones (${geofences.length})`}
              </h3>
              {activeTab === "zones" && (
                <Button size="sm" disabled={!geofencingAllowed} onClick={() => setShowGeofenceDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Zone
                </Button>
              )}
            </div>
            <div className="max-h-[calc(100vh-220px)] overflow-y-auto pr-2">
              {activeTab === "vehicles" ? (
                <div className="space-y-4">
                  {vehiclesWithLocation.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                        Active GPS ({vehiclesWithLocation.length})
                      </h4>
                      <div className="space-y-2">
                        {vehiclesWithLocation.map((vehicle) => (
                          <Card
                            key={vehicle.id}
                            className={`p-3 cursor-pointer transition-colors ${
                              selectedVehicle === vehicle.id ? "border-primary bg-primary/5" : "hover:bg-secondary/50"
                            }`}
                            onClick={() => handleVehicleClick(vehicle.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Truck className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{vehicle.truck_number}</span>
                              </div>
                              <Badge variant="outline">{vehicle.status || "Active"}</Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {vehicle.driver?.name || "No driver"} · {vehicle.location?.speed ? `${Math.round(vehicle.location.speed)} mph` : "Speed N/A"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Last update: {vehicle.location?.timestamp ? new Date(vehicle.location.timestamp).toLocaleTimeString() : "Unknown"}
                            </p>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {vehiclesWithoutLocation.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                        Offline / No GPS ({vehiclesWithoutLocation.length})
                      </h4>
                      <div className="space-y-2">
                        {vehiclesWithoutLocation.map((vehicle) => (
                          <Card key={vehicle.id} className="p-3 opacity-70">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Truck className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{vehicle.truck_number}</span>
                              </div>
                              <Badge variant="secondary">Offline</Badge>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {vehicles.length === 0 && !isLoading && (
                    <Card className="p-5 text-center">
                      <p className="text-sm font-medium text-foreground mb-1">No vehicles tracked yet</p>
                      <p className="text-xs text-muted-foreground mb-3">Add trucks and connect GPS/ELD to populate live map.</p>
                      <Link href="/dashboard/trucks/add">
                        <Button size="sm">Add Truck</Button>
                      </Link>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {geofences.map((geofence) => (
                    <Card
                      key={geofence.id}
                      className={`p-3 cursor-pointer transition-colors ${
                        selectedGeofence === geofence.id ? "border-primary bg-primary/5" : "hover:bg-secondary/50"
                      }`}
                      onClick={() => handleGeofenceClick(geofence.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{geofence.name}</span>
                            {!geofence.is_active && <Badge variant="secondary">Inactive</Badge>}
                          </div>
                          {geofence.description && <p className="text-sm text-muted-foreground mt-1">{geofence.description}</p>}
                          <p className="text-xs text-muted-foreground mt-1">
                            {geofence.zone_type === "circle"
                              ? `Circle - ${geofence.radius_meters}m`
                              : geofence.zone_type === "rectangle"
                                ? "Rectangle"
                                : "Polygon"}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Link href={`/dashboard/geofencing/${geofence.id}/edit`}>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={!geofencingAllowed}
                              className="h-8 w-8"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={!geofencingAllowed}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteGeofenceId(geofence.id)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}

                  {geofences.length === 0 && (
                    <Card className="p-5 text-center">
                      <p className="text-sm font-medium text-foreground mb-1">No zones created yet</p>
                      <p className="text-xs text-muted-foreground mb-3">Create geofences for entry/exit alerts.</p>
                      <Button size="sm" disabled={!geofencingAllowed} onClick={() => setShowGeofenceDialog(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create First Zone
                      </Button>
                    </Card>
                  )}
                </div>
              )}
            </div>
          </Card>
          </div>

        {/* Right Panel - Map */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Live Map View</h2>
              <div className="flex items-center gap-4">
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "vehicles" | "zones")} suppressHydrationWarning>
                  <TabsList className="grid w-[220px] grid-cols-2" suppressHydrationWarning>
                    <TabsTrigger value="vehicles" suppressHydrationWarning>Vehicles</TabsTrigger>
                    <TabsTrigger value="zones" suppressHydrationWarning>Zones</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>

            {!geofencingAllowed && (
              <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-amber-300">
                    Geofencing requires a paid plan. You are on <span className="font-semibold capitalize">{planName}</span>.
                  </p>
                  <Link href="/dashboard/settings/billing">
                    <Button size="sm" className="h-8">Upgrade Plan</Button>
                  </Link>
                </div>
              </div>
            )}

            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/10 px-3 py-2">
              <div className="flex items-center gap-2">
                <Switch
                  id="show-zones"
                  checked={showGeofences}
                  onCheckedChange={(checked) => setShowGeofences(checked)}
                />
                <Label htmlFor="show-zones" className="cursor-pointer text-sm">Show Zones</Label>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">
                  Last updated {lastUpdatedAt ? lastUpdatedAt.toLocaleTimeString() : "never"}
                </p>
                <Button variant="outline" size="sm" onClick={handleRefreshActiveView} className="h-8 border-border/70 bg-transparent">
                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 border-border/70 bg-transparent"
                  onClick={handleCenterOnFleet}
                  disabled={vehiclesWithLocation.length === 0}
                >
                  <LocateFixed className="mr-2 h-3.5 w-3.5" />
                  Center on Fleet
                </Button>
              </div>
                    </div>

            <div className="relative h-[72vh] min-h-[700px] bg-secondary/20 rounded-lg border border-border overflow-hidden">
              <div className={`h-full ${showZonePaywall ? "pointer-events-none blur-[1px]" : ""}`}>
                <FleetMap
                  vehicles={vehiclesWithLocation}
                  selectedVehicle={selectedVehicle}
                onVehicleClick={handleVehicleClick}
                  center={mapCenter}
                  zoom={zoom}
                  geofences={geofences}
                  showGeofences={showGeofences}
                  selectedGeofence={selectedGeofence}
                onGeofenceClick={handleGeofenceClick}
                />
              </div>

              {showZonePaywall && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/55">
                  <div className="max-w-sm rounded-lg border border-border/70 bg-card/95 p-5 text-center shadow-lg">
                    <Lock className="mx-auto mb-2 h-5 w-5 text-amber-400" />
                    <p className="text-sm font-semibold text-foreground">Geofencing is locked on your plan</p>
                    <p className="mt-1 text-xs text-muted-foreground">Upgrade to Fleet or Enterprise to create zones and alerts.</p>
                    <Link href="/dashboard/settings/billing" className="mt-3 inline-block">
                      <Button size="sm">Upgrade Plan</Button>
                    </Link>
                  </div>
                </div>
              )}

              {(showVehicleEmptyOverlay || showZoneEmptyOverlay) && !showZonePaywall && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/35">
                  <div className="max-w-sm rounded-lg border border-border/70 bg-card/95 p-5 text-center">
                    <Radar className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                    {showVehicleEmptyOverlay ? (
                      <>
                        <p className="text-sm font-semibold text-foreground">No vehicles tracked yet</p>
                        <p className="mt-1 text-xs text-muted-foreground">Connect your ELD or GPS provider to start real-time tracking.</p>
                        <div className="mt-3 flex justify-center gap-2">
                          <Link href="/dashboard/settings">
                            <Button size="sm">Connect GPS</Button>
                          </Link>
                          <Link href="/dashboard/trucks/add">
                            <Button size="sm" variant="outline">Add Truck</Button>
                          </Link>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-foreground">No zones created</p>
                        <p className="mt-1 text-xs text-muted-foreground">Draw your first geofence zone for entry/exit alerts.</p>
                        <Button size="sm" className="mt-3" onClick={() => setShowGeofenceDialog(true)}>
                          <Plus className="mr-2 h-4 w-4" />
                          Draw First Zone
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
              </div>
            </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteGeofenceId} onOpenChange={(open) => !open && setDeleteGeofenceId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Geofence</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this geofence? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteGeofence} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Zone Dialog */}
      <Dialog open={showGeofenceDialog} onOpenChange={setShowGeofenceDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Geofence Zone</DialogTitle>
            <DialogDescription>
              Define a location zone for vehicle tracking and alerts. Draw on the map or enter coordinates manually.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (!geofencingAllowed) {
                toast.error("Geofencing is available on Fleet and Enterprise plans.")
                return
              }
              
              if (!geofenceFormData.name) {
                toast.error("Zone name is required")
                return
              }

              if (geofenceFormData.zone_type === "circle") {
                if (!geofenceFormData.center_latitude || !geofenceFormData.center_longitude || !geofenceFormData.radius_meters) {
                  toast.error("Please draw a circle on the map or enter coordinates and radius")
                  return
                }
              } else if (geofenceFormData.zone_type === "rectangle") {
                if (!geofenceFormData.north_bound || !geofenceFormData.south_bound || !geofenceFormData.east_bound || !geofenceFormData.west_bound) {
                  toast.error("Please draw a rectangle on the map or enter all bounds")
                  return
                }
              } else if (geofenceFormData.zone_type === "polygon") {
                // Polygon coordinates will be set from the drawn shape
                if (!drawnShapeRef.current) {
                  toast.error("Please draw a polygon on the map")
                  return
                }
              }

              setIsCreatingGeofence(true)
              
              let polygonCoordinates: Array<{ lat: number; lng: number }> | undefined
              if (geofenceFormData.zone_type === "polygon" && drawnShapeRef.current) {
                const paths = drawnShapeRef.current.getPath()
                polygonCoordinates = paths.getArray().map((latLng: any) => ({
                  lat: latLng.lat(),
                  lng: latLng.lng(),
                }))
              }

              const result = await createGeofence({
                name: geofenceFormData.name,
                description: geofenceFormData.description || undefined,
                zone_type: geofenceFormData.zone_type,
                center_latitude: geofenceFormData.center_latitude ? parseFloat(geofenceFormData.center_latitude) : undefined,
                center_longitude: geofenceFormData.center_longitude ? parseFloat(geofenceFormData.center_longitude) : undefined,
                radius_meters: geofenceFormData.radius_meters ? parseInt(geofenceFormData.radius_meters) : undefined,
                polygon_coordinates: polygonCoordinates,
                north_bound: geofenceFormData.north_bound ? parseFloat(geofenceFormData.north_bound) : undefined,
                south_bound: geofenceFormData.south_bound ? parseFloat(geofenceFormData.south_bound) : undefined,
                east_bound: geofenceFormData.east_bound ? parseFloat(geofenceFormData.east_bound) : undefined,
                west_bound: geofenceFormData.west_bound ? parseFloat(geofenceFormData.west_bound) : undefined,
                is_active: geofenceFormData.is_active,
                alert_on_entry: geofenceFormData.alert_on_entry,
                alert_on_exit: geofenceFormData.alert_on_exit,
                alert_on_dwell: geofenceFormData.alert_on_dwell,
                dwell_time_minutes: geofenceFormData.dwell_time_minutes ? parseInt(geofenceFormData.dwell_time_minutes) : undefined,
                assigned_trucks: geofenceFormData.assigned_trucks.length > 0 ? geofenceFormData.assigned_trucks : undefined,
                assigned_routes: geofenceFormData.assigned_routes.length > 0 ? geofenceFormData.assigned_routes : undefined,
                address: geofenceFormData.address || undefined,
                city: geofenceFormData.city || undefined,
                state: geofenceFormData.state || undefined,
                zip_code: geofenceFormData.zip_code || undefined,
              })

              setIsCreatingGeofence(false)

              if (result.error) {
                toast.error(result.error)
              } else {
                toast.success("Geofence created successfully")
                setShowGeofenceDialog(false)
                // Reset form
                setGeofenceFormData({
                  name: "",
                  description: "",
                  zone_type: "circle",
                  center_latitude: "",
                  center_longitude: "",
                  radius_meters: "",
                  north_bound: "",
                  south_bound: "",
                  east_bound: "",
                  west_bound: "",
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
                if (drawnShapeRef.current) {
                  drawnShapeRef.current.setMap(null)
                  drawnShapeRef.current = null
                }
                if (drawingManagerRef.current) {
                  drawingManagerRef.current.setDrawingMode(null)
                }
                loadGeofences()
              }
            }}
            className="space-y-6"
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Zone Name *</Label>
                <Input
                  id="name"
                  value={geofenceFormData.name}
                  onChange={(e) => setGeofenceFormData({ ...geofenceFormData, name: e.target.value })}
                  placeholder="e.g., Main Warehouse"
                  className="mt-2"
                  required
                />
              </div>

              <div>
                <Label htmlFor="zone_type">Zone Type *</Label>
                <Select
                  value={geofenceFormData.zone_type}
                  onValueChange={(value) => {
                    setGeofenceFormData({ ...geofenceFormData, zone_type: value as "circle" | "polygon" | "rectangle" })
                    // Clear drawn shape when changing type
                    if (drawnShapeRef.current) {
                      drawnShapeRef.current.setMap(null)
                      drawnShapeRef.current = null
                    }
                    if (drawingManagerRef.current) {
                      drawingManagerRef.current.setDrawingMode(null)
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
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={geofenceFormData.description}
                onChange={(e) => setGeofenceFormData({ ...geofenceFormData, description: e.target.value })}
                placeholder="Zone description"
                className="mt-2"
                rows={2}
              />
            </div>

            {/* Map for Drawing */}
            <div>
              <Label>Draw Zone on Map</Label>
              <div className="mt-2 space-y-2">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={geofenceFormData.zone_type === "circle" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setGeofenceFormData({ ...geofenceFormData, zone_type: "circle" })
                      if (drawingManagerRef.current && mapInstanceRef.current) {
                        drawingManagerRef.current.setDrawingMode(window.google.maps.drawing.OverlayType.CIRCLE)
                      }
                    }}
                  >
                    Draw Circle
                  </Button>
                  <Button
                    type="button"
                    variant={geofenceFormData.zone_type === "rectangle" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setGeofenceFormData({ ...geofenceFormData, zone_type: "rectangle" })
                      if (drawingManagerRef.current && mapInstanceRef.current) {
                        drawingManagerRef.current.setDrawingMode(window.google.maps.drawing.OverlayType.RECTANGLE)
                      }
                    }}
                  >
                    Draw Rectangle
                  </Button>
                  <Button
                    type="button"
                    variant={geofenceFormData.zone_type === "polygon" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setGeofenceFormData({ ...geofenceFormData, zone_type: "polygon" })
                      if (drawingManagerRef.current && mapInstanceRef.current) {
                        drawingManagerRef.current.setDrawingMode(window.google.maps.drawing.OverlayType.POLYGON)
                      }
                    }}
                  >
                    Draw Polygon
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (drawnShapeRef.current) {
                        drawnShapeRef.current.setMap(null)
                        drawnShapeRef.current = null
                      }
                      if (drawingManagerRef.current) {
                        drawingManagerRef.current.setDrawingMode(null)
                      }
                      setGeofenceFormData({
                        ...geofenceFormData,
                        center_latitude: "",
                        center_longitude: "",
                        radius_meters: "",
                        north_bound: "",
                        south_bound: "",
                        east_bound: "",
                        west_bound: "",
                      })
                    }}
                  >
                    Clear
                  </Button>
                      </div>
                <div className="h-[300px] bg-secondary/20 rounded-lg border border-border overflow-hidden relative">
                  <div ref={mapRef} className="h-full w-full" />
                  <GeofenceDrawingMap
                    mapRef={mapRef}
                    mapInstanceRef={mapInstanceRef}
                    drawingManagerRef={drawingManagerRef}
                    drawnShapeRef={drawnShapeRef}
                    zoneType={geofenceFormData.zone_type}
                    onShapeComplete={handleDrawingShapeComplete}
                  />
                  <div className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-black/70 px-2 py-1 text-[11px] text-white/90">
                    Draw directly on the map: choose shape, then click and drag.
                  </div>
                    </div>
                  </div>
                </div>

            {geofenceFormData.zone_type === "circle" && (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                  <Label htmlFor="center_latitude">Center Latitude</Label>
                    <Input
                    id="center_latitude"
                      type="number"
                      step="any"
                      value={geofenceFormData.center_latitude}
                    onChange={(e) => setGeofenceFormData({ ...geofenceFormData, center_latitude: e.target.value })}
                      placeholder="37.7749"
                      className="mt-2"
                    />
                  </div>
                  <div>
                  <Label htmlFor="center_longitude">Center Longitude</Label>
                    <Input
                    id="center_longitude"
                      type="number"
                      step="any"
                      value={geofenceFormData.center_longitude}
                    onChange={(e) => setGeofenceFormData({ ...geofenceFormData, center_longitude: e.target.value })}
                      placeholder="-122.4194"
                      className="mt-2"
                    />
                  </div>
                  <div>
                  <Label htmlFor="radius_meters">Radius (meters)</Label>
                    <Input
                    id="radius_meters"
                      type="number"
                      value={geofenceFormData.radius_meters}
                    onChange={(e) => setGeofenceFormData({ ...geofenceFormData, radius_meters: e.target.value })}
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
            )}

            {geofenceFormData.zone_type === "rectangle" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="north_bound">North Bound</Label>
                  <Input
                    id="north_bound"
                    type="number"
                    step="any"
                    value={geofenceFormData.north_bound}
                    onChange={(e) => setGeofenceFormData({ ...geofenceFormData, north_bound: e.target.value })}
                    placeholder="37.80"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="south_bound">South Bound</Label>
                  <Input
                    id="south_bound"
                    type="number"
                    step="any"
                    value={geofenceFormData.south_bound}
                    onChange={(e) => setGeofenceFormData({ ...geofenceFormData, south_bound: e.target.value })}
                    placeholder="37.70"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="east_bound">East Bound</Label>
                  <Input
                    id="east_bound"
                    type="number"
                    step="any"
                    value={geofenceFormData.east_bound}
                    onChange={(e) => setGeofenceFormData({ ...geofenceFormData, east_bound: e.target.value })}
                    placeholder="-122.35"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="west_bound">West Bound</Label>
                  <Input
                    id="west_bound"
                    type="number"
                    step="any"
                    value={geofenceFormData.west_bound}
                    onChange={(e) => setGeofenceFormData({ ...geofenceFormData, west_bound: e.target.value })}
                    placeholder="-122.52"
                    className="mt-2"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={geofenceFormData.address}
                  onChange={(e) => setGeofenceFormData({ ...geofenceFormData, address: e.target.value })}
                  placeholder="Street address"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={geofenceFormData.city}
                  onChange={(e) => setGeofenceFormData({ ...geofenceFormData, city: e.target.value })}
                  placeholder="City"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={geofenceFormData.state}
                  onChange={(e) => setGeofenceFormData({ ...geofenceFormData, state: e.target.value })}
                  placeholder="State"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="zip_code">ZIP Code</Label>
                <Input
                  id="zip_code"
                  value={geofenceFormData.zip_code}
                  onChange={(e) => setGeofenceFormData({ ...geofenceFormData, zip_code: e.target.value })}
                  placeholder="ZIP"
                  className="mt-2"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Switch
                  id="alert_on_entry"
                  checked={geofenceFormData.alert_on_entry}
                  onCheckedChange={(checked) => setGeofenceFormData({ ...geofenceFormData, alert_on_entry: checked })}
                />
                <Label htmlFor="alert_on_entry" className="cursor-pointer">
                  Alert on Entry
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="alert_on_exit"
                  checked={geofenceFormData.alert_on_exit}
                  onCheckedChange={(checked) => setGeofenceFormData({ ...geofenceFormData, alert_on_exit: checked })}
                />
                <Label htmlFor="alert_on_exit" className="cursor-pointer">
                  Alert on Exit
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="alert_on_dwell"
                  checked={geofenceFormData.alert_on_dwell}
                  onCheckedChange={(checked) => setGeofenceFormData({ ...geofenceFormData, alert_on_dwell: checked })}
                />
                <Label htmlFor="alert_on_dwell" className="cursor-pointer">
                  Alert on Dwell (Extended Stay)
                </Label>
              </div>

              {geofenceFormData.alert_on_dwell && (
                <div>
                  <Label htmlFor="dwell_time_minutes">Dwell Time (minutes)</Label>
                  <Input
                    id="dwell_time_minutes"
                    type="number"
                    value={geofenceFormData.dwell_time_minutes}
                    onChange={(e) => setGeofenceFormData({ ...geofenceFormData, dwell_time_minutes: e.target.value })}
                    placeholder="30"
                    className="mt-2"
                  />
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={geofenceFormData.is_active}
                  onCheckedChange={(checked) => setGeofenceFormData({ ...geofenceFormData, is_active: checked })}
                />
                <Label htmlFor="is_active" className="cursor-pointer">
                  Active
                </Label>
              </div>
            </div>

            <div>
              <Label>Assigned Trucks (Optional)</Label>
              <div className="mt-2 space-y-2 max-h-32 overflow-y-auto border rounded-lg p-2">
                {trucks.map((truck) => (
                  <div key={truck.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`truck-${truck.id}`}
                      checked={geofenceFormData.assigned_trucks.includes(truck.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setGeofenceFormData({
                            ...geofenceFormData,
                            assigned_trucks: [...geofenceFormData.assigned_trucks, truck.id],
                          })
                        } else {
                          setGeofenceFormData({
                            ...geofenceFormData,
                            assigned_trucks: geofenceFormData.assigned_trucks.filter((id) => id !== truck.id),
                          })
                        }
                      }}
                    />
                    <Label htmlFor={`truck-${truck.id}`} className="cursor-pointer">
                      {truck.truck_number} - {truck.make} {truck.model}
                    </Label>
          </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Assigned Routes (Optional)</Label>
              <div className="mt-2 space-y-2 max-h-32 overflow-y-auto border rounded-lg p-2">
                {routes.map((route) => (
                  <div key={route.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`route-${route.id}`}
                      checked={geofenceFormData.assigned_routes.includes(route.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setGeofenceFormData({
                            ...geofenceFormData,
                            assigned_routes: [...geofenceFormData.assigned_routes, route.id],
                          })
                        } else {
                          setGeofenceFormData({
                            ...geofenceFormData,
                            assigned_routes: geofenceFormData.assigned_routes.filter((id) => id !== route.id),
                          })
                        }
                      }}
                    />
                    <Label htmlFor={`route-${route.id}`} className="cursor-pointer">
                      {route.name} - {route.origin} to {route.destination}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

          <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
              setShowGeofenceDialog(false)
                  if (drawnShapeRef.current) {
                    drawnShapeRef.current.setMap(null)
                    drawnShapeRef.current = null
                  }
                  if (drawingManagerRef.current) {
                    drawingManagerRef.current.setDrawingMode(null)
                  }
                }}
              >
              Cancel
            </Button>
              <Button type="submit" disabled={isCreatingGeofence}>
                {isCreatingGeofence ? "Creating..." : "Create Zone"}
            </Button>
          </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Separate component for the drawing map in the dialog
function GeofenceDrawingMap({
  mapRef,
  mapInstanceRef,
  drawingManagerRef,
  drawnShapeRef,
  zoneType,
  onShapeComplete,
}: {
  mapRef: React.RefObject<HTMLDivElement | null>
  mapInstanceRef: React.MutableRefObject<any>
  drawingManagerRef: React.MutableRefObject<any>
  drawnShapeRef: React.MutableRefObject<any>
  zoneType: "circle" | "polygon" | "rectangle"
  onShapeComplete: (
    shape: any,
    payload?:
      | { kind: "circle"; center: { lat: number; lng: number }; radius: number }
      | { kind: "rectangle"; bounds: { north: number; south: number; east: number; west: number } }
      | { kind: "polygon" }
  ) => void
}) {
  const localMapInstanceRef = useRef<any>(null)
  const applyDrawingMode = (mode: "circle" | "polygon" | "rectangle") => {
    if (!drawingManagerRef.current || !window.google?.maps?.drawing) return
    const overlayType = mode === "circle"
      ? window.google.maps.drawing.OverlayType.CIRCLE
      : mode === "rectangle"
        ? window.google.maps.drawing.OverlayType.RECTANGLE
        : window.google.maps.drawing.OverlayType.POLYGON
    drawingManagerRef.current.setDrawingMode(overlayType)
  }
  
  useEffect(() => {
    if (!mapRef.current) return

    const initMap = () => {
      if (localMapInstanceRef.current) {
        return // Already initialized
      }

      if (!window.google || !window.google.maps) {
        return
      }

      if (!mapRef.current) {
        return
      }

      const map = new window.google.maps.Map(mapRef.current!, {
        center: { lat: 37.7749, lng: -122.4194 },
        zoom: 10,
      })

      localMapInstanceRef.current = map
      // Only set parent ref if it's not already set (to avoid overwriting main map)
      if (!mapInstanceRef.current) {
        mapInstanceRef.current = map
      }

      const drawingManager = new window.google.maps.drawing.DrawingManager({
        drawingMode: null,
        drawingControl: false,
        circleOptions: {
          fillColor: "#3b82f6",
          fillOpacity: 0.15,
          strokeColor: "#3b82f6",
          strokeWeight: 2,
          clickable: false,
          editable: true,
          zIndex: 1,
        },
        rectangleOptions: {
          fillColor: "#3b82f6",
          fillOpacity: 0.15,
          strokeColor: "#3b82f6",
          strokeWeight: 2,
          clickable: false,
          editable: true,
          zIndex: 1,
        },
        polygonOptions: {
          fillColor: "#3b82f6",
          fillOpacity: 0.15,
          strokeColor: "#3b82f6",
          strokeWeight: 2,
          clickable: false,
          editable: true,
          zIndex: 1,
        },
      })

      drawingManager.setMap(localMapInstanceRef.current)
      drawingManagerRef.current = drawingManager
      applyDrawingMode(zoneType)

      drawingManager.addListener("circlecomplete", (circle: any) => {
        const center = circle.getCenter()
        const radius = circle.getRadius()
        onShapeComplete(circle, { kind: "circle", center: { lat: center.lat(), lng: center.lng() }, radius })
        drawingManager.setDrawingMode(null)
      })

      drawingManager.addListener("rectanglecomplete", (rectangle: any) => {
        const bounds = rectangle.getBounds()
        const ne = bounds.getNorthEast()
        const sw = bounds.getSouthWest()
        onShapeComplete(rectangle, {
          kind: "rectangle",
          bounds: {
            north: ne.lat(),
            east: ne.lng(),
            south: sw.lat(),
            west: sw.lng(),
          },
        })
        drawingManager.setDrawingMode(null)
      })

      drawingManager.addListener("polygoncomplete", (polygon: any) => {
        onShapeComplete(polygon, { kind: "polygon" })
        drawingManager.setDrawingMode(null)
      })
    }

    let checkInterval: any = null
    let waitForScript: any = null

    // If Google Maps is already loaded, initialize immediately
    if (window.google && window.google.maps) {
      setTimeout(initMap, 300)
      return () => {
        if (checkInterval) clearInterval(checkInterval)
        if (waitForScript) clearInterval(waitForScript)
        if (localMapInstanceRef.current && mapInstanceRef.current === localMapInstanceRef.current) {
          mapInstanceRef.current = null
        }
        localMapInstanceRef.current = null
      }
    }

    // Check if script is already being loaded
    if (document.querySelector(`script[src*="maps.googleapis.com"]`)) {
      // Wait for it to load
      checkInterval = setInterval(() => {
        if (window.google && window.google.maps) {
          clearInterval(checkInterval)
          setTimeout(initMap, 300)
        }
      }, 100)
      
      setTimeout(() => clearInterval(checkInterval), 10000)
      return () => {
        if (checkInterval) clearInterval(checkInterval)
        if (waitForScript) clearInterval(waitForScript)
        if (localMapInstanceRef.current && mapInstanceRef.current === localMapInstanceRef.current) {
          mapInstanceRef.current = null
        }
        localMapInstanceRef.current = null
      }
    }

    // Script should already be loaded by the main FleetMap component
    // If not, wait a bit and check again
    waitForScript = setInterval(() => {
      if (window.google && window.google.maps) {
        clearInterval(waitForScript)
        setTimeout(initMap, 300)
      }
    }, 100)

    setTimeout(() => clearInterval(waitForScript), 10000)

    // Cleanup: clear timers and restore refs when dialog closes/unmounts
    return () => {
      if (checkInterval) clearInterval(checkInterval)
      if (waitForScript) clearInterval(waitForScript)
      if (localMapInstanceRef.current && mapInstanceRef.current === localMapInstanceRef.current) {
        mapInstanceRef.current = null
      }
      localMapInstanceRef.current = null
    }
  }, [mapRef, mapInstanceRef, drawingManagerRef, onShapeComplete])

  useEffect(() => {
    applyDrawingMode(zoneType)
  }, [zoneType])

  return null
}

