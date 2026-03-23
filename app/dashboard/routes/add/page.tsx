"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Route, Clock, DollarSign, User, FileText, Building2, ChevronDown } from "lucide-react"
import { toast } from "sonner"
import { createRoute } from "@/app/actions/routes"
import { getTripPlanningEstimate } from "@/app/actions/promiles"
import { useRouter } from "next/navigation"
import { getDrivers } from "@/app/actions/drivers"
import { getTrucks } from "@/app/actions/trucks"
import { RouteStopsManager } from "@/components/route-stops-manager"
import { createRouteStop } from "@/app/actions/route-stops"
import { FormPageLayout, FormSection, FormGrid } from "@/components/dashboard/form-page-layout"

function timeFromDateTimeLocal(dt: string): string | undefined {
  if (!dt || !dt.includes("T")) return undefined
  const t = dt.split("T")[1]
  if (!t) return undefined
  const [h, m] = t.split(":")
  if (h == null || m == null) return undefined
  return `${h.padStart(2, "0")}:${m.slice(0, 2)}:00`
}

export default function AddRoutePage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isEstimating, setIsEstimating] = useState(false)
  const [drivers, setDrivers] = useState<any[]>([])
  const [trucks, setTrucks] = useState<any[]>([])
  const [stops, setStops] = useState<any[]>([])
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const [formData, setFormData] = useState({
    name: "",
    origin: "",
    destination: "",
    distance: "",
    estimatedTime: "",
    priority: "normal",
    status: "pending",
    driver: "",
    truck: "",
    departureTime: "",
    estimatedArrival: "",
    depotName: "",
    depotAddress: "",
    preRouteTime: "",
    postRouteTime: "",
    routeStartTime: "",
    routeDepartureTime: "",
    routeCompleteTime: "",
    scenario: "",
    estimatedFuelCost: "",
    estimatedTollCost: "",
    totalEstimatedCost: "",
    routeType: "standard",
    requiresPermits: "no",
    specialInstructions: "",
    notes: "",
  })

  useEffect(() => {
    async function loadData() {
      const [driversResult, trucksResult] = await Promise.all([getDrivers(), getTrucks()])
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

  const applyTripPlanningEstimate = async () => {
    if (!formData.origin?.trim() || !formData.destination?.trim()) {
      toast.error("Enter origin and destination first.")
      return
    }
    setIsEstimating(true)
    try {
      const res = await getTripPlanningEstimate({
        origin: formData.origin.trim(),
        destination: formData.destination.trim(),
        mpg: 6.5,
      })
      if (res.error || !res.data) {
        toast.error(res.error || "Could not calculate route estimate.")
        return
      }
      const d = res.data
      const fuel = d.fuel.estimated_cost_usd
      const toll = d.tolls.estimated_usd
      const total =
        fuel != null || toll != null ? (Number(fuel ?? 0) + Number(toll ?? 0)).toFixed(2) : ""
      const dur = d.duration_seconds
      const timeStr =
        dur != null
          ? `${Math.floor(dur / 3600)}h ${Math.round((dur % 3600) / 60)}m`
          : formData.estimatedTime

      setFormData((prev) => ({
        ...prev,
        distance: `${d.distance_miles} mi`,
        estimatedTime: timeStr,
        estimatedFuelCost: fuel != null ? fuel.toFixed(2) : "",
        estimatedTollCost: toll != null ? toll.toFixed(2) : "",
        totalEstimatedCost: total,
      }))
      toast.success("Distance, time, fuel & tolls filled from trip planning.")
    } catch {
      toast.error("Trip planning failed.")
    } finally {
      setIsEstimating(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    if (stops.length > 0) {
      const invalidStops = stops.filter((stop) => !stop.location_name || !stop.address)
      if (invalidStops.length > 0) {
        toast.error("Please fill in location name and address for all stops")
        setIsSubmitting(false)
        return
      }
    }

    const depTime =
      timeFromDateTimeLocal(formData.departureTime) || formData.routeDepartureTime || undefined

    const result = await createRoute({
      name: formData.name,
      origin: formData.origin,
      destination: formData.destination,
      distance: formData.distance || undefined,
      estimated_time: formData.estimatedTime || undefined,
      priority: formData.priority,
      status: formData.status,
      driver_id: formData.driver || undefined,
      truck_id: formData.truck || undefined,
      depot_name: formData.depotName || undefined,
      depot_address: formData.depotAddress || undefined,
      pre_route_time_minutes: formData.preRouteTime ? parseInt(formData.preRouteTime, 10) : undefined,
      post_route_time_minutes: formData.postRouteTime ? parseInt(formData.postRouteTime, 10) : undefined,
      route_start_time: formData.routeStartTime || undefined,
      route_departure_time: depTime,
      route_complete_time: formData.routeCompleteTime || undefined,
      route_type: formData.routeType || undefined,
      scenario: formData.scenario || undefined,
      estimated_arrival: formData.estimatedArrival
        ? new Date(formData.estimatedArrival).toISOString()
        : undefined,
      special_instructions: formData.specialInstructions || undefined,
      notes: formData.notes || undefined,
      estimated_fuel_cost: formData.estimatedFuelCost
        ? parseFloat(formData.estimatedFuelCost)
        : undefined,
      estimated_toll_cost: formData.estimatedTollCost ? parseFloat(formData.estimatedTollCost) : undefined,
      total_estimated_cost: formData.totalEstimatedCost
        ? parseFloat(formData.totalEstimatedCost)
        : undefined,
    })

    if (result.error) {
      toast.error(result.error || "Failed to add route")
      setIsSubmitting(false)
      return
    }

    if (stops.length > 0 && result.data?.id) {
      try {
        for (const stop of stops) {
          await createRouteStop(result.data.id, stop)
        }
        toast.success(`Route added successfully with ${stops.length} stops`)
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unknown error"
        toast.error(`Route created but failed to add some stops: ${msg}`)
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
      subtitle="Keep it simple: corridor, stops, and who’s on it. Use trip planning for miles and costs."
      backUrl="/dashboard/routes"
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      submitLabel="Add Route"
    >
      <Tabs defaultValue="basic" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="stops">Stops</TabsTrigger>
          <TabsTrigger value="assignment">Assignment</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-6">
          <FormSection title="Route" icon={<Route className="w-5 h-5" />}>
            <FormGrid cols={2}>
              <div className="md:col-span-2">
                <Label htmlFor="name">Route name *</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="NY–PA corridor"
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
                  placeholder="Harrisburg, PA"
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
                  placeholder="Filled by estimate"
                  value={formData.distance}
                  onChange={handleChange}
                  className="mt-1 bg-muted/30"
                  readOnly
                />
              </div>
              <div>
                <Label htmlFor="estimatedTime">Drive time (est.)</Label>
                <Input
                  id="estimatedTime"
                  name="estimatedTime"
                  placeholder="Filled by estimate"
                  value={formData.estimatedTime}
                  onChange={handleChange}
                  className="mt-1 bg-muted/30"
                  readOnly
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
                    <SelectItem value="in_progress">In progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </FormGrid>
          </FormSection>

          <FormSection title="Schedule" icon={<Clock className="w-5 h-5" />}>
            <FormGrid cols={2}>
              <div>
                <Label htmlFor="departureTime">Departure</Label>
                <Input
                  id="departureTime"
                  name="departureTime"
                  type="datetime-local"
                  value={formData.departureTime}
                  onChange={handleChange}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="estimatedArrival">Estimated arrival</Label>
                <Input
                  id="estimatedArrival"
                  name="estimatedArrival"
                  type="datetime-local"
                  value={formData.estimatedArrival}
                  onChange={handleChange}
                  className="mt-1"
                />
              </div>
            </FormGrid>
          </FormSection>

          <FormSection title="Costs (from trip planning)" icon={<DollarSign className="w-5 h-5" />}>
            <p className="text-sm text-muted-foreground mb-3">
              Miles, fuel, and tolls come from the same trip planning engine as loads—not manual guesses.
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              <Button type="button" variant="secondary" onClick={() => void applyTripPlanningEstimate()} disabled={isEstimating}>
                {isEstimating ? "Calculating…" : "Fill from trip planning"}
              </Button>
            </div>
            <FormGrid cols={2}>
              <div>
                <Label>Est. fuel ($)</Label>
                <Input
                  name="estimatedFuelCost"
                  type="number"
                  step="0.01"
                  value={formData.estimatedFuelCost}
                  onChange={handleChange}
                  className="mt-1 bg-muted/30"
                  readOnly
                  placeholder="—"
                />
              </div>
              <div>
                <Label>Est. tolls ($)</Label>
                <Input
                  name="estimatedTollCost"
                  type="number"
                  step="0.01"
                  value={formData.estimatedTollCost}
                  onChange={handleChange}
                  className="mt-1 bg-muted/30"
                  readOnly
                  placeholder="—"
                />
              </div>
              <div className="md:col-span-2">
                <Label>Total est. ($)</Label>
                <Input
                  name="totalEstimatedCost"
                  type="number"
                  step="0.01"
                  value={formData.totalEstimatedCost}
                  onChange={handleChange}
                  className="mt-1 bg-muted/30"
                  readOnly
                  placeholder="—"
                />
              </div>
            </FormGrid>
          </FormSection>

          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="outline" className="w-full justify-between">
                <span>Advanced — depot, permits, extra times</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-6 pt-4">
              <FormSection title="Depot (optional)" icon={<Building2 className="w-5 h-5" />}>
                <FormGrid cols={2}>
                  <div>
                    <Label htmlFor="depotName">Depot name</Label>
                    <Input id="depotName" name="depotName" value={formData.depotName} onChange={handleChange} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="depotAddress">Depot address</Label>
                    <Input id="depotAddress" name="depotAddress" value={formData.depotAddress} onChange={handleChange} className="mt-1" />
                  </div>
                </FormGrid>
              </FormSection>

              <FormSection title="Extra timing (optional)" icon={<Clock className="w-5 h-5" />}>
                <FormGrid cols={2}>
                  <div>
                    <Label htmlFor="preRouteTime">Pre-route (minutes)</Label>
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
                    <Label htmlFor="postRouteTime">Post-route (minutes)</Label>
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
                    <Label htmlFor="routeStartTime">Route start (time)</Label>
                    <Input id="routeStartTime" name="routeStartTime" type="time" value={formData.routeStartTime} onChange={handleChange} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="routeDepartureTime">Departure (time only, if not using schedule above)</Label>
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
                    <Label htmlFor="routeCompleteTime">Route complete (time)</Label>
                    <Input
                      id="routeCompleteTime"
                      name="routeCompleteTime"
                      type="time"
                      value={formData.routeCompleteTime}
                      onChange={handleChange}
                      className="mt-1"
                    />
                  </div>
                </FormGrid>
              </FormSection>

              <FormSection title="Details" icon={<Route className="w-5 h-5" />}>
                <FormGrid cols={2}>
                  <div>
                    <Label htmlFor="routeType">Route type</Label>
                    <Select value={formData.routeType} onValueChange={(value) => handleSelectChange("routeType", value)}>
                      <SelectTrigger className="mt-1 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="express">Express</SelectItem>
                        <SelectItem value="local">Local</SelectItem>
                        <SelectItem value="long-haul">Long haul</SelectItem>
                        <SelectItem value="regional">Regional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="requiresPermits">Requires permits</Label>
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
                    <Label htmlFor="scenario">Scenario</Label>
                    <Input id="scenario" name="scenario" value={formData.scenario} onChange={handleChange} className="mt-1" placeholder="e.g. delivery" />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="specialInstructions">Special instructions</Label>
                    <Textarea
                      id="specialInstructions"
                      name="specialInstructions"
                      value={formData.specialInstructions}
                      onChange={handleChange}
                      className="mt-1 min-h-24"
                      rows={3}
                    />
                  </div>
                </FormGrid>
              </FormSection>

              <FormSection title="Notes" icon={<FileText className="w-5 h-5" />}>
                <Textarea
                  id="notes"
                  name="notes"
                  placeholder="Anything else about this route…"
                  value={formData.notes}
                  onChange={handleChange}
                  className="min-h-24"
                  rows={4}
                />
              </FormSection>
            </CollapsibleContent>
          </Collapsible>
        </TabsContent>

        <TabsContent value="stops" className="space-y-6">
          <RouteStopsManager stops={stops} onStopsChange={setStops} />
        </TabsContent>

        <TabsContent value="assignment" className="space-y-6">
          <FormSection title="Assignment" icon={<User className="w-5 h-5" />}>
            <FormGrid cols={2}>
              <div>
                <Label htmlFor="driver">Assigned driver</Label>
                <Select value={formData.driver || "none"} onValueChange={(value) => handleSelectChange("driver", value === "none" ? "" : value)}>
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue placeholder="Optional" />
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
                <Label htmlFor="truck">Assigned truck</Label>
                <Select value={formData.truck || "none"} onValueChange={(value) => handleSelectChange("truck", value === "none" ? "" : value)}>
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {trucks.map((truck) => (
                      <SelectItem key={truck.id} value={truck.id}>
                        {truck.truck_number} — {truck.make} {truck.model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </FormGrid>
          </FormSection>
        </TabsContent>
      </Tabs>
    </FormPageLayout>
  )
}
