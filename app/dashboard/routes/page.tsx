"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  MapPin,
  Clock,
  Download,
  Plus,
  Eye,
  Edit2,
  Trash2,
  Route,
  Search,
  Sparkles,
  User,
  Truck as TruckIcon,
  Fuel,
  DollarSign,
  Package,
  ExternalLink,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { exportToExcel } from "@/lib/export-utils"
import { toast } from "sonner"
import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { getRoutes, deleteRoute, updateRoute, duplicateRoute, getRoute, getLoadsByRouteIds } from "@/app/actions/routes"
import { getRouteStops, getRouteStopCounts } from "@/app/actions/route-stops"
import { optimizeMultiStopRoute } from "@/app/actions/route-optimization"
import { getDrivers } from "@/app/actions/drivers"
import { getTrucks } from "@/app/actions/trucks"
import { InlineStatusSelect } from "@/components/dashboard/inline-status-select"
import { useListPageShortcuts } from "@/lib/hooks/use-keyboard-shortcuts"
import { Copy, History } from "lucide-react"
import { InlineEdit } from "@/components/dashboard/inline-edit"
import { DefensiveDelete } from "@/components/dashboard/defensive-delete"
import { AuditTrail } from "@/components/dashboard/audit-trail"
import { GoogleMapsRoute } from "@/components/google-maps-route"
import { cn } from "@/lib/utils"

type RouteRow = Record<string, unknown> & {
  id: string
  name?: string | null
  origin?: string | null
  destination?: string | null
  status?: string | null
  driver_id?: string | null
  truck_id?: string | null
  stop_count?: number
  distance?: string | null
  estimated_time?: string | null
  estimated_fuel_cost?: number | null
  estimated_toll_cost?: number | null
  traffic_distance_meters?: number | null
  traffic_duration_minutes?: number | null
  loads?: Array<{ id: string; shipment_number: string | null; status: string | null }>
}

