"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { MapPin, Clock, Download, Plus, Eye, Edit2, Trash2, Route, Search, Filter } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { exportToExcel } from "@/lib/export-utils"
import { toast } from "sonner"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
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
import { getRoutes, deleteRoute, updateRoute, duplicateRoute } from "@/app/actions/routes"
import { getRouteStops } from "@/app/actions/route-stops"
import { InlineStatusSelect } from "@/components/dashboard/inline-status-select"
import { useListPageShortcuts } from "@/lib/hooks/use-keyboard-shortcuts"
import { Copy, History } from "lucide-react"
import { InlineEdit } from "@/components/dashboard/inline-edit"
import { DefensiveDelete } from "@/components/dashboard/defensive-delete"
import { AuditTrail } from "@/components/dashboard/audit-trail"

export default function RoutesPage() {
  const router = useRouter()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteDependencies, setDeleteDependencies] = useState<any[]>([])
  const [routesList, setRoutesList] = useState<any[]>([])
  const [filteredRoutes, setFilteredRoutes] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortBy, setSortBy] = useState("created_at")
  const searchInputRef = useRef<HTMLInputElement>(null)

  const loadRoutes = async () => {
    setIsLoading(true)
    const result = await getRoutes()
    if (result.error) {
      toast.error(result.error)
      setIsLoading(false)
      return
    }
    if (result.data) {
      // Load stop counts for each route
      const routesWithStops = await Promise.all(
        result.data.map(async (route: any) => {
          const stopsResult = await getRouteStops(route.id)
          return {
            ...route,
            stop_count: stopsResult.data?.length || 0,
          }
        })
      )
      setRoutesList(routesWithStops)
      setFilteredRoutes(routesWithStops)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    loadRoutes()
  }, [])

  // Filter and sort routes
  useEffect(() => {
    let filtered = [...routesList]

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (route) =>
          route.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          route.origin?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          route.destination?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((route) => route.status === statusFilter)
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return (a.name || "").localeCompare(b.name || "")
        case "distance":
          return parseFloat(a.distance || "0") - parseFloat(b.distance || "0")
        case "status":
          return (a.status || "").localeCompare(b.status || "")
        case "created_at":
        default:
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      }
    })

    setFilteredRoutes(filtered)
  }, [routesList, searchTerm, statusFilter, sortBy])

  const handleExportRoutes = () => {
    try {
      const exportData = routesList.map(({ id, company_id, created_at, updated_at, waypoints, estimated_arrival, ...rest }) => rest)
      exportToExcel(exportData, "routes")
      toast.success("Routes exported successfully")
    } catch (error) {
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
      await loadRoutes()
    }
  }

  const handleStatusUpdate = async (id: string, status: string) => {
    const updatedRoutes = routesList.map(route => 
      route.id === id ? { ...route, status } : route
    )
    setRoutesList(updatedRoutes)
    
    const updatedFiltered = filteredRoutes.map(route => 
      route.id === id ? { ...route, status } : route
    )
    setFilteredRoutes(updatedFiltered)

    const result = await updateRoute(id, { status })
    if (result.error) {
      await loadRoutes()
      toast.error(result.error)
    }
  }

  const handleInlineUpdate = async (routeId: string, field: string, value: string | number | null) => {
    const updatedRoutes = routesList.map(route => 
      route.id === routeId ? { ...route, [field]: value } : route
    )
    setRoutesList(updatedRoutes)
    
    const updatedFiltered = filteredRoutes.map(route => 
      route.id === routeId ? { ...route, [field]: value } : route
    )
    setFilteredRoutes(updatedFiltered)

    const updateData: any = { [field]: value }
    const result = await updateRoute(routeId, updateData)
    
    if (result.error) {
      await loadRoutes()
      toast.error(result.error || "Failed to update")
      throw new Error(result.error)
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

  // Keyboard shortcuts
  useListPageShortcuts(router, "/dashboard/routes/add", searchInputRef)

  return (
    <div className="w-full">
      {/* Page Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Routes</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage and optimize delivery routes</p>
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

      {/* Content */}
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
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
                  {searchTerm || statusFilter !== "all"
                    ? "Try adjusting your search or filters"
                    : "Get started by creating your first route"}
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
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {filteredRoutes.map((route) => (
              <Card
                key={route.id}
                className="border border-border/50 p-4 md:p-6 hover:border-border/80 hover:shadow-md transition-all shadow-sm"
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-bold text-foreground">{route.name}</h3>
                  <InlineStatusSelect
                    currentStatus={route.status || "pending"}
                    availableStatuses={["pending", "scheduled", "in_progress", "completed", "cancelled"]}
                    onStatusChange={(newStatus) => handleStatusUpdate(route.id, newStatus)}
                  />
                </div>
                <div className="space-y-3 mb-6 border-t border-border/30 pt-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">From</p>
                      <p className="text-sm text-foreground">{route.origin}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">To</p>
                      <p className="text-sm text-foreground">{route.destination}</p>
                    </div>
                  </div>
                  {route.stop_count > 0 && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-purple-400" />
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">Stops</p>
                        <p className="text-sm text-foreground">{route.stop_count} {route.stop_count === 1 ? 'stop' : 'stops'}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground font-medium">Duration</p>
                      <InlineEdit
                        value={route.estimated_time || ""}
                        onSave={async (value) => handleInlineUpdate(route.id, "estimated_time", value as string)}
                        placeholder="Set duration"
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-4 pb-4 border-b border-border/30">
                  Distance: {route.distance || "N/A"}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 border-border/50 bg-transparent hover:bg-secondary/50 transition"
                    onClick={() => router.push(`/dashboard/routes/${route.id}`)}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    View
                  </Button>
                  {route.id && typeof route.id === 'string' && route.id.trim() !== '' ? (
                    <>
                      <Link href={`/dashboard/routes/${route.id}/edit`}>
                        <Button variant="outline" size="sm" className="border-border/50 bg-transparent hover:bg-secondary/50">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </Link>
                      <AuditTrail
                        resourceType="route"
                        resourceId={route.id}
                        trigger={
                          <Button variant="outline" size="sm" className="border-border/50 bg-transparent hover:bg-secondary/50">
                            <History className="w-4 h-4" />
                          </Button>
                        }
                      />
                    </>
                  ) : null}
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border/50 bg-transparent hover:bg-blue-500/20"
                    onClick={() => handleDuplicate(route.id)}
                    title="Duplicate route"
                  >
                    <Copy className="w-4 h-4 text-blue-400" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border/50 bg-transparent hover:bg-red-500/20"
                    onClick={() => handleDeleteClick(route.id)}
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                </div>
              </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Defensive Delete Dialog */}
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
          resourceName={routesList.find(r => r.id === deleteId)?.name || "Route"}
          resourceId={deleteId}
          dependencies={deleteDependencies}
          warningMessage="This will permanently delete the route. Associated stops and loads will be preserved but the route link will be removed."
        />
      )}
    </div>
  )
}
