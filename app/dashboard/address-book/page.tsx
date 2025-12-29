"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Search,
  Building2,
  Store,
  User,
  Users,
  Mail,
  Phone,
  MapPin,
  Download,
  Upload,
  Eye,
  Edit,
} from "lucide-react"
import Link from "next/link"
import { getAddressBookContacts, AddressBookContact } from "@/app/actions/address-book"
import { toast } from "sonner"
import { exportToExcel } from "@/lib/export-utils"

export default function AddressBookPage() {
  const [contacts, setContacts] = useState<AddressBookContact[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState<"all" | "customer" | "vendor" | "driver" | "employee">("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  useEffect(() => {
    loadContacts()
  }, [searchTerm, typeFilter, statusFilter])

  async function loadContacts() {
    setIsLoading(true)
    try {
      const result = await getAddressBookContacts({
        search: searchTerm || undefined,
        type: typeFilter,
        status: statusFilter !== "all" ? statusFilter : undefined,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        setContacts(result.data)
      }
    } catch (error) {
      toast.error("Failed to load contacts")
    } finally {
      setIsLoading(false)
    }
  }

  const handleExport = () => {
    const exportData = contacts.map((contact) => ({
      Type: contact.type.toUpperCase(),
      Name: contact.name,
      "Company Name": contact.company_name || "",
      Email: contact.email || "",
      Phone: contact.phone || "",
      Address: contact.address || "",
      City: contact.city || "",
      State: contact.state || "",
      ZIP: contact.zip || "",
      Status: contact.status || "",
    }))

    exportToExcel(exportData, "address-book")
    toast.success("Address book exported successfully")
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "customer":
        return <Building2 className="w-4 h-4" />
      case "vendor":
        return <Store className="w-4 h-4" />
      case "driver":
        return <User className="w-4 h-4" />
      case "employee":
        return <Users className="w-4 h-4" />
      default:
        return <Building2 className="w-4 h-4" />
    }
  }

  const getTypeBadge = (type: string) => {
    const types: Record<string, { label: string; className: string }> = {
      customer: { label: "Customer", className: "bg-blue-500/20 text-blue-400 border-blue-500/50" },
      vendor: { label: "Vendor", className: "bg-purple-500/20 text-purple-400 border-purple-500/50" },
      driver: { label: "Driver", className: "bg-green-500/20 text-green-400 border-green-500/50" },
      employee: { label: "Employee", className: "bg-orange-500/20 text-orange-400 border-orange-500/50" },
    }
    const typeInfo = types[type] || { label: type, className: "bg-gray-500/20 text-gray-400 border-gray-500/50" }
    return <Badge className={typeInfo.className}>{typeInfo.label}</Badge>
  }

  const getStatusBadge = (status?: string) => {
    if (!status) return null
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/50">Active</Badge>
      case "inactive":
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/50">Inactive</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const getDetailUrl = (contact: AddressBookContact) => {
    switch (contact.type) {
      case "customer":
        return `/dashboard/customers/${contact.id}`
      case "vendor":
        return `/dashboard/vendors/${contact.id}`
      case "driver":
        return `/dashboard/drivers/${contact.id}`
      case "employee":
        return `/dashboard/employees/${contact.id}`
      default:
        return "#"
    }
  }

  const getEditUrl = (contact: AddressBookContact) => {
    switch (contact.type) {
      case "customer":
        return `/dashboard/customers/${contact.id}/edit`
      case "vendor":
        return `/dashboard/vendors/${contact.id}/edit`
      case "driver":
        return `/dashboard/drivers/${contact.id}/edit`
      case "employee":
        return `/dashboard/employees/${contact.id}/edit`
      default:
        return "#"
    }
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Address Book</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage all your contacts in one place
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="border-border/50 bg-transparent hover:bg-secondary/50"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-border/50 bg-transparent hover:bg-secondary/50"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="p-4 md:p-8">
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search by name, email, phone, or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-background border-border"
            />
          </div>
          <Select value={typeFilter} onValueChange={(value: any) => setTypeFilter(value)}>
            <SelectTrigger className="w-full sm:w-[180px] bg-background border-border">
              <SelectValue placeholder="Contact Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="customer">Customers</SelectItem>
              <SelectItem value="vendor">Vendors</SelectItem>
              <SelectItem value="driver">Drivers</SelectItem>
              <SelectItem value="employee">Employees</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px] bg-background border-border">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Contacts List */}
        {isLoading ? (
          <Card className="border border-border/50 p-8 text-center">
            <p className="text-muted-foreground">Loading contacts...</p>
          </Card>
        ) : contacts.length === 0 ? (
          <Card className="border border-border/50 p-8 text-center">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No contacts found</p>
            <p className="text-sm text-muted-foreground">
              {searchTerm
                ? "Try adjusting your search filters"
                : "Add customers, vendors, drivers, or employees to see them here"}
            </p>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contacts.map((contact) => (
              <Card
                key={`${contact.type}-${contact.id}`}
                className="border-border p-4 hover:border-primary/50 transition cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-md bg-primary/10 text-primary">
                      {getTypeIcon(contact.type)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{contact.name}</h3>
                      {contact.company_name && (
                        <p className="text-sm text-muted-foreground">{contact.company_name}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {getTypeBadge(contact.type)}
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  {contact.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-3 h-3 text-muted-foreground" />
                      <a
                        href={`mailto:${contact.email}`}
                        className="text-foreground hover:text-primary"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {contact.email}
                      </a>
                    </div>
                  )}
                  {contact.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-3 h-3 text-muted-foreground" />
                      <a
                        href={`tel:${contact.phone}`}
                        className="text-foreground hover:text-primary"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {contact.phone}
                      </a>
                    </div>
                  )}
                  {(contact.address || contact.city) && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="w-3 h-3 text-muted-foreground mt-0.5" />
                      <div className="text-muted-foreground">
                        {contact.address && <div>{contact.address}</div>}
                        {(contact.city || contact.state || contact.zip) && (
                          <div>
                            {contact.city}
                            {contact.city && contact.state && ", "}
                            {contact.state} {contact.zip}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {getStatusBadge(contact.status)}
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-border">
                  <Link href={getDetailUrl(contact)} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <Eye className="w-3 h-3 mr-1" />
                      View
                    </Button>
                  </Link>
                  <Link href={getEditUrl(contact)} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <Edit className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Summary */}
        {!isLoading && contacts.length > 0 && (
          <div className="mt-6 p-4 bg-secondary/30 rounded-lg border border-border">
            <p className="text-sm text-muted-foreground">
              Showing {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
              {typeFilter !== "all" && ` (${typeFilter}s only)`}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

