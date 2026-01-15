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
import { Plus, ArrowLeft, MapPin } from "lucide-react"
import { createELDLocation } from "@/app/actions/eld-manual"
import { getELDDevices } from "@/app/actions/eld"
import { getDrivers } from "@/app/actions/drivers"
import { getTrucks } from "@/app/actions/trucks"
import { toast } from "sonner"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function AddELDLocationPage() {
  const router = useRouter()
  const [devices, setDevices] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [trucks, setTrucks] = useState<any[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    eld_device_id: "",
    driver_id: "",
    truck_id: "",
    timestamp: new Date().toISOString().slice(0, 16),
    latitude: "",
    longitude: "",
    address: "",
    speed: "",
    heading: "",
    odometer: "",
    engine_status: "on",
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
    if (!formData.eld_device_id || !formData.timestamp || !formData.latitude || !formData.longitude) {
      toast.error("Please fill in required fields (Device, Timestamp, Latitude, Longitude)")
      return
    }

    const lat = parseFloat(formData.latitude)
    const lng = parseFloat(formData.longitude)

    if (isNaN(lat) || lat < -90 || lat > 90) {
      toast.error("Latitude must be between -90 and 90")
      return
    }

    if (isNaN(lng) || lng < -180 || lng > 180) {
      toast.error("Longitude must be between -180 and 180")
      return
    }

    setIsSubmitting(true)
    try {
      const result = await createELDLocation({
        eld_device_id: formData.eld_device_id,
        driver_id: formData.driver_id || undefined,
        truck_id: formData.truck_id || undefined,
        timestamp: formData.timestamp,
        latitude: lat,
        longitude: lng,
        address: formData.address || undefined,
        speed: formData.speed ? parseInt(formData.speed) : undefined,
        heading: formData.heading ? parseInt(formData.heading) : undefined,
        odometer: formData.odometer ? parseInt(formData.odometer) : undefined,
        engine_status: formData.engine_status || undefined,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("ELD location created successfully")
        router.push("/dashboard/eld")
      }
    } catch (error) {
      toast.error("Failed to create ELD location")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Add ELD Location Entry</h1>
          <p className="text-sm text-muted-foreground mt-1">Manually create a new GPS location entry</p>
        </div>
        <Link href="/dashboard/eld">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to ELD
          </Button>
        </Link>
      </div>

        <div className="p-4 md:p-8">
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

              {/* Timestamp */}
              <div>
                <Label htmlFor="timestamp">Timestamp *</Label>
                <Input
                  id="timestamp"
                  type="datetime-local"
                  value={formData.timestamp}
                  onChange={(e) => setFormData({ ...formData, timestamp: e.target.value })}
                />
              </div>

              {/* Location Coordinates */}
              <div>
                <Label className="mb-2 block flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Location Coordinates *
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="latitude" className="text-xs text-muted-foreground">Latitude (-90 to 90)</Label>
                    <Input
                      id="latitude"
                      type="number"
                      step="0.000001"
                      value={formData.latitude}
                      onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                      placeholder="e.g., 40.7128"
                    />
                  </div>
                  <div>
                    <Label htmlFor="longitude" className="text-xs text-muted-foreground">Longitude (-180 to 180)</Label>
                    <Input
                      id="longitude"
                      type="number"
                      step="0.000001"
                      value={formData.longitude}
                      onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                      placeholder="e.g., -74.0060"
                    />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div>
                <Label htmlFor="address">Address (Optional)</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g., 123 Main St, New York, NY 10001"
                />
              </div>

              {/* Speed, Heading, Odometer */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="speed">Speed (MPH)</Label>
                  <Input
                    id="speed"
                    type="number"
                    value={formData.speed}
                    onChange={(e) => setFormData({ ...formData, speed: e.target.value })}
                    placeholder="0-100"
                  />
                </div>
                <div>
                  <Label htmlFor="heading">Heading (0-360°)</Label>
                  <Input
                    id="heading"
                    type="number"
                    min="0"
                    max="360"
                    value={formData.heading}
                    onChange={(e) => setFormData({ ...formData, heading: e.target.value })}
                    placeholder="0-360"
                  />
                </div>
                <div>
                  <Label htmlFor="odometer">Odometer</Label>
                  <Input
                    id="odometer"
                    type="number"
                    value={formData.odometer}
                    onChange={(e) => setFormData({ ...formData, odometer: e.target.value })}
                    placeholder="Miles"
                  />
                </div>
              </div>

              {/* Engine Status */}
              <div>
                <Label htmlFor="engine_status">Engine Status</Label>
                <Select value={formData.engine_status} onValueChange={(value) => setFormData({ ...formData, engine_status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="on">On</SelectItem>
                    <SelectItem value="off">Off</SelectItem>
                    <SelectItem value="idle">Idle</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-4 pt-4">
                <Button variant="outline" onClick={() => router.back()} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1">
                  {isSubmitting ? "Creating..." : "Create Location Entry"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
