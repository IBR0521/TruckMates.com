"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Plus, Edit2, Trash2, Eye, Download, Users, Search, Filter, Trophy } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import Link from "next/link"
import { exportToExcel } from "@/lib/export-utils"
import { toast } from "sonner"
import { useState, useEffect } from "react"
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
import { useRouter } from "next/navigation"
import { getDrivers, deleteDriver, bulkDeleteDrivers, bulkUpdateDriverStatus, updateDriver } from "@/app/actions/drivers"
import { AccessGuard } from "@/components/access-guard"
import { InlineEdit } from "@/components/dashboard/inline-edit"
import { DefensiveDelete } from "@/components/dashboard/defensive-delete"
import { AuditTrail } from "@/components/dashboard/audit-trail"
import { History } from "lucide-react"

function DriversPageContent() {
  const router = useRouter()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [driversList, setDriversList] = useState<any[]>([])
  const [filteredDrivers, setFilteredDrivers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortBy, setSortBy] = useState("name")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBulkMode, setIsBulkMode] = useState(false)
  const [deleteDependencies, setDeleteDependencies] = useState<any[]>([])

  const loadDrivers = async () => {
    setIsLoading(true)
    const result = await getDrivers()
    if (result.error) {
      toast.error(result.error)
      setIsLoading(false)
      return
    }
    if (result.data) {
      setDriversList(result.data)
      setFilteredDrivers(result.data)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    loadDrivers()
  }, [])

  // Filter and sort drivers
  useEffect(() => {
    let filtered = [...driversList]

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (driver) =>
          driver.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          driver.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          driver.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          driver.license_number?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((driver) => driver.status === statusFilter)
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return (a.name || "").localeCompare(b.name || "")
        case "status":
          return (a.status || "").localeCompare(b.status || "")
        case "license_expiry":
          return new Date(a.license_expiry || 0).getTime() - new Date(b.license_expiry || 0).getTime()
        default:
          return 0
      }
    })

    setFilteredDrivers(filtered)
  }, [driversList, searchTerm, statusFilter, sortBy])

  const handleExportDrivers = () => {
    try {
      const exportData = driversList.map(({ id, company_id, user_id, created_at, updated_at, ...rest }) => rest)
      exportToExcel(exportData, "drivers")
      toast.success("Drivers exported successfully")
    } catch (error) {
      toast.error("Failed to export drivers")
    }
  }

  const handleDeleteClick = async (id: string) => {
    setDeleteId(id)
    // Check dependencies
    try {
      const response = await fetch(`/api/check-dependencies?resource_type=driver&resource_id=${id}`)
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
    const result = await deleteDriver(deleteId)
    if (result.error) {
      toast.error(result.error)
      setDeleteId(null)
      setDeleteDependencies([])
    } else {
      toast.success("Driver deleted successfully")
      setDeleteId(null)
      setDeleteDependencies([])
      // Reload drivers list
      await loadDrivers()
    }
  }

  const handleInlineUpdate = async (driverId: string, field: string, value: string | number | null) => {
    // Find the driver to get current value for revert
    const currentDriver = driversList.find(d => d.id === driverId)
    const oldValue = currentDriver?.[field]
    
    // Optimistic update - update UI immediately
    const updatedDrivers = driversList.map(driver => 
      driver.id === driverId ? { ...driver, [field]: value } : driver
    )
    setDriversList(updatedDrivers)
    
    // Update filtered list too
    const updatedFiltered = filteredDrivers.map(driver => 
      driver.id === driverId ? { ...driver, [field]: value } : driver
    )
    setFilteredDrivers(updatedFiltered)

    // Then save to server silently
    const updateData: any = { [field]: value }
    const result = await updateDriver(driverId, updateData)
    
    if (result.error) {
      // Revert on error - restore old value
      const revertedDrivers = driversList.map(driver => 
        driver.id === driverId ? { ...driver, [field]: oldValue } : driver
      )
      setDriversList(revertedDrivers)
      
      const revertedFiltered = filteredDrivers.map(driver => 
        driver.id === driverId ? { ...driver, [field]: oldValue } : driver
      )
      setFilteredDrivers(revertedFiltered)
      
      toast.error(result.error || "Failed to update")
      throw new Error(result.error)
    }
    // Success - no toast, no reload, UI already updated optimistically
  }

  // Bulk operations
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    const result = await bulkDeleteDrivers(Array.from(selectedIds))
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(`Deleted ${selectedIds.size} driver(s) successfully`)
      setSelectedIds(new Set())
      setIsBulkMode(false)
      await loadDrivers()
    }
  }

  const handleBulkStatusUpdate = async (status: string) => {
    if (selectedIds.size === 0) return
    const result = await bulkUpdateDriverStatus(Array.from(selectedIds), status)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(`Updated ${selectedIds.size} driver(s) to ${status}`)
      setSelectedIds(new Set())
      setIsBulkMode(false)
      await loadDrivers()
    }
  }

  const handleQuickStatusUpdate = async (id: string, status: string) => {
    const result = await updateDriver(id, { status })
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Status updated successfully")
      await loadDrivers()
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
    if (selectedIds.size === filteredDrivers.length) {
      setSelectedIds(new Set())
      setIsBulkMode(false)
    } else {
      setSelectedIds(new Set(filteredDrivers.map(d => d.id)))
      setIsBulkMode(true)
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + N: New driver
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        router.push('/dashboard/drivers/add')
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
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Drivers</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your fleet drivers</p>
          <p className="text-xs text-muted-foreground mt-1">Press Ctrl+N for new, Ctrl+F to search, Delete to bulk delete</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Link href="/dashboard/drivers/leaderboard">
            <Button variant="outline" size="sm">
              <Trophy className="w-4 h-4 mr-2" />
              Leaderboard
            </Button>
          </Link>
          {isBulkMode && selectedIds.size > 0 && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border/50 bg-transparent hover:bg-secondary/50 text-foreground"
                    aria-label={`Update status for ${selectedIds.size} selected drivers`}
                    aria-haspopup="true"
                  >
                    Update Status ({selectedIds.size})
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleBulkStatusUpdate("active")}>
                    Active
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkStatusUpdate("on_route")}>
                    On Route
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkStatusUpdate("off_duty")}>
                    Off Duty
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkStatusUpdate("inactive")}>
                    Inactive
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkStatusUpdate("on_leave")}>
                    On Leave
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                onClick={handleBulkDelete}
                variant="outline"
                size="sm"
                className="border-red-500/50 bg-transparent hover:bg-red-500/20 text-red-400"
                aria-label={`Delete ${selectedIds.size} selected drivers`}
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
                onClick={handleExportDrivers}
                variant="outline"
                size="sm"
                className="border-border/50 bg-transparent hover:bg-secondary/50 text-foreground flex-1 sm:flex-initial"
                aria-label="Export drivers to Excel"
              >
                <Download className="w-4 h-4 sm:mr-2" aria-hidden="true" />
                <span className="hidden sm:inline">Export to Excel</span>
                <span className="sm:hidden">Export</span>
              </Button>
              <Link href="/dashboard/drivers/add" className="flex-1 sm:flex-initial">
                <Button
                  className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition w-full sm:w-auto"
                  aria-label="Add new driver"
                >
                  <Plus className="w-4 h-4 sm:mr-2" aria-hidden="true" />
                  <span className="hidden sm:inline">Add Driver</span>
                  <span className="sm:hidden">Add</span>
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
          {!isLoading && driversList.length > 0 && (
            <Card className="border-border/50 p-4 mb-6">
              <div className="grid md:grid-cols-4 gap-4">
                {filteredDrivers.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedIds.size === filteredDrivers.length && filteredDrivers.length > 0}
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
                    placeholder="Search by name, email, phone, license..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    aria-label="Search drivers"
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
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on_route">On Route</SelectItem>
                    <SelectItem value="off_duty">Off Duty</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="on_leave">On Leave</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                    <SelectItem value="license_expiry">License Expiry</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>
          )}

          {isLoading ? (
            <Card className="border border-border/50 p-4 md:p-8">
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading drivers...</p>
              </div>
            </Card>
          ) : filteredDrivers.length === 0 ? (
            <Card className="border border-border/50 p-4 md:p-8">
              <div className="text-center py-8 md:py-12">
                <Users className="w-12 h-12 md:w-16 md:h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg md:text-xl font-semibold text-foreground mb-2">
                  {searchTerm || statusFilter !== "all" ? "No drivers found" : "No drivers yet"}
                </h3>
                <p className="text-muted-foreground mb-6 text-sm md:text-base">
                  {searchTerm || statusFilter !== "all"
                    ? "Try adjusting your search or filters"
                    : "Get started by adding your first driver to the fleet"}
                </p>
                {!searchTerm && statusFilter === "all" && (
                  <Link href="/dashboard/drivers/add">
                    <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Your First Driver
                    </Button>
                  </Link>
                )}
              </div>
            </Card>
          ) : (
            <>
              {/* Desktop: Table */}
              <Card className="border border-border/50 overflow-hidden shadow-sm hidden md:block">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        {isBulkMode && (
                          <th className="px-6 py-4 text-left text-sm font-semibold text-foreground w-12">
                            <Checkbox
                              checked={selectedIds.size === filteredDrivers.length && filteredDrivers.length > 0}
                              onCheckedChange={toggleSelectAll}
                            />
                          </th>
                        )}
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Name</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Contact</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">License</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">License Expiry</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Status</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDrivers.map((driver) => (
                        <tr key={driver.id} className={`border-b border-border hover:bg-secondary/20 transition ${selectedIds.has(driver.id) ? 'bg-primary/5' : ''}`}>
                          {isBulkMode && (
                            <td className="px-6 py-4">
                              <Checkbox
                                checked={selectedIds.has(driver.id)}
                                onCheckedChange={() => toggleSelect(driver.id)}
                              />
                            </td>
                          )}
                          <td className="px-6 py-4">
                            <div>
                              <InlineEdit
                                value={driver.name || ""}
                                onSave={async (value) => handleInlineUpdate(driver.id, "name", value as string)}
                                placeholder="Driver name"
                                className="w-full"
                              />
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div>
                              <InlineEdit
                                value={driver.phone || ""}
                                onSave={async (value) => handleInlineUpdate(driver.id, "phone", value as string)}
                                type="phone"
                                placeholder="Phone number"
                                className="w-full"
                              />
                              <InlineEdit
                                value={driver.email || ""}
                                onSave={async (value) => handleInlineUpdate(driver.id, "email", value as string)}
                                type="email"
                                placeholder="Email address"
                                className="w-full mt-1"
                              />
                            </div>
                          </td>
                        <td className="px-6 py-4">
                          <div>
                            <InlineEdit
                              value={driver.license_number || ""}
                              onSave={async (value) => handleInlineUpdate(driver.id, "license_number", value as string)}
                              placeholder="License number"
                              className="w-full"
                            />
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <InlineEdit
                              value={driver.license_expiry || null}
                              onSave={async (value) => handleInlineUpdate(driver.id, "license_expiry", value)}
                              type="date"
                              placeholder="Set expiry date"
                              className="flex-1"
                            />
                            {driver.license_expiry && new Date(driver.license_expiry) < new Date() && (
                              <span className="text-xs text-red-400 whitespace-nowrap">(Expired)</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <InlineEdit
                            value={driver.status || ""}
                            onSave={async (value) => handleInlineUpdate(driver.id, "status", value as string)}
                            type="select"
                            options={[
                              { value: "active", label: "Active" },
                              { value: "on_route", label: "On Route" },
                              { value: "off_duty", label: "Off Duty" },
                              { value: "inactive", label: "Inactive" },
                              { value: "on_leave", label: "On Leave" },
                            ]}
                            formatValue={(val) => {
                              if (!val) return "N/A"
                              return String(val).charAt(0).toUpperCase() + String(val).slice(1).replace("_", " ")
                            }}
                            className="w-full"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="hover:bg-secondary/50"
                              onClick={() => router.push(`/dashboard/drivers/${driver.id}`)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {driver.id && typeof driver.id === 'string' && driver.id.trim() !== '' ? (
                              <>
                                <Link href={`/dashboard/drivers/${driver.id}/edit`}>
                                  <Button variant="ghost" size="sm" className="hover:bg-secondary/50">
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                </Link>
                                <AuditTrail
                                  resourceType="driver"
                                  resourceId={driver.id}
                                  trigger={
                                    <Button variant="ghost" size="sm" className="hover:bg-secondary/50">
                                      <History className="w-4 h-4" />
                                    </Button>
                                  }
                                />
                              </>
                            ) : null}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="hover:bg-red-500/20"
                              onClick={() => handleDeleteClick(driver.id)}
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

              {/* Mobile: Cards */}
              <div className="md:hidden space-y-4">
                {filteredDrivers.map((driver) => (
                  <Card key={driver.id} className={`border border-border/50 p-4 ${selectedIds.has(driver.id) ? 'border-primary bg-primary/5' : ''}`}>
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {isBulkMode && (
                            <Checkbox
                              checked={selectedIds.has(driver.id)}
                              onCheckedChange={() => toggleSelect(driver.id)}
                            />
                          )}
                          <div>
                            <h3 className="text-lg font-semibold text-foreground">{driver.name || "N/A"}</h3>
                            {driver.email && (
                              <p className="text-sm text-muted-foreground">{driver.email}</p>
                            )}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 px-2">
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  driver.status === "on_route" || driver.status === "On Route"
                                    ? "bg-green-500/20 text-green-400"
                                    : driver.status === "active" || driver.status === "Active"
                                      ? "bg-blue-500/20 text-blue-400"
                                      : driver.status === "inactive" || driver.status === "off_duty"
                                        ? "bg-gray-500/20 text-gray-400"
                                        : "bg-yellow-500/20 text-yellow-400"
                                }`}
                              >
                                {driver.status ? driver.status.charAt(0).toUpperCase() + driver.status.slice(1).replace("_", " ") : "N/A"}
                              </span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleQuickStatusUpdate(driver.id, "active")}>
                              Active
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleQuickStatusUpdate(driver.id, "on_route")}>
                              On Route
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleQuickStatusUpdate(driver.id, "off_duty")}>
                              Off Duty
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleQuickStatusUpdate(driver.id, "inactive")}>
                              Inactive
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleQuickStatusUpdate(driver.id, "on_leave")}>
                              On Leave
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      
                      <div className="space-y-2 pt-2 border-t border-border/30">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Phone</p>
                          <p className="text-sm text-foreground">{driver.phone || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">License Number</p>
                          <p className="text-sm text-foreground">{driver.license_number || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">License Expiry</p>
                          <p className="text-sm text-foreground">
                            {driver.license_expiry 
                              ? new Date(driver.license_expiry).toLocaleDateString() 
                              : "N/A"}
                            {driver.license_expiry && new Date(driver.license_expiry) < new Date() && (
                              <span className="ml-2 text-xs text-red-400">(Expired)</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2 border-t border-border/30">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => router.push(`/dashboard/drivers/${driver.id}`)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </Button>
                        {driver.id && typeof driver.id === 'string' && driver.id.trim() !== '' ? (
                          <Link href={`/dashboard/drivers/${driver.id}/edit`} className="flex-1">
                            <Button variant="outline" size="sm" className="w-full">
                              <Edit2 className="w-4 h-4 mr-2" />
                              Edit
                            </Button>
                          </Link>
                        ) : null}
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/20"
                          onClick={() => handleDeleteClick(driver.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
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
          resourceType="driver"
          resourceName={driversList.find(d => d.id === deleteId)?.name || "Driver"}
          resourceId={deleteId}
          dependencies={deleteDependencies}
          warningMessage="This will permanently delete the driver. All associated data will be preserved but the driver link will be removed."
        />
      )}
    </div>
  )
}

export default function DriversPage() {
  return (
    <AccessGuard requiredFeature="drivers">
      <DriversPageContent />
    </AccessGuard>
  )
}
