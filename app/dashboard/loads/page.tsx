"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Package, Download, Eye, Edit2, Trash2, Search, Filter, Copy, MoreVertical, CheckSquare, Square, FileText, User, History } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import Link from "next/link"
import { useState, useEffect, useCallback, useMemo } from "react"
import { useDebounce } from "@/lib/hooks/use-debounce"
import { exportToExcel } from "@/lib/export-utils"
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
import {
  getLoads,
  deleteLoad,
  bulkDeleteLoads,
  bulkUpdateLoadStatusDetailed,
  bulkAssignLoads,
  bulkCreateInvoicesForLoads,
  duplicateLoad,
  updateLoad,
  type BulkLoadSummary,
} from "@/app/actions/loads"
import { ensureDispatchConfirmed } from "@/lib/dispatch-confirm-client"
import { getDrivers } from "@/app/actions/drivers"
import { getTrucks } from "@/app/actions/trucks"
import { autoGenerateInvoiceOnPOD } from "@/app/actions/auto-invoice"
import { BulkActionsBar } from "@/components/bulk-actions-bar"
import { InlineEdit } from "@/components/dashboard/inline-edit"
import { DefensiveDelete } from "@/components/dashboard/defensive-delete"
import { AuditTrail } from "@/components/dashboard/audit-trail"
import { useLoadsInitialData } from "@/components/dashboard/initial-list-data-contexts"
import { BulkLoadResultDialog } from "@/components/loads/bulk-load-result-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { getCompanySettings } from "@/app/actions/number-formats"
import { formatLoadWeight, type WeightUnit } from "@/lib/format-weight"

type LoadListItem = NonNullable<Awaited<ReturnType<typeof getLoads>>["data"]>[number]
type LoadDeleteDependency = {
  type: string
  id: string
  name: string
  link?: string
}

