"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Plus, Edit2, Trash2, Eye, Download, Users, Search, Filter } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
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
import { useRouter } from "next/navigation"
import { getDrivers, deleteDriver } from "@/app/actions/drivers"

export default function DriversPage() {
  const router = useRouter()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [driversList, setDriversList] = useState<any[]>([])
  const [filteredDrivers, setFilteredDrivers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortBy, setSortBy] = useState("name")

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

  const handleDelete = async (id: string) => {
    const result = await deleteDriver(id)
    if (result.error) {
      toast.error(result.error)
      setDeleteId(null)
    } else {
      toast.success("Driver deleted successfully")
      setDeleteId(null)
      // Reload drivers list
      await loadDrivers()
    }
  }

  return (
    <div className="w-full">
      {/* Page Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Drivers</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your fleet drivers</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Button
            onClick={handleExportDrivers}
            variant="outline"
            size="sm"
            className="border-border/50 bg-transparent hover:bg-secondary/50 text-foreground flex-1 sm:flex-initial"
          >
            <Download className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Export to Excel</span>
            <span className="sm:hidden">Export</span>
          </Button>
          <Link href="/dashboard/drivers/add" className="flex-1 sm:flex-initial">
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition w-full sm:w-auto"
              onClick={() => console.log("[v0] Navigating to /dashboard/drivers/add")}
            >
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Add Driver</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Search and Filters */}
          {!isLoading && driversList.length > 0 && (
            <Card className="border-border/50 p-4 mb-6">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, phone, license..."
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
                        <tr key={driver.id} className="border-b border-border hover:bg-secondary/20 transition">
                          <td className="px-6 py-4">
                            <div>
                              <p className="text-foreground font-medium">{driver.name || "N/A"}</p>
                              <p className="text-xs text-muted-foreground">{driver.email || ""}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div>
                              <p className="text-sm text-foreground">{driver.phone || "N/A"}</p>
                              {driver.email && <p className="text-xs text-muted-foreground">{driver.email}</p>}
                            </div>
                          </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm text-foreground">{driver.license_number || "N/A"}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-foreground">
                            {driver.license_expiry 
                              ? new Date(driver.license_expiry).toLocaleDateString() 
                              : "N/A"}
                            {driver.license_expiry && new Date(driver.license_expiry) < new Date() && (
                              <span className="ml-2 text-xs text-red-400">(Expired)</span>
                            )}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <Badge
                            className={
                              driver.status === "on_route"
                                ? "bg-green-500/20 text-green-400 border-green-500/50"
                                : driver.status === "active"
                                ? "bg-blue-500/20 text-blue-400 border-blue-500/50"
                                : driver.status === "inactive" || driver.status === "off_duty"
                                ? "bg-gray-500/20 text-gray-400 border-gray-500/50"
                                : "bg-yellow-500/20 text-yellow-400 border-yellow-500/50"
                            }
                          >
                            {driver.status ? driver.status.charAt(0).toUpperCase() + driver.status.slice(1).replace("_", " ") : "N/A"}
                          </Badge>
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
                            <Link href={`/dashboard/drivers/${driver.id}/edit`}>
                              <Button variant="ghost" size="sm" className="hover:bg-secondary/50">
                                <Edit2 className="w-4 h-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="hover:bg-red-500/20"
                              onClick={() => setDeleteId(driver.id)}
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
                  <Card key={driver.id} className="border border-border/50 p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">{driver.name || "N/A"}</h3>
                          {driver.email && (
                            <p className="text-sm text-muted-foreground">{driver.email}</p>
                          )}
                        </div>
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
                        <Link href={`/dashboard/drivers/${driver.id}/edit`} className="flex-1">
                          <Button variant="outline" size="sm" className="w-full">
                            <Edit2 className="w-4 h-4 mr-2" />
                            Edit
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/20"
                          onClick={() => setDeleteId(driver.id)}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the driver from the system.
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
