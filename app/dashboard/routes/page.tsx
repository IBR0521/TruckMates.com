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
import { useState, useEffect } from "react"
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
import { getRoutes, deleteRoute } from "@/app/actions/routes"
import { getRouteStops } from "@/app/actions/route-stops"

export default function RoutesPage() {
  const router = useRouter()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [routesList, setRoutesList] = useState<any[]>([])
  const [filteredRoutes, setFilteredRoutes] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortBy, setSortBy] = useState("created_at")

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

  const handleDelete = async (id: string) => {
    const result = await deleteRoute(id)
    if (result.error) {
      toast.error(result.error)
      setDeleteId(null)
    } else {
      toast.success("Route deleted successfully")
      setDeleteId(null)
      await loadRoutes()
    }
  }

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
                  <Badge
                    className={
                      route.status === "completed"
                        ? "bg-green-500/20 text-green-400 border-green-500/50"
                        : route.status === "in_progress"
                        ? "bg-blue-500/20 text-blue-400 border-blue-500/50"
                        : route.status === "scheduled"
                        ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/50"
                        : route.status === "cancelled"
                        ? "bg-red-500/20 text-red-400 border-red-500/50"
                        : "bg-gray-500/20 text-gray-400 border-gray-500/50"
                    }
                  >
                    {route.status ? route.status.charAt(0).toUpperCase() + route.status.slice(1).replace("_", " ") : "Pending"}
                  </Badge>
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
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Duration</p>
                      <p className="text-sm text-foreground">{route.estimated_time || "N/A"}</p>
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
                  <Link href={`/dashboard/routes/${route.id}/edit`}>
                    <Button variant="outline" size="sm" className="border-border/50 bg-transparent hover:bg-secondary/50">
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border/50 bg-transparent hover:bg-red-500/20"
                    onClick={() => setDeleteId(route.id)}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the route from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
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
