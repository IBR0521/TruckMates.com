"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import {
  Package,
  Route,
  User,
  Truck,
  Clock,
  MapPin,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Phone,
  Mail,
  FileText,
  Info,
  Sparkles,
  BookOpen,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import {
  getUnassignedLoads,
  getUnassignedRoutes,
  quickAssignLoad,
  quickAssignRoute,
} from "@/app/actions/dispatches"
import { getDrivers } from "@/app/actions/drivers"
import { getTrucks } from "@/app/actions/trucks"
import { findNearbyDriversForLoad, type NearbyDriver } from "@/app/actions/proximity-dispatching"
import { getAllDriversHOSStatus, type DriverHOSStatus } from "@/app/actions/dispatcher-hos"
import { getLoadDetails, type LoadDetails } from "@/app/actions/load-details"
import { DispatchGantt } from "@/components/dispatch/dispatch-gantt"
import { DispatchAssist } from "@/components/dispatch/dispatch-assist"
import { type TimelineJob } from "@/app/actions/dispatch-timeline"
import { format } from "date-fns"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { createClient } from "@/lib/supabase/client"
import { useRealtimeSubscription } from "@/lib/hooks/use-realtime"

export default function DispatchesPage() {
  const [unassignedLoads, setUnassignedLoads] = useState<any[]>([])
  const [unassignedRoutes, setUnassignedRoutes] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [trucks, setTrucks] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [assigning, setAssigning] = useState<string | null>(null)
  const [nearbyDriversModal, setNearbyDriversModal] = useState<{ open: boolean; loadId: string | null; drivers: NearbyDriver[] }>({
    open: false,
    loadId: null,
    drivers: []
  })
  const [findingNearby, setFindingNearby] = useState<string | null>(null)
  const [driversHOS, setDriversHOS] = useState<DriverHOSStatus[]>([])
  const [hosLoading, setHosLoading] = useState(false)
  const [selectedLoadId, setSelectedLoadId] = useState<string | null>(null)
  const [loadDetails, setLoadDetails] = useState<LoadDetails | null>(null)
  const [loadDetailsLoading, setLoadDetailsLoading] = useState(false)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [showDispatchAssist, setShowDispatchAssist] = useState<string | null>(null)

  // Get company ID for real-time filtering
  useEffect(() => {
    async function getCompanyId() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: userData } = await supabase
          .from("users")
          .select("company_id")
          .eq("id", user.id)
          .single()
        if (userData?.company_id) {
          setCompanyId(userData.company_id)
        }
      }
    }
    getCompanyId()
  }, [])

  useEffect(() => {
    loadData()
    loadHOSData()
    
    // Refresh HOS data every 30 seconds (keep as fallback)
    const hosInterval = setInterval(loadHOSData, 30000)
    return () => clearInterval(hosInterval)
  }, [])

  // Real-time subscription for loads (Phase 1: Visual Clarity)
  useRealtimeSubscription<any>(
    "loads",
    {
      filter: companyId ? `company_id=eq.${companyId}` : undefined,
      event: "*",
      enabled: !!companyId,
      onUpdate: (payload) => {
        // Update load in local state instantly
        setUnassignedLoads((prev) => {
          const updated = prev.map((load) =>
            load.id === payload.id ? { ...load, ...payload } : load
          )
          // Remove if no longer unassigned
          return updated.filter(
            (load) => !load.driver_id || !load.truck_id || load.status === "pending"
          )
        })
        
        // Update load details if it's the selected load
        if (selectedLoadId === payload.id) {
          setLoadDetails((prev) => prev ? { ...prev, ...payload } : null)
        }
        
        // Show toast notification for status changes (only if status actually changed)
        if (payload.status && payload.shipment_number) {
          toast.info(`Load ${payload.shipment_number} status updated: ${payload.status}`)
        }
      },
      onInsert: (payload) => {
        // Add new unassigned load
        if (!payload.driver_id || !payload.truck_id || payload.status === "pending") {
          setUnassignedLoads((prev) => {
            // Check if load already exists to avoid duplicates
            if (prev.some(load => load.id === payload.id)) {
              return prev
            }
            return [payload, ...prev]
          })
          if (payload.shipment_number) {
            toast.info(`New load added: ${payload.shipment_number}`)
          }
        }
      },
      onDelete: (payload) => {
        // Remove deleted load
        setUnassignedLoads((prev) => prev.filter((load) => load.id !== payload.id))
      },
    }
  )

  async function loadData() {
    setIsLoading(true)
    try {
      const [loadsResult, routesResult, driversResult, trucksResult] = await Promise.all([
        getUnassignedLoads(),
        getUnassignedRoutes(),
        getDrivers(),
        getTrucks(),
      ])

      if (loadsResult.data) setUnassignedLoads(loadsResult.data)
      if (routesResult.data) setUnassignedRoutes(routesResult.data)
      if (driversResult.data) setDrivers(driversResult.data.filter((d: any) => d.status === "active"))
      if (trucksResult.data) setTrucks(trucksResult.data.filter((t: any) => t.status === "available" || t.status === "in_use"))
    } catch (error: any) {
      toast.error("Failed to load dispatch data")
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  async function loadHOSData() {
    setHosLoading(true)
    try {
      const result = await getAllDriversHOSStatus()
      if (result.error) {
        console.error("Failed to load HOS data:", result.error)
      } else if (result.data) {
        setDriversHOS(result.data)
      }
    } catch (error: any) {
      console.error("Failed to load HOS data:", error)
    } finally {
      setHosLoading(false)
    }
  }

  function getHOSColor(remainingHours: number, type: 'drive' | 'onDuty'): string {
    if (type === 'drive') {
      if (remainingHours >= 4) return "bg-green-500"
      if (remainingHours >= 2) return "bg-yellow-500"
      return "bg-orange-500" // Changed from red to orange
    } else {
      if (remainingHours >= 6) return "bg-green-500"
      if (remainingHours >= 3) return "bg-yellow-500"
      return "bg-orange-500" // Changed from red to orange
    }
  }

  function getHOSStatus(driver: DriverHOSStatus): { label: string; color: string } {
    if (!driver.can_drive) {
      return { label: "Cannot Drive", color: "text-orange-500" } // Changed from red to orange
    }
    if (driver.needs_break) {
      return { label: "Break Required", color: "text-yellow-500" }
    }
    if (driver.remaining_drive_hours < 2) {
      return { label: "Low Hours", color: "text-yellow-500" }
    }
    return { label: "Available", color: "text-green-500" }
  }

  async function handleAssignLoad(loadId: string, driverId?: string, truckId?: string) {
    if (!driverId && !truckId) {
      toast.error("Please select a driver or truck")
      return
    }

    setAssigning(`load-${loadId}`)
    try {
      const result = await quickAssignLoad(loadId, driverId, truckId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Load assigned successfully")
        await loadData()
      }
    } catch (error: any) {
      toast.error("Failed to assign load")
    } finally {
      setAssigning(null)
    }
  }

  async function handleAssignRoute(routeId: string, driverId?: string, truckId?: string) {
    if (!driverId && !truckId) {
      toast.error("Please select a driver or truck")
      return
    }

    setAssigning(`route-${routeId}`)
    try {
      const result = await quickAssignRoute(routeId, driverId, truckId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Route assigned successfully")
        await loadData()
      }
    } catch (error: any) {
      toast.error("Failed to assign route")
    } finally {
      setAssigning(null)
    }
  }

  async function handleFindNearbyDrivers(loadId: string) {
    setFindingNearby(loadId)
    try {
      const result = await findNearbyDriversForLoad(loadId, {
        max_radius_km: 50,
        min_drive_hours: 4,
        min_on_duty_hours: 6,
        limit: 3
      })
      
      if (result.error) {
        toast.error(result.error)
      } else if (result.data && result.data.length > 0) {
        setNearbyDriversModal({
          open: true,
          loadId,
          drivers: result.data
        })
      } else {
        toast.info("No nearby drivers found with sufficient HOS")
      }
    } catch (error: any) {
      toast.error("Failed to find nearby drivers")
    } finally {
      setFindingNearby(null)
    }
  }

  async function handleAssignFromNearby(loadId: string, driverId: string, truckId: string) {
    setAssigning(`load-${loadId}`)
    setNearbyDriversModal({ open: false, loadId: null, drivers: [] })
    try {
      const result = await quickAssignLoad(loadId, driverId, truckId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Load assigned successfully")
        await loadData()
      }
    } catch (error: any) {
      toast.error("Failed to assign load")
    } finally {
      setAssigning(null)
    }
  }

  function getStatusBadge(status: string, statusColor?: string) {
    // Use status_color from database if available, otherwise fallback to default colors
    const defaultColors: Record<string, string> = {
      pending: "bg-amber-500/20 text-amber-400 border-amber-500/30", // Changed from yellow to amber
      scheduled: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      in_progress: "bg-green-500/20 text-green-400 border-green-500/30",
      in_transit: "bg-green-500/20 text-green-400 border-green-500/30",
      completed: "bg-gray-500/20 text-gray-400 border-gray-500/30",
      delivered: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    }
    
    // If status_color is provided, use it with opacity
    if (statusColor) {
      const colorMap: Record<string, string> = {
        "#EF4444": "bg-orange-500/20 text-orange-400 border-orange-500/30", // Changed: Red -> Orange for delayed
        "#F97316": "bg-amber-500/20 text-amber-400 border-amber-500/30", // Changed: Orange -> Amber for urgent
        "#10B981": "bg-green-500/20 text-green-400 border-green-500/30", // Green - En Route
        "#3B82F6": "bg-blue-500/20 text-blue-400 border-blue-500/30", // Blue - Scheduled
        "#F59E0B": "bg-amber-500/20 text-amber-400 border-amber-500/30", // Amber - Needs Attention
        "#9CA3AF": "bg-gray-500/20 text-gray-400 border-gray-500/30", // Gray - Completed
        "#6B7280": "bg-slate-500/20 text-slate-400 border-slate-500/30", // Changed: Gray -> Slate for default
      }
      return (
        <Badge className={colorMap[statusColor] || defaultColors[status] || "bg-secondary text-foreground border-border"}>
          {status?.replace("_", " ").toUpperCase() || "PENDING"}
        </Badge>
      )
    }
    
    return (
      <Badge className={defaultColors[status] || "bg-secondary text-foreground border-border"}>
        {status?.replace("_", " ").toUpperCase() || "PENDING"}
      </Badge>
    )
  }

  async function handleLoadClick(loadId: string) {
    setSelectedLoadId(loadId)
    setLoadDetailsLoading(true)
    try {
      const result = await getLoadDetails(loadId)
      if (result.error) {
        toast.error(result.error)
        setSelectedLoadId(null)
      } else if (result.data) {
        setLoadDetails(result.data)
      }
    } catch (error: any) {
      toast.error("Failed to load details")
      setSelectedLoadId(null)
    } finally {
      setLoadDetailsLoading(false)
    }
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dispatch Board</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Assign drivers and vehicles to pending loads and routes
          </p>
        </div>
        <Button onClick={loadData} variant="outline" disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Content */}
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Dispatch Assist Modal (Phase 3) */}
          {showDispatchAssist && (
            <DispatchAssist
              loadId={showDispatchAssist}
              onAssigned={() => {
                setShowDispatchAssist(null)
                loadData()
              }}
              onClose={() => setShowDispatchAssist(null)}
            />
          )}

          {/* Gantt Chart Timeline View (Phase 2) */}
          <DispatchGantt
            onJobClick={(job) => {
              if (job.type === "load") {
                handleLoadClick(job.id)
              } else {
                // Handle route click
                toast.info(`Route: ${job.route_name}`)
              }
            }}
          />

          {/* Summary Cards */}
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="border-border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Unassigned Loads</p>
                  <p className="text-3xl font-bold text-foreground">
                    {isLoading ? "..." : unassignedLoads.length}
                  </p>
                </div>
                <Package className="w-10 h-10 text-primary opacity-50" />
              </div>
            </Card>
            <Card className="border-border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Unassigned Routes</p>
                  <p className="text-3xl font-bold text-foreground">
                    {isLoading ? "..." : unassignedRoutes.length}
                  </p>
                </div>
                <Route className="w-10 h-10 text-primary opacity-50" />
              </div>
            </Card>
            <Card className="border-border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Available Drivers</p>
                  <p className="text-3xl font-bold text-foreground">
                    {isLoading ? "..." : drivers.length}
                  </p>
                </div>
                <User className="w-10 h-10 text-primary opacity-50" />
              </div>
            </Card>
          </div>

          {/* Real-Time HOS Status Widget */}
          <Card className="border-border">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-bold text-foreground">Driver HOS Status</h2>
                  <Badge variant="outline" className="ml-2">
                    Real-Time
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadHOSData}
                  disabled={hosLoading}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${hosLoading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>

              {hosLoading && driversHOS.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading HOS data...
                </div>
              ) : driversHOS.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No active drivers with HOS data
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {driversHOS.map((driver) => {
                    const status = getHOSStatus(driver)
                    const maxDriveHours = 11
                    const maxOnDutyHours = 14
                    const driveProgress = (driver.remaining_drive_hours / maxDriveHours) * 100
                    const onDutyProgress = (driver.remaining_on_duty_hours / maxOnDutyHours) * 100

                    return (
                      <Card key={driver.driver_id} className="border-border p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-foreground">{driver.driver_name}</h3>
                              {driver.truck_number && (
                                <Badge variant="outline" className="text-xs">
                                  {driver.truck_number}
                                </Badge>
                              )}
                              <Badge
                                variant="outline"
                                className={`text-xs ${status.color} border-current`}
                              >
                                {status.label}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Status: {driver.current_status.replace('_', ' ')}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {/* Remaining Drive Time */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-muted-foreground">Remaining Drive Time</span>
                              <span className={`text-xs font-semibold ${
                                driver.remaining_drive_hours >= 4 ? 'text-green-500' :
                                driver.remaining_drive_hours >= 2 ? 'text-yellow-500' : 'text-orange-500'
                              }`}>
                                {driver.remaining_drive_hours.toFixed(1)} hrs
                              </span>
                            </div>
                            <div className="relative h-2 w-full bg-secondary rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all ${
                                  driver.remaining_drive_hours >= 4 ? 'bg-green-500' :
                                  driver.remaining_drive_hours >= 2 ? 'bg-yellow-500' : 'bg-orange-500'
                                }`}
                                style={{ width: `${driveProgress}%` }}
                              />
                            </div>
                          </div>

                          {/* Remaining On-Duty Time */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-muted-foreground">Remaining On-Duty Time</span>
                              <span className={`text-xs font-semibold ${
                                driver.remaining_on_duty_hours >= 6 ? 'text-green-500' :
                                driver.remaining_on_duty_hours >= 3 ? 'text-yellow-500' : 'text-orange-500'
                              }`}>
                                {driver.remaining_on_duty_hours.toFixed(1)} hrs
                              </span>
                            </div>
                            <div className="relative h-2 w-full bg-secondary rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all ${
                                  driver.remaining_on_duty_hours >= 6 ? 'bg-green-500' :
                                  driver.remaining_on_duty_hours >= 3 ? 'bg-yellow-500' : 'bg-orange-500'
                                }`}
                                style={{ width: `${onDutyProgress}%` }}
                              />
                            </div>
                          </div>

                          {/* Violations */}
                          {driver.violations.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-border">
                              <div className="flex items-center gap-1 text-xs text-orange-500">
                                <AlertCircle className="w-3 h-3" />
                                <span>{driver.violations.length} violation(s)</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          </Card>

          {/* Unassigned Loads */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Package className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Unassigned Loads</h2>
              <Badge variant="outline" className="ml-auto">
                {unassignedLoads.length} pending
              </Badge>
            </div>

            {isLoading ? (
              <Card className="border-border p-8">
                <p className="text-center text-muted-foreground">Loading loads...</p>
              </Card>
            ) : unassignedLoads.length === 0 ? (
              <Card className="border-border p-8">
                <div className="text-center">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">All loads assigned!</h3>
                  <p className="text-muted-foreground mb-4">There are no unassigned loads at the moment.</p>
                  <Link href="/dashboard/loads/add">
                    <Button variant="outline">Create New Load</Button>
                  </Link>
                </div>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {unassignedLoads.map((load) => {
                  // Sort by urgency_score (highest first) for visual prioritization
                  const urgencyScore = load.urgency_score || 0
                  const statusColor = load.status_color || "#6B7280"
                  
                  return (
                    <Card 
                      key={load.id} 
                      className="border-border p-4 hover:border-primary/50 transition-all cursor-pointer"
                      onClick={() => handleLoadClick(load.id)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-foreground">{load.shipment_number}</h3>
                            {getStatusBadge(load.status, statusColor)}
                            {load.priority && load.priority !== 'normal' && (
                              <Badge variant="outline" className="text-xs">
                                {load.priority.toUpperCase()}
                              </Badge>
                            )}
                          </div>
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <MapPin className="w-3 h-3" />
                              <span>{load.origin} → {load.destination}</span>
                            </div>
                            {load.load_date && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                <span>{format(new Date(load.load_date), "MMM dd, yyyy")}</span>
                              </div>
                            )}
                            {urgencyScore >= 70 && (
                              <div className="flex items-center gap-1 text-xs text-orange-500 font-semibold">
                                <AlertCircle className="w-3 h-3" />
                                <span>URGENT</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleLoadClick(load.id)
                          }}
                        >
                          <Info className="w-4 h-4" />
                        </Button>
                      </div>

                    <div className="space-y-3 pt-3 border-t border-border" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => handleFindNearbyDrivers(load.id)}
                        disabled={findingNearby === load.id}
                      >
                        <MapPin className="w-4 h-4 mr-2" />
                        {findingNearby === load.id ? "Finding..." : "Find Nearby Drivers"}
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="w-full"
                        onClick={() => setShowDispatchAssist(load.id)}
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Dispatch Assist
                      </Button>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Assign Driver</Label>
                        <Select
                          value={load.driver_id || undefined}
                          onValueChange={(value) => handleAssignLoad(load.id, value, load.truck_id)}
                          disabled={assigning === `load-${load.id}`}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select driver" />
                          </SelectTrigger>
                          <SelectContent>
                            {drivers.map((driver) => (
                              <SelectItem key={driver.id} value={driver.id}>
                                {driver.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Assign Vehicle</Label>
                        <Select
                          value={load.truck_id || undefined}
                          onValueChange={(value) => handleAssignLoad(load.id, load.driver_id, value)}
                          disabled={assigning === `load-${load.id}`}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select vehicle" />
                          </SelectTrigger>
                          <SelectContent>
                            {trucks.map((truck) => (
                              <SelectItem key={truck.id} value={truck.id}>
                                {truck.truck_number} {truck.make && truck.model ? `- ${truck.make} ${truck.model}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </Card>
                  )
                })}
              </div>
            )}
          </div>

          {/* Unassigned Routes */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Route className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Unassigned Routes</h2>
              <Badge variant="outline" className="ml-auto">
                {unassignedRoutes.length} pending
              </Badge>
            </div>

            {isLoading ? (
              <Card className="border-border p-8">
                <p className="text-center text-muted-foreground">Loading routes...</p>
              </Card>
            ) : unassignedRoutes.length === 0 ? (
              <Card className="border-border p-8">
                <div className="text-center">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">All routes assigned!</h3>
                  <p className="text-muted-foreground mb-4">There are no unassigned routes at the moment.</p>
                  <Link href="/dashboard/routes/add">
                    <Button variant="outline">Create New Route</Button>
                  </Link>
                </div>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {unassignedRoutes.map((route) => (
                  <Card key={route.id} className="border-border p-4 hover:border-primary/50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-foreground">{route.name}</h3>
                          {getStatusBadge(route.status)}
                        </div>
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="w-3 h-3" />
                            <span>{route.origin} → {route.destination}</span>
                          </div>
                          {route.distance && (
                            <div className="text-muted-foreground text-xs">
                              Distance: {route.distance}
                            </div>
                          )}
                          {route.priority && route.priority !== "normal" && (
                            <Badge variant="outline" className="text-xs">
                              {route.priority.toUpperCase()} Priority
                            </Badge>
                          )}
                        </div>
                      </div>
                      {route.id && typeof route.id === 'string' && route.id.trim() !== '' ? (
                        <Link href={`/dashboard/routes/${route.id}`}>
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </Link>
                      ) : null}
                    </div>

                    <div className="space-y-3 pt-3 border-t border-border">
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Assign Driver</Label>
                        <Select
                          value={route.driver_id || undefined}
                          onValueChange={(value) => handleAssignRoute(route.id, value, route.truck_id)}
                          disabled={assigning === `route-${route.id}`}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select driver" />
                          </SelectTrigger>
                          <SelectContent>
                            {drivers.map((driver) => (
                              <SelectItem key={driver.id} value={driver.id}>
                                {driver.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Assign Vehicle</Label>
                        <Select
                          value={route.truck_id || undefined}
                          onValueChange={(value) => handleAssignRoute(route.id, route.driver_id, value)}
                          disabled={assigning === `route-${route.id}`}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select vehicle" />
                          </SelectTrigger>
                          <SelectContent>
                            {trucks.map((truck) => (
                              <SelectItem key={truck.id} value={truck.id}>
                                {truck.truck_number} {truck.make && truck.model ? `- ${truck.make} ${truck.model}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Nearby Drivers Modal */}
      <Dialog open={nearbyDriversModal.open} onOpenChange={(open) => setNearbyDriversModal({ open, loadId: null, drivers: [] })}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nearby Drivers with HOS</DialogTitle>
            <DialogDescription>
              Top drivers near the pickup location with sufficient Hours of Service remaining
            </DialogDescription>
          </DialogHeader>
          
          {nearbyDriversModal.drivers.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">No nearby drivers found</p>
            </div>
          ) : (
            <div className="space-y-4 mt-4">
              {nearbyDriversModal.drivers.map((driver, index) => (
                <Card key={driver.driver_id} className="border-border p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">
                          #{index + 1} Closest
                        </Badge>
                        <h3 className="font-semibold text-foreground">{driver.driver_name}</h3>
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Truck className="w-3 h-3" />
                          <span>{driver.truck_number}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3 h-3" />
                          <span>{driver.distance_miles.toFixed(1)} miles away</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          <span>Status: {driver.current_status.replace('_', ' ')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mb-3 pt-3 border-t border-border">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Remaining Drive Time</p>
                      <p className="text-lg font-semibold text-green-500">
                        {driver.remaining_drive_hours.toFixed(1)} hrs
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Remaining On-Duty Time</p>
                      <p className="text-lg font-semibold text-blue-500">
                        {driver.remaining_on_duty_hours.toFixed(1)} hrs
                      </p>
                    </div>
                  </div>
                  
                  <Button
                    className="w-full"
                    onClick={() => handleAssignFromNearby(
                      nearbyDriversModal.loadId!,
                      driver.driver_id,
                      driver.truck_id
                    )}
                    disabled={assigning === `load-${nearbyDriversModal.loadId}`}
                  >
                    {assigning === `load-${nearbyDriversModal.loadId}` ? "Assigning..." : "Assign This Driver"}
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Load Details Flyout (Phase 1: Contextual Data) */}
      <Sheet open={!!selectedLoadId} onOpenChange={(open) => {
        if (!open) {
          setSelectedLoadId(null)
          setLoadDetails(null)
        }
      }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {loadDetails ? `Load: ${loadDetails.shipment_number}` : "Load Details"}
            </SheetTitle>
            <SheetDescription>
              Complete load information and contextual data for dispatch decisions
            </SheetDescription>
          </SheetHeader>

          {loadDetailsLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading details...</span>
            </div>
          ) : loadDetails ? (
            <div className="mt-6 space-y-6">
              {/* Status & Priority */}
              <Card className="border-border p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {getStatusBadge(loadDetails.status, loadDetails.status_color)}
                    {loadDetails.priority && loadDetails.priority !== 'normal' && (
                      <Badge variant="outline">{loadDetails.priority.toUpperCase()}</Badge>
                    )}
                    {loadDetails.urgency_score >= 70 && (
                      <Badge variant="destructive">URGENT</Badge>
                    )}
                  </div>
                  {loadDetails.urgency_score > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Urgency: {loadDetails.urgency_score}/100
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Origin</p>
                    <p className="font-semibold">{loadDetails.origin}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Destination</p>
                    <p className="font-semibold">{loadDetails.destination}</p>
                  </div>
                  {loadDetails.load_date && (
                    <div>
                      <p className="text-muted-foreground">Pickup Date</p>
                      <p className="font-semibold">{format(new Date(loadDetails.load_date), "MMM dd, yyyy")}</p>
                    </div>
                  )}
                  {loadDetails.estimated_delivery && (
                    <div>
                      <p className="text-muted-foreground">Estimated Delivery</p>
                      <p className="font-semibold">{format(new Date(loadDetails.estimated_delivery), "MMM dd, yyyy")}</p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Driver HOS (if assigned) */}
              {loadDetails.driver && (
                <Card className="border-border p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Driver: {loadDetails.driver.name}
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-4 text-sm">
                      {loadDetails.driver.phone && (
                        <a href={`tel:${loadDetails.driver.phone}`} className="flex items-center gap-1 text-primary hover:underline">
                          <Phone className="w-3 h-3" />
                          {loadDetails.driver.phone}
                        </a>
                      )}
                      {loadDetails.driver.email && (
                        <a href={`mailto:${loadDetails.driver.email}`} className="flex items-center gap-1 text-primary hover:underline">
                          <Mail className="w-3 h-3" />
                          {loadDetails.driver.email}
                        </a>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Remaining Drive Time</p>
                        <p className={`text-lg font-semibold ${
                          loadDetails.driver.remaining_drive_hours >= 4 ? 'text-green-500' :
                          loadDetails.driver.remaining_drive_hours >= 2 ? 'text-yellow-500' : 'text-orange-500'
                        }`}>
                          {loadDetails.driver.remaining_drive_hours.toFixed(1)} hrs
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Remaining On-Duty Time</p>
                        <p className={`text-lg font-semibold ${
                          loadDetails.driver.remaining_on_duty_hours >= 6 ? 'text-green-500' :
                          loadDetails.driver.remaining_on_duty_hours >= 3 ? 'text-yellow-500' : 'text-orange-500'
                        }`}>
                          {loadDetails.driver.remaining_on_duty_hours.toFixed(1)} hrs
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Current Status: <span className="font-semibold text-foreground">{loadDetails.driver.current_status.replace('_', ' ')}</span>
                    </div>
                  </div>
                </Card>
              )}

              {/* Truck Info (if assigned) */}
              {loadDetails.truck && (
                <Card className="border-border p-4">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Truck className="w-4 h-4" />
                    Vehicle: {loadDetails.truck.truck_number}
                  </h3>
                  {loadDetails.truck.make && loadDetails.truck.model && (
                    <p className="text-sm text-muted-foreground">
                      {loadDetails.truck.make} {loadDetails.truck.model}
                    </p>
                  )}
                </Card>
              )}

              {/* Broker Info */}
              {loadDetails.broker && (
                <Card className="border-border p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Broker: {loadDetails.broker.name}
                  </h3>
                  <div className="space-y-2 text-sm">
                    {loadDetails.broker.phone && (
                      <a href={`tel:${loadDetails.broker.phone}`} className="flex items-center gap-2 text-primary hover:underline">
                        <Phone className="w-3 h-3" />
                        {loadDetails.broker.phone}
                      </a>
                    )}
                    {loadDetails.broker.email && (
                      <a href={`mailto:${loadDetails.broker.email}`} className="flex items-center gap-2 text-primary hover:underline">
                        <Mail className="w-3 h-3" />
                        {loadDetails.broker.email}
                      </a>
                    )}
                    {loadDetails.broker.w9_url && (
                      <a href={loadDetails.broker.w9_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                        <FileText className="w-3 h-3" />
                        View W-9
                      </a>
                    )}
                    {loadDetails.broker.insurance_url && (
                      <a href={loadDetails.broker.insurance_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                        <FileText className="w-3 h-3" />
                        View Insurance
                      </a>
                    )}
                  </div>
                </Card>
              )}

              {/* Customer Info */}
              {loadDetails.customer && (
                <Card className="border-border p-4">
                  <h3 className="font-semibold mb-2">Customer: {loadDetails.customer.name}</h3>
                  <div className="space-y-1 text-sm">
                    {loadDetails.customer.phone && (
                      <a href={`tel:${loadDetails.customer.phone}`} className="flex items-center gap-2 text-primary hover:underline">
                        <Phone className="w-3 h-3" />
                        {loadDetails.customer.phone}
                      </a>
                    )}
                    {loadDetails.customer.email && (
                      <a href={`mailto:${loadDetails.customer.email}`} className="flex items-center gap-2 text-primary hover:underline">
                        <Mail className="w-3 h-3" />
                        {loadDetails.customer.email}
                      </a>
                    )}
                  </div>
                </Card>
              )}

              {/* Delivery Points */}
              {loadDetails.delivery_points.length > 0 && (
                <Card className="border-border p-4">
                  <h3 className="font-semibold mb-3">Delivery Points ({loadDetails.delivery_points.length})</h3>
                  <div className="space-y-2">
                    {loadDetails.delivery_points.map((point) => (
                      <div key={point.id} className="text-sm border-l-2 border-primary/30 pl-3">
                        <p className="font-semibold">{point.location_name || `Delivery #${point.delivery_number}`}</p>
                        <p className="text-muted-foreground">{point.address}</p>
                        {point.scheduled_delivery_date && (
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(point.scheduled_delivery_date), "MMM dd, yyyy")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Address Book Custom Fields */}
              {(loadDetails.shipper_address_book || loadDetails.consignee_address_book) && (
                <Card className="border-border p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    Address Book Details
                  </h3>
                  <div className="space-y-4 text-sm">
                    {loadDetails.shipper_address_book && (
                      <div>
                        <p className="text-muted-foreground mb-2 font-semibold">Shipper: {loadDetails.shipper_address_book.name}</p>
                        {loadDetails.shipper_address_book.formatted_address && (
                          <p className="text-foreground mb-2">{loadDetails.shipper_address_book.formatted_address}</p>
                        )}
                        {loadDetails.shipper_address_book.custom_fields && Object.keys(loadDetails.shipper_address_book.custom_fields).length > 0 && (
                          <div className="space-y-1 mt-2">
                            {loadDetails.shipper_address_book.custom_fields.gate_code && (
                              <p><span className="text-muted-foreground">Gate Code:</span> <span className="font-semibold">{loadDetails.shipper_address_book.custom_fields.gate_code}</span></p>
                            )}
                            {loadDetails.shipper_address_book.custom_fields.warehouse_hours && (
                              <p><span className="text-muted-foreground">Hours:</span> {loadDetails.shipper_address_book.custom_fields.warehouse_hours}</p>
                            )}
                            {loadDetails.shipper_address_book.custom_fields.dock_count && (
                              <p><span className="text-muted-foreground">Docks:</span> {loadDetails.shipper_address_book.custom_fields.dock_count}</p>
                            )}
                            {loadDetails.shipper_address_book.custom_fields.loading_instructions && (
                              <p><span className="text-muted-foreground">Loading Instructions:</span> {loadDetails.shipper_address_book.custom_fields.loading_instructions}</p>
                            )}
                            {loadDetails.shipper_address_book.custom_fields.accepts_flatbed_after_3pm !== undefined && (
                              <p><span className="text-muted-foreground">Accepts Flatbed After 3PM:</span> {loadDetails.shipper_address_book.custom_fields.accepts_flatbed_after_3pm ? "Yes" : "No"}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {loadDetails.consignee_address_book && (
                      <div>
                        <p className="text-muted-foreground mb-2 font-semibold">Consignee: {loadDetails.consignee_address_book.name}</p>
                        {loadDetails.consignee_address_book.formatted_address && (
                          <p className="text-foreground mb-2">{loadDetails.consignee_address_book.formatted_address}</p>
                        )}
                        {loadDetails.consignee_address_book.custom_fields && Object.keys(loadDetails.consignee_address_book.custom_fields).length > 0 && (
                          <div className="space-y-1 mt-2">
                            {loadDetails.consignee_address_book.custom_fields.gate_code && (
                              <p><span className="text-muted-foreground">Gate Code:</span> <span className="font-semibold">{loadDetails.consignee_address_book.custom_fields.gate_code}</span></p>
                            )}
                            {loadDetails.consignee_address_book.custom_fields.warehouse_hours && (
                              <p><span className="text-muted-foreground">Hours:</span> {loadDetails.consignee_address_book.custom_fields.warehouse_hours}</p>
                            )}
                            {loadDetails.consignee_address_book.custom_fields.dock_count && (
                              <p><span className="text-muted-foreground">Docks:</span> {loadDetails.consignee_address_book.custom_fields.dock_count}</p>
                            )}
                            {loadDetails.consignee_address_book.custom_fields.loading_instructions && (
                              <p><span className="text-muted-foreground">Delivery Instructions:</span> {loadDetails.consignee_address_book.custom_fields.loading_instructions}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Notes & Instructions */}
              {(loadDetails.pickup_notes || loadDetails.delivery_notes || loadDetails.special_instructions || loadDetails.notes.length > 0) && (
                <Card className="border-border p-4">
                  <h3 className="font-semibold mb-3">Notes & Instructions</h3>
                  <div className="space-y-3 text-sm">
                    {loadDetails.pickup_notes && (
                      <div>
                        <p className="text-muted-foreground mb-1">Pickup Notes:</p>
                        <p className="text-foreground">{loadDetails.pickup_notes}</p>
                      </div>
                    )}
                    {loadDetails.delivery_notes && (
                      <div>
                        <p className="text-muted-foreground mb-1">Delivery Notes:</p>
                        <p className="text-foreground">{loadDetails.delivery_notes}</p>
                      </div>
                    )}
                    {loadDetails.special_instructions && (
                      <div>
                        <p className="text-muted-foreground mb-1">Special Instructions:</p>
                        <p className="text-foreground font-semibold">{loadDetails.special_instructions}</p>
                      </div>
                    )}
                    {loadDetails.notes.length > 0 && (
                      <div>
                        <p className="text-muted-foreground mb-2">Additional Notes:</p>
                        <div className="space-y-2">
                          {loadDetails.notes.map((note) => (
                            <div key={note.id} className="text-xs border-l-2 border-border pl-2">
                              <p className="text-foreground">{note.note}</p>
                              <p className="text-muted-foreground mt-1">
                                {format(new Date(note.created_at), "MMM dd, yyyy HH:mm")}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Load Details */}
              <Card className="border-border p-4">
                <h3 className="font-semibold mb-3">Load Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {loadDetails.weight_kg && (
                    <div>
                      <p className="text-muted-foreground">Weight</p>
                      <p className="font-semibold">{(loadDetails.weight_kg / 1000).toFixed(1)} tons</p>
                    </div>
                  )}
                  {loadDetails.contents && (
                    <div>
                      <p className="text-muted-foreground">Contents</p>
                      <p className="font-semibold">{loadDetails.contents}</p>
                    </div>
                  )}
                  {loadDetails.rate && (
                    <div>
                      <p className="text-muted-foreground">Rate</p>
                      <p className="font-semibold">${loadDetails.rate.toLocaleString()}</p>
                    </div>
                  )}
                  {loadDetails.value && (
                    <div>
                      <p className="text-muted-foreground">Value</p>
                      <p className="font-semibold">${loadDetails.value.toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Quick Actions */}
              <div className="flex gap-2 pt-4 border-t border-border">
                <Button
                  className="flex-1"
                  onClick={() => {
                    if (loadDetails.id) {
                      handleFindNearbyDrivers(loadDetails.id)
                      setSelectedLoadId(null)
                    }
                  }}
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  Find Nearby Drivers
                </Button>
                <Link href={`/dashboard/loads/${loadDetails.id}`} className="flex-1">
                  <Button variant="outline" className="w-full">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View Full Details
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">No load selected</p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

