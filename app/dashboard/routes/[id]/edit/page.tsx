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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Route, MapPin, Clock, DollarSign, User, FileText, Building2 } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { use } from "react"
import { getRoute, updateRoute } from "@/app/actions/routes"
import { getDrivers } from "@/app/actions/drivers"
import { getTrucks } from "@/app/actions/trucks"
import { RouteStopsManager } from "@/components/route-stops-manager"
import { getRouteStops, createRouteStop, updateRouteStop, deleteRouteStop } from "@/app/actions/route-stops"
import { FormPageLayout, FormSection, FormGrid } from "@/components/dashboard/form-page-layout"

export default function EditRoutePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [drivers, setDrivers] = useState<any[]>([])
  const [trucks, setTrucks] = useState<any[]>([])
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
    
    // Financial Information
    estimatedFuelCost: "",
    estimatedTollCost: "",
    totalEstimatedCost: "",
    
    // Route Information
    routeType: "standard",
    requiresPermits: "no",
    hasRestStops: "yes",
    restStopLocations: "",
    
    // Depot Information
    depotName: "",
    depotAddress: "",
    preRouteTime: "",
    postRouteTime: "",
    routeStartTime: "",
    routeDepartureTime: "",
    routeCompleteTime: "",
    scenario: "",
    
    // Additional Information
    specialInstructions: "",
    notes: "",
  })

  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      try {
        const [routeResult, driversResult, trucksResult, stopsResult] = await Promise.all([
          getRoute(id),
          getDrivers(),
          getTrucks(),
          getRouteStops(id),
        ])

        if (routeResult.error || !routeResult.data) {
          toast.error(routeResult.error || "Failed to load route")
          router.push("/dashboard/routes")
          return
        }

        const route = routeResult.data
        setFormData({
          name: route.name || "",
          origin: route.origin || "",
          destination: route.destination || "",
          distance: route.distance || "",
          estimatedTime: route.estimated_time || "",
          priority: route.priority || "normal",
          status: route.status || "pending",
          driver: route.driver_id || "",
          truck: route.truck_id || "",
          estimatedArrival: route.estimated_arrival || "",
          departureTime: route.departure_time || "",
          estimatedFuelCost: route.estimated_fuel_cost || "",
          estimatedTollCost: route.estimated_toll_cost || "",
          totalEstimatedCost: route.total_estimated_cost || "",
          routeType: route.route_type || "standard",
          requiresPermits: route.requires_permits || "no",
          hasRestStops: route.has_rest_stops || "yes",
          restStopLocations: route.rest_stop_locations || "",
          depotName: route.depot_name || "",
          depotAddress: route.depot_address || "",
          preRouteTime: route.pre_route_time_minutes?.toString() || "",
          postRouteTime: route.post_route_time_minutes?.toString() || "",
          routeStartTime: route.route_start_time || "",
          routeDepartureTime: route.route_departure_time || "",
          routeCompleteTime: route.route_complete_time || "",
          scenario: route.scenario || "",
          specialInstructions: route.special_instructions || "",
          notes: route.notes || "",
        })

        if (driversResult.data) setDrivers(driversResult.data)
        if (trucksResult.data) setTrucks(trucksResult.data)
        if (stopsResult.data) setStops(stopsResult.data || [])
      } catch (error: any) {
        toast.error("Failed to load route data")
        console.error(error)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [id, router])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value })
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

    // Update route
    const result = await updateRoute(id, {
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
      notes: formData.notes || undefined,
      special_instructions: formData.specialInstructions || undefined,
    })

    if (result.error) {
      toast.error(result.error || "Failed to update route")
      setIsSubmitting(false)
      return
    }

    // Update stops - delete all existing and recreate
    try {
      // Get existing stops to delete them
      const existingStopsResult = await getRouteStops(id)
      if (existingStopsResult.data && existingStopsResult.data.length > 0) {
        for (const stop of existingStopsResult.data) {
          await deleteRouteStop(stop.id)
        }
      }

      // Create new stops if any
      if (stops.length > 0) {
        for (const stop of stops) {
          await createRouteStop(id, stop)
        }
        toast.success(`Route updated successfully with ${stops.length} stops`)
      } else {
        toast.success("Route updated successfully")
      }
    } catch (error: any) {
      toast.error(`Route updated but failed to update some stops: ${error.message}`)
    }

    setIsSubmitting(false)
    router.push(`/dashboard/routes/${id}`)
  }

  if (isLoading) {
    return (
      <FormPageLayout
        title="Edit Route"
        subtitle="Loading route information..."
        backUrl={`/dashboard/routes/${id}`}
      >
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading route information...</p>
        </div>
      </FormPageLayout>
    )
  }

  return (
    <FormPageLayout
      title="Edit Route"
      subtitle="Update route information"
      backUrl={`/dashboard/routes/${id}`}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      submitLabel="Update Route"
    >
      <Tabs defaultValue="basic" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="stops">Stops</TabsTrigger>
          <TabsTrigger value="assignment">Assignment</TabsTrigger>
          <TabsTrigger value="timing">Timing</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        {/* Basic Information Tab */}
        <TabsContent value="basic" className="space-y-6">
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
                  className="mt-1"
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
                  className="mt-1"
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
                  className="mt-1"
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
                  className="mt-1"
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
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select value={formData.priority} onValueChange={(value) => handleSelectChange("priority", value)}>
                  <SelectTrigger className="mt-1 w-full">
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
                  <SelectTrigger className="mt-1 w-full">
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
        </TabsContent>

        {/* Route Stops Tab */}
        <TabsContent value="stops" className="space-y-6">
          <RouteStopsManager stops={stops} onStopsChange={setStops} />
        </TabsContent>

        {/* Assignment Tab */}
        <TabsContent value="assignment" className="space-y-6">
          <FormSection title="Assignment" icon={<User className="w-5 h-5" />}>
            <FormGrid cols={2}>
              <div>
                <Label htmlFor="driver">Assigned Driver</Label>
                <Select value={formData.driver || "none"} onValueChange={(value) => handleSelectChange("driver", value === "none" ? "" : value)}>
                  <SelectTrigger className="mt-1 w-full">
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
                  <SelectTrigger className="mt-1 w-full">
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
        </TabsContent>

        {/* Timing Tab */}
        <TabsContent value="timing" className="space-y-6">
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
                  className="mt-1"
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
                  className="mt-1"
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
                    className="mt-1"
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
                    className="mt-1"
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
                    className="mt-1"
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
                    className="mt-1"
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
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="scenario">Scenario</Label>
                  <Input
                    id="scenario"
                    name="scenario"
                    value={formData.scenario}
                    onChange={handleChange}
                    placeholder="e.g., Morning Delivery"
                    className="mt-1"
                  />
                </div>
              </FormGrid>
            </div>
          </FormSection>
        </TabsContent>

        {/* Financial Tab */}
        <TabsContent value="financial" className="space-y-6">
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
                  className="mt-1"
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
                  className="mt-1"
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
                  className="mt-1"
                  step="0.01"
                />
              </div>
            </FormGrid>
          </FormSection>
        </TabsContent>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-6">
          <FormSection title="Route Details" icon={<Route className="w-5 h-5" />}>
            <FormGrid cols={2}>
              <div>
                <Label htmlFor="routeType">Route Type</Label>
                <Select value={formData.routeType} onValueChange={(value) => handleSelectChange("routeType", value)}>
                  <SelectTrigger className="mt-1 w-full">
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
                  <SelectTrigger className="mt-1 w-full">
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
                  <SelectTrigger className="mt-1 w-full">
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
                  className="mt-1 min-h-20"
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
                  className="mt-1 min-h-24"
                  rows={3}
                />
              </div>
            </FormGrid>
          </FormSection>

          <FormSection title="Additional Information" icon={<FileText className="w-5 h-5" />}>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                placeholder="Any additional information about the route..."
                value={formData.notes}
                onChange={handleChange}
                className="mt-1 min-h-24"
                rows={4}
              />
            </div>
          </FormSection>
        </TabsContent>
      </Tabs>
    </FormPageLayout>
  )
}
