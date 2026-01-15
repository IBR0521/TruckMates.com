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
import { Plus, ArrowLeft } from "lucide-react"
import { createELDLog } from "@/app/actions/eld-manual"
import { getELDDevices } from "@/app/actions/eld"
import { getDrivers } from "@/app/actions/drivers"
import { getTrucks } from "@/app/actions/trucks"
import { toast } from "sonner"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function AddELDLogPage() {
  const router = useRouter()
  const [devices, setDevices] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [trucks, setTrucks] = useState<any[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    eld_device_id: "",
    driver_id: "",
    truck_id: "",
    log_date: new Date().toISOString().split('T')[0],
    log_type: "driving",
    start_time: "",
    end_time: "",
    duration_minutes: "",
    location_start_lat: "",
    location_start_lng: "",
    location_start_address: "",
    location_end_lat: "",
    location_end_lng: "",
    location_end_address: "",
    odometer_start: "",
    odometer_end: "",
    miles_driven: "",
    engine_hours: "",
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
    if (!formData.eld_device_id || !formData.log_date || !formData.log_type || !formData.start_time) {
      toast.error("Please fill in required fields")
      return
    }

    setIsSubmitting(true)
    try {
      const result = await createELDLog({
        eld_device_id: formData.eld_device_id,
        driver_id: formData.driver_id || undefined,
        truck_id: formData.truck_id || undefined,
        log_date: formData.log_date,
        log_type: formData.log_type,
        start_time: formData.start_time,
        end_time: formData.end_time || undefined,
        duration_minutes: formData.duration_minutes ? parseInt(formData.duration_minutes) : undefined,
        location_start: formData.location_start_lat && formData.location_start_lng ? {
          lat: parseFloat(formData.location_start_lat),
          lng: parseFloat(formData.location_start_lng),
          address: formData.location_start_address || undefined,
        } : undefined,
        location_end: formData.location_end_lat && formData.location_end_lng ? {
          lat: parseFloat(formData.location_end_lat),
          lng: parseFloat(formData.location_end_lng),
          address: formData.location_end_address || undefined,
        } : undefined,
        odometer_start: formData.odometer_start ? parseInt(formData.odometer_start) : undefined,
        odometer_end: formData.odometer_end ? parseInt(formData.odometer_end) : undefined,
        miles_driven: formData.miles_driven ? parseFloat(formData.miles_driven) : undefined,
        engine_hours: formData.engine_hours ? parseFloat(formData.engine_hours) : undefined,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("ELD log created successfully")
        router.push("/dashboard/eld/logs")
      }
    } catch (error) {
      toast.error("Failed to create ELD log")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Add ELD Log Entry</h1>
          <p className="text-sm text-muted-foreground mt-1">Manually create a new HOS log entry</p>
        </div>
        <Link href="/dashboard/eld/logs">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Logs
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

              {/* Date and Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="log_date">Log Date *</Label>
                  <Input
                    id="log_date"
                    type="date"
                    value={formData.log_date}
                    onChange={(e) => setFormData({ ...formData, log_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="log_type">Log Type *</Label>
                  <Select value={formData.log_type} onValueChange={(value) => setFormData({ ...formData, log_type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="driving">Driving</SelectItem>
                      <SelectItem value="on_duty">On Duty</SelectItem>
                      <SelectItem value="off_duty">Off Duty</SelectItem>
                      <SelectItem value="sleeper_berth">Sleeper Berth</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Times */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_time">Start Time *</Label>
                  <Input
                    id="start_time"
                    type="datetime-local"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="end_time">End Time (Optional)</Label>
                  <Input
                    id="end_time"
                    type="datetime-local"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  />
                </div>
              </div>

              {/* Duration and Miles */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="duration_minutes">Duration (minutes)</Label>
                  <Input
                    id="duration_minutes"
                    type="number"
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                    placeholder="Auto-calculated if end time provided"
                  />
                </div>
                <div>
                  <Label htmlFor="miles_driven">Miles Driven</Label>
                  <Input
                    id="miles_driven"
                    type="number"
                    step="0.01"
                    value={formData.miles_driven}
                    onChange={(e) => setFormData({ ...formData, miles_driven: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="engine_hours">Engine Hours</Label>
                  <Input
                    id="engine_hours"
                    type="number"
                    step="0.01"
                    value={formData.engine_hours}
                    onChange={(e) => setFormData({ ...formData, engine_hours: e.target.value })}
                  />
                </div>
              </div>

              {/* Odometer */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="odometer_start">Odometer Start</Label>
                  <Input
                    id="odometer_start"
                    type="number"
                    value={formData.odometer_start}
                    onChange={(e) => setFormData({ ...formData, odometer_start: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="odometer_end">Odometer End</Label>
                  <Input
                    id="odometer_end"
                    type="number"
                    value={formData.odometer_end}
                    onChange={(e) => setFormData({ ...formData, odometer_end: e.target.value })}
                  />
                </div>
              </div>

              {/* Start Location */}
              <div>
                <Label className="mb-2 block">Start Location (Optional)</Label>
                <div className="grid grid-cols-3 gap-4">
                  <Input
                    placeholder="Latitude"
                    type="number"
                    step="0.000001"
                    value={formData.location_start_lat}
                    onChange={(e) => setFormData({ ...formData, location_start_lat: e.target.value })}
                  />
                  <Input
                    placeholder="Longitude"
                    type="number"
                    step="0.000001"
                    value={formData.location_start_lng}
                    onChange={(e) => setFormData({ ...formData, location_start_lng: e.target.value })}
                  />
                  <Input
                    placeholder="Address"
                    value={formData.location_start_address}
                    onChange={(e) => setFormData({ ...formData, location_start_address: e.target.value })}
                  />
                </div>
              </div>

              {/* End Location */}
              <div>
                <Label className="mb-2 block">End Location (Optional)</Label>
                <div className="grid grid-cols-3 gap-4">
                  <Input
                    placeholder="Latitude"
                    type="number"
                    step="0.000001"
                    value={formData.location_end_lat}
                    onChange={(e) => setFormData({ ...formData, location_end_lat: e.target.value })}
                  />
                  <Input
                    placeholder="Longitude"
                    type="number"
                    step="0.000001"
                    value={formData.location_end_lng}
                    onChange={(e) => setFormData({ ...formData, location_end_lng: e.target.value })}
                  />
                  <Input
                    placeholder="Address"
                    value={formData.location_end_address}
                    onChange={(e) => setFormData({ ...formData, location_end_address: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <Button variant="outline" onClick={() => router.back()} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1">
                  {isSubmitting ? "Creating..." : "Create Log Entry"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
