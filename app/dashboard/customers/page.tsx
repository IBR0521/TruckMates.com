"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Plus, Edit2, Trash2, Eye, Download, Building2, Search, Filter } from "lucide-react"
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
import { getCustomers, deleteCustomer } from "@/app/actions/customers"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"

export default function CustomersPage() {
  const router = useRouter()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [customersList, setCustomersList] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")

  const loadCustomers = async () => {
    setIsLoading(true)
    const filters: any = {}
    if (searchTerm) filters.search = searchTerm
    if (statusFilter !== "all") filters.status = statusFilter
    if (typeFilter !== "all") filters.customer_type = typeFilter

    const result = await getCustomers(filters)
    if (result.error) {
      toast.error(result.error)
      setIsLoading(false)
      return
    }
    if (result.data) {
      setCustomersList(result.data)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    loadCustomers()
  }, [statusFilter, typeFilter])

  useEffect(() => {
    const debounce = setTimeout(() => {
      loadCustomers()
    }, 300)
    return () => clearTimeout(debounce)
  }, [searchTerm])

  const handleExportCustomers = () => {
    try {
      const exportData = customersList.map(({ id, company_id, created_at, updated_at, coordinates, custom_fields, ...rest }) => rest)
      exportToExcel(exportData, "customers")
      toast.success("Customers exported successfully")
    } catch (error) {
      toast.error("Failed to export customers")
    }
  }

  const handleDelete = async (id: string) => {
    const result = await deleteCustomer(id)
    if (result.error) {
      toast.error(result.error)
      setDeleteId(null)
    } else {
      toast.success("Customer deleted successfully")
      setDeleteId(null)
      await loadCustomers()
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/50">Active</Badge>
      case "inactive":
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/50">Inactive</Badge>
      case "prospect":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50">Prospect</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const getTypeBadge = (type: string) => {
    const types: Record<string, { label: string; className: string }> = {
      shipper: { label: "Shipper", className: "bg-purple-500/20 text-purple-400 border-purple-500/50" },
      broker: { label: "Broker", className: "bg-orange-500/20 text-orange-400 border-orange-500/50" },
      consignee: { label: "Consignee", className: "bg-cyan-500/20 text-cyan-400 border-cyan-500/50" },
      "3pl": { label: "3PL", className: "bg-pink-500/20 text-pink-400 border-pink-500/50" },
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
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Customers</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your customers and contacts</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Button
            onClick={handleExportCustomers}
            variant="outline"
            size="sm"
            className="border-border/50 bg-transparent hover:bg-secondary/50 text-foreground flex-1 sm:flex-initial"
          >
            <Download className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Link href="/dashboard/customers/add" className="flex-1 sm:flex-initial">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition w-full sm:w-auto">
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Add Customer</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="p-4 md:p-8">
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search customers by name, email, or company..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-background border-border"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px] bg-background border-border">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="prospect">Prospect</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[180px] bg-background border-border">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="shipper">Shipper</SelectItem>
              <SelectItem value="broker">Broker</SelectItem>
              <SelectItem value="consignee">Consignee</SelectItem>
              <SelectItem value="3pl">3PL</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Customers Table */}
        {isLoading ? (
          <Card className="border border-border/50 p-8 text-center">
            <p className="text-muted-foreground">Loading customers...</p>
          </Card>
        ) : customersList.length === 0 ? (
          <Card className="border border-border/50 p-8 text-center">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No customers found</p>
            <Link href="/dashboard/customers/add">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Customer
              </Button>
            </Link>
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
                  <th className="text-left p-4 text-sm font-semibold text-foreground">Revenue</th>
                  <th className="text-right p-4 text-sm font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customersList.map((customer) => (
                  <tr 
                    key={customer.id} 
                    className="border-b border-border/50 hover:bg-secondary/20 transition cursor-pointer"
                    onClick={() => router.push(`/dashboard/customers/${customer.id}`)}
                  >
                    <td className="p-4">
                      {customer.id && typeof customer.id === 'string' && customer.id.trim() !== '' ? (
                        <Link 
                          href={`/dashboard/customers/${customer.id}`}
                          className="block hover:text-primary transition"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="font-medium text-foreground">{customer.name}</div>
                          {customer.email && (
                            <div className="text-sm text-muted-foreground">{customer.email}</div>
                          )}
                        </Link>
                      ) : (
                        <>
                          <div className="font-medium text-foreground">{customer.name}</div>
                          {customer.email && (
                            <div className="text-sm text-muted-foreground">{customer.email}</div>
                          )}
                        </>
                      )}
                    </td>
                    <td className="p-4 text-foreground">{customer.company_name || "—"}</td>
                    <td className="p-4">
                      {customer.primary_contact_name && (
                        <div className="text-sm text-foreground">{customer.primary_contact_name}</div>
                      )}
                      {customer.phone && (
                        <div className="text-sm text-muted-foreground">{customer.phone}</div>
                      )}
                    </td>
                    <td className="p-4">{getTypeBadge(customer.relationship_type || customer.customer_type)}</td>
                    <td className="p-4">{getStatusBadge(customer.status)}</td>
                    <td className="p-4">
                      {customer.city && customer.state ? (
                        <div className="text-sm text-foreground">
                          {customer.city}, {customer.state}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="text-sm font-medium text-foreground">
                        ${customer.total_revenue?.toFixed(2) || "0.00"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {customer.total_loads || 0} loads
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        {customer.id && typeof customer.id === 'string' && customer.id.trim() !== '' ? (
                          <>
                            <Link href={`/dashboard/customers/${customer.id}`}>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </Link>
                            <Link href={`/dashboard/customers/${customer.id}/edit`}>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <Edit2 className="w-4 h-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              onClick={() => setDeleteId(customer.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        ) : null}
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
            <AlertDialogTitle>Delete Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this customer? This action cannot be undone. Related loads and invoices will be preserved but the customer link will be removed.
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


