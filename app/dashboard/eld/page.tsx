"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { 
  Shield, 
  Plus, 
  Edit2, 
  Trash2, 
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Truck,
  Search,
  Filter,
  RefreshCw
} from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { 
  getELDDevices, 
  createELDDevice,
  updateELDDevice,
  deleteELDDevice,
  getELDEvents,
  syncELDData
} from "@/app/actions/eld"
import { canUseELD, canAccessFeature } from "@/app/actions/subscription-limits"
import { getTrucks } from "@/app/actions/trucks"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

export default function ELDPage() {
  const [devices, setDevices] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [canAccessELD, setCanAccessELD] = useState<boolean | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<any>(null)
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterProvider, setFilterProvider] = useState<string>("all")
  const [trucks, setTrucks] = useState<any[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [syncingDevice, setSyncingDevice] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    device_name: "",
    device_serial_number: "",
    provider: "",
    provider_device_id: "",
    api_key: "",
    api_secret: "",
    truck_id: "",
    status: "active",
    firmware_version: "",
    installation_date: "",
    notes: "",
  })

  useEffect(() => {
    async function checkAccess() {
      const result = await canUseELD()
      setCanAccessELD(result.allowed)
      if (!result.allowed && result.error) {
        toast.error(result.error)
      }
    }
    checkAccess()
    loadData()
    loadTrucks()
  }, [])

  async function loadTrucks() {
    const result = await getTrucks()
    if (result.data) {
      setTrucks(result.data)
    }
  }

  async function loadData() {
    setIsLoading(true)
    try {
      const [devicesResult, eventsResult] = await Promise.all([
        getELDDevices(),
        getELDEvents({ resolved: false })
      ])

      if (devicesResult.data) {
        setDevices(devicesResult.data)
      } else if (devicesResult.error) {
        toast.error(devicesResult.error)
      }

      if (eventsResult.data) {
        setEvents(eventsResult.data)
      }
    } catch (error) {
      toast.error("Failed to load ELD data")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedDevice) return

    const result = await deleteELDDevice(selectedDevice.id)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("ELD device deleted successfully")
      setShowDeleteDialog(false)
      setSelectedDevice(null)
      loadData()
    }
  }

  const handleSyncDevice = async (deviceId: string) => {
    setSyncingDevice(deviceId)
    try {
      const result = await syncELDData(deviceId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Device synced successfully")
        loadData()
      }
    } catch (error) {
      toast.error("Failed to sync device")
    } finally {
      setSyncingDevice(null)
    }
  }

  const filteredDevices = devices.filter((device) => {
    const matchesSearch = 
      device.device_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.device_serial_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.provider?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = filterStatus === "all" || device.status === filterStatus
    const matchesProvider = filterProvider === "all" || device.provider === filterProvider

    return matchesSearch && matchesStatus && matchesProvider
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/10 text-green-500 border-green-500/20"
      case "inactive":
        return "bg-gray-500/10 text-gray-500 border-gray-500/20"
      case "maintenance":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
      case "disconnected":
        return "bg-red-500/10 text-red-500 border-red-500/20"
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20"
    }
  }

  const getEventSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500/10 text-red-500 border-red-500/20"
      case "warning":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
      default:
        return "bg-blue-500/10 text-blue-500 border-blue-500/20"
    }
  }

  if (isLoading || canAccessELD === null) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-border bg-card/50 backdrop-blur px-8 py-4">
          <h1 className="text-2xl font-bold text-foreground">ELD Service</h1>
        </div>
        <main className="flex-1 overflow-auto p-8">
          <div className="max-w-6xl mx-auto">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </main>
      </div>
    )
  }

  if (canAccessELD === false) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-border bg-card/50 backdrop-blur px-8 py-4">
          <h1 className="text-2xl font-bold text-foreground">ELD Service</h1>
        </div>
        <main className="flex-1 overflow-auto p-8">
          <div className="max-w-6xl mx-auto">
            <Card className="p-8 text-center">
              <Shield className="w-16 h-16 text-primary mx-auto mb-4 opacity-50" />
              <h2 className="text-2xl font-bold text-foreground mb-2">ELD Service Not Available</h2>
              <p className="text-muted-foreground mb-6">
                ELD integration is only available in Professional and Enterprise plans.
              </p>
              <Link href="/plans">
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  Upgrade Plan
                </Button>
              </Link>
            </Card>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ELD Service</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage Electronic Logging Devices</p>
        </div>
            <Button
              onClick={() => {
                setFormData({
                  device_name: "",
                  device_serial_number: "",
                  provider: "",
                  provider_device_id: "",
                  api_key: "",
                  api_secret: "",
                  truck_id: "",
                  status: "active",
                  firmware_version: "",
                  installation_date: "",
                  notes: "",
                })
                setSelectedDevice(null)
                setShowAddDialog(true)
              }}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add ELD Device
        </Button>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Quick Access Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/dashboard/eld/health">
              <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-border">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-500/10 rounded-lg">
                    <Activity className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Fleet Health</h3>
                    <p className="text-xs text-muted-foreground">Real-time overview</p>
                  </div>
                </div>
              </Card>
            </Link>
            <Link href="/dashboard/eld/logs">
              <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-border">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-500/10 rounded-lg">
                    <Clock className="w-6 h-6 text-green-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">HOS Logs</h3>
                    <p className="text-xs text-muted-foreground">View log entries</p>
                  </div>
                </div>
              </Card>
            </Link>
            <Link href="/dashboard/eld/violations">
              <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-border">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-red-500/10 rounded-lg">
                    <AlertTriangle className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Violations</h3>
                    <p className="text-xs text-muted-foreground">
                      {events.length} active
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
            <Link href="/dashboard/eld/devices">
              <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-border">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-500/10 rounded-lg">
                    <Truck className="w-6 h-6 text-purple-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Devices</h3>
                    <p className="text-xs text-muted-foreground">Manage ELD devices</p>
                  </div>
                </div>
              </Card>
            </Link>
            <Link href="/dashboard/eld/driver-app">
              <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-border">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-500/10 rounded-lg">
                    <Clock className="w-6 h-6 text-indigo-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Driver App</h3>
                    <p className="text-xs text-muted-foreground">Mobile HOS status</p>
                  </div>
                </div>
              </Card>
            </Link>
            <Link href="/dashboard/eld/insights">
              <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-border">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-orange-500/10 rounded-lg">
                    <Activity className="w-6 h-6 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">AI Insights</h3>
                    <p className="text-xs text-muted-foreground">Smart recommendations</p>
                  </div>
                </div>
              </Card>
            </Link>
          </div>

          {/* Active Events Alert */}
          {events && events.length > 0 && (
            <Card className="bg-yellow-500/10 border-yellow-500/20 p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">Active ELD Events</h3>
                  <p className="text-sm text-muted-foreground">
                    {events.length} unresolved event{events.length !== 1 ? "s" : ""} require attention
                  </p>
                </div>
                <Link href="/dashboard/eld/violations">
                  <Button variant="outline" size="sm">View Violations</Button>
                </Link>
              </div>
            </Card>
          )}

          {/* Filters and Search */}
          <Card className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search devices..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="disconnected">Disconnected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterProvider} onValueChange={setFilterProvider}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Filter by provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Providers</SelectItem>
                  <SelectItem value="keeptruckin">KeepTruckin</SelectItem>
                  <SelectItem value="samsara">Samsara</SelectItem>
                  <SelectItem value="geotab">Geotab</SelectItem>
                  <SelectItem value="rand_mcnally">Rand McNally</SelectItem>
                  <SelectItem value="truckmates_mobile">TruckMates Mobile App</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>

          {/* Enhanced Tools Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6 border-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">Quick Tools</h3>
              </div>
              <div className="space-y-3">
                <Link href="/dashboard/eld/health">
                  <Button variant="outline" className="w-full justify-start">
                    <Activity className="w-4 h-4 mr-2" />
                    Fleet Health Dashboard
                  </Button>
                </Link>
                <Link href="/dashboard/eld/logs">
                  <Button variant="outline" className="w-full justify-start">
                    <Clock className="w-4 h-4 mr-2" />
                    View HOS Logs
                  </Button>
                </Link>
                <Link href="/dashboard/eld/violations">
                  <Button variant="outline" className="w-full justify-start">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    View Violations
                  </Button>
                </Link>
                <Link href="/dashboard/eld/logs/add">
                  <Button variant="outline" className="w-full justify-start">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Log Entry
                  </Button>
                </Link>
                <Link href="/dashboard/eld/locations/add">
                  <Button variant="outline" className="w-full justify-start">
                    <Truck className="w-4 h-4 mr-2" />
                    Add Location
                  </Button>
                </Link>
                <Link href="/dashboard/eld/violations/add">
                  <Button variant="outline" className="w-full justify-start">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Add Event/Violation
                  </Button>
                </Link>
              </div>
            </Card>

            <Card className="p-6 border-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">Device Status</h3>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Devices</span>
                  <span className="font-semibold text-foreground">{devices.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Active</span>
                  <span className="font-semibold text-green-500">
                    {devices.filter(d => d.status === "active").length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Inactive</span>
                  <span className="font-semibold text-gray-500">
                    {devices.filter(d => d.status === "inactive").length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Maintenance</span>
                  <span className="font-semibold text-yellow-500">
                    {devices.filter(d => d.status === "maintenance").length}
                  </span>
                </div>
              </div>
            </Card>
          </div>

          {/* Devices Grid */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">ELD Devices</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDevices.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No ELD Devices</h3>
                <p className="text-muted-foreground mb-4">Get started by adding your first ELD device</p>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add ELD Device
                </Button>
              </div>
            ) : (
              filteredDevices.map((device) => (
                <Card key={device.id} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground mb-1">{device.device_name}</h3>
                      <p className="text-sm text-muted-foreground">SN: {device.device_serial_number}</p>
                    </div>
                    <Badge className={getStatusColor(device.status)}>
                      {device.status}
                    </Badge>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Provider:</span>
                      <span className="text-foreground font-medium capitalize">{device.provider?.replace("_", " ")}</span>
                    </div>
                    {device.trucks && (
                      <div className="flex items-center gap-2 text-sm">
                        <Truck className="w-4 h-4 text-muted-foreground" />
                        <span className="text-foreground">{device.trucks.truck_number}</span>
                      </div>
                    )}
                    {device.last_sync_at && (
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          Last sync: {new Date(device.last_sync_at).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Link href={`/dashboard/eld/devices/${device.id}`} className="flex-1">
                      <Button variant="outline" className="w-full" size="sm">
                        <Activity className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                    </Link>
                    {device.status === "active" && device.api_key && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSyncDevice(device.id)}
                        disabled={syncingDevice === device.id}
                      >
                        <RefreshCw className={`w-4 h-4 ${syncingDevice === device.id ? "animate-spin" : ""}`} />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedDevice(device)
                        setFormData({
                          device_name: device.device_name || "",
                          device_serial_number: device.device_serial_number || "",
                          provider: device.provider || "",
                          provider_device_id: device.provider_device_id || "",
                          api_key: device.api_key || "",
                          api_secret: device.api_secret || "",
                          truck_id: device.truck_id || "",
                          status: device.status || "active",
                          firmware_version: device.firmware_version || "",
                          installation_date: device.installation_date || "",
                          notes: device.notes || "",
                        })
                        setShowEditDialog(true)
                      }}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedDevice(device)
                        setShowDeleteDialog(true)
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))
            )}
            </div>
          </div>
        </div>
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete ELD Device</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedDevice?.device_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add/Edit Device Dialog */}
      <Dialog open={showAddDialog || showEditDialog} onOpenChange={(open) => {
        setShowAddDialog(false)
        setShowEditDialog(false)
        if (!open) {
          setSelectedDevice(null)
          setFormData({
            device_name: "",
            device_serial_number: "",
            provider: "",
            provider_device_id: "",
            api_key: "",
            api_secret: "",
            truck_id: "",
            status: "active",
            firmware_version: "",
            installation_date: "",
            notes: "",
          })
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{showEditDialog ? "Edit ELD Device" : "Add ELD Device"}</DialogTitle>
            <DialogDescription>
              {showEditDialog ? "Update ELD device information" : "Add a new Electronic Logging Device to your fleet"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="device_name">Device Name *</Label>
                <Input
                  id="device_name"
                  value={formData.device_name}
                  onChange={(e) => setFormData({ ...formData, device_name: e.target.value })}
                  placeholder="e.g., Truck #1 ELD"
                />
              </div>
              <div>
                <Label htmlFor="device_serial_number">Serial Number *</Label>
                <Input
                  id="device_serial_number"
                  value={formData.device_serial_number}
                  onChange={(e) => setFormData({ ...formData, device_serial_number: e.target.value })}
                  placeholder="Device serial number"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="provider">Provider *</Label>
                <Select value={formData.provider} onValueChange={(value) => setFormData({ ...formData, provider: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="keeptruckin">KeepTruckin</SelectItem>
                    <SelectItem value="samsara">Samsara</SelectItem>
                    <SelectItem value="geotab">Geotab</SelectItem>
                    <SelectItem value="rand_mcnally">Rand McNally</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="disconnected">Disconnected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="truck_id">Truck (Optional)</Label>
              <Select value={formData.truck_id || "none"} onValueChange={(value) => setFormData({ ...formData, truck_id: value === "none" ? "" : value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select truck" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {trucks.map((truck) => (
                    <SelectItem key={truck.id} value={truck.id}>
                      {truck.truck_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="provider_device_id">Provider Device ID</Label>
              <Input
                id="provider_device_id"
                value={formData.provider_device_id}
                onChange={(e) => setFormData({ ...formData, provider_device_id: e.target.value })}
                placeholder="Device ID from provider (optional)"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="api_key">API Key</Label>
                <Input
                  id="api_key"
                  type="password"
                  value={formData.api_key}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                  placeholder="API key (optional)"
                />
              </div>
              <div>
                <Label htmlFor="api_secret">API Secret</Label>
                <Input
                  id="api_secret"
                  type="password"
                  value={formData.api_secret}
                  onChange={(e) => setFormData({ ...formData, api_secret: e.target.value })}
                  placeholder="API secret (optional)"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firmware_version">Firmware Version</Label>
                <Input
                  id="firmware_version"
                  value={formData.firmware_version}
                  onChange={(e) => setFormData({ ...formData, firmware_version: e.target.value })}
                  placeholder="e.g., 2.1.0"
                />
              </div>
              <div>
                <Label htmlFor="installation_date">Installation Date</Label>
                <Input
                  id="installation_date"
                  type="date"
                  value={formData.installation_date}
                  onChange={(e) => setFormData({ ...formData, installation_date: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full min-h-[100px] px-3 py-2 text-sm border border-input rounded-md bg-background"
                placeholder="Additional notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAddDialog(false)
              setShowEditDialog(false)
            }}>
              Cancel
            </Button>
            <Button 
              onClick={async () => {
                if (!formData.device_name || !formData.device_serial_number || !formData.provider) {
                  toast.error("Please fill in required fields (Device Name, Serial Number, Provider)")
                  return
                }

                setIsSubmitting(true)
                try {
                  let result
                  if (showEditDialog && selectedDevice) {
                    result = await updateELDDevice(selectedDevice.id, formData)
                  } else {
                    result = await createELDDevice(formData)
                  }

                  if (result.error) {
                    toast.error(result.error)
                  } else {
                    toast.success(`Device ${showEditDialog ? "updated" : "created"} successfully`)
                    setShowAddDialog(false)
                    setShowEditDialog(false)
                    setSelectedDevice(null)
                    loadData()
                  }
                } catch (error) {
                  toast.error("Failed to save device")
                } finally {
                  setIsSubmitting(false)
                }
              }}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : showEditDialog ? "Update" : "Add"} Device
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
