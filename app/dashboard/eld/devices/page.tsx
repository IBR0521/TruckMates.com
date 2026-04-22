"use client"

import { useEffect, useState } from "react"
import { errorMessage } from "@/lib/error-message"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
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
import { 
  Shield, 
  Plus, 
  Edit2, 
  Trash2, 
  RefreshCw,
  Search,
  Truck,
  Cpu
} from "lucide-react"
import { 
  getELDDevices, 
  createELDDevice, 
  updateELDDevice, 
  deleteELDDevice
} from "@/app/actions/eld"
import { getTrucks } from "@/app/actions/trucks"
import { toast } from "sonner"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  getDeviceLastSyncAt,
  getEldSyncVisual,
} from "@/components/eld/eld-device-sync-status"

export default function ELDDevicesPage() {
  const [devices, setDevices] = useState<any[]>([])
  const [trucks, setTrucks] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<any>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    device_serial_number: "",
    device_name: "",
    provider: "",
    provider_device_id: "",
    truck_id: "",
    installation_date: "",
    firmware_version: "",
    api_key: "",
    api_secret: "",
    status: "active",
    notes: "",
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setIsLoading(true)
    try {
      const [devicesResult, trucksResult] = await Promise.all([
        getELDDevices(),
        getTrucks(),
      ])

      if (devicesResult.data) setDevices(devicesResult.data)
      if (trucksResult.data) setTrucks(trucksResult.data)
    } catch (error) {
      toast.error("Failed to load devices")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleAddDevice() {
    setIsSubmitting(true)
    try {
      const result = await createELDDevice(formData)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Device added successfully")
        setShowAddDialog(false)
        resetForm()
        loadData()
      }
    } catch (error) {
      toast.error("Failed to add device")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleUpdateDevice() {
    if (!selectedDevice) return
    setIsSubmitting(true)
    try {
      const result = await updateELDDevice(selectedDevice.id, formData)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Device updated successfully")
        setShowEditDialog(false)
        resetForm()
        loadData()
      }
    } catch (error) {
      toast.error("Failed to update device")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeleteDevice() {
    if (!selectedDevice) return
    setIsSubmitting(true)
    try {
      const result = await deleteELDDevice(selectedDevice.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Device deleted successfully")
        setShowDeleteDialog(false)
        setSelectedDevice(null)
        loadData()
      }
    } catch (error) {
      toast.error("Failed to delete device")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSync(deviceId: string) {
    try {
      setIsSubmitting(true)
      const { syncELDData } = await import("@/app/actions/eld")
      const result = await syncELDData(deviceId)
      
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Synced: ${result.data?.logs || 0} logs, ${result.data?.locations || 0} locations, ${result.data?.events || 0} events`)
        loadData()
      }
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Failed to sync device"))
    } finally {
      setIsSubmitting(false)
    }
  }

  function resetForm() {
    setFormData({
      device_serial_number: "",
      device_name: "",
      provider: "",
      provider_device_id: "",
      truck_id: "",
      installation_date: "",
      firmware_version: "",
      api_key: "",
      api_secret: "",
      status: "active",
      notes: "",
    })
    setSelectedDevice(null)
  }

  function openEditDialog(device: any) {
    setSelectedDevice(device)
    setFormData({
      device_serial_number: device.device_serial_number,
      device_name: device.device_name,
      provider: device.provider || "",
      provider_device_id: device.provider_device_id || "",
      truck_id: device.truck_id || "",
      installation_date: device.installation_date || "",
      firmware_version: device.firmware_version || "",
      api_key: device.api_key || "",
      api_secret: device.api_secret || "",
      status: device.status || "active",
      notes: device.notes || "",
    })
    setShowEditDialog(true)
  }

  const filteredDevices = devices.filter((device) =>
    device.device_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    device.device_serial_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    device.provider?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  function providerLabel(provider?: string | null) {
    const p = (provider || "").toLowerCase()
    if (p === "keeptruckin") return "Motive"
    if (p === "samsara") return "Samsara"
    if (p === "geotab") return "Geotab"
    return provider || "Other"
  }

  function syncLine(sync: ReturnType<typeof getEldSyncVisual>) {
    if (sync.urgency === "fresh") return { text: `Last synced ${sync.detail.split(" · ")[0]}`, cls: "text-emerald-500" }
    if (sync.urgency === "warn") return { text: `Last synced ${sync.detail.split(" · ")[0]}`, cls: "text-amber-500" }
    if (sync.urgency === "never" || sync.urgency === "stale" || sync.urgency === "invalid") {
      return { text: sync.urgency === "never" ? "Never synced" : sync.title, cls: "text-red-500" }
    }
    return { text: sync.title, cls: "text-muted-foreground" }
  }

  if (isLoading) {
    return (
      <div className="w-full">
        <div className="border-b border-border bg-card px-8 py-4">
          <h1 className="text-2xl font-bold text-foreground">ELD Devices</h1>
        </div>
        <div className="p-4 md:p-8">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-border bg-card px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ELD Devices</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your Electronic Logging Devices</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/eld">
            <Button variant="outline">Back to ELD</Button>
          </Link>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Device
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search devices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Sync health edge: green under 15 min, amber 15 min–2 h, red over 2 h or never synced.
          </p>

          {/* Devices Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDevices.map((device) => {
              const lastSync = getDeviceLastSyncAt(device)
              const sync = getEldSyncVisual(lastSync)
              return (
              <Card key={device.id} className={cn("overflow-hidden border-l-4 border-border bg-card p-5", sync.cardBorderCls)}>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-semibold text-foreground">{device.device_name}</h3>
                    <p className="truncate text-xs text-muted-foreground">{device.device_serial_number}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                      <Cpu className="mr-1 h-3.5 w-3.5" />
                      {providerLabel(device.provider)}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        device.status === "active"
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                          : "border-slate-500/30 bg-slate-500/10 text-slate-500"
                      }
                    >
                      {device.status}
                    </Badge>
                  </div>
                </div>

                <div className="mb-4 space-y-2 text-sm">
                  <p className={cn("text-xs font-medium", syncLine(sync).cls)}>{syncLine(sync).text}</p>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Truck className="h-4 w-4" />
                    <span>Truck {device.trucks?.truck_number || "Unassigned"}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSync(device.id)}
                    className="justify-start"
                  >
                    <RefreshCw className="mr-1 h-3.5 w-3.5" />
                    Sync
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(device)}
                    className="justify-start"
                  >
                    <Edit2 className="mr-1 h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedDevice(device)
                      setShowDeleteDialog(true)
                    }}
                    className="justify-start"
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </Card>
              )
            })}
          </div>

          {filteredDevices.length === 0 && (
            <Card className="p-12 text-center bg-card border-border">
              <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No ELD devices found</p>
              <Button onClick={() => setShowAddDialog(true)} className="mt-4">
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Device
              </Button>
            </Card>
          )}
        </div>
      </div>

      {/* Add Device Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add ELD Device</DialogTitle>
            <DialogDescription>Add a new Electronic Logging Device to your fleet</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Device Serial Number *</Label>
              <Input
                value={formData.device_serial_number}
                onChange={(e) => setFormData({ ...formData, device_serial_number: e.target.value })}
                placeholder="ELD-123456"
              />
            </div>
            <div>
              <Label>Device Name *</Label>
              <Input
                value={formData.device_name}
                onChange={(e) => setFormData({ ...formData, device_name: e.target.value })}
                placeholder="Truck #1 ELD"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Provider *</Label>
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
                <Label>Status</Label>
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
              <Label>Provider Device ID (Optional)</Label>
              <Input
                value={formData.provider_device_id}
                onChange={(e) => setFormData({ ...formData, provider_device_id: e.target.value })}
                placeholder="Device ID from provider"
              />
            </div>
            <div>
              <Label>Assigned Truck</Label>
              <Select value={formData.truck_id || "none"} onValueChange={(value) => setFormData({ ...formData, truck_id: value === "none" ? "" : value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a truck" />
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Installation Date</Label>
                <Input
                  type="date"
                  value={formData.installation_date}
                  onChange={(e) => setFormData({ ...formData, installation_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Firmware Version</Label>
                <Input
                  value={formData.firmware_version}
                  onChange={(e) => setFormData({ ...formData, firmware_version: e.target.value })}
                  placeholder="v1.0.0"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>API Key (Optional)</Label>
                <Input
                  type="password"
                  value={formData.api_key}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                  placeholder="For ELD provider integration"
                />
              </div>
              <div>
                <Label>API Secret (Optional)</Label>
                <Input
                  type="password"
                  value={formData.api_secret}
                  onChange={(e) => setFormData({ ...formData, api_secret: e.target.value })}
                  placeholder="API secret for provider"
                />
              </div>
            </div>
            <div>
              <Label>Notes (Optional)</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes about the device"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddDevice} disabled={isSubmitting || !formData.device_serial_number || !formData.device_name || !formData.provider}>
              {isSubmitting ? "Adding..." : "Add Device"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Device Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit ELD Device</DialogTitle>
            <DialogDescription>Update device information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Device Name *</Label>
              <Input
                value={formData.device_name}
                onChange={(e) => setFormData({ ...formData, device_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Provider *</Label>
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
                <Label>Status</Label>
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
              <Label>Provider Device ID (Optional)</Label>
              <Input
                value={formData.provider_device_id}
                onChange={(e) => setFormData({ ...formData, provider_device_id: e.target.value })}
                placeholder="Device ID from provider"
              />
            </div>
            <div>
              <Label>Assigned Truck</Label>
              <Select value={formData.truck_id || "none"} onValueChange={(value) => setFormData({ ...formData, truck_id: value === "none" ? "" : value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a truck" />
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Installation Date</Label>
                <Input
                  type="date"
                  value={formData.installation_date}
                  onChange={(e) => setFormData({ ...formData, installation_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Firmware Version</Label>
                <Input
                  value={formData.firmware_version}
                  onChange={(e) => setFormData({ ...formData, firmware_version: e.target.value })}
                  placeholder="v1.0.0"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>API Key (Optional)</Label>
                <Input
                  type="password"
                  value={formData.api_key}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                  placeholder="For ELD provider integration"
                />
              </div>
              <div>
                <Label>API Secret (Optional)</Label>
                <Input
                  type="password"
                  value={formData.api_secret}
                  onChange={(e) => setFormData({ ...formData, api_secret: e.target.value })}
                  placeholder="API secret for provider"
                />
              </div>
            </div>
            <div>
              <Label>Notes (Optional)</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes about the device"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateDevice} disabled={isSubmitting || !formData.device_serial_number || !formData.device_name || !formData.provider}>
              {isSubmitting ? "Updating..." : "Update Device"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete ELD Device?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedDevice?.device_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDevice} disabled={isSubmitting}>
              {isSubmitting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

