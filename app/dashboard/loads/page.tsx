"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Package, Download, Eye, Edit2, Trash2, Search, Filter, Copy, MoreVertical, CheckSquare, Square } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import Link from "next/link"
import { useState, useEffect, useCallback } from "react"
import { exportToExcel } from "@/lib/export-utils"
import { TruckMap } from "@/components/truck-map"
import { toast } from "sonner"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getLoads, deleteLoad, bulkDeleteLoads, bulkUpdateLoadStatus, duplicateLoad, updateLoad } from "@/app/actions/loads"

export default function LoadsPage() {
  const router = useRouter()
  const [selectedLoad, setSelectedLoad] = useState<any | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [loadsList, setLoadsList] = useState<any[]>([])
  const [filteredLoads, setFilteredLoads] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortBy, setSortBy] = useState("created_at")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBulkMode, setIsBulkMode] = useState(false)

  const loadLoads = async () => {
    setIsLoading(true)
    try {
      const result = await getLoads()
      if (result.error) {
        toast.error(result.error)
        setLoadsList([]) // Set empty array on error
        setIsLoading(false)
        return
      }
      if (result.data) {
        setLoadsList(result.data)
        setFilteredLoads(result.data)
      } else {
        setLoadsList([])
        setFilteredLoads([])
      }
    } catch (error: any) {
      console.error("Error loading loads:", error)
      toast.error("Failed to load loads. Please try again.")
      setLoadsList([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadLoads()
  }, [])

  // Filter and sort loads
  useEffect(() => {
    let filtered = [...loadsList]

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (load) =>
          load.shipment_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          load.origin?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          load.destination?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          load.contents?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((load) => load.status === statusFilter)
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "shipment_number":
          return (a.shipment_number || "").localeCompare(b.shipment_number || "")
        case "load_date":
          return new Date(b.load_date || 0).getTime() - new Date(a.load_date || 0).getTime()
        case "status":
          return (a.status || "").localeCompare(b.status || "")
        case "created_at":
        default:
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      }
    })

    setFilteredLoads(filtered)
  }, [loadsList, searchTerm, statusFilter, sortBy])

  const handleExportLoads = () => {
    try {
      const exportData = loadsList.map(({ id, company_id, route_id, driver_id, truck_id, coordinates, created_at, updated_at, ...rest }) => rest)
      exportToExcel(exportData, "loads")
      toast.success("Loads exported successfully")
    } catch (error) {
      toast.error("Failed to export loads")
    }
  }

  const handleDelete = async (id: string) => {
    const result = await deleteLoad(id)
    if (result.error) {
      toast.error(result.error)
      setDeleteId(null)
    } else {
      if (selectedLoad?.id === id) {
        setSelectedLoad(null)
      }
      toast.success("Load deleted successfully")
      setDeleteId(null)
      await loadLoads()
    }
  }

  // Bulk operations
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    const result = await bulkDeleteLoads(Array.from(selectedIds))
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(`Deleted ${selectedIds.size} load(s) successfully`)
      setSelectedIds(new Set())
      setIsBulkMode(false)
      await loadLoads()
    }
  }

  const handleBulkStatusUpdate = async (status: string) => {
    if (selectedIds.size === 0) return
    const result = await bulkUpdateLoadStatus(Array.from(selectedIds), status)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(`Updated ${selectedIds.size} load(s) to ${status}`)
      setSelectedIds(new Set())
      setIsBulkMode(false)
      await loadLoads()
    }
  }

  const handleDuplicate = async (id: string) => {
    const result = await duplicateLoad(id)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Load duplicated successfully")
      await loadLoads()
      if (result.data) {
        router.push(`/dashboard/loads/${result.data.id}/edit`)
      }
    }
  }

  const handleQuickStatusUpdate = async (id: string, status: string) => {
    const result = await updateLoad(id, { status })
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Status updated successfully")
      await loadLoads()
    }
  }

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
    if (newSelected.size > 0 && !isBulkMode) {
      setIsBulkMode(true)
    } else if (newSelected.size === 0 && isBulkMode) {
      setIsBulkMode(false)
    }
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredLoads.length) {
      setSelectedIds(new Set())
      setIsBulkMode(false)
    } else {
      setSelectedIds(new Set(filteredLoads.map(l => l.id)))
      setIsBulkMode(true)
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + N: New load
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        router.push('/dashboard/loads/add')
      }
      // Ctrl/Cmd + F: Focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement
        searchInput?.focus()
      }
      // Delete: Bulk delete if items selected
      if (e.key === 'Delete' && selectedIds.size > 0 && !isLoading) {
        e.preventDefault()
        handleBulkDelete()
      }
      // Escape: Clear selection
      if (e.key === 'Escape' && selectedIds.size > 0) {
        setSelectedIds(new Set())
        setIsBulkMode(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIds, isLoading, router])

  return (
    <div className="w-full">
      {/* Page Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Loads</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage shipments and track deliveries</p>
          <p className="text-xs text-muted-foreground mt-1">Press Ctrl+N for new, Ctrl+F to search, Delete to bulk delete</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {isBulkMode && selectedIds.size > 0 && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border/50 bg-transparent hover:bg-secondary/50 text-foreground"
                  >
                    Update Status ({selectedIds.size})
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleBulkStatusUpdate("draft")}>
                    Draft
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkStatusUpdate("pending")}>
                    Pending
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkStatusUpdate("scheduled")}>
                    Scheduled
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkStatusUpdate("in_transit")}>
                    In Transit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkStatusUpdate("delivered")}>
                    Delivered
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkStatusUpdate("cancelled")}>
                    Cancelled
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                onClick={handleBulkDelete}
                variant="outline"
                size="sm"
                className="border-red-500/50 bg-transparent hover:bg-red-500/20 text-red-400"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete ({selectedIds.size})
              </Button>
              <Button
                onClick={() => {
                  setSelectedIds(new Set())
                  setIsBulkMode(false)
                }}
                variant="outline"
                size="sm"
                className="border-border/50 bg-transparent hover:bg-secondary/50 text-foreground"
              >
                Cancel
              </Button>
            </>
          )}
          {!isBulkMode && (
            <>
              <Button
                onClick={handleExportLoads}
                variant="outline"
                size="sm"
                className="border-border/50 bg-transparent hover:bg-secondary/50 text-foreground flex-1 sm:flex-initial"
              >
                <Download className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Export to Excel</span>
                <span className="sm:hidden">Export</span>
              </Button>
              <Link href="/dashboard/loads/add" className="flex-1 sm:flex-initial">
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition w-full sm:w-auto">
                  <Plus className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">New Load</span>
                  <span className="sm:hidden">New</span>
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Search and Filters */}
          {!isLoading && loadsList.length > 0 && (
            <Card className="border-border/50 p-4 mb-6">
              <div className="grid md:grid-cols-4 gap-4">
                {filteredLoads.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedIds.size === filteredLoads.length && filteredLoads.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                    <span className="text-sm text-muted-foreground">
                      {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
                    </span>
                  </div>
                )}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by shipment #, origin, destination..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Filter by Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="in_transit">In Transit</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created_at">Newest First</SelectItem>
                    <SelectItem value="shipment_number">Shipment Number</SelectItem>
                    <SelectItem value="load_date">Load Date</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Loads List */}
          <div className="lg:col-span-2">
            {isLoading ? (
              <Card className="border-border p-8">
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loading loads...</p>
                </div>
              </Card>
            ) : filteredLoads.length === 0 ? (
              <Card className="border-border p-8">
                <div className="text-center py-12">
                  <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    {searchTerm || statusFilter !== "all" ? "No loads found" : "No loads yet"}
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    {searchTerm || statusFilter !== "all"
                      ? "Try adjusting your search or filters"
                      : "Get started by creating your first load"}
                  </p>
                  {!searchTerm && statusFilter === "all" && (
                    <Link href="/dashboard/loads/add">
                      <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Your First Load
                      </Button>
                    </Link>
                  )}
                </div>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredLoads.map((load) => (
                <Card
                  key={load.id}
                  className={`border-border p-4 md:p-6 hover:border-primary/50 hover:shadow-md transition ${selectedIds.has(load.id) ? 'border-primary bg-primary/5' : ''}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {isBulkMode && (
                        <Checkbox
                          checked={selectedIds.has(load.id)}
                          onCheckedChange={() => toggleSelect(load.id)}
                          className="mt-1"
                        />
                      )}
                      <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                        <Package className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Shipment</p>
                        <p className="font-bold text-foreground">{load.shipment_number || "N/A"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 px-2">
                            <Badge
                              className={
                                load.status === "in_transit" || load.status === "In Transit"
                                  ? "bg-green-500/20 text-green-400 border-green-500/50 cursor-pointer"
                                  : load.status === "delivered" || load.status === "Delivered"
                                  ? "bg-gray-500/20 text-gray-400 border-gray-500/50 cursor-pointer"
                                  : load.status === "scheduled"
                                  ? "bg-blue-500/20 text-blue-400 border-blue-500/50 cursor-pointer"
                                  : load.status === "draft"
                                  ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/50 cursor-pointer"
                                  : load.status === "cancelled"
                                  ? "bg-red-500/20 text-red-400 border-red-500/50 cursor-pointer"
                                  : "bg-blue-500/20 text-blue-400 border-blue-500/50 cursor-pointer"
                              }
                            >
                              {load.status ? load.status.charAt(0).toUpperCase() + load.status.slice(1).replace("_", " ") : "N/A"}
                            </Badge>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleQuickStatusUpdate(load.id, "draft")}>
                            Draft
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleQuickStatusUpdate(load.id, "pending")}>
                            Pending
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleQuickStatusUpdate(load.id, "scheduled")}>
                            Scheduled
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleQuickStatusUpdate(load.id, "in_transit")}>
                            In Transit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleQuickStatusUpdate(load.id, "delivered")}>
                            Delivered
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleQuickStatusUpdate(load.id, "cancelled")}>
                            Cancelled
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex items-center gap-2">
                      <p className="text-foreground">Weight: {load.weight || `${load.weight_kg ? (load.weight_kg / 1000).toFixed(1) : 0} tons`}</p>
                      {load.delivery_type === "multi" && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-400">
                          {load.total_delivery_points || 0} Delivery Points
                        </span>
                      )}
                      {load.delivery_type === "single" && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-500/20 text-gray-400">
                          Single Delivery
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground">From: {load.origin || "N/A"}</p>
                    {load.delivery_type === "single" ? (
                      <p className="text-muted-foreground">To: {load.destination || "N/A"}</p>
                    ) : (
                      <p className="text-muted-foreground">Multiple Destinations: {load.total_delivery_points || 0} locations</p>
                    )}
                    <p className="text-muted-foreground">Contents: {load.contents || "N/A"}</p>
                    {load.company_name && (
                      <p className="text-muted-foreground">Company: {load.company_name}</p>
                    )}
                    <p className="text-muted-foreground">Est. Delivery: {load.estimated_delivery ? (() => {
                      try {
                        const date = new Date(load.estimated_delivery)
                        return isNaN(date.getTime()) ? "N/A" : date.toISOString().split('T')[0]
                      } catch {
                        return "N/A"
                      }
                    })() : "N/A"}</p>
                  </div>
                  <div className="flex gap-2 pt-4 border-t border-border/30">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-border/50 bg-transparent hover:bg-secondary/50"
                      onClick={() => {
                        setSelectedLoad(load)
                      }}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View Details
                    </Button>
                    <Link href={`/dashboard/loads/${load.id}/edit`}>
                      <Button variant="outline" size="sm" className="border-border/50 bg-transparent hover:bg-secondary/50">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border/50 bg-transparent hover:bg-blue-500/20"
                      onClick={() => handleDuplicate(load.id)}
                      title="Duplicate load"
                    >
                      <Copy className="w-4 h-4 text-blue-400" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border/50 bg-transparent hover:bg-red-500/20"
                      onClick={() => setDeleteId(load.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </div>
                </Card>
                ))}
              </div>
            )}
          </div>

          {/* Map View */}
          <div className="lg:col-span-1">
            <Card className="border-border p-6 sticky top-8">
              {selectedLoad ? (
                <TruckMap
                  origin={selectedLoad.origin || ""}
                  destination={selectedLoad.destination || ""}
                  weight={selectedLoad.weight_kg || 0}
                  truckHeight={4.2}
                  contents={selectedLoad.contents || ""}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-center py-12">
                  <div>
                    <Package className="w-12 h-12 text-primary/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Select a load to view truck route</p>
                    <p className="text-xs text-muted-foreground mt-1">Route will show truck-approved paths</p>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the load from the system.
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
