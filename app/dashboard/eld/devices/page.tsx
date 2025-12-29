"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  Truck
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
    manufacturer: "",
    model: "",
    truck_id: "",
    installed_date: "",
    firmware_version: "",
    api_key: "",
    api_endpoint: "",
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
    } catch (error: any) {
      toast.error(error.message || "Failed to sync device")
    } finally {
      setIsSubmitting(false)
    }
  }

  function resetForm() {
    setFormData({
      device_serial_number: "",
      device_name: "",
      manufacturer: "",
      model: "",
      truck_id: "",
      installed_date: "",
      firmware_version: "",
      api_key: "",
      api_endpoint: "",
    })
    setSelectedDevice(null)
  }

  function openEditDialog(device: any) {
    setSelectedDevice(device)
    setFormData({
      device_serial_number: device.device_serial_number,
      device_name: device.device_name,
      manufacturer: device.manufacturer || "",
      model: device.model || "",
      truck_id: device.truck_id || "",
      installed_date: device.installed_date || "",
      firmware_version: device.firmware_version || "",
      api_key: device.api_key || "",
      api_endpoint: device.api_endpoint || "",
    })
    setShowEditDialog(true)
  }

  const filteredDevices = devices.filter((device) =>
    device.device_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    device.device_serial_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    device.manufacturer?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-border bg-card/50 backdrop-blur px-8 py-4">
          <h1 className="text-2xl font-bold text-foreground">ELD Devices</h1>
        </div>
        <main className="flex-1 overflow-auto p-8">
          <p className="text-muted-foreground">Loading...</p>
        </main>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur px-8 py-4 flex items-center justify-between">
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
      <main className="flex-1 overflow-auto p-8">
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

          {/* Devices Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDevices.map((device) => (
              <Card key={device.id} className="p-6 bg-card/50 border-border">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Shield className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{device.device_name}</h3>
                      <p className="text-xs text-muted-foreground">{device.device_serial_number}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    device.status === "active" ? "bg-green-500/20 text-green-400" :
                    device.status === "inactive" ? "bg-gray-500/20 text-gray-400" :
                    "bg-yellow-500/20 text-yellow-400"
                  }`}>
                    {device.status}
                  </span>
                </div>

                <div className="space-y-2 text-sm mb-4">
                  {device.manufacturer && (
                    <p className="text-muted-foreground">
                      <span className="font-medium">Manufacturer:</span> {device.manufacturer}
                    </p>
                  )}
                  {device.trucks && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Truck className="w-4 h-4" />
                      <span>{device.trucks.truck_number}</span>
                    </div>
                  )}
                  {device.last_sync_at && (
                    <p className="text-xs text-muted-foreground">
                      Last sync: {new Date(device.last_sync_at).toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSync(device.id)}
                    className="flex-1"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Sync
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(device)}
                  >
                    <Edit2 className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedDevice(device)
                      setShowDeleteDialog(true)
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {filteredDevices.length === 0 && (
            <Card className="p-12 text-center bg-card/50 border-border">
              <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No ELD devices found</p>
              <Button onClick={() => setShowAddDialog(true)} className="mt-4">
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Device
              </Button>
            </Card>
          )}
        </div>
      </main>

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
                <Label>Manufacturer</Label>
                <Input
                  value={formData.manufacturer}
                  onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                  placeholder="KeepTruckin, Samsara, etc."
                />
              </div>
              <div>
                <Label>Model</Label>
                <Input
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="Model number"
                />
              </div>
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
                <Label>Installed Date</Label>
                <Input
                  type="date"
                  value={formData.installed_date}
                  onChange={(e) => setFormData({ ...formData, installed_date: e.target.value })}
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
              <Label>API Endpoint (Optional)</Label>
              <Input
                value={formData.api_endpoint}
                onChange={(e) => setFormData({ ...formData, api_endpoint: e.target.value })}
                placeholder="https://api.eld-provider.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddDevice} disabled={isSubmitting || !formData.device_serial_number || !formData.device_name}>
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
                <Label>Manufacturer</Label>
                <Input
                  value={formData.manufacturer}
                  onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                />
              </div>
              <div>
                <Label>Model</Label>
                <Input
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                />
              </div>
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
            <div>
              <Label>Status</Label>
              <Select value={selectedDevice?.status} onValueChange={(value) => setSelectedDevice({ ...selectedDevice, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="replaced">Replaced</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Installed Date</Label>
                <Input
                  type="date"
                  value={formData.installed_date}
                  onChange={(e) => setFormData({ ...formData, installed_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Firmware Version</Label>
                <Input
                  value={formData.firmware_version}
                  onChange={(e) => setFormData({ ...formData, firmware_version: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateDevice} disabled={isSubmitting}>
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

