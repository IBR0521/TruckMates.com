"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Plus, Edit2, Trash2, Eye, Download, Store, Search, Filter } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getVendors, deleteVendor } from "@/app/actions/vendors"
import { Badge } from "@/components/ui/badge"

export default function VendorsPage() {
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [vendorsList, setVendorsList] = useState<any[]>([])
  const [filteredVendors, setFilteredVendors] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState("created_at")

  const loadVendors = async () => {
    setIsLoading(true)
    const filters: any = {}
    if (searchTerm) filters.search = searchTerm
    if (statusFilter !== "all") filters.status = statusFilter
    if (typeFilter !== "all") filters.vendor_type = typeFilter

    const result = await getVendors(filters)
    if (result.error) {
      toast.error(result.error)
      setIsLoading(false)
      return
    }
    if (result.data) {
      setVendorsList(result.data)
      setFilteredVendors(result.data)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    loadVendors()
  }, [statusFilter, typeFilter])

  // Filter and sort vendors
  useEffect(() => {
    let filtered = [...vendorsList]

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return (a.name || "").localeCompare(b.name || "")
        case "total_spent":
          return Number(b.total_spent || 0) - Number(a.total_spent || 0)
        case "status":
          return (a.status || "").localeCompare(b.status || "")
        case "created_at":
        default:
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      }
    })

    setFilteredVendors(filtered)
  }, [vendorsList, sortBy])

  useEffect(() => {
    const debounce = setTimeout(() => {
      loadVendors()
    }, 300)
    return () => clearTimeout(debounce)
  }, [searchTerm])

  const handleExportVendors = () => {
    try {
      const exportData = vendorsList.map(({ id, company_id, created_at, updated_at, coordinates, custom_fields, ...rest }) => rest)
      exportToExcel(exportData, "vendors")
      toast.success("Vendors exported successfully")
    } catch (error) {
      toast.error("Failed to export vendors")
    }
  }

  const handleDelete = async (id: string) => {
    const result = await deleteVendor(id)
    if (result.error) {
      toast.error(result.error)
      setDeleteId(null)
    } else {
      toast.success("Vendor deleted successfully")
      setDeleteId(null)
      await loadVendors()
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/50">Active</Badge>
      case "inactive":
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/50">Inactive</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const getTypeBadge = (type: string) => {
    const types: Record<string, { label: string; className: string }> = {
      supplier: { label: "Supplier", className: "bg-blue-500/20 text-blue-400 border-blue-500/50" },
      maintenance: { label: "Maintenance", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50" },
      fuel: { label: "Fuel", className: "bg-orange-500/20 text-orange-400 border-orange-500/50" },
      parts: { label: "Parts", className: "bg-purple-500/20 text-purple-400 border-purple-500/50" },
      other: { label: "Other", className: "bg-gray-500/20 text-gray-400 border-gray-500/50" },
    }
    const typeInfo = types[type] || { label: type, className: "bg-gray-500/20 text-gray-400 border-gray-500/50" }
    return <Badge className={typeInfo.className}>{typeInfo.label}</Badge>
  }

  return (
    <div className="w-full">
      {/* Page Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Vendors</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your vendors and suppliers</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Button
            onClick={handleExportVendors}
            variant="outline"
            size="sm"
            className="border-border/50 bg-transparent hover:bg-secondary/50 text-foreground flex-1 sm:flex-initial"
          >
            <Download className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Link href="/dashboard/vendors/add" className="flex-1 sm:flex-initial">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition w-full sm:w-auto">
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Add Vendor</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="p-4 md:p-8">
        <Card className="border-border/50 p-4 mb-6">
          <div className="grid md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search vendors by name, email, or company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-background border-border"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-background border-border">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="supplier">Supplier</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="fuel">Fuel</SelectItem>
                <SelectItem value="parts">Parts</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">Newest First</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="total_spent">Total Spent</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Vendors Table */}
        {isLoading ? (
          <Card className="border border-border/50 p-8 text-center">
            <p className="text-muted-foreground">Loading vendors...</p>
          </Card>
        ) : filteredVendors.length === 0 ? (
          <Card className="border border-border/50 p-8 text-center">
            <Store className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              {searchTerm || statusFilter !== "all" || typeFilter !== "all" ? "No vendors found matching your criteria" : "No vendors found"}
            </p>
            {!searchTerm && statusFilter === "all" && typeFilter === "all" && (
              <Link href="/dashboard/vendors/add">
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Vendor
                </Button>
              </Link>
            )}
          </Card>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border bg-card/50">
                  <th className="text-left p-4 text-sm font-semibold text-foreground">Name</th>
                  <th className="text-left p-4 text-sm font-semibold text-foreground">Company</th>
                  <th className="text-left p-4 text-sm font-semibold text-foreground">Contact</th>
                  <th className="text-left p-4 text-sm font-semibold text-foreground">Type</th>
                  <th className="text-left p-4 text-sm font-semibold text-foreground">Status</th>
                  <th className="text-left p-4 text-sm font-semibold text-foreground">Location</th>
                  <th className="text-left p-4 text-sm font-semibold text-foreground">Total Spent</th>
                  <th className="text-right p-4 text-sm font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVendors.map((vendor) => (
                  <tr key={vendor.id} className="border-b border-border/50 hover:bg-secondary/20 transition">
                    <td className="p-4">
                      <div className="font-medium text-foreground">{vendor.name}</div>
                      {vendor.email && (
                        <div className="text-sm text-muted-foreground">{vendor.email}</div>
                      )}
                    </td>
                    <td className="p-4 text-foreground">{vendor.company_name || "—"}</td>
                    <td className="p-4">
                      {vendor.primary_contact_name && (
                        <div className="text-sm text-foreground">{vendor.primary_contact_name}</div>
                      )}
                      {vendor.phone && (
                        <div className="text-sm text-muted-foreground">{vendor.phone}</div>
                      )}
                    </td>
                    <td className="p-4">{getTypeBadge(vendor.vendor_type)}</td>
                    <td className="p-4">{getStatusBadge(vendor.status)}</td>
                    <td className="p-4">
                      {vendor.city && vendor.state ? (
                        <div className="text-sm text-foreground">
                          {vendor.city}, {vendor.state}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="text-sm font-medium text-foreground">
                        ${Number(vendor.total_spent || 0).toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {vendor.total_transactions || 0} {vendor.total_transactions === 1 ? 'transaction' : 'transactions'}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/dashboard/vendors/${vendor.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Link href={`/dashboard/vendors/${vendor.id}/edit`}>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(vendor.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vendor</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this vendor? This action cannot be undone. Related expenses and maintenance records will be preserved but the vendor link will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

