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
import { format } from "date-fns"

export default function DispatchesPage() {
  const [unassignedLoads, setUnassignedLoads] = useState<any[]>([])
  const [unassignedRoutes, setUnassignedRoutes] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [trucks, setTrucks] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [assigning, setAssigning] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

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

  function getStatusBadge(status: string) {
    const statusColors: Record<string, string> = {
      pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      scheduled: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      in_progress: "bg-green-500/20 text-green-400 border-green-500/30",
      in_transit: "bg-green-500/20 text-green-400 border-green-500/30",
      completed: "bg-gray-500/20 text-gray-400 border-gray-500/30",
      delivered: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    }
    return (
      <Badge className={statusColors[status] || "bg-secondary text-foreground border-border"}>
        {status?.replace("_", " ").toUpperCase() || "PENDING"}
      </Badge>
    )
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
                {unassignedLoads.map((load) => (
                  <Card key={load.id} className="border-border p-4 hover:border-primary/50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-foreground">{load.shipment_number}</h3>
                          {getStatusBadge(load.status)}
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
                        </div>
                      </div>
                      <Link href={`/dashboard/loads/${load.id}`}>
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </Link>
                    </div>

                    <div className="space-y-3 pt-3 border-t border-border">
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
                ))}
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
                      <Link href={`/dashboard/routes/${route.id}`}>
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </Link>
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
    </div>
  )
}