function formatDurationMinutes(minutes: number | null | undefined) {
  if (minutes == null || !Number.isFinite(Number(minutes))) return null
  const n = Math.round(Number(minutes))
  const h = Math.floor(n / 60)
  const m = n % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function formatDistanceDisplay(route: RouteRow) {
  if (route.distance) return String(route.distance)
  if (route.traffic_distance_meters != null && Number.isFinite(route.traffic_distance_meters)) {
    return `${(route.traffic_distance_meters / 1609.34).toFixed(1)} mi`
  }
  return "—"
}

function formatTimeDisplay(route: RouteRow) {
  if (route.estimated_time) return String(route.estimated_time)
  return formatDurationMinutes(route.traffic_duration_minutes) ?? "—"
}

export default function RoutesPage() {
  const router = useRouter()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteDependencies, setDeleteDependencies] = useState<any[]>([])
  const [routesList, setRoutesList] = useState<RouteRow[]>([])
  const [filteredRoutes, setFilteredRoutes] = useState<RouteRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortBy, setSortBy] = useState("created_at")
  const searchInputRef = useRef<HTMLInputElement>(null)

  const [driverById, setDriverById] = useState<Record<string, { name?: string | null }>>({})
  const [truckById, setTruckById] = useState<Record<string, { truck_number?: string | null; make?: string | null; model?: string | null }>>({})

  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
  const [previewRoute, setPreviewRoute] = useState<any>(null)
  const [previewStops, setPreviewStops] = useState<any[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [optimizingId, setOptimizingId] = useState<string | null>(null)

  const loadRoutes = useCallback(async () => {
    setIsLoading(true)
    const result = await getRoutes({ limit: 100 })
    if (result.error) {
      toast.error(result.error)
      setIsLoading(false)
      return
    }
    if (!result.data?.length) {
      setRoutesList([])
      setFilteredRoutes([])
      setIsLoading(false)
      return
    }

    const ids = result.data.map((r: { id: string }) => r.id)

    const [stopsRes, loadsRes, driversRes, trucksRes] = await Promise.all([
      getRouteStopCounts(ids),
      getLoadsByRouteIds(ids),
      getDrivers({ limit: 500 }),
      getTrucks({ limit: 500 }),
    ])

    const stopCounts = stopsRes.data || {}
    const loadsByRoute = loadsRes.data || {}

    if (driversRes.data) {
      const dm: Record<string, { name?: string | null }> = {}
      for (const d of driversRes.data as any[]) {
        if (d?.id) dm[d.id] = { name: d.name }
      }
      setDriverById(dm)
    }
    if (trucksRes.data) {
      const tm: Record<string, { truck_number?: string | null; make?: string | null; model?: string | null }> = {}
      for (const t of trucksRes.data as any[]) {
        if (t?.id) tm[t.id] = { truck_number: t.truck_number, make: t.make, model: t.model }
      }
      setTruckById(tm)
    }

    const routesWithMeta: RouteRow[] = result.data.map((route: any) => ({
      ...route,
      stop_count: stopCounts[route.id] ?? 0,
      loads: loadsByRoute[route.id] || [],
    }))

    setRoutesList(routesWithMeta)
    setFilteredRoutes(routesWithMeta)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadRoutes()
  }, [loadRoutes])

  useEffect(() => {
    if (!selectedRouteId) {
      setPreviewRoute(null)
      setPreviewStops([])
      return
    }
    const routeId = selectedRouteId

    let cancelled = false
    async function loadPreview() {
      setPreviewLoading(true)
      const [routeResult, stopsResult] = await Promise.all([getRoute(routeId), getRouteStops(routeId)])
      if (cancelled) return
      setPreviewRoute(routeResult.data || null)
      setPreviewStops(stopsResult.data || [])
      setPreviewLoading(false)
    }
    loadPreview()
    return () => {
      cancelled = true
    }
  }, [selectedRouteId])

  // Filter and sort routes
  useEffect(() => {
    let filtered = [...routesList]

    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (route) =>
          route.name?.toLowerCase().includes(q) ||
          route.origin?.toLowerCase().includes(q) ||
          route.destination?.toLowerCase().includes(q) ||
          route.loads?.some((l) => (l.shipment_number || "").toLowerCase().includes(q))
      )
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((route) => route.status === statusFilter)
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return (a.name || "").localeCompare(b.name || "")
        case "distance":
          return (
            parseFloat(String(a.distance || "0").replace(/[^\d.]/g, "") || "0") -
            parseFloat(String(b.distance || "0").replace(/[^\d.]/g, "") || "0")
          )
        case "status":
          return (a.status || "").localeCompare(b.status || "")
        case "created_at":
        default:
          return new Date(b.created_at as string || 0).getTime() - new Date(a.created_at as string || 0).getTime()
      }
    })

    setFilteredRoutes(filtered)
  }, [routesList, searchTerm, statusFilter, sortBy])

  const handleExportRoutes = () => {
    try {
      const exportData = routesList.map((row) => {
        const { loads: _loads, stop_count: _sc, ...rest } = row
        return rest
      })
      exportToExcel(exportData, "routes")
      toast.success("Routes exported successfully")
    } catch {
      toast.error("Failed to export routes")
    }
  }

  const handleDeleteClick = async (id: string) => {
    setDeleteId(id)
    try {
      const response = await fetch(`/api/check-dependencies?resource_type=route&resource_id=${id}`)
      if (response.ok) {
        const data = await response.json()
        setDeleteDependencies(data.dependencies || [])
      }
    } catch (error) {
      console.error("Failed to check dependencies:", error)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    const result = await deleteRoute(deleteId)
    if (result.error) {
      toast.error(result.error)
      setDeleteId(null)
      setDeleteDependencies([])
    } else {
      toast.success("Route deleted successfully")
      setDeleteId(null)
      setDeleteDependencies([])
      if (selectedRouteId === deleteId) setSelectedRouteId(null)
      await loadRoutes()
    }
  }

  const handleStatusUpdate = async (id: string, status: string) => {
    const updatedRoutes = routesList.map((route) => (route.id === id ? { ...route, status } : route))
    setRoutesList(updatedRoutes)

    const updatedFiltered = filteredRoutes.map((route) => (route.id === id ? { ...route, status } : route))
    setFilteredRoutes(updatedFiltered)

    const result = await updateRoute(id, { status })
    if (result.error) {
      await loadRoutes()
      toast.error(result.error)
    }
    if (selectedRouteId === id && previewRoute) {
      setPreviewRoute((r: any) => (r ? { ...r, status } : r))
    }
  }

  const handleInlineUpdate = async (routeId: string, field: string, value: string | number | null) => {
    const updatedRoutes = routesList.map((route) => (route.id === routeId ? { ...route, [field]: value } : route))
    setRoutesList(updatedRoutes)

    const updatedFiltered = filteredRoutes.map((route) => (route.id === routeId ? { ...route, [field]: value } : route))
    setFilteredRoutes(updatedFiltered)

    const updateData: Record<string, unknown> = { [field]: value }
    const result = await updateRoute(routeId, updateData)

    if (result.error) {
      await loadRoutes()
      toast.error(result.error || "Failed to update")
    }
  }

  const handleDuplicate = async (id: string) => {
    const result = await duplicateRoute(id)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Route duplicated successfully")
      await loadRoutes()
      if (result.data) {
        router.push(`/dashboard/routes/${result.data.id}/edit`)
      }
    }
  }

  const handleOptimize = async (e: React.MouseEvent, routeId: string) => {
    e.stopPropagation()
    setOptimizingId(routeId)
    try {
      const res = await optimizeMultiStopRoute(routeId)
      if (res.error || !res.optimized) {
        toast.error(res.error || "Could not optimize this route")
        return
      }
      toast.success(
        `Stops optimized${res.distance != null ? ` · ~${res.distance.toFixed(1)} mi` : ""}${res.fuelCost != null ? ` · fuel ~$${res.fuelCost.toFixed(2)}` : ""}`
      )
      await loadRoutes()
      if (selectedRouteId === routeId) {
        const [routeResult, stopsResult] = await Promise.all([getRoute(routeId), getRouteStops(routeId)])
        setPreviewRoute(routeResult.data || null)
        setPreviewStops(stopsResult.data || [])
      }
    } finally {
      setOptimizingId(null)
    }
  }

  useListPageShortcuts(router, "/dashboard/routes/add", searchInputRef)

  const previewLoads =
    previewRoute?.id != null
      ? routesList.find((r) => r.id === previewRoute.id)?.loads || []
      : []

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Routes</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage routes — select one to preview the map and trip details</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Button
            onClick={handleExportRoutes}
            variant="outline"
            size="sm"
            className="border-border/50 bg-transparent hover:bg-secondary/50 text-foreground flex-1 sm:flex-initial"
          >
            <Download className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Export to Excel</span>
            <span className="sm:hidden">Export</span>
          </Button>
          <Link href="/dashboard/routes/add" className="flex-1 sm:flex-initial">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition w-full sm:w-auto">
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Add Route</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </Link>
        </div>
      </div>

      <div className="p-4 md:p-8">
        <div className="max-w-[1600px] mx-auto">
          {isLoading ? (
            <Card className="border border-border/50 p-4 md:p-8">
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading routes...</p>
              </div>
            </Card>
          ) : filteredRoutes.length === 0 ? (
            <Card className="border border-border/50 p-4 md:p-8">
              <div className="text-center py-8 md:py-12">
                <Route className="w-12 h-12 md:w-16 md:h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg md:text-xl font-semibold text-foreground mb-2">
                  {searchTerm || statusFilter !== "all" ? "No routes found" : "No routes yet"}
                </h3>
                <p className="text-muted-foreground mb-6 text-sm md:text-base">
                  {searchTerm || statusFilter !== "all" ? "Try adjusting your search or filters" : "Get started by creating your first route"}
                </p>
                {!searchTerm && statusFilter === "all" && (
                  <Link href="/dashboard/routes/add">
                    <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Your First Route
                    </Button>
                  </Link>
                )}
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(340px,46%)] gap-6 items-start">
              {/* Left: filters + list */}
              <div className="space-y-4 min-w-0">
                <Card className="border border-border/50 p-3 md:p-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        ref={searchInputRef}
                        placeholder="Search name, origin, destination, load #..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full sm:w-[160px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="in_progress">In progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-full sm:w-[160px]">
                        <SelectValue placeholder="Sort" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="created_at">Newest</SelectItem>
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="distance">Distance</SelectItem>
                        <SelectItem value="status">Status</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </Card>

                <div className="space-y-3">
                  {filteredRoutes.map((route) => {
                    const isSelected = selectedRouteId === route.id
                    const driverName = route.driver_id ? driverById[route.driver_id]?.name : null
                    const truck = route.truck_id ? truckById[route.truck_id] : null
                    const truckLabel = truck
                      ? [truck.truck_number, truck.make && truck.model ? `${truck.make} ${truck.model}` : null]
                          .filter(Boolean)
                          .join(" · ")
                      : null
                    const stopCount = route.stop_count ?? 0
                    const canOptimize = stopCount > 1

                    return (
                      <Card
                        key={route.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedRouteId(route.id)}
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter" || ev.key === " ") {
                            ev.preventDefault()
                            setSelectedRouteId(route.id)
                          }
                        }}
                        className={cn(
                          "border p-4 md:p-5 transition-all cursor-pointer text-left",
                          isSelected ? "border-primary ring-2 ring-primary/30 shadow-md bg-muted/30" : "border-border/50 hover:border-border hover:shadow-sm"
                        )}
                      >
                        <div className="flex flex-col gap-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="text-base md:text-lg font-bold text-foreground truncate">{route.name}</h3>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {route.origin} → {route.destination}
                              </p>
                            </div>
                            <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                              <InlineStatusSelect
                                key={`${route.id}-${route.status}`}
                                currentStatus={route.status || "pending"}
                                availableStatuses={["pending", "scheduled", "in_progress", "completed", "cancelled"]}
                                onStatusChange={(newStatus) => handleStatusUpdate(route.id, newStatus)}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-2 text-xs">
                            <div>
                              <span className="text-muted-foreground block">Distance</span>
                              <span className="font-medium text-foreground">{formatDistanceDisplay(route)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block">Est. time</span>
                              <span className="font-medium text-foreground">{formatTimeDisplay(route)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block">Stops</span>
                              <span className="font-medium text-foreground">{stopCount}</span>
                            </div>
                            <div className="col-span-2 sm:col-span-1">
                              <span className="text-muted-foreground flex items-center gap-1">
                                <User className="w-3 h-3" /> Driver
                              </span>
                              <span className="font-medium text-foreground truncate block">{driverName || "—"}</span>
                            </div>
                            <div className="col-span-2 sm:col-span-2 lg:col-span-1">
                              <span className="text-muted-foreground flex items-center gap-1">
                                <TruckIcon className="w-3 h-3" /> Truck
                              </span>
                              <span className="font-medium text-foreground truncate block">{truckLabel || "—"}</span>
                            </div>
                            {route.estimated_fuel_cost != null && Number.isFinite(Number(route.estimated_fuel_cost)) && (
                              <div>
                                <span className="text-muted-foreground flex items-center gap-1">
                                  <Fuel className="w-3 h-3" /> Fuel est.
                                </span>
                                <span className="font-medium text-foreground">${Number(route.estimated_fuel_cost).toFixed(2)}</span>
                              </div>
                            )}
                            {route.estimated_toll_cost != null && Number.isFinite(Number(route.estimated_toll_cost)) && (
                              <div>
                                <span className="text-muted-foreground flex items-center gap-1">
                                  <DollarSign className="w-3 h-3" /> Tolls est.
                                </span>
                                <span className="font-medium text-foreground">${Number(route.estimated_toll_cost).toFixed(2)}</span>
                              </div>
                            )}
                          </div>

                          {route.loads && route.loads.length > 0 && (
                            <div className="flex flex-wrap gap-2 items-center" onClick={(e) => e.stopPropagation()}>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Package className="w-3.5 h-3.5" /> Load
                              </span>
                              {route.loads.map((load) => (
                                <Link
                                  key={load.id}
                                  href={`/dashboard/loads/${load.id}`}
                                  className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-0.5"
                                >
                                  #{load.shipment_number || load.id.slice(0, 8)}
                                  <ExternalLink className="w-3 h-3" />
                                </Link>
                              ))}
                            </div>
                          )}

                          <div className="flex flex-wrap gap-2 pt-1 border-t border-border/40" onClick={(e) => e.stopPropagation()}>
                            {canOptimize && (
                              <Button
                                variant="secondary"
                                size="sm"
                                className="h-8"
                                disabled={optimizingId === route.id}
                                onClick={(e) => handleOptimize(e, route.id)}
                                title="Reorder intermediate stops to reduce distance and time"
                              >
                                <Sparkles className="w-3.5 h-3.5 mr-1" />
                                {optimizingId === route.id ? "Optimizing…" : "Optimize stops"}
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8"
                              onClick={() => router.push(`/dashboard/routes/${route.id}`)}
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" />
                              Open
                            </Button>
                            <Link href={`/dashboard/routes/${route.id}/edit`}>
                              <Button variant="outline" size="sm" className="h-8">
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                            </Link>
                            <AuditTrail
                              resourceType="route"
                              resourceId={route.id}
                              trigger={
                                <Button variant="outline" size="sm" className="h-8">
                                  <History className="w-3.5 h-3.5" />
                                </Button>
                              }
                            />
                            <Button variant="outline" size="sm" className="h-8 hover:bg-blue-500/20" onClick={() => handleDuplicate(route.id)} title="Duplicate route">
                              <Copy className="w-3.5 h-3.5 text-blue-400" />
                            </Button>
                            <Button variant="outline" size="sm" className="h-8 hover:bg-red-500/20" onClick={() => handleDeleteClick(route.id)}>
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </Button>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-muted-foreground border-t border-border/30 pt-2" onClick={(e) => e.stopPropagation()}>
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            <span className="shrink-0">Duration (edit):</span>
                            <InlineEdit
                              value={route.estimated_time || ""}
                              onSave={async (value) => handleInlineUpdate(route.id, "estimated_time", value as string)}
                              placeholder="Set duration"
                              className="flex-1 min-w-0"
                            />
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              </div>

              {/* Right: map preview */}
              <div className="xl:sticky xl:top-4 space-y-3 min-w-0">
                <Card className="border border-border/50 overflow-hidden">
                  <div className="border-b border-border/50 px-4 py-3 flex flex-wrap items-center justify-between gap-2 bg-muted/20">
                    <h2 className="text-sm font-semibold text-foreground">Map preview</h2>
                    {selectedRouteId && previewRoute && (
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/dashboard/routes/${selectedRouteId}`}>
                          <Button variant="outline" size="sm" className="h-8">
                            Full detail
                          </Button>
                        </Link>
                        <Link href={`/dashboard/routes/${selectedRouteId}/edit`}>
                          <Button size="sm" className="h-8">
                            Edit route
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>

                  {!selectedRouteId ? (
                    <div className="p-8 text-center text-muted-foreground text-sm min-h-[280px] flex flex-col items-center justify-center gap-2">
                      <MapPin className="w-10 h-10 opacity-40" />
                      <p>Select a route on the left to load the interactive map, directions, and stop sequence.</p>
                    </div>
                  ) : previewLoading || !previewRoute ? (
                    <div className="p-8 text-center text-muted-foreground min-h-[280px] flex items-center justify-center">Loading map…</div>
                  ) : previewRoute.origin && previewRoute.destination ? (
                    <>
                      <div className="px-4 py-3 space-y-1 text-sm border-b border-border/40 bg-card/40">
                        <p className="font-medium text-foreground">{previewRoute.name}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>Distance: {formatDistanceDisplay(previewRoute)}</span>
                          <span>Time: {formatTimeDisplay(previewRoute)}</span>
                          {previewStops.length > 0 && <span>{previewStops.length} intermediate stops</span>}
                          {previewRoute.estimated_fuel_cost != null && (
                            <span>Fuel est. ${Number(previewRoute.estimated_fuel_cost).toFixed(2)}</span>
                          )}
                          {previewRoute.estimated_toll_cost != null && (
                            <span>Tolls est. ${Number(previewRoute.estimated_toll_cost).toFixed(2)}</span>
                          )}
                        </div>
                        {previewLoads.length > 0 && (
                          <div className="flex flex-wrap gap-2 items-center pt-1">
                            <span className="text-xs text-muted-foreground">Load:</span>
                            {previewLoads.map((load) => (
                              <Link
                                key={load.id}
                                href={`/dashboard/loads/${load.id}`}
                                className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-0.5"
                              >
                                #{load.shipment_number || load.id.slice(0, 8)}
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="h-[min(52vh,480px)] min-h-[320px] w-full">
                        <GoogleMapsRoute
                          origin={previewRoute.origin}
                          destination={previewRoute.destination}
                          originCoordinates={previewRoute.origin_coordinates as { lat: number; lng: number } | undefined}
                          destinationCoordinates={previewRoute.destination_coordinates as { lat: number; lng: number } | undefined}
                          weight={0}
                          truckHeight={4.0}
                          stops={previewStops.map((stop) => ({
                            location_name: stop.location_name,
                            address: stop.address,
                            stop_number: stop.stop_number,
                            coordinates: stop.coordinates as { lat: number; lng: number } | undefined,
                            stop_type: stop.stop_type,
                          }))}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="p-8 text-center text-muted-foreground min-h-[280px] flex items-center justify-center text-sm">
                      Add origin and destination on this route to see the map.
                    </div>
                  )}
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>

      {deleteId && (
        <DefensiveDelete
          open={deleteId !== null}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteId(null)
              setDeleteDependencies([])
            }
          }}
          onConfirm={handleDelete}
          resourceType="route"
          resourceName={routesList.find((r) => r.id === deleteId)?.name || "Route"}
          resourceId={deleteId}
          dependencies={deleteDependencies}
          warningMessage="This will permanently delete the route. Associated stops and loads will be preserved but the route link will be removed."
        />
      )}
    </div>
  )
}
