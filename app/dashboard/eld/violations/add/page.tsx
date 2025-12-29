"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Plus, ArrowLeft, AlertTriangle } from "lucide-react"
import { createELDEvent } from "@/app/actions/eld-manual"
import { getELDDevices } from "@/app/actions/eld"
import { getDrivers } from "@/app/actions/drivers"
import { getTrucks } from "@/app/actions/trucks"
import { toast } from "sonner"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function AddELDEventPage() {
  const router = useRouter()
  const [devices, setDevices] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [trucks, setTrucks] = useState<any[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    eld_device_id: "",
    driver_id: "",
    truck_id: "",
    event_type: "hos_violation",
    severity: "warning",
    title: "",
    description: "",
    event_time: new Date().toISOString().slice(0, 16),
    location_lat: "",
    location_lng: "",
    location_address: "",
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [devicesResult, driversResult, trucksResult] = await Promise.all([
      getELDDevices(),
      getDrivers(),
      getTrucks(),
    ])

    if (devicesResult.data) setDevices(devicesResult.data)
    if (driversResult.data) setDrivers(driversResult.data)
    if (trucksResult.data) setTrucks(trucksResult.data)
  }

  async function handleSubmit() {
    if (!formData.eld_device_id || !formData.title || !formData.event_time) {
      toast.error("Please fill in required fields (Device, Title, Event Time)")
      return
    }

    setIsSubmitting(true)
    try {
      const result = await createELDEvent({
        eld_device_id: formData.eld_device_id,
        driver_id: formData.driver_id || undefined,
        truck_id: formData.truck_id || undefined,
        event_type: formData.event_type,
        severity: formData.severity,
        title: formData.title,
        description: formData.description || undefined,
        event_time: formData.event_time,
        location: formData.location_lat && formData.location_lng ? {
          lat: parseFloat(formData.location_lat),
          lng: parseFloat(formData.location_lng),
          address: formData.location_address || undefined,
        } : undefined,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("ELD event/violation created successfully")
        router.push("/dashboard/eld/violations")
      }
    } catch (error) {
      toast.error("Failed to create ELD event")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="border-b border-border bg-card/50 backdrop-blur px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Add ELD Event/Violation</h1>
          <p className="text-sm text-muted-foreground mt-1">Manually create a new event or violation entry</p>
        </div>
        <Link href="/dashboard/eld/violations">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Violations
          </Button>
        </Link>
      </div>

      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-3xl mx-auto">
          <Card className="p-6 border-border">
            <div className="space-y-6">
              {/* Device Selection */}
              <div>
                <Label htmlFor="eld_device_id">ELD Device *</Label>
                <Select value={formData.eld_device_id} onValueChange={(value) => setFormData({ ...formData, eld_device_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select device" />
                  </SelectTrigger>
                  <SelectContent>
                    {devices.map((device) => (
                      <SelectItem key={device.id} value={device.id}>
                        {device.device_name} ({device.device_serial_number})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Driver and Truck */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="driver_id">Driver (Optional)</Label>
                  <Select value={formData.driver_id || "none"} onValueChange={(value) => setFormData({ ...formData, driver_id: value === "none" ? "" : value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select driver" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {drivers.map((driver) => (
                        <SelectItem key={driver.id} value={driver.id}>
                          {driver.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
              </div>

              {/* Event Type and Severity */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="event_type">Event Type *</Label>
                  <Select value={formData.event_type} onValueChange={(value) => setFormData({ ...formData, event_type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hos_violation">HOS Violation</SelectItem>
                      <SelectItem value="speeding">Speeding</SelectItem>
                      <SelectItem value="hard_brake">Hard Braking</SelectItem>
                      <SelectItem value="hard_accel">Hard Acceleration</SelectItem>
                      <SelectItem value="device_malfunction">Device Malfunction</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="severity">Severity *</Label>
                  <Select value={formData.severity} onValueChange={(value) => setFormData({ ...formData, severity: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Title and Time */}
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Exceeded 11-hour driving limit"
                />
              </div>

              <div>
                <Label htmlFor="event_time">Event Time *</Label>
                <Input
                  id="event_time"
                  type="datetime-local"
                  value={formData.event_time}
                  onChange={(e) => setFormData({ ...formData, event_time: e.target.value })}
                />
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Provide additional details about this event..."
                  rows={4}
                />
              </div>

              {/* Location (Optional) */}
              <div>
                <Label className="mb-2 block">Location (Optional)</Label>
                <div className="grid grid-cols-3 gap-4 mb-2">
                  <Input
                    placeholder="Latitude"
                    type="number"
                    step="0.000001"
                    value={formData.location_lat}
                    onChange={(e) => setFormData({ ...formData, location_lat: e.target.value })}
                  />
                  <Input
                    placeholder="Longitude"
                    type="number"
                    step="0.000001"
                    value={formData.location_lng}
                    onChange={(e) => setFormData({ ...formData, location_lng: e.target.value })}
                  />
                  <Input
                    placeholder="Address"
                    value={formData.location_address}
                    onChange={(e) => setFormData({ ...formData, location_address: e.target.value })}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Leave blank if location is not available</p>
              </div>

              <div className="flex gap-4 pt-4">
                <Button variant="outline" onClick={() => router.back()} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1">
                  {isSubmitting ? "Creating..." : "Create Event/Violation"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}
