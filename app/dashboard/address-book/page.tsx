"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Search,
  Plus,
  MapPin,
  Download,
  Upload,
  Eye,
  Edit,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Building2,
  Package,
  Store,
  User,
  Users,
  Wrench,
  Fuel,
  Navigation,
  FileText,
  Globe,
  Clock,
  TrendingUp,
  Mail,
  Phone,
} from "lucide-react"
import { toast } from "sonner"
import {
  getAddressBookEntries,
  createAddressBookEntry,
  updateAddressBookEntry,
  deleteAddressBookEntry,
  geocodeAddressBookEntry,
  findNearbyAddresses,
  extractAddressesFromRateCon,
  type AddressBookEntry,
  type AddressBookCategory,
  type CreateAddressBookEntryInput,
} from "@/app/actions/enhanced-address-book"
import { exportToExcel } from "@/lib/export-utils"
import { AddressBookMap } from "@/components/address-book-map"

const CATEGORY_ICONS: Record<AddressBookCategory, any> = {
  shipper: Package,
  receiver: Package,
  vendor: Store,
  broker: Building2,
  driver: User,
  warehouse: Building2,
  repair_shop: Wrench,
  fuel_station: Fuel,
  other: Building2,
}

const CATEGORY_LABELS: Record<AddressBookCategory, string> = {
  shipper: "Shipper",
  receiver: "Receiver",
  vendor: "Vendor",
  broker: "Broker",
  driver: "Driver",
  warehouse: "Warehouse",
  repair_shop: "Repair Shop",
  fuel_station: "Fuel Station",
  other: "Other",
}

