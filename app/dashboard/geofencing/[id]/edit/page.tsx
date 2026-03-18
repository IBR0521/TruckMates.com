"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { FormPageLayout } from "@/components/dashboard/form-page-layout"

import { getGeofence, updateGeofence } from "@/app/actions/geofencing"
import { getTrucks } from "@/app/actions/trucks"
import { getRoutes } from "@/app/actions/routes"
import { ALL_LOAD_STATUSES } from "@/lib/load-status"

export default function EditGeofencePage() {
  const params = useParams()
  const router = useRouter()
  const geofenceId = params.id as string

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const [geofence, setGeofence] = useState<any>(null)
  const [trucks, setTrucks] = useState<any[]>([])
  const [routes, setRoutes] = useState<any[]>([])

  const [formData, setFormData] = useState({
    name: "",
    description: "",
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
    auto_update_load_status: false,
    entry_load_status: "scheduled",
    exit_load_status: "delivered",
  })

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      try {
        const [geofenceResult, trucksResult, routesResult] = await Promise.all([
          getGeofence(geofenceId),
          getTrucks(),
          getRoutes(),
        ])

        if (geofenceResult.error) throw new Error(geofenceResult.error)

        setGeofence(geofenceResult.data)
        if (trucksResult.data) setTrucks(trucksResult.data)
        if (routesResult.data) setRoutes(routesResult.data)

        const g = geofenceResult.data
        setFormData({
          name: g?.name || "",
          description: g?.description || "",
          is_active: !!g?.is_active,
          alert_on_entry: g?.alert_on_entry !== false,
          alert_on_exit: g?.alert_on_exit !== false,
          alert_on_dwell: !!g?.alert_on_dwell,
          dwell_time_minutes: g?.dwell_time_minutes ? String(g.dwell_time_minutes) : "",
          assigned_trucks: Array.isArray(g?.assigned_trucks) ? g.assigned_trucks : [],
          assigned_routes: Array.isArray(g?.assigned_routes) ? g.assigned_routes : [],
          address: g?.address || "",
          city: g?.city || "",
          state: g?.state || "",
          zip_code: g?.zip_code || "",
          auto_update_load_status: !!g?.auto_update_load_status,
          entry_load_status: g?.entry_load_status || "scheduled",
          exit_load_status: g?.exit_load_status || "delivered",
        })
      } catch (e: any) {
        toast.error(e?.message || "Failed to load geofence")
        router.push("/dashboard/geofencing")
      } finally {
        setIsLoading(false)
      }
    }

    if (geofenceId) load()
  }, [geofenceId, router])

  const zoneTypeBadge = useMemo(() => {
    if (!geofence?.zone_type) return null
    return <Badge variant="outline">{geofence.zone_type}</Badge>
  }, [geofence?.zone_type])

  const handleSave = async () => {
    if (!geofence) return
    if (!formData.name.trim()) {
      toast.error("Zone name is required")
      return
    }

    setIsSaving(true)
    try {
      const dwellTimeMinutesRaw = formData.dwell_time_minutes
        ? Number.parseInt(formData.dwell_time_minutes, 10)
        : undefined
      const dwellTimeMinutes =
        dwellTimeMinutesRaw !== undefined && Number.isFinite(dwellTimeMinutesRaw)
          ? dwellTimeMinutesRaw
          : undefined

      const result = await updateGeofence(geofenceId, {
        name: formData.name.trim(),
        description: formData.description,
        is_active: formData.is_active,
        alert_on_entry: formData.alert_on_entry,
        alert_on_exit: formData.alert_on_exit,
        alert_on_dwell: formData.alert_on_dwell,
        // `updateGeofence` expects `dwell_time_minutes?: number` (no `null`).
        dwell_time_minutes: dwellTimeMinutes,
        assigned_trucks: formData.assigned_trucks.length > 0 ? formData.assigned_trucks : [],
        assigned_routes: formData.assigned_routes.length > 0 ? formData.assigned_routes : [],
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zip_code: formData.zip_code,

        // Optional: geofence->load status updates (backend supports it; UI exposes here).
        auto_update_load_status: formData.auto_update_load_status,
        entry_load_status: formData.entry_load_status,
        exit_load_status: formData.exit_load_status,
      })

      if (result.error) throw new Error(result.error)

      toast.success("Geofence updated")
      router.push(`/dashboard/geofencing/${encodeURIComponent(geofenceId)}`)
    } catch (e: any) {
      toast.error(e?.message || "Failed to save geofence")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <FormPageLayout
      title="Edit Geofence"
      subtitle={geofence?.description || "Update zone settings and alert rules"}
      backUrl={`/dashboard/geofencing/${encodeURIComponent(geofenceId)}`}
      isSubmitting={isSaving}
      submitLabel="Save Changes"
      onSubmit={(e) => {
        e.preventDefault()
        handleSave()
      }}
    >
      {isLoading ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">Loading geofence...</p>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="space-y-1">
                  <Label htmlFor="name">Zone Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Main Warehouse"
                    className="mt-2"
                  />
                </div>
                <div className="flex items-center gap-2">
                  {zoneTypeBadge}
                  <Badge variant={formData.is_active ? "default" : "secondary"}>
                    {formData.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Zone description"
                  className="mt-2"
                  rows={2}
                />
              </div>

              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_active: checked }))}
                  />
                  <Label htmlFor="is_active" className="cursor-pointer">
                    Active
                  </Label>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-sm font-semibold text-muted-foreground mb-4">Alert Settings</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="alert_on_entry"
                    checked={formData.alert_on_entry}
                    onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, alert_on_entry: checked }))}
                  />
                  <Label htmlFor="alert_on_entry" className="cursor-pointer">
                    Alert on Entry
                  </Label>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="alert_on_exit"
                    checked={formData.alert_on_exit}
                    onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, alert_on_exit: checked }))}
                  />
                  <Label htmlFor="alert_on_exit" className="cursor-pointer">
                    Alert on Exit
                  </Label>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="alert_on_dwell"
                    checked={formData.alert_on_dwell}
                    onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, alert_on_dwell: checked }))}
                  />
                  <Label htmlFor="alert_on_dwell" className="cursor-pointer">
                    Alert on Dwell
                  </Label>
                </div>
              </div>

              {formData.alert_on_dwell && (
                <div>
                  <Label htmlFor="dwell_time_minutes">Dwell Time (minutes)</Label>
                  <Input
                    id="dwell_time_minutes"
                    type="number"
                    value={formData.dwell_time_minutes}
                    onChange={(e) => setFormData((prev) => ({ ...prev, dwell_time_minutes: e.target.value }))}
                    placeholder="30"
                    className="mt-2"
                  />
                </div>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-sm font-semibold text-muted-foreground mb-4">Assignments</h3>
            <div className="space-y-6">
              <div>
                <Label>Assigned Trucks (Optional)</Label>
                <div className="mt-2 space-y-2 max-h-32 overflow-y-auto border rounded-lg p-2">
                  {trucks.map((truck) => (
                    <div key={truck.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`truck-${truck.id}`}
                        checked={formData.assigned_trucks.includes(truck.id)}
                        onCheckedChange={(checked) => {
                          setFormData((prev) => {
                            const current = new Set(prev.assigned_trucks)
                            if (checked) current.add(truck.id)
                            else current.delete(truck.id)
                            return { ...prev, assigned_trucks: Array.from(current) }
                          })
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
                          setFormData((prev) => {
                            const current = new Set(prev.assigned_routes)
                            if (checked) current.add(route.id)
                            else current.delete(route.id)
                            return { ...prev, assigned_routes: Array.from(current) }
                          })
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

          <Card className="p-6">
            <h3 className="text-sm font-semibold text-muted-foreground mb-4">Location + Optional Automations</h3>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                    placeholder="Street address"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
                    placeholder="City"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData((prev) => ({ ...prev, state: e.target.value }))}
                    placeholder="State"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="zip_code">ZIP Code</Label>
                  <Input
                    id="zip_code"
                    value={formData.zip_code}
                    onChange={(e) => setFormData((prev) => ({ ...prev, zip_code: e.target.value }))}
                    placeholder="ZIP"
                    className="mt-2"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="auto_update_load_status"
                    checked={formData.auto_update_load_status}
                    onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, auto_update_load_status: checked }))}
                  />
                  <Label htmlFor="auto_update_load_status" className="cursor-pointer">
                    Auto-update Load Status from Geofence
                  </Label>
                </div>

                {formData.auto_update_load_status && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="entry_load_status">Set status when entering</Label>
                      <Select
                        value={formData.entry_load_status}
                        onValueChange={(value) => setFormData((prev) => ({ ...prev, entry_load_status: value }))}
                      >
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ALL_LOAD_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="exit_load_status">Set status when exiting</Label>
                      <Select
                        value={formData.exit_load_status}
                        onValueChange={(value) => setFormData((prev) => ({ ...prev, exit_load_status: value }))}
                      >
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ALL_LOAD_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Geometry edits (circle/polygon/rectangle bounds) are done on the Fleet Map page. This screen edits behavior and assignments.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </FormPageLayout>
  )
}

