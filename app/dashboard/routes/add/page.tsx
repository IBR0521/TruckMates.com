"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeft, Route, MapPin, Clock, Fuel, DollarSign, User, FileText } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { createRoute } from "@/app/actions/routes"
import { useRouter } from "next/navigation"
import { getDrivers } from "@/app/actions/drivers"
import { getTrucks } from "@/app/actions/trucks"

export default function AddRoutePage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [drivers, setDrivers] = useState<any[]>([])
  const [trucks, setTrucks] = useState<any[]>([])
  const [waypoints, setWaypoints] = useState<string[]>([])
  const [newWaypoint, setNewWaypoint] = useState("")
  const [formData, setFormData] = useState({
    // Basic Information
    name: "",
    origin: "",
    destination: "",
    
    // Route Details
    distance: "",
    estimatedTime: "",
    priority: "normal",
    status: "pending",
    
    // Assignment
    driver: "",
    truck: "",
    
    // Timing
    estimatedArrival: "",
    departureTime: "",
    
    // Financial Information
    estimatedFuelCost: "",
    estimatedTollCost: "",
    totalEstimatedCost: "",
    
    // Route Information
    routeType: "standard",
    requiresPermits: "no",
    hasRestStops: "yes",
    restStopLocations: "",
    
    // Additional Information
    specialInstructions: "",
    notes: "",
  })

  useEffect(() => {
    async function loadData() {
      const [driversResult, trucksResult] = await Promise.all([
        getDrivers(),
        getTrucks(),
      ])
      if (driversResult.data) setDrivers(driversResult.data)
      if (trucksResult.data) setTrucks(trucksResult.data)
    }
    loadData()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value })
  }

  const addWaypoint = () => {
    if (newWaypoint.trim()) {
      setWaypoints([...waypoints, newWaypoint.trim()])
      setNewWaypoint("")
    }
  }

  const removeWaypoint = (index: number) => {
    setWaypoints(waypoints.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const result = await createRoute({
      name: formData.name,
      origin: formData.origin,
      destination: formData.destination,
      distance: formData.distance,
      estimated_time: formData.estimatedTime,
      priority: formData.priority,
      status: formData.status,
      driver_id: formData.driver || undefined,
      truck_id: formData.truck || undefined,
    })

    setIsSubmitting(false)

    if (result.error) {
      toast.error(result.error || "Failed to add route")
    } else {
      toast.success("Route added successfully")
      router.push("/dashboard/routes")
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="border-b border-border bg-card/50 backdrop-blur px-8 py-4 flex items-center gap-4">
        <Link href="/dashboard/routes">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Add New Route</h1>
      </div>

      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information Section */}
            <Card className="border-border p-6">
              <div className="flex items-center gap-2 mb-6">
                <Route className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Basic Information</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <Label htmlFor="name">Route Name *</Label>
                <Input
                    id="name"
                    name="name"
                  type="text"
                  placeholder="NY-PA Route"
                  value={formData.name}
                  onChange={handleChange}
                    className="mt-2"
                    required
                />
              </div>
                <div>
                  <Label htmlFor="origin">Origin *</Label>
                  <Input
                    id="origin"
                    name="origin"
                    type="text"
                    placeholder="New York, NY"
                    value={formData.origin}
                    onChange={handleChange}
                    className="mt-2"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="destination">Destination *</Label>
                  <Input
                    id="destination"
                    name="destination"
                    type="text"
                    placeholder="Pennsylvania, PA"
                    value={formData.destination}
                    onChange={handleChange}
                    className="mt-2"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="distance">Distance</Label>
                  <Input
                    id="distance"
                    name="distance"
                    type="text"
                    placeholder="180 mi"
                    value={formData.distance}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="estimatedTime">Estimated Time</Label>
                  <Input
                    id="estimatedTime"
                    name="estimatedTime"
                    type="text"
                    placeholder="3h 30m"
                    value={formData.estimatedTime}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={formData.priority} onValueChange={(value) => handleSelectChange("priority", value)}>
                    <SelectTrigger className="mt-2 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="status">Status *</Label>
                  <Select value={formData.status} onValueChange={(value) => handleSelectChange("status", value)}>
                    <SelectTrigger className="mt-2 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            {/* Waypoints Section */}
            <Card className="border-border p-6">
              <div className="flex items-center gap-2 mb-6">
                <MapPin className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Waypoints</h2>
              </div>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Add a waypoint (e.g., Scranton, PA)"
                    value={newWaypoint}
                    onChange={(e) => setNewWaypoint(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addWaypoint()
                      }
                    }}
                    className="flex-1"
                  />
                  <Button type="button" onClick={addWaypoint} variant="outline">
                    Add
                  </Button>
                </div>
                {waypoints.length > 0 && (
                  <div className="space-y-2">
                    {waypoints.map((waypoint, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-secondary/50 rounded-md">
                        <span className="text-sm text-foreground">
                          {index + 1}. {waypoint}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeWaypoint(index)}
                          className="text-red-400 hover:text-red-500"
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            {/* Assignment Section */}
            <Card className="border-border p-6">
              <div className="flex items-center gap-2 mb-6">
                <User className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Assignment</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="driver">Assigned Driver</Label>
                  <Select value={formData.driver || undefined} onValueChange={(value) => handleSelectChange("driver", value)}>
                    <SelectTrigger className="mt-2 w-full">
                      <SelectValue placeholder="Select a driver (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {drivers.map((driver) => (
                        <SelectItem key={driver.id} value={driver.id}>
                          {driver.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="truck">Assigned Truck</Label>
                  <Select value={formData.truck || undefined} onValueChange={(value) => handleSelectChange("truck", value)}>
                    <SelectTrigger className="mt-2 w-full">
                      <SelectValue placeholder="Select a truck (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {trucks.map((truck) => (
                        <SelectItem key={truck.id} value={truck.id}>
                          {truck.truck_number} - {truck.make} {truck.model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            {/* Timing Section */}
            <Card className="border-border p-6">
              <div className="flex items-center gap-2 mb-6">
                <Clock className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Timing Information</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="departureTime">Departure Time</Label>
                  <Input
                    id="departureTime"
                    name="departureTime"
                    type="datetime-local"
                    value={formData.departureTime}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="estimatedArrival">Estimated Arrival</Label>
                  <Input
                    id="estimatedArrival"
                    name="estimatedArrival"
                    type="datetime-local"
                    value={formData.estimatedArrival}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
              </div>
            </Card>

            {/* Financial Information Section */}
            <Card className="border-border p-6">
              <div className="flex items-center gap-2 mb-6">
                <DollarSign className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Financial Information</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="estimatedFuelCost">Estimated Fuel Cost ($)</Label>
                  <Input
                    id="estimatedFuelCost"
                    name="estimatedFuelCost"
                    type="number"
                    placeholder="450.00"
                    value={formData.estimatedFuelCost}
                    onChange={handleChange}
                    className="mt-2"
                    step="0.01"
                  />
                </div>
                <div>
                  <Label htmlFor="estimatedTollCost">Estimated Toll Cost ($)</Label>
                  <Input
                    id="estimatedTollCost"
                    name="estimatedTollCost"
                    type="number"
                    placeholder="35.50"
                    value={formData.estimatedTollCost}
                    onChange={handleChange}
                    className="mt-2"
                    step="0.01"
                  />
                </div>
                <div>
                  <Label htmlFor="totalEstimatedCost">Total Estimated Cost ($)</Label>
                  <Input
                    id="totalEstimatedCost"
                    name="totalEstimatedCost"
                    type="number"
                    placeholder="485.50"
                    value={formData.totalEstimatedCost}
                    onChange={handleChange}
                    className="mt-2"
                    step="0.01"
                  />
                </div>
              </div>
            </Card>

            {/* Route Details Section */}
            <Card className="border-border p-6">
              <div className="flex items-center gap-2 mb-6">
                <Route className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Route Details</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="routeType">Route Type</Label>
                  <Select value={formData.routeType} onValueChange={(value) => handleSelectChange("routeType", value)}>
                    <SelectTrigger className="mt-2 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="express">Express</SelectItem>
                      <SelectItem value="local">Local</SelectItem>
                      <SelectItem value="long-haul">Long Haul</SelectItem>
                      <SelectItem value="regional">Regional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="requiresPermits">Requires Permits</Label>
                  <Select value={formData.requiresPermits} onValueChange={(value) => handleSelectChange("requiresPermits", value)}>
                    <SelectTrigger className="mt-2 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="hasRestStops">Has Rest Stops</Label>
                  <Select value={formData.hasRestStops} onValueChange={(value) => handleSelectChange("hasRestStops", value)}>
                    <SelectTrigger className="mt-2 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="restStopLocations">Rest Stop Locations</Label>
                  <Textarea
                    id="restStopLocations"
                    name="restStopLocations"
                    placeholder="List rest stop locations along the route..."
                    value={formData.restStopLocations}
                    onChange={handleChange}
                    className="mt-2 min-h-20"
                    rows={2}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="specialInstructions">Special Instructions</Label>
                  <Textarea
                    id="specialInstructions"
                    name="specialInstructions"
                    placeholder="Any special route instructions, restrictions, or requirements..."
                    value={formData.specialInstructions}
                    onChange={handleChange}
                    className="mt-2 min-h-24"
                    rows={3}
                  />
                </div>
              </div>
            </Card>

            {/* Additional Notes Section */}
            <Card className="border-border p-6">
              <div className="flex items-center gap-2 mb-6">
                <FileText className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Additional Information</h2>
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  placeholder="Any additional information about the route..."
                  value={formData.notes}
                  onChange={handleChange}
                  className="mt-2 min-h-24"
                  rows={4}
                />
              </div>
            </Card>

            {/* Submit Buttons */}
            <div className="flex gap-4 justify-end">
                <Link href="/dashboard/routes">
                  <Button type="button" variant="outline" className="border-border bg-transparent">
                    Cancel
                  </Button>
                </Link>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isSubmitting ? "Adding Route..." : "Add Route"}
              </Button>
              </div>
            </form>
        </div>
      </main>
    </div>
  )
}