export default function LoadsPage() {
  const router = useRouter()
  const { initialLoads, initialError } = useLoadsInitialData()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [loadsList, setLoadsList] = useState<LoadListItem[]>(() => (initialLoads as LoadListItem[]) || [])
  const [isLoading, setIsLoading] = useState(() => !initialLoads && !initialError)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(() => !!initialLoads || !!initialError)
  const [searchTerm, setSearchTerm] = useState("")
  const debouncedSearchTerm = useDebounce(searchTerm, 300) // Debounce search for performance
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortBy, setSortBy] = useState("created_at")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBulkMode, setIsBulkMode] = useState(false)
  const [deleteDependencies, setDeleteDependencies] = useState<LoadDeleteDependency[]>([])
  const [generatingInvoiceId, setGeneratingInvoiceId] = useState<string | null>(null)
  const [bulkResult, setBulkResult] = useState<BulkLoadSummary | null>(null)
  const [bulkResultTitle, setBulkResultTitle] = useState("")
  const [bulkResultOpen, setBulkResultOpen] = useState(false)
  const [confirmBulkStatus, setConfirmBulkStatus] = useState<string | null>(null)
  const [confirmBulkInvoice, setConfirmBulkInvoice] = useState(false)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false)
  const [bulkAssignDriverId, setBulkAssignDriverId] = useState("")
  const [bulkAssignTruckId, setBulkAssignTruckId] = useState("")
  const [bulkDrivers, setBulkDrivers] = useState<Array<{ id: string; name: string }>>([])
  const [bulkTrucks, setBulkTrucks] = useState<Array<{ id: string; truck_number: string }>>([])
  const [bulkRunning, setBulkRunning] = useState(false)
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("lbs")

  useEffect(() => {
    getCompanySettings()
      .then((result) => {
        const unit = result.data?.weight_unit === "kg" ? "kg" : "lbs"
        setWeightUnit(unit)
      })
      .catch(() => {})
  }, [])

  const loadLoads = useCallback(async () => {
    if (!hasLoadedOnce) {
      setIsLoading(true)
    }
    try {
      const result = await getLoads({
        status: statusFilter !== "all" ? statusFilter : undefined,
        search: debouncedSearchTerm || undefined,
        sortBy: (sortBy as "created_at" | "shipment_number" | "load_date" | "status"),
      })
      if (result.error) {
        toast.error(result.error)
        setLoadsList([]) // Set empty array on error
        setHasLoadedOnce(true)
        return
      }
      if (result.data) {
        setLoadsList(result.data)
      } else {
        setLoadsList([])
      }
    } catch (error: unknown) {
      console.error("Error loading loads:", error)
      toast.error("Failed to load loads. Please try again.")
      setLoadsList([])
    } finally {
      setHasLoadedOnce(true)
      setIsLoading(false)
    }
  }, [statusFilter, debouncedSearchTerm, sortBy, hasLoadedOnce])

  useEffect(() => {
    // Always refresh in the background on mount/filter changes so newly created
    // rows appear even when the page was hydrated from cached server layout data.
    void loadLoads()
  }, [loadLoads])

  // Memoized filter and sort for better performance
  const filteredLoads = useMemo(() => {
    return loadsList
  }, [loadsList])

  const handleExportLoads = () => {
    try {
      const exportData = loadsList.map(({ id, company_id, route_id, driver_id, truck_id, coordinates, created_at, updated_at, ...rest }) => rest)
      exportToExcel(exportData, "loads")
      toast.success("Loads exported successfully")
    } catch (error) {
      toast.error("Failed to export loads")
    }
  }

  const handleDeleteClick = async (id: string) => {
    setDeleteId(id)
    // Check dependencies
    try {
      const response = await fetch(`/api/check-dependencies?resource_type=load&resource_id=${id}`)
      if (response.ok) {
        const data = (await response.json()) as {
          dependencies?: Array<{
            type?: string
            id?: string
            name?: string
            label?: string
            details?: string
            link?: string
          }>
        }
        const deps = (data.dependencies || [])
          .map((dep) => ({
            type: dep.type || "dependency",
            id: dep.id || "",
            name: dep.name || dep.label || dep.details || "Related record",
            link: dep.link,
          }))
          .filter((dep) => dep.id.length > 0)
        setDeleteDependencies(deps)
      }
    } catch (error) {
      console.error("Failed to check dependencies:", error)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    const result = await deleteLoad(deleteId)
    if (result.error) {
      toast.error(result.error)
      setDeleteId(null)
      setDeleteDependencies([])
    } else {
      toast.success("Load deleted successfully")
      setDeleteId(null)
      setDeleteDependencies([])
      await loadLoads()
    }
  }

  const handleInlineUpdate = async (loadId: string, field: string, value: string | number | null) => {
    // Optimistic update - update UI immediately
    const updatedLoads = loadsList.map(load => 
      load.id === loadId ? { ...load, [field]: value } : load
    )
    setLoadsList(updatedLoads)
    // filteredLoads will automatically update via useMemo when loadsList changes

    // Then save to server
    const updateData: Record<string, string | number | null> = { [field]: value }
    const result = await updateLoad(loadId, updateData)
    
    if (result.error) {
      // Revert on error
      await loadLoads()
      toast.error(result.error || "Failed to update")
      // CRH-001 FIX: Removed throw - toast already shows error to user
      return
    }
    // Success - no need to reload, UI already updated
  }

  function showBulkSummary(title: string, summary: BulkLoadSummary) {
    setBulkResultTitle(title)
    setBulkResult(summary)
    setBulkResultOpen(true)
    toast.success(`${summary.succeeded} succeeded, ${summary.skipped} skipped, ${summary.failed} failed`)
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    setBulkRunning(true)
    const result = await bulkDeleteLoads(Array.from(selectedIds))
    setBulkRunning(false)
    setConfirmBulkDelete(false)
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
    setBulkRunning(true)
    const result = await bulkUpdateLoadStatusDetailed(Array.from(selectedIds), status)
    setBulkRunning(false)
    setConfirmBulkStatus(null)
    if (result.error) {
      toast.error(result.error)
    } else if (result.data) {
      showBulkSummary(`Bulk status → ${status}`, result.data)
      setSelectedIds(new Set())
      setIsBulkMode(false)
      await loadLoads()
    }
  }

  async function openBulkAssign() {
    const [driversResult, trucksResult] = await Promise.all([getDrivers(), getTrucks()])
    if (driversResult.data) {
      setBulkDrivers(
        driversResult.data
          .filter((d: { status?: string | null }) => d.status === "active")
          .map((d: { id: string; name?: string | null }) => ({ id: d.id, name: d.name || "Driver" })),
      )
    }
    if (trucksResult.data) {
      setBulkTrucks(
        trucksResult.data.map((t: { id: string; truck_number?: string | null }) => ({
          id: t.id,
          truck_number: t.truck_number || t.id.slice(0, 6),
        })),
      )
    }
    setBulkAssignOpen(true)
  }

  const handleBulkAssign = async () => {
    if (!bulkAssignDriverId || selectedIds.size === 0) {
      toast.error("Select a driver for bulk assignment")
      return
    }
    if (!(await ensureDispatchConfirmed())) return
    setBulkRunning(true)
    const result = await bulkAssignLoads(
      Array.from(selectedIds),
      bulkAssignDriverId,
      bulkAssignTruckId || undefined,
    )
    setBulkRunning(false)
    setBulkAssignOpen(false)
    if (result.error) {
      toast.error(result.error)
    } else if (result.data) {
      showBulkSummary("Bulk assign driver", result.data)
      setSelectedIds(new Set())
      setIsBulkMode(false)
      await loadLoads()
    }
  }

  const handleBulkInvoice = async () => {
    if (selectedIds.size === 0) return
    setBulkRunning(true)
    const result = await bulkCreateInvoicesForLoads(Array.from(selectedIds))
    setBulkRunning(false)
    setConfirmBulkInvoice(false)
    if (result.error) {
      toast.error(result.error)
    } else if (result.data) {
      showBulkSummary("Bulk create invoices", result.data)
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
    // Optimistic update
    const updatedLoads = loadsList.map(load => 
      load.id === id ? { ...load, status } : load
    )
    setLoadsList(updatedLoads)
    // filteredLoads will automatically update via useMemo when loadsList changes

    const result = await updateLoad(id, { status })
    if (result.error) {
      await loadLoads() // Revert on error
      toast.error(result.error)
    }
    // Success - no toast, no reload
  }

  const handleGenerateInvoice = async (load: LoadListItem) => {
    if (!load?.id) return
    setGeneratingInvoiceId(load.id)
    const result = await autoGenerateInvoiceOnPOD(load.id)
    setGeneratingInvoiceId(null)

    if (result.error) {
      toast.error(result.error)
      return
    }

    const invoiceId = result.data?.invoiceId
    if (!invoiceId) {
      toast.error("Invoice generation succeeded but invoice ID was not returned")
      return
    }

    toast.success(result.data?.alreadyExists ? "Invoice already exists for this load" : "Invoice generated")
    await loadLoads()
    router.push(`/dashboard/accounting/invoices/${invoiceId}`)
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
        setConfirmBulkDelete(true)
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
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs">
            <Link
              href="/dashboard/ifta/trip-sheet"
              className="text-primary font-medium hover:underline"
            >
              IFTA trip sheet (manual miles)
            </Link>
            <span className="text-border">·</span>
            <Link href="/dashboard/ifta" className="text-muted-foreground hover:text-primary hover:underline">
              IFTA reports
            </Link>
            <span className="text-border hidden sm:inline">·</span>
            <span className="text-muted-foreground hidden sm:inline">
              Trip planning (ProMiles-style) is on each load’s detail page → scroll to <strong className="text-foreground">Trip planning</strong>
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Press Ctrl+N for new, Ctrl+F to search, Delete to bulk delete</p>
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
                    aria-label={`Update status for ${selectedIds.size} selected loads`}
                    aria-haspopup="true"
                  >
                    Update Status ({selectedIds.size})
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setConfirmBulkStatus("draft")}>
                    Draft
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setConfirmBulkStatus("pending")}>
                    Pending
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setConfirmBulkStatus("confirmed")}>
                    Confirmed
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setConfirmBulkStatus("scheduled")}>
                    Scheduled
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setConfirmBulkStatus("in_transit")}>
                    In Transit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setConfirmBulkStatus("delivered")}>
                    Delivered
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setConfirmBulkStatus("cancelled")}>
                    Cancelled
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void openBulkAssign()}
                disabled={bulkRunning}
              >
                <User className="w-4 h-4 mr-2" />
                Assign ({selectedIds.size})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmBulkInvoice(true)}
                disabled={bulkRunning}
              >
                <FileText className="w-4 h-4 mr-2" />
                Invoice ({selectedIds.size})
              </Button>
              <Button
                onClick={() => setConfirmBulkDelete(true)}
                variant="outline"
                size="sm"
                className="border-red-500/50 bg-transparent hover:bg-red-500/20 text-red-400"
                aria-label={`Delete ${selectedIds.size} selected loads`}
              >
                <Trash2 className="w-4 h-4 mr-2" aria-hidden="true" />
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
                aria-label="Cancel selection"
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
                aria-label="Export loads to Excel"
              >
                <Download className="w-4 h-4 sm:mr-2" aria-hidden="true" />
                <span className="hidden sm:inline">Export to Excel</span>
                <span className="sm:hidden">Export</span>
              </Button>
              <Link href="/dashboard/loads/add" className="flex-1 sm:flex-initial">
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition w-full sm:w-auto" aria-label="Add new load">
                  <Plus className="w-4 h-4 sm:mr-2" aria-hidden="true" />
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
                    aria-label="Search loads"
                    type="search"
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
                    <SelectItem value="confirmed">Confirmed</SelectItem>
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
          {/* Loads List */}
          <div>
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
              <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                {filteredLoads.map((load) => (
                <Card
                  key={load.id}
                  className={`border-border p-4 md:p-6 hover:border-primary/50 hover:shadow-md transition h-full ${
                    selectedIds.has(load.id) ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedIds.has(load.id)}
                        onCheckedChange={() => toggleSelect(load.id)}
                        className="mt-1"
                      />
                      <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                        <Package className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Shipment</p>
                        <p className="font-bold text-foreground">{load.shipment_number || "N/A"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <InlineEdit
                        value={load.status || ""}
                        onSave={async (value) => handleInlineUpdate(load.id, "status", value as string)}
                        type="select"
                        options={[
                          { value: "draft", label: "Draft" },
                          { value: "pending", label: "Pending" },
                          { value: "confirmed", label: "Confirmed" },
                          { value: "scheduled", label: "Scheduled" },
                          { value: "in_transit", label: "In Transit" },
                          { value: "delivered", label: "Delivered" },
                          { value: "cancelled", label: "Cancelled" },
                        ]}
                        formatValue={(val) => {
                          if (!val) return "N/A"
                          return String(val).charAt(0).toUpperCase() + String(val).slice(1).replace("_", " ")
                        }}
                        className="w-auto"
                      />
                    </div>
                  </div>
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex items-center gap-2">
                      <p className="text-foreground">Weight: {formatLoadWeight(load, weightUnit)}</p>
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
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Est. Delivery:</span>
                      <InlineEdit
                        value={load.estimated_delivery || null}
                        onSave={async (value) => handleInlineUpdate(load.id, "estimated_delivery", value)}
                        type="date"
                        placeholder="Set delivery date"
                        className="flex-1"
                      />
                    </div>
                    {load.value && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Rate:</span>
                        <InlineEdit
                          value={load.value || 0}
                          onSave={async (value) => handleInlineUpdate(load.id, "value", value as number)}
                          type="currency"
                          placeholder="Set rate"
                          className="flex-1"
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-4 border-t border-border/30">
                    {load.id && typeof load.id === "string" && load.id.trim() !== "" ? (
                      <>
                        {load.invoice_id ? (
                          <Link href={`/dashboard/accounting/invoices/${load.invoice_id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-border/50 bg-transparent hover:bg-secondary/50"
                            >
                              <FileText className="w-4 h-4 mr-1" />
                              View Invoice
                            </Button>
                          </Link>
                        ) : (load.status === "delivered" || load.status === "completed") ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-border/50 bg-transparent hover:bg-secondary/50"
                            disabled={generatingInvoiceId === load.id}
                            onClick={() => handleGenerateInvoice(load)}
                          >
                            <FileText className="w-4 h-4 mr-1" />
                            {generatingInvoiceId === load.id ? "Generating..." : "Generate Invoice"}
                          </Button>
                        ) : null}
                        <Link href={`/dashboard/loads/${load.id}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 border-border/50 bg-transparent hover:bg-secondary/50"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View Details
                          </Button>
                        </Link>
                        <Link href={`/dashboard/loads/${load.id}/edit`}>
                          <Button variant="outline" size="sm" className="border-border/50 bg-transparent hover:bg-secondary/50">
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </Link>
                        <AuditTrail
                          resourceType="load"
                          resourceId={load.id}
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
                      onClick={() => handleDuplicate(load.id)}
                      title="Duplicate load"
                    >
                      <Copy className="w-4 h-4 text-blue-400" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border/50 bg-transparent hover:bg-red-500/20"
                      onClick={() => handleDeleteClick(load.id)}
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
          resourceType="load"
          resourceName={loadsList.find(l => l.id === deleteId)?.shipment_number || "Load"}
          resourceId={deleteId}
          dependencies={deleteDependencies}
          warningMessage="This will permanently delete the load. Associated invoices and documents will be preserved but the load link will be removed."
        />
      )}

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedCount={selectedIds.size}
        onClearSelection={() => {
          setSelectedIds(new Set())
          setIsBulkMode(false)
        }}
        onBulkDelete={() => setConfirmBulkDelete(true)}
        customActions={[
          {
            label: "Assign driver",
            icon: <User className="h-3 w-3 mr-1" />,
            onClick: () => void openBulkAssign(),
          },
          {
            label: "Create invoices",
            icon: <FileText className="h-3 w-3 mr-1" />,
            onClick: () => setConfirmBulkInvoice(true),
          },
        ]}
        onBulkStatusChange={(status) => setConfirmBulkStatus(status)}
        onBulkExport={() => {
          const selectedLoads = loadsList.filter((load) =>
            selectedIds.has(load.id)
          )
          const exportData = selectedLoads.map(
            ({
              id,
              company_id,
              route_id,
              driver_id,
              truck_id,
              coordinates,
              created_at,
              updated_at,
              ...rest
            }) => rest
          )
          exportToExcel(exportData, "selected-loads")
          toast.success(`Exported ${selectedIds.size} load(s)`)
        }}
        availableStatuses={[
          "draft",
          "pending",
          "scheduled",
          "in_transit",
          "delivered",
          "cancelled",
        ]}
      />

      <BulkLoadResultDialog
        open={bulkResultOpen}
        onOpenChange={setBulkResultOpen}
        title={bulkResultTitle}
        summary={bulkResult}
      />

      <Dialog open={confirmBulkStatus !== null} onOpenChange={(o) => !o && setConfirmBulkStatus(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update {selectedIds.size} load(s)?</DialogTitle>
            <DialogDescription>
              Mark {selectedIds.size} selected load(s) as <strong>{confirmBulkStatus}</strong>. Loads
              with invalid status transitions will be reported individually.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmBulkStatus(null)}>Cancel</Button>
            <Button
              disabled={bulkRunning}
              onClick={() => confirmBulkStatus && void handleBulkStatusUpdate(confirmBulkStatus)}
            >
              {bulkRunning ? "Updating..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmBulkInvoice} onOpenChange={setConfirmBulkInvoice}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create invoices for {selectedIds.size} load(s)?</DialogTitle>
            <DialogDescription>
              Generates invoices for delivered loads in the selection. Loads already invoiced are
              skipped. Non-delivered loads will fail individually.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmBulkInvoice(false)}>Cancel</Button>
            <Button disabled={bulkRunning} onClick={() => void handleBulkInvoice()}>
              {bulkRunning ? "Creating..." : "Create invoices"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmBulkDelete} onOpenChange={setConfirmBulkDelete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.size} load(s)?</DialogTitle>
            <DialogDescription>
              This permanently deletes the selected loads. In-transit or active loads cannot be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmBulkDelete(false)}>Cancel</Button>
            <Button variant="destructive" disabled={bulkRunning} onClick={() => void handleBulkDelete()}>
              {bulkRunning ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkAssignOpen} onOpenChange={setBulkAssignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk assign {selectedIds.size} load(s)</DialogTitle>
            <DialogDescription>
              Each load is validated for HOS and scheduling conflicts. Failures are reported per load.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Driver</Label>
              <Select value={bulkAssignDriverId} onValueChange={setBulkAssignDriverId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select driver" />
                </SelectTrigger>
                <SelectContent>
                  {bulkDrivers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Truck (optional)</Label>
              <Select value={bulkAssignTruckId} onValueChange={setBulkAssignTruckId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select truck" />
                </SelectTrigger>
                <SelectContent>
                  {bulkTrucks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.truck_number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAssignOpen(false)}>Cancel</Button>
            <Button disabled={bulkRunning || !bulkAssignDriverId} onClick={() => void handleBulkAssign()}>
              {bulkRunning ? "Assigning..." : "Assign all"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