export default function EnhancedAddressBookPage() {
  const [entries, setEntries] = useState<AddressBookEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<AddressBookCategory | "all">("all")
  const [geocodingStatusFilter, setGeocodingStatusFilter] = useState<string>("all")
  const [viewMode, setViewMode] = useState<"list" | "map">("list")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showOCRDialog, setShowOCRDialog] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<AddressBookEntry | null>(null)
  const [isGeocoding, setIsGeocoding] = useState<string | null>(null)
  const [formData, setFormData] = useState<CreateAddressBookEntryInput>({
    name: "",
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    fax: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    zip_code: "",
    country: "USA",
    category: "shipper",
    custom_fields: {},
    notes: "",
    auto_create_geofence: false,
    geofence_radius_meters: 500,
    auto_geocode: true,
  })

  useEffect(() => {
    loadEntries()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, categoryFilter, geocodingStatusFilter])

  async function loadEntries() {
    setIsLoading(true)
    try {
      const result = await getAddressBookEntries({
        search: searchTerm || undefined,
        category: categoryFilter === "all" ? undefined : categoryFilter,
        geocoding_status: geocodingStatusFilter !== "all" ? geocodingStatusFilter as any : undefined,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        setEntries(result.data)
      }
    } catch (error) {
      toast.error("Failed to load address book entries")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCreate() {
    try {
      const result = await createAddressBookEntry(formData)
      if (result.error) {
        toast.error(result.error)
      } else {
        if (result.data?.geocoding_status === "failed") {
          toast.warning("Address created, but geocoding failed. Click the globe icon to retry.")
        } else if (result.data?.geocoding_status === "verified") {
          toast.success("Address created and geocoded successfully")
        } else {
          toast.success("Address book entry created successfully")
        }
        setShowCreateDialog(false)
        resetForm()
        loadEntries()
      }
    } catch (error) {
      toast.error("Failed to create address book entry")
    }
  }

  async function handleUpdate() {
    if (!selectedEntry) return

    try {
      const result = await updateAddressBookEntry(selectedEntry.id, formData)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Address book entry updated successfully")
        setShowEditDialog(false)
        setSelectedEntry(null)
        resetForm()
        loadEntries()
      }
    } catch (error) {
      toast.error("Failed to update address book entry")
    }
  }

  async function handleDelete(entryId: string) {
    try {
      const result = await deleteAddressBookEntry(entryId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Address book entry deleted successfully")
        loadEntries()
      }
    } catch (error) {
      toast.error("Failed to delete address book entry")
    }
  }

  async function handleGeocode(entryId: string) {
    setIsGeocoding(entryId)
    try {
      const result = await geocodeAddressBookEntry(entryId)
      if (result.error) {
        // Show more helpful error message
        if (result.error.includes("Google Maps API key")) {
          toast.error("Google Maps API key not configured. Please contact your administrator.")
        } else if (result.error.includes("integration is not enabled")) {
          toast.error("Google Maps integration is not enabled for your company.")
        } else if (result.error.includes("ZERO_RESULTS")) {
          toast.error("Address not found. Please check the address format.")
        } else {
          toast.error(`Geocoding failed: ${result.error}`)
        }
      } else {
        toast.success("Address geocoded successfully")
        loadEntries()
      }
    } catch (error: any) {
      toast.error(`Failed to geocode address: ${error.message || "Unknown error"}`)
    } finally {
      setIsGeocoding(null)
    }
  }

  async function handleOCRUpload(file: File) {
    try {
      // Upload file to Supabase Storage first
      const supabase = (await import("@/lib/supabase/client")).createClient()
      const fileExt = file.name.split(".").pop()
      const fileName = `${Date.now()}.${fileExt}`
      const filePath = `rate-cons/${fileName}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file)

      if (uploadError) {
        toast.error("Failed to upload file")
        return
      }

      const { data: { publicUrl } } = supabase.storage
        .from("documents")
        .getPublicUrl(filePath)

      // Extract addresses
      const result = await extractAddressesFromRateCon(publicUrl, file.name)
      if (result.error) {
        toast.error(result.error)
      } else if (result.data) {
        // Pre-fill form with extracted data
        if (result.data.shipper) {
          setFormData({
            ...formData,
            ...result.data.shipper,
            category: "shipper",
          })
          setShowCreateDialog(true)
          toast.success("Shipper address extracted. Please verify and save.")
        }
        if (result.data.receiver) {
          // Could show second dialog or allow user to save shipper first
          toast.info("Receiver address also extracted. Save shipper first, then create receiver.")
        }
      }
    } catch (error) {
      toast.error("Failed to extract addresses from document")
    }
  }

  function resetForm() {
    setFormData({
      name: "",
      company_name: "",
      contact_name: "",
      email: "",
      phone: "",
      fax: "",
      address_line1: "",
      address_line2: "",
      city: "",
      state: "",
      zip_code: "",
      country: "USA",
      category: "shipper",
      custom_fields: {},
      notes: "",
      auto_create_geofence: false,
      geofence_radius_meters: 500,
      auto_geocode: true,
    })
  }

  function openEditDialog(entry: AddressBookEntry) {
    setSelectedEntry(entry)
    setFormData({
      name: entry.name,
      company_name: entry.company_name,
      contact_name: entry.contact_name,
      email: entry.email,
      phone: entry.phone,
      fax: entry.fax,
      address_line1: entry.address_line1,
      address_line2: entry.address_line2,
      city: entry.city,
      state: entry.state,
      zip_code: entry.zip_code,
      country: entry.country,
      category: entry.category,
      custom_fields: entry.custom_fields,
      notes: entry.notes,
      auto_create_geofence: entry.auto_create_geofence,
      geofence_radius_meters: entry.geofence_radius_meters,
      auto_geocode: false,
    })
    setShowEditDialog(true)
  }

  function getGeocodingStatusBadge(status: string) {
    switch (status) {
      case "verified":
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/50 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Verified
          </Badge>
        )
      case "failed":
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/50 flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            Failed
          </Badge>
        )
      case "pending":
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Pending
          </Badge>
        )
      default:
        return (
          <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/50">
            {status}
          </Badge>
        )
    }
  }

  function getCategoryCustomFields(category: AddressBookCategory) {
    switch (category) {
      case "shipper":
      case "receiver":
        return [
          { key: "gate_code", label: "Gate Code", type: "text" },
          { key: "warehouse_hours", label: "Warehouse Hours", type: "text" },
          { key: "accepts_flatbed_after_3pm", label: "Accepts Flatbed After 3 PM", type: "checkbox" },
          { key: "dock_count", label: "Dock Count", type: "number" },
          { key: "loading_instructions", label: "Loading Instructions", type: "textarea" },
        ]
      case "broker":
        return [
          { key: "mc_number", label: "MC Number", type: "text" },
          { key: "contact_preference", label: "Contact Preference", type: "text" },
        ]
      case "vendor":
        return [
          { key: "service_type", label: "Service Type", type: "text" },
          { key: "special_equipment_required", label: "Special Equipment Required", type: "text" },
        ]
      default:
        return []
    }
  }

  const handleExport = () => {
    const exportData = entries.map((entry) => ({
      Name: entry.name,
      "Company Name": entry.company_name || "",
      Category: CATEGORY_LABELS[entry.category],
      Email: entry.email || "",
      Phone: entry.phone || "",
      Address: entry.address_line1,
      City: entry.city,
      State: entry.state,
      "ZIP Code": entry.zip_code,
      "Geocoding Status": entry.geocoding_status,
      "Usage Count": entry.usage_count,
      "Last Used": entry.last_used_at ? new Date(entry.last_used_at).toLocaleDateString() : "",
    }))

    exportToExcel(exportData, "enhanced-address-book")
    toast.success("Address book exported successfully")
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Address Book</h1>
          <p className="text-muted-foreground text-sm mt-1">
            PostGIS-verified addresses with role-based categorization and geofencing
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowOCRDialog(true)}
            className="border-border/50 bg-transparent hover:bg-secondary/50"
          >
            <FileText className="w-4 h-4 mr-2" />
            Extract from Rate Con
          </Button>
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
            size="sm"
            onClick={() => {
              resetForm()
              setShowCreateDialog(true)
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Address
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="p-4 md:p-8">
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search by name, company, address, city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-background border-border"
            />
          </div>
          <Select value={categoryFilter} onValueChange={(value: any) => setCategoryFilter(value)}>
            <SelectTrigger className="w-full sm:w-[180px] bg-background border-border">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={geocodingStatusFilter} onValueChange={setGeocodingStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px] bg-background border-border">
              <SelectValue placeholder="Geocoding Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "list" | "map")}>
            <TabsList>
              <TabsTrigger value="list">List</TabsTrigger>
              <TabsTrigger value="map">Map</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Entries List or Map */}
        {isLoading ? (
          <Card className="border border-border/50 p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Loading address book entries...</p>
          </Card>
        ) : entries.length === 0 ? (
          <Card className="border border-border/50 p-8 text-center">
            <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No address book entries found</p>
            <p className="text-sm text-muted-foreground mb-4">
              {searchTerm
                ? "Try adjusting your search filters"
                : "Add addresses to see them here"}
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Address
            </Button>
          </Card>
        ) : viewMode === "map" ? (
          <AddressBookMap entries={entries.filter(e => e.coordinates && e.geocoding_status === "verified")} />
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {entries.map((entry) => {
              const Icon = CATEGORY_ICONS[entry.category]
              return (
              <Card
                  key={entry.id}
                className="border-border p-4 hover:border-primary/50 transition cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 flex-1">
                    <div className="p-2 rounded-md bg-primary/10 text-primary">
                        <Icon className="w-4 h-4" />
                    </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">{entry.name}</h3>
                        {entry.company_name && (
                          <p className="text-sm text-muted-foreground truncate">{entry.company_name}</p>
                      )}
                    </div>
                  </div>
                    <Badge className="bg-primary/20 text-primary border-primary/50">
                      {CATEGORY_LABELS[entry.category]}
                    </Badge>
                </div>

                <div className="space-y-2 mb-4">
                    {entry.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-3 h-3 text-muted-foreground" />
                        <span className="text-muted-foreground truncate">{entry.email}</span>
                    </div>
                  )}
                    {entry.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-3 h-3 text-muted-foreground" />
                        <span className="text-muted-foreground">{entry.phone}</span>
                    </div>
                  )}
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="w-3 h-3 text-muted-foreground mt-0.5" />
                      <div className="text-muted-foreground">
                        <div>{entry.address_line1}</div>
                          <div>
                          {entry.city}, {entry.state} {entry.zip_code}
                          </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getGeocodingStatusBadge(entry.geocoding_status)}
                      {entry.usage_count > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Used {entry.usage_count}x
                        </Badge>
                      )}
                    </div>
                    {entry.coordinates && (
                      <div className="flex items-center gap-1 text-xs text-green-500">
                        <CheckCircle2 className="w-3 h-3" />
                        Coordinates verified
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-border">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => openEditDialog(entry)}
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                    {entry.geocoding_status !== "verified" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleGeocode(entry.id)}
                        disabled={isGeocoding === entry.id}
                      >
                        {isGeocoding === entry.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Globe className="w-3 h-3" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(entry.id)}
                      className="text-red-500 hover:text-red-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                </div>
              </Card>
              )
            })}
          </div>
        )}

        {/* Summary */}
        {!isLoading && entries.length > 0 && (
          <div className="mt-6 p-4 bg-secondary/30 rounded-lg border border-border">
            <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
                Showing {entries.length} address{entries.length !== 1 ? "es" : ""}
                {categoryFilter !== "all" && ` (${CATEGORY_LABELS[categoryFilter]} only)`}
              </p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>
                  Verified: {entries.filter((e) => e.geocoding_status === "verified").length}
                </span>
                <span>
                  Total Usage: {entries.reduce((sum, e) => sum + e.usage_count, 0)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog || showEditDialog} onOpenChange={(open) => {
        if (!open) {
          setShowCreateDialog(false)
          setShowEditDialog(false)
          setSelectedEntry(null)
          resetForm()
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {showEditDialog ? "Edit Address Book Entry" : "Create Address Book Entry"}
            </DialogTitle>
            <DialogDescription>
              {showEditDialog
                ? "Update address information and custom fields"
                : "Add a new address with PostGIS geo-verification and role-based categorization"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList>
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="address">Address</TabsTrigger>
                <TabsTrigger value="custom">Custom Fields</TabsTrigger>
                <TabsTrigger value="geofence">Geofencing</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="category">Category *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value: AddressBookCategory) =>
                        setFormData({ ...formData, category: value, custom_fields: {} })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="company_name">Company Name</Label>
                  <Input
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="contact_name">Contact Name</Label>
                    <Input
                      id="contact_name"
                      value={formData.contact_name}
                      onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="fax">Fax</Label>
                    <Input
                      id="fax"
                      value={formData.fax}
                      onChange={(e) => setFormData({ ...formData, fax: e.target.value })}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="address" className="space-y-4">
                <div>
                  <Label htmlFor="address_line1">Address Line 1 *</Label>
                  <Input
                    id="address_line1"
                    value={formData.address_line1}
                    onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="address_line2">Address Line 2</Label>
                  <Input
                    id="address_line2"
                    value={formData.address_line2}
                    onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                  />
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="state">State *</Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="zip_code">ZIP Code *</Label>
                    <Input
                      id="zip_code"
                      value={formData.zip_code}
                      onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  />
                </div>
                {!showEditDialog && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="auto_geocode"
                      checked={formData.auto_geocode}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, auto_geocode: checked as boolean })
                      }
                    />
                    <Label htmlFor="auto_geocode" className="text-sm">
                      Auto-geocode address on save
                    </Label>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="custom" className="space-y-4">
                {getCategoryCustomFields(formData.category).map((field) => (
                  <div key={field.key}>
                    <Label htmlFor={field.key}>{field.label}</Label>
                    {field.type === "textarea" ? (
                      <Textarea
                        id={field.key}
                        value={formData.custom_fields?.[field.key] || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            custom_fields: {
                              ...formData.custom_fields,
                              [field.key]: e.target.value,
                            },
                          })
                        }
                      />
                    ) : field.type === "checkbox" ? (
                      <div className="flex items-center space-x-2 mt-2">
                        <Checkbox
                          id={field.key}
                          checked={formData.custom_fields?.[field.key] || false}
                          onCheckedChange={(checked) =>
                            setFormData({
                              ...formData,
                              custom_fields: {
                                ...formData.custom_fields,
                                [field.key]: checked,
                              },
                            })
                          }
                        />
                        <Label htmlFor={field.key} className="text-sm">
                          {field.label}
                        </Label>
                      </div>
                    ) : (
                      <Input
                        id={field.key}
                        type={field.type}
                        value={formData.custom_fields?.[field.key] || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            custom_fields: {
                              ...formData.custom_fields,
                              [field.key]: field.type === "number" ? Number(e.target.value) : e.target.value,
                            },
                          })
                        }
                      />
                    )}
                  </div>
                ))}
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                  />
                </div>
              </TabsContent>

              <TabsContent value="geofence" className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="auto_create_geofence"
                    checked={formData.auto_create_geofence}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, auto_create_geofence: checked as boolean })
                    }
                  />
                  <Label htmlFor="auto_create_geofence" className="text-sm">
                    Automatically create geofence when address is verified
                  </Label>
                </div>
                {formData.auto_create_geofence && (
                  <div>
                    <Label htmlFor="geofence_radius_meters">Geofence Radius (meters)</Label>
                    <Input
                      id="geofence_radius_meters"
                      type="number"
                      value={formData.geofence_radius_meters}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          geofence_radius_meters: Number(e.target.value),
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Default: 500m. Geofence will be created automatically when address coordinates are verified.
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateDialog(false)
              setShowEditDialog(false)
              setSelectedEntry(null)
              resetForm()
            }}>
              Cancel
            </Button>
            <Button onClick={showEditDialog ? handleUpdate : handleCreate}>
              {showEditDialog ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* OCR Upload Dialog */}
      <Dialog open={showOCRDialog} onOpenChange={setShowOCRDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extract Addresses from Rate Confirmation</DialogTitle>
            <DialogDescription>
              Upload a Rate Confirmation PDF to automatically extract shipper and receiver addresses
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    handleOCRUpload(file)
                    setShowOCRDialog(false)
                  }
                }}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Supported formats: PDF, JPG, PNG
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOCRDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

