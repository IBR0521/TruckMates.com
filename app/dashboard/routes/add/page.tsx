"use client"

import type React from "react"
import { errorMessage } from "@/lib/error-message"
import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Route, User } from "lucide-react"
import { toast } from "sonner"
import { createRoute } from "@/app/actions/routes"
import { getTripPlanningEstimate } from "@/app/actions/promiles"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { getDrivers } from "@/app/actions/drivers"
import { getTrucks } from "@/app/actions/trucks"
import { RouteStopsManager } from "@/components/route-stops-manager"
import { createRouteStop } from "@/app/actions/route-stops"
import { FormPageLayout, FormSection, FormGrid } from "@/components/dashboard/form-page-layout"
import { GoogleMapsRoute } from "@/components/google-maps-route"
import { Check, AlertTriangle, ChevronLeft, ChevronRight, Sparkles } from "lucide-react"

function timeFromDateTimeLocal(dt: string): string | undefined {
  if (!dt || !dt.includes("T")) return undefined
  const t = dt.split("T")[1]
  if (!t) return undefined
  const [h, m] = t.split(":")
  if (h == null || m == null) return undefined
  return `${h.padStart(2, "0")}:${m.slice(0, 2)}:00`
}

export default function AddRoutePage() {
  const wizardSteps = [
    { key: "basic", label: "Basic Info", required: true },
    { key: "stops", label: "Stops", required: false },
    { key: "assignment", label: "Assignment", required: false },
  ] as const
  type WizardStepKey = (typeof wizardSteps)[number]["key"]

  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isEstimating, setIsEstimating] = useState(false)
  const [drivers, setDrivers] = useState<any[]>([])
  const [trucks, setTrucks] = useState<any[]>([])
  const [stops, setStops] = useState<any[]>([])
  const [activeStep, setActiveStep] = useState<WizardStepKey>("basic")
  const [autoNameEnabled, setAutoNameEnabled] = useState(true)
  const [assignLater, setAssignLater] = useState(false)

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

  useEffect(() => {
    if (!autoNameEnabled) return
    const origin = formData.origin.trim()
    const destination = formData.destination.trim()
    if (!origin || !destination) return
    const shortOrigin = origin.split(",")[0]?.trim() || origin
    const shortDestination = destination.split(",")[0]?.trim() || destination
    setFormData((prev) => {
      if (prev.name.trim()) return prev
      return { ...prev, name: `${shortOrigin} → ${shortDestination}` }
    })
  }, [formData.origin, formData.destination, autoNameEnabled])

  useEffect(() => {
    if (!formData.origin.trim() || !formData.destination.trim()) return
    const t = setTimeout(() => {
      void applyTripPlanningEstimate({ silent: true })
    }, 700)
    return () => clearTimeout(t)
  }, [formData.origin, formData.destination])

  const applyTripPlanningEstimate = async (options?: { silent?: boolean }) => {
    if (!formData.origin?.trim() || !formData.destination?.trim()) {
      if (!options?.silent) toast.error("Enter origin and destination first.")
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
        if (!options?.silent) toast.error(res.error || "Could not calculate route estimate.")
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
      if (!options?.silent) toast.success("Distance, time, fuel & tolls filled from trip planning.")
    } catch {
      if (!options?.silent) toast.error("Trip planning failed.")
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

    const depTime = timeFromDateTimeLocal(formData.departureTime) || undefined
    const routeName =
      formData.name.trim() ||
      `${formData.origin.split(",")[0]?.trim() || formData.origin} → ${formData.destination.split(",")[0]?.trim() || formData.destination}`

    const result = await createRoute({
      name: routeName,
      origin: formData.origin,
      destination: formData.destination,
      distance: formData.distance || undefined,
      estimated_time: formData.estimatedTime || undefined,
      priority: formData.priority,
      status: "pending",
      driver_id: assignLater ? undefined : formData.driver || undefined,
      truck_id: assignLater ? undefined : formData.truck || undefined,
      depot_name: undefined,
      depot_address: undefined,
      pre_route_time_minutes: undefined,
      post_route_time_minutes: undefined,
      route_start_time: undefined,
      route_departure_time: depTime,
      route_complete_time: undefined,
      route_type: undefined,
      scenario: undefined,
      estimated_arrival: formData.estimatedArrival
        ? new Date(formData.estimatedArrival).toISOString()
        : undefined,
      special_instructions: undefined,
      notes: undefined,
      estimated_fuel_cost: undefined,
      estimated_toll_cost: undefined,
      total_estimated_cost: undefined,
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
        const msg = error instanceof Error ? errorMessage(error) : "Unknown error"
        toast.error(`Route created but failed to add some stops: ${msg}`)
      }
    } else {
      toast.success("Route added successfully")
    }

    setIsSubmitting(false)
    router.push(`/dashboard/routes/${result.data?.id || ""}`)
  }

  const stepErrors: Record<WizardStepKey, string[]> = {
    basic: [
      ...(formData.origin.trim() ? [] : ["Origin is required"]),
      ...(formData.destination.trim() ? [] : ["Destination is required"]),
    ],
    stops: [],
    assignment: [],
  }

  const currentStepIndex = wizardSteps.findIndex((step) => step.key === activeStep)
  const isFinalStep = currentStepIndex === wizardSteps.length - 1

  const goToStep = (target: WizardStepKey) => {
    setActiveStep(target)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleNextStep = () => {
    if (stepErrors[activeStep].length > 0) {
      toast.error(stepErrors[activeStep][0] || "Please complete required fields")
      return
    }
    const next = wizardSteps[currentStepIndex + 1]
    if (next) goToStep(next.key)
  }

  const handleBackStep = () => {
    const prev = wizardSteps[currentStepIndex - 1]
    if (prev) goToStep(prev.key)
  }

  return (
    <FormPageLayout
      title="Add New Route"
      subtitle="Keep it simple: corridor, stops, and who’s on it. Use trip planning for miles and costs."
      backUrl="/dashboard/routes"
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      submitLabel="Add Route"
      showDefaultSubmitBar={false}
      footerActions={
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm text-muted-foreground">Step {currentStepIndex + 1} of {wizardSteps.length}</div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/routes">
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
            <Button type="button" variant="outline" onClick={handleBackStep} disabled={currentStepIndex === 0}>
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            {!isFinalStep ? (
              <Button type="button" onClick={handleNextStep}>
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Adding..." : "Add Route"}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <Tabs value={activeStep} onValueChange={(value) => goToStep(value as WizardStepKey)} className="space-y-6">
        <div className="sticky top-[108px] z-20 space-y-3">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${((currentStepIndex + 1) / wizardSteps.length) * 100}%` }}
            />
          </div>
          <TabsList className="grid w-full grid-cols-3 bg-card/95 backdrop-blur border border-border/60 h-auto py-1">
            {wizardSteps.map((step) => {
              const hasErrors = stepErrors[step.key].length > 0
              const completed = !hasErrors && wizardSteps.findIndex((s) => s.key === step.key) < currentStepIndex
              return (
                <TabsTrigger key={step.key} value={step.key} className="text-xs md:text-sm py-2">
                  <span className="inline-flex items-center gap-1.5">
                    {completed ? (
                      <Check className="w-3.5 h-3.5 text-green-500" />
                    ) : hasErrors ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-border/80 inline-block" />
                    )}
                    {step.label}
                  </span>
                </TabsTrigger>
              )
            })}
          </TabsList>
        </div>

        <TabsContent value="basic" className="space-y-6">
          <FormSection title="Route planning" icon={<Route className="w-5 h-5" />}>
            <FormGrid cols={2}>
              <div className="md:col-span-2">
                <Label htmlFor="name">Route name *</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="name"
                    name="name"
                    placeholder="NY-PA corridor"
                    value={formData.name}
                    onChange={(e) => {
                      if (autoNameEnabled) setAutoNameEnabled(false)
                      handleChange(e)
                    }}
                    className="flex-1"
                    required
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setAutoNameEnabled(true)
                      const shortOrigin = formData.origin.split(",")[0]?.trim() || formData.origin
                      const shortDestination = formData.destination.split(",")[0]?.trim() || formData.destination
                      if (shortOrigin && shortDestination) {
                        setFormData((prev) => ({ ...prev, name: `${shortOrigin} → ${shortDestination}` }))
                      }
                    }}
                  >
                    Auto Name
                  </Button>
                </div>
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
              <div className="md:col-span-2 flex items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/10 px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  Distance and drive time are auto-calculated via Google Maps estimate when origin and destination are set.
                </p>
                <Button type="button" variant="outline" size="sm" onClick={() => void applyTripPlanningEstimate()} disabled={isEstimating}>
                  {isEstimating ? "Calculating..." : "Calculate"}
                </Button>
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
                <p className="text-[11px] text-muted-foreground mt-1">
                  {formData.origin && formData.destination ? "via Google Maps estimate" : "Enter origin and destination to auto-calculate"}
                </p>
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
                <p className="text-[11px] text-muted-foreground mt-1">
                  {formData.origin && formData.destination ? "via Google Maps estimate" : "Enter origin and destination to auto-calculate"}
                </p>
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
                <Label htmlFor="status">Status</Label>
                <Input id="status" value="Pending (new routes start as pending)" className="mt-1 bg-muted/30" readOnly />
              </div>
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
              <div className="md:col-span-2">
                <div className="h-[320px] rounded-lg border border-border/60 overflow-hidden">
                  <GoogleMapsRoute
                    origin={formData.origin}
                    destination={formData.destination}
                    stops={stops}
                    showNavigationButton={false}
                  />
                </div>
              </div>
            </FormGrid>
          </FormSection>
          <Card className="border-border/60 bg-muted/10 p-4">
            <p className="text-xs text-muted-foreground">
              Advanced settings (costs, depot, permits, notes) can be edited after creation from Route Details.
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="stops" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              <FormSection title="Route flow" icon={<Route className="w-5 h-5" />}>
                <div className="space-y-3">
                  <div className="rounded-md border border-border/60 bg-muted/10 p-3 text-sm">
                    <p className="text-muted-foreground mb-2">Route timeline</p>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" />
                        <div>
                          <p className="font-medium text-foreground">{formData.origin || "Set origin in Basic Info"}</p>
                          <p className="text-xs text-muted-foreground">Origin</p>
                        </div>
                      </div>
                      {stops.map((stop, idx) => (
                        <div key={`flow-${idx}`} className="ml-[5px] border-l border-border/70 pl-4 py-1">
                          <p className="text-foreground">Stop {idx + 1}: {stop.location_name || stop.address || "Unnamed stop"}</p>
                        </div>
                      ))}
                      <div className="flex items-start gap-2">
                        <span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        <div>
                          <p className="font-medium text-foreground">{formData.destination || "Set destination in Basic Info"}</p>
                          <p className="text-xs text-muted-foreground">Destination</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      Use stops for multi-stop routes. You can optimize stop order before final save.
                    </p>
                    <Link href="/dashboard/routes/optimize">
                      <Button type="button" variant="outline" size="sm">
                        <Sparkles className="w-4 h-4 mr-2" />
                        Optimize stop order
                      </Button>
                    </Link>
                  </div>
                </div>
              </FormSection>

              <RouteStopsManager stops={stops} onStopsChange={setStops} />
            </div>

            <div className="lg:sticky lg:top-[140px] h-fit">
              <FormSection title="Map preview" icon={<Route className="w-5 h-5" />}>
                <div className="h-[560px] rounded-lg border border-border/60 overflow-hidden">
                  <GoogleMapsRoute
                    origin={formData.origin}
                    destination={formData.destination}
                    stops={stops}
                    showNavigationButton={false}
                  />
                </div>
              </FormSection>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="assignment" className="space-y-6">
          <FormSection title="Assignment" icon={<User className="w-5 h-5" />}>
            <FormGrid cols={2}>
              <div className="md:col-span-2 rounded-md border border-border/60 bg-muted/10 p-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="assign-later"
                    checked={assignLater}
                    onCheckedChange={(checked) => setAssignLater(Boolean(checked))}
                  />
                  <Label htmlFor="assign-later" className="cursor-pointer">Assign later</Label>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  If enabled, this route will be created unassigned and show up in Dispatch Board queue.
                </p>
              </div>
              <div>
                <Label htmlFor="driver">Assigned driver</Label>
                <Select
                  value={formData.driver || "none"}
                  onValueChange={(value) => handleSelectChange("driver", value === "none" ? "" : value)}
                  disabled={assignLater}
                >
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {drivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        {driver.name} — {driver.hos_status || driver.status || "Unknown"}{" "}
                        {typeof driver.remaining_drive_hours === "number" ? `· ${driver.remaining_drive_hours.toFixed(1)}h remaining` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="truck">Assigned truck</Label>
                <Select
                  value={formData.truck || "none"}
                  onValueChange={(value) => handleSelectChange("truck", value === "none" ? "" : value)}
                  disabled={assignLater}
                >
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {trucks.map((truck) => (
                      <SelectItem key={truck.id} value={truck.id}>
                        {truck.truck_number} — {truck.status === "available" ? "Available" : truck.status === "in_use" ? "In Use" : truck.status || "Unknown"}
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
