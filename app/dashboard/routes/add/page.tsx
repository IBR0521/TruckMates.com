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
import { ArrowLeft, Route, MapPin, Clock, Fuel, DollarSign, User, FileText, Building2 } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { createRoute } from "@/app/actions/routes"
import { useRouter } from "next/navigation"
import { getDrivers } from "@/app/actions/drivers"
import { getTrucks } from "@/app/actions/trucks"
import { RouteStopsManager } from "@/components/route-stops-manager"
import { createRouteStop } from "@/app/actions/route-stops"
import { FormPageLayout, FormSection, FormGrid } from "@/components/dashboard/form-page-layout"

export default function AddRoutePage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [drivers, setDrivers] = useState<any[]>([])
  const [trucks, setTrucks] = useState<any[]>([])
  const [waypoints, setWaypoints] = useState<string[]>([])
  const [newWaypoint, setNewWaypoint] = useState("")
  const [stops, setStops] = useState<any[]>([])
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
    
    // Depot Information
    depotName: "",
    depotAddress: "",
    preRouteTime: "",
    postRouteTime: "",
    routeStartTime: "",
    routeDepartureTime: "",
    routeCompleteTime: "",
    scenario: "",
    
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

    // Validate stops
    if (stops.length > 0) {
      const invalidStops = stops.filter(
        (stop) => !stop.location_name || !stop.address
      )
      if (invalidStops.length > 0) {
        toast.error("Please fill in location name and address for all stops")
        setIsSubmitting(false)
        return
      }
    }

    // Create route
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
      depot_name: formData.depotName || undefined,
      depot_address: formData.depotAddress || undefined,
      pre_route_time_minutes: formData.preRouteTime ? parseInt(formData.preRouteTime) : undefined,
      post_route_time_minutes: formData.postRouteTime ? parseInt(formData.postRouteTime) : undefined,
      route_start_time: formData.routeStartTime || undefined,
      route_departure_time: formData.routeDepartureTime || undefined,
      route_complete_time: formData.routeCompleteTime || undefined,
      route_type: formData.routeType || undefined,
      scenario: formData.scenario || undefined,
    })

    if (result.error) {
      toast.error(result.error || "Failed to add route")
      setIsSubmitting(false)
      return
    }

    // Create stops if any
    if (stops.length > 0 && result.data?.id) {
      try {
        for (const stop of stops) {
          await createRouteStop(result.data.id, stop)
        }
        toast.success(`Route added successfully with ${stops.length} stops`)
      } catch (error: any) {
        toast.error(`Route created but failed to add some stops: ${error.message}`)
      }
    } else {
      toast.success("Route added successfully")
    }

    setIsSubmitting(false)
    router.push(`/dashboard/routes/${result.data?.id || ""}`)
  }

  return (
    <FormPageLayout
      title="Add New Route"
      subtitle="Create a new route for your fleet"
      backUrl="/dashboard/routes"
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      submitLabel="Add Route"
    >
      <div className="space-y-6">
        {/* Basic Information Section */}
        <FormSection title="Basic Information" icon={<Route className="w-5 h-5" />}>
          <FormGrid cols={2}>
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
              </FormGrid>
            </FormSection>

            {/* Route Stops Section */}
            <RouteStopsManager stops={stops} onStopsChange={setStops} />

            {/* Depot Information Section */}
            <FormSection title="Depot Information (Optional)" icon={<Building2 className="w-5 h-5" />}>
              <FormGrid cols={2}>
                <div>
                  <Label htmlFor="depotName">Depot Name</Label>
                  <Input
                    id="depotName"
                    name="depotName"
                    value={formData.depotName}
                    onChange={handleChange}
                    placeholder="e.g., DPT - MAIN"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="depotAddress">Depot Address</Label>
                  <Input
                    id="depotAddress"
                    name="depotAddress"
                    value={formData.depotAddress}
                    onChange={handleChange}
                    placeholder="Depot address"
                    className="mt-2"
                  />
                </div>
              </FormGrid>
              <div className="mt-4">
                <FormGrid cols={3}>
                  <div>
                    <Label htmlFor="preRouteTime">Pre-Route Time (minutes)</Label>
                  <Input
                    id="preRouteTime"
                    name="preRouteTime"
                    type="number"
                    value={formData.preRouteTime}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="postRouteTime">Post-Route Time (minutes)</Label>
                  <Input
                    id="postRouteTime"
                    name="postRouteTime"
                    type="number"
                    value={formData.postRouteTime}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="routeStartTime">Route Start Time</Label>
                  <Input
                    id="routeStartTime"
                    name="routeStartTime"
                    type="time"
                    value={formData.routeStartTime}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="routeDepartureTime">Route Departure Time</Label>
                  <Input
                    id="routeDepartureTime"
                    name="routeDepartureTime"
                    type="time"
                    value={formData.routeDepartureTime}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="routeCompleteTime">Route Complete Time</Label>
                  <Input
                    id="routeCompleteTime"
                    name="routeCompleteTime"
                    type="time"
                    value={formData.routeCompleteTime}
                    onChange={handleChange}
                    className="mt-2"
                  />
                  </div>
                </FormGrid>
              </div>
            </FormSection>

            {/* Assignment Section */}
            <FormSection title="Assignment" icon={<User className="w-5 h-5" />}>
              <FormGrid cols={2}>
                <div>
                  <Label htmlFor="driver">Assigned Driver</Label>
                  <Select value={formData.driver || "none"} onValueChange={(value) => handleSelectChange("driver", value === "none" ? "" : value)}>
                    <SelectTrigger className="mt-2 w-full">
                      <SelectValue placeholder="Select a driver (optional)" />
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
                  <Label htmlFor="truck">Assigned Truck</Label>
                  <Select value={formData.truck || "none"} onValueChange={(value) => handleSelectChange("truck", value === "none" ? "" : value)}>
                    <SelectTrigger className="mt-2 w-full">
                      <SelectValue placeholder="Select a truck (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {trucks.map((truck) => (
                        <SelectItem key={truck.id} value={truck.id}>
                          {truck.truck_number} - {truck.make} {truck.model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </FormGrid>
            </FormSection>

            {/* Timing Section */}
            <FormSection title="Timing Information" icon={<Clock className="w-5 h-5" />}>
              <FormGrid cols={2}>
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
              </FormGrid>
            </FormSection>

            {/* Financial Information Section */}
            <FormSection title="Financial Information" icon={<DollarSign className="w-5 h-5" />}>
              <FormGrid cols={2}>
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
              </FormGrid>
            </FormSection>

            {/* Route Details Section */}
            <FormSection title="Route Details" icon={<Route className="w-5 h-5" />}>
              <FormGrid cols={2}>
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
              </FormGrid>
            </FormSection>

            {/* Additional Notes Section */}
            <FormSection title="Additional Information" icon={<FileText className="w-5 h-5" />}>
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
            </FormSection>
      </div>
    </FormPageLayout>
  )
}
