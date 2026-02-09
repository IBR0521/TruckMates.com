"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { FormPageLayout } from "@/components/dashboard/form-page-layout"
import { createGeofence } from "@/app/actions/geofencing"
import { getTrucks } from "@/app/actions/trucks"
import { getRoutes } from "@/app/actions/routes"
import { useEffect } from "react"

export default function AddGeofencePage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [trucks, setTrucks] = useState<any[]>([])
  const [routes, setRoutes] = useState<any[]>([])
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    zone_type: "circle",
    center_latitude: "",
    center_longitude: "",
    radius_meters: "",
    north_bound: "",
    south_bound: "",
    east_bound: "",
    west_bound: "",
    is_active: true,
    alert_on_entry: true,
    alert_on_exit: true,
    alert_on_dwell: false,
    dwell_time_minutes: "",
    assigned_trucks: [] as string[],
    assigned_routes: [] as string[],
    address: "",
    city: "",
    state: "",
    zip_code: "",
  })

  useEffect(() => {
    loadTrucks()
    loadRoutes()
  }, [])

  async function loadTrucks() {
    const result = await getTrucks()
    if (result.data) {
      setTrucks(result.data)
    }
  }

  async function loadRoutes() {
    const result = await getRoutes()
    if (result.data) {
      setRoutes(result.data)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name) {
      toast.error("Zone name is required")
      return
    }

    if (formData.zone_type === "circle") {
      if (!formData.center_latitude || !formData.center_longitude || !formData.radius_meters) {
        toast.error("Center coordinates and radius are required for circle zones")
        return
      }
    } else if (formData.zone_type === "rectangle") {
      if (!formData.north_bound || !formData.south_bound || !formData.east_bound || !formData.west_bound) {
        toast.error("All boundary coordinates are required for rectangle zones")
        return
      }
    }

    setIsSubmitting(true)
    const result = await createGeofence({
      name: formData.name,
      description: formData.description || undefined,
      zone_type: formData.zone_type,
      center_latitude: formData.center_latitude ? parseFloat(formData.center_latitude) : undefined,
      center_longitude: formData.center_longitude ? parseFloat(formData.center_longitude) : undefined,
      radius_meters: formData.radius_meters ? parseInt(formData.radius_meters) : undefined,
      north_bound: formData.north_bound ? parseFloat(formData.north_bound) : undefined,
      south_bound: formData.south_bound ? parseFloat(formData.south_bound) : undefined,
      east_bound: formData.east_bound ? parseFloat(formData.east_bound) : undefined,
      west_bound: formData.west_bound ? parseFloat(formData.west_bound) : undefined,
      is_active: formData.is_active,
      alert_on_entry: formData.alert_on_entry,
      alert_on_exit: formData.alert_on_exit,
      alert_on_dwell: formData.alert_on_dwell,
      dwell_time_minutes: formData.dwell_time_minutes ? parseInt(formData.dwell_time_minutes) : undefined,
      assigned_trucks: formData.assigned_trucks.length > 0 ? formData.assigned_trucks : undefined,
      assigned_routes: formData.assigned_routes.length > 0 ? formData.assigned_routes : undefined,
      address: formData.address || undefined,
      city: formData.city || undefined,
      state: formData.state || undefined,
      zip_code: formData.zip_code || undefined,
    })

    setIsSubmitting(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Geofence zone created successfully")
      router.push("/dashboard/geofencing")
    }
  }

  return (
    <FormPageLayout
      title="Create Geofence Zone"
      subtitle="Define a location zone for vehicle tracking and alerts"
      backUrl="/dashboard/geofencing"
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      submitLabel="Create Zone"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Zone Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Main Warehouse"
                  className="mt-2"
                  required
                />
              </div>

              <div>
                <Label htmlFor="zone_type">Zone Type *</Label>
                <Select
                  value={formData.zone_type}
                  onValueChange={(value) => setFormData({ ...formData, zone_type: value })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="circle">Circle</SelectItem>
                    <SelectItem value="rectangle">Rectangle</SelectItem>
                    <SelectItem value="polygon">Polygon</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Zone description"
                className="mt-2"
                rows={2}
              />
            </div>

            {formData.zone_type === "circle" && (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="center_latitude">Center Latitude *</Label>
                  <Input
                    id="center_latitude"
                    type="number"
                    step="any"
                    value={formData.center_latitude}
                    onChange={(e) => setFormData({ ...formData, center_latitude: e.target.value })}
                    placeholder="37.7749"
                    className="mt-2"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="center_longitude">Center Longitude *</Label>
                  <Input
                    id="center_longitude"
                    type="number"
                    step="any"
                    value={formData.center_longitude}
                    onChange={(e) => setFormData({ ...formData, center_longitude: e.target.value })}
                    placeholder="-122.4194"
                    className="mt-2"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="radius_meters">Radius (meters) *</Label>
                  <Input
                    id="radius_meters"
                    type="number"
                    value={formData.radius_meters}
                    onChange={(e) => setFormData({ ...formData, radius_meters: e.target.value })}
                    placeholder="1000"
                    className="mt-2"
                    required
                  />
                  {formData.radius_meters && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {(parseFloat(formData.radius_meters) / 1000).toFixed(2)} km
                    </p>
                  )}
                </div>
              </div>
            )}

            {formData.zone_type === "rectangle" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="north_bound">North Bound *</Label>
                  <Input
                    id="north_bound"
                    type="number"
                    step="any"
                    value={formData.north_bound}
                    onChange={(e) => setFormData({ ...formData, north_bound: e.target.value })}
                    className="mt-2"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="south_bound">South Bound *</Label>
                  <Input
                    id="south_bound"
                    type="number"
                    step="any"
                    value={formData.south_bound}
                    onChange={(e) => setFormData({ ...formData, south_bound: e.target.value })}
                    className="mt-2"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="east_bound">East Bound *</Label>
                  <Input
                    id="east_bound"
                    type="number"
                    step="any"
                    value={formData.east_bound}
                    onChange={(e) => setFormData({ ...formData, east_bound: e.target.value })}
                    className="mt-2"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="west_bound">West Bound *</Label>
                  <Input
                    id="west_bound"
                    type="number"
                    step="any"
                    value={formData.west_bound}
                    onChange={(e) => setFormData({ ...formData, west_bound: e.target.value })}
                    className="mt-2"
                    required
                  />
                </div>
              </div>
            )}

            {formData.zone_type === "polygon" && (
              <div className="p-4 bg-secondary/30 rounded-lg border border-border">
                <p className="text-sm text-muted-foreground">
                  Polygon zones can be created on the Fleet Map page. Use the map interface to draw polygon boundaries.
                </p>
                <Link href="/dashboard/fleet-map">
                  <Button variant="outline" className="mt-2">
                    Open Fleet Map
                  </Button>
                </Link>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street address"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="City"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  placeholder="State"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="zip_code">ZIP Code</Label>
                <Input
                  id="zip_code"
                  value={formData.zip_code}
                  onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                  placeholder="ZIP"
                  className="mt-2"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Switch
                  id="alert_on_entry"
                  checked={formData.alert_on_entry}
                  onCheckedChange={(checked) => setFormData({ ...formData, alert_on_entry: checked })}
                />
                <Label htmlFor="alert_on_entry" className="cursor-pointer">
                  Alert on Entry
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="alert_on_exit"
                  checked={formData.alert_on_exit}
                  onCheckedChange={(checked) => setFormData({ ...formData, alert_on_exit: checked })}
                />
                <Label htmlFor="alert_on_exit" className="cursor-pointer">
                  Alert on Exit
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="alert_on_dwell"
                  checked={formData.alert_on_dwell}
                  onCheckedChange={(checked) => setFormData({ ...formData, alert_on_dwell: checked })}
                />
                <Label htmlFor="alert_on_dwell" className="cursor-pointer">
                  Alert on Dwell (Extended Stay)
                </Label>
              </div>

              {formData.alert_on_dwell && (
                <div>
                  <Label htmlFor="dwell_time_minutes">Dwell Time (minutes)</Label>
                  <Input
                    id="dwell_time_minutes"
                    type="number"
                    value={formData.dwell_time_minutes}
                    onChange={(e) => setFormData({ ...formData, dwell_time_minutes: e.target.value })}
                    placeholder="30"
                    className="mt-2"
                  />
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active" className="cursor-pointer">
                  Active
                </Label>
              </div>
            </div>

            <div>
              <Label>Assigned Trucks (Optional)</Label>
              <div className="mt-2 space-y-2 max-h-32 overflow-y-auto border rounded-lg p-2">
                {trucks.map((truck) => (
                  <div key={truck.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`truck-${truck.id}`}
                      checked={formData.assigned_trucks.includes(truck.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData({
                            ...formData,
                            assigned_trucks: [...formData.assigned_trucks, truck.id],
                          })
                        } else {
                          setFormData({
                            ...formData,
                            assigned_trucks: formData.assigned_trucks.filter((id) => id !== truck.id),
                          })
                        }
                      }}
                    />
                    <Label htmlFor={`truck-${truck.id}`} className="cursor-pointer">
                      {truck.truck_number} - {truck.make} {truck.model}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Assigned Routes (Optional)</Label>
              <div className="mt-2 space-y-2 max-h-32 overflow-y-auto border rounded-lg p-2">
                {routes.map((route) => (
                  <div key={route.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`route-${route.id}`}
                      checked={formData.assigned_routes.includes(route.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData({
                            ...formData,
                            assigned_routes: [...formData.assigned_routes, route.id],
                          })
                        } else {
                          setFormData({
                            ...formData,
                            assigned_routes: formData.assigned_routes.filter((id) => id !== route.id),
                          })
                        }
                      }}
                    />
                    <Label htmlFor={`route-${route.id}`} className="cursor-pointer">
                      {route.name} - {route.origin} to {route.destination}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/dashboard/geofencing")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || formData.zone_type === "polygon"}>
            {isSubmitting ? "Creating..." : "Create Zone"}
          </Button>
        </div>
      </form>
    </FormPageLayout>
  )
}


