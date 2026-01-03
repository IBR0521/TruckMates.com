"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { getCompanySettings, updateCompanySettings } from "@/app/actions/number-formats"
import { Save, Package, Info, DollarSign, Settings, Route, Truck } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"

export default function LoadSettingsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [settings, setSettings] = useState({
    // Number Format
    load_number_format: "LOAD-{YEAR}-{SEQUENCE}",
    load_number_sequence: 1,
    
    // Default Settings
    default_load_type: "ftl",
    default_carrier_type: "dry-van",
    auto_create_route: true,
    
    // Pricing Defaults
    default_rate_per_mile: 0,
    default_rate_per_hour: 0,
    default_fuel_surcharge_percentage: 0,
    default_accessorial_charges: "",
    
    // Units
    weight_unit: "lbs", // 'lbs' or 'kg'
    distance_unit: "miles", // 'miles' or 'km'
    temperature_unit: "fahrenheit", // 'fahrenheit' or 'celsius'
    
    // Workflow
    default_status: "pending",
    auto_assign_driver: false,
    auto_assign_truck: false,
    require_bol_before_dispatch: false,
    require_documents_before_dispatch: false,
    
    // Auto-Assignment Rules
    assignment_priority: "proximity", // 'proximity', 'availability', 'experience', 'manual'
    consider_driver_hours: true,
    consider_truck_maintenance: true,
    max_distance_for_auto_assign: 50, // miles
    
    // Status Workflow
    allow_status_skip: false,
    required_statuses: ["pending", "scheduled", "in_transit", "delivered"],
    
    // Notifications
    notify_on_load_created: true,
    notify_on_status_change: true,
    notify_on_delivery: true,
    notify_driver_on_assignment: true,
    
    // Route Settings
    auto_optimize_route: false,
    route_optimization_method: "distance", // 'distance', 'time', 'cost'
    allow_multi_stop: true,
    max_stops_per_route: 10,
  })
  const [previewNumber, setPreviewNumber] = useState("")

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (settings.load_number_format) {
      const now = new Date()
      const year = now.getFullYear()
      const sequence = String(settings.load_number_sequence).padStart(4, '0')
      
      let preview = settings.load_number_format
        .replace(/{YEAR}/g, String(year))
        .replace(/{MONTH}/g, String(now.getMonth() + 1).padStart(2, '0'))
        .replace(/{DAY}/g, String(now.getDate()).padStart(2, '0'))
        .replace(/{SEQUENCE}/g, sequence)
        .replace(/{COMPANY}/g, "COMP")
      
      setPreviewNumber(preview)
    }
  }, [settings.load_number_format, settings.load_number_sequence])

  async function loadData() {
    setIsLoading(true)
    try {
      const result = await getCompanySettings()
      if (result.data) {
        setSettings({
          load_number_format: result.data.load_number_format || "LOAD-{YEAR}-{SEQUENCE}",
          load_number_sequence: result.data.load_number_sequence || 1,
          default_load_type: result.data.default_load_type || "ftl",
          default_carrier_type: result.data.default_carrier_type || "dry-van",
          auto_create_route: result.data.auto_create_route !== false,
          default_rate_per_mile: result.data.default_rate_per_mile || 0,
          default_rate_per_hour: result.data.default_rate_per_hour || 0,
          default_fuel_surcharge_percentage: result.data.default_fuel_surcharge_percentage || 0,
          default_accessorial_charges: result.data.default_accessorial_charges || "",
          weight_unit: result.data.weight_unit || "lbs",
          distance_unit: result.data.distance_unit || "miles",
          temperature_unit: result.data.temperature_unit || "fahrenheit",
          default_status: result.data.default_status || "pending",
          auto_assign_driver: result.data.auto_assign_driver || false,
          auto_assign_truck: result.data.auto_assign_truck || false,
          require_bol_before_dispatch: result.data.require_bol_before_dispatch || false,
          require_documents_before_dispatch: result.data.require_documents_before_dispatch || false,
          assignment_priority: result.data.assignment_priority || "proximity",
          consider_driver_hours: result.data.consider_driver_hours !== false,
          consider_truck_maintenance: result.data.consider_truck_maintenance !== false,
          max_distance_for_auto_assign: result.data.max_distance_for_auto_assign || 50,
          allow_status_skip: result.data.allow_status_skip || false,
          required_statuses: result.data.required_statuses || ["pending", "scheduled", "in_transit", "delivered"],
          notify_on_load_created: result.data.notify_on_load_created !== false,
          notify_on_status_change: result.data.notify_on_status_change !== false,
          notify_on_delivery: result.data.notify_on_delivery !== false,
          notify_driver_on_assignment: result.data.notify_driver_on_assignment !== false,
          auto_optimize_route: result.data.auto_optimize_route || false,
          route_optimization_method: result.data.route_optimization_method || "distance",
          allow_multi_stop: result.data.allow_multi_stop !== false,
          max_stops_per_route: result.data.max_stops_per_route || 10,
        })
      }
    } catch (error: any) {
      toast.error("Failed to load settings")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      const result = await updateCompanySettings(settings)

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Load settings updated")
      }
    } catch (error: any) {
      toast.error("Failed to save settings")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-border bg-card/50 backdrop-blur px-8 py-4">
          <h1 className="text-2xl font-bold text-foreground">Load Settings</h1>
        </div>
        <main className="flex-1 overflow-auto p-8">
          <div className="text-center py-8">Loading...</div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="border-b border-border bg-card/50 backdrop-blur px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Load Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure load numbering, defaults, pricing, workflow, and automation</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="bg-primary hover:bg-primary/90">
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Load Number Format */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Package className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Load Number Format</h2>
            </div>
            
            <Alert className="mb-6">
              <Info className="w-4 h-4" />
              <AlertDescription>
                Use tokens: <code className="px-1 py-0.5 bg-muted rounded">{`{YEAR}`}</code>, <code className="px-1 py-0.5 bg-muted rounded">{`{MONTH}`}</code>, <code className="px-1 py-0.5 bg-muted rounded">{`{DAY}`}</code>, <code className="px-1 py-0.5 bg-muted rounded">{`{SEQUENCE}`}</code>, <code className="px-1 py-0.5 bg-muted rounded">{`{COMPANY}`}</code>
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div>
                <Label htmlFor="load_format">Format Pattern</Label>
                <Input
                  id="load_format"
                  value={settings.load_number_format}
                  onChange={(e) => setSettings({ ...settings, load_number_format: e.target.value })}
                  placeholder="LOAD-{YEAR}-{SEQUENCE}"
                  className="mt-2 font-mono"
                />
              </div>
              
              <div>
                <Label htmlFor="load_sequence">Starting Sequence Number</Label>
                <Input
                  id="load_sequence"
                  type="number"
                  value={settings.load_number_sequence}
                  onChange={(e) => setSettings({ ...settings, load_number_sequence: parseInt(e.target.value) || 1 })}
                  className="mt-2"
                  min="1"
                />
              </div>

              <div>
                <Label>Preview</Label>
                <div className="mt-2 p-3 bg-muted rounded-md font-mono text-sm">
                  {previewNumber || "LOAD-2024-0001"}
                </div>
              </div>
            </div>
          </Card>

          {/* Default Settings */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Settings className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Default Settings</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="load_type">Default Load Type</Label>
                <Select value={settings.default_load_type} onValueChange={(value) => setSettings({ ...settings, default_load_type: value })}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ftl">Full Truckload (FTL)</SelectItem>
                    <SelectItem value="ltl">Less Than Truckload (LTL)</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="intermodal">Intermodal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="carrier_type">Default Carrier Type</Label>
                <Select value={settings.default_carrier_type} onValueChange={(value) => setSettings({ ...settings, default_carrier_type: value })}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dry-van">Dry Van</SelectItem>
                    <SelectItem value="reefer">Reefer</SelectItem>
                    <SelectItem value="flatbed">Flatbed</SelectItem>
                    <SelectItem value="step-deck">Step Deck</SelectItem>
                    <SelectItem value="box-truck">Box Truck</SelectItem>
                    <SelectItem value="hotshot">Hotshot</SelectItem>
                    <SelectItem value="specialized">Specialized</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="default_status">Default Status</Label>
                <Select value={settings.default_status} onValueChange={(value) => setSettings({ ...settings, default_status: value })}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="in_transit">In Transit</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="auto_route">Auto-Create Routes</Label>
                  <p className="text-sm text-muted-foreground">Automatically create routes when loads are created</p>
                </div>
                <Switch
                  id="auto_route"
                  checked={settings.auto_create_route}
                  onCheckedChange={(checked) => setSettings({ ...settings, auto_create_route: checked })}
                />
              </div>
            </div>
          </Card>

          {/* Pricing Defaults */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <DollarSign className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Pricing Defaults</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="rate_per_mile">Default Rate Per Mile ($)</Label>
                <Input
                  id="rate_per_mile"
                  type="number"
                  step="0.01"
                  value={settings.default_rate_per_mile}
                  onChange={(e) => setSettings({ ...settings, default_rate_per_mile: parseFloat(e.target.value) || 0 })}
                  className="mt-2"
                  min="0"
                />
              </div>

              <div>
                <Label htmlFor="rate_per_hour">Default Rate Per Hour ($)</Label>
                <Input
                  id="rate_per_hour"
                  type="number"
                  step="0.01"
                  value={settings.default_rate_per_hour}
                  onChange={(e) => setSettings({ ...settings, default_rate_per_hour: parseFloat(e.target.value) || 0 })}
                  className="mt-2"
                  min="0"
                />
              </div>

              <div>
                <Label htmlFor="fuel_surcharge">Default Fuel Surcharge (%)</Label>
                <Input
                  id="fuel_surcharge"
                  type="number"
                  step="0.01"
                  value={settings.default_fuel_surcharge_percentage}
                  onChange={(e) => setSettings({ ...settings, default_fuel_surcharge_percentage: parseFloat(e.target.value) || 0 })}
                  className="mt-2"
                  min="0"
                  max="100"
                />
              </div>

              <div>
                <Label htmlFor="accessorial">Default Accessorial Charges</Label>
                <Input
                  id="accessorial"
                  value={settings.default_accessorial_charges}
                  onChange={(e) => setSettings({ ...settings, default_accessorial_charges: e.target.value })}
                  placeholder="Lumper, Detention, etc."
                  className="mt-2"
                />
                <p className="text-sm text-muted-foreground mt-1">Comma-separated list of default accessorial charges</p>
              </div>
            </div>
          </Card>

          {/* Units */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Settings className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Measurement Units</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="weight_unit">Weight Unit</Label>
                <Select value={settings.weight_unit} onValueChange={(value) => setSettings({ ...settings, weight_unit: value })}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lbs">Pounds (lbs)</SelectItem>
                    <SelectItem value="kg">Kilograms (kg)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="distance_unit">Distance Unit</Label>
                <Select value={settings.distance_unit} onValueChange={(value) => setSettings({ ...settings, distance_unit: value })}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="miles">Miles</SelectItem>
                    <SelectItem value="km">Kilometers (km)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="temperature_unit">Temperature Unit</Label>
                <Select value={settings.temperature_unit} onValueChange={(value) => setSettings({ ...settings, temperature_unit: value })}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fahrenheit">Fahrenheit (°F)</SelectItem>
                    <SelectItem value="celsius">Celsius (°C)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {/* Workflow Settings */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Settings className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Workflow Settings</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="require_bol">Require BOL Before Dispatch</Label>
                  <p className="text-sm text-muted-foreground">Prevent dispatching loads without BOL</p>
                </div>
                <Switch
                  id="require_bol"
                  checked={settings.require_bol_before_dispatch}
                  onCheckedChange={(checked) => setSettings({ ...settings, require_bol_before_dispatch: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="require_docs">Require Documents Before Dispatch</Label>
                  <p className="text-sm text-muted-foreground">Prevent dispatching loads without required documents</p>
                </div>
                <Switch
                  id="require_docs"
                  checked={settings.require_documents_before_dispatch}
                  onCheckedChange={(checked) => setSettings({ ...settings, require_documents_before_dispatch: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="allow_skip">Allow Status Skip</Label>
                  <p className="text-sm text-muted-foreground">Allow skipping statuses in workflow</p>
                </div>
                <Switch
                  id="allow_skip"
                  checked={settings.allow_status_skip}
                  onCheckedChange={(checked) => setSettings({ ...settings, allow_status_skip: checked })}
                />
              </div>
            </div>
          </Card>

          {/* Auto-Assignment */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Truck className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Auto-Assignment Rules</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="auto_driver">Auto-Assign Driver</Label>
                  <p className="text-sm text-muted-foreground">Automatically assign driver based on rules</p>
                </div>
                <Switch
                  id="auto_driver"
                  checked={settings.auto_assign_driver}
                  onCheckedChange={(checked) => setSettings({ ...settings, auto_assign_driver: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="auto_truck">Auto-Assign Truck</Label>
                  <p className="text-sm text-muted-foreground">Automatically assign truck based on rules</p>
                </div>
                <Switch
                  id="auto_truck"
                  checked={settings.auto_assign_truck}
                  onCheckedChange={(checked) => setSettings({ ...settings, auto_assign_truck: checked })}
                />
              </div>

              {settings.auto_assign_driver || settings.auto_assign_truck ? (
                <>
                  <Separator />
                  
                  <div>
                    <Label htmlFor="assignment_priority">Assignment Priority</Label>
                    <Select value={settings.assignment_priority} onValueChange={(value) => setSettings({ ...settings, assignment_priority: value })}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="proximity">Proximity to Pickup</SelectItem>
                        <SelectItem value="availability">Availability</SelectItem>
                        <SelectItem value="experience">Experience with Route</SelectItem>
                        <SelectItem value="manual">Manual Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="consider_hours">Consider Driver Hours</Label>
                      <p className="text-sm text-muted-foreground">Check driver HOS availability</p>
                    </div>
                    <Switch
                      id="consider_hours"
                      checked={settings.consider_driver_hours}
                      onCheckedChange={(checked) => setSettings({ ...settings, consider_driver_hours: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="consider_maintenance">Consider Truck Maintenance</Label>
                      <p className="text-sm text-muted-foreground">Check truck maintenance schedule</p>
                    </div>
                    <Switch
                      id="consider_maintenance"
                      checked={settings.consider_truck_maintenance}
                      onCheckedChange={(checked) => setSettings({ ...settings, consider_truck_maintenance: checked })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="max_distance">Max Distance for Auto-Assign (miles)</Label>
                    <Input
                      id="max_distance"
                      type="number"
                      value={settings.max_distance_for_auto_assign}
                      onChange={(e) => setSettings({ ...settings, max_distance_for_auto_assign: parseInt(e.target.value) || 50 })}
                      className="mt-2"
                      min="0"
                    />
                    <p className="text-sm text-muted-foreground mt-1">Maximum distance from pickup for auto-assignment</p>
                  </div>
                </>
              ) : null}
            </div>
          </Card>

          {/* Route Settings */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Route className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Route Settings</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="auto_optimize">Auto-Optimize Routes</Label>
                  <p className="text-sm text-muted-foreground">Automatically optimize route order</p>
                </div>
                <Switch
                  id="auto_optimize"
                  checked={settings.auto_optimize_route}
                  onCheckedChange={(checked) => setSettings({ ...settings, auto_optimize_route: checked })}
                />
              </div>

              {settings.auto_optimize_route && (
                <div>
                  <Label htmlFor="optimization_method">Optimization Method</Label>
                  <Select value={settings.route_optimization_method} onValueChange={(value) => setSettings({ ...settings, route_optimization_method: value })}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="distance">Minimize Distance</SelectItem>
                      <SelectItem value="time">Minimize Time</SelectItem>
                      <SelectItem value="cost">Minimize Cost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="multi_stop">Allow Multi-Stop Routes</Label>
                  <p className="text-sm text-muted-foreground">Enable multiple stops per route</p>
                </div>
                <Switch
                  id="multi_stop"
                  checked={settings.allow_multi_stop}
                  onCheckedChange={(checked) => setSettings({ ...settings, allow_multi_stop: checked })}
                />
              </div>

              {settings.allow_multi_stop && (
                <div>
                  <Label htmlFor="max_stops">Max Stops Per Route</Label>
                  <Input
                    id="max_stops"
                    type="number"
                    value={settings.max_stops_per_route}
                    onChange={(e) => setSettings({ ...settings, max_stops_per_route: parseInt(e.target.value) || 10 })}
                    className="mt-2"
                    min="1"
                    max="50"
                  />
                </div>
              )}
            </div>
          </Card>

          {/* Notifications */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Info className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Notifications</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="notify_created">Notify on Load Created</Label>
                  <p className="text-sm text-muted-foreground">Send notification when new load is created</p>
                </div>
                <Switch
                  id="notify_created"
                  checked={settings.notify_on_load_created}
                  onCheckedChange={(checked) => setSettings({ ...settings, notify_on_load_created: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="notify_status">Notify on Status Change</Label>
                  <p className="text-sm text-muted-foreground">Send notification when load status changes</p>
                </div>
                <Switch
                  id="notify_status"
                  checked={settings.notify_on_status_change}
                  onCheckedChange={(checked) => setSettings({ ...settings, notify_on_status_change: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="notify_delivery">Notify on Delivery</Label>
                  <p className="text-sm text-muted-foreground">Send notification when load is delivered</p>
                </div>
                <Switch
                  id="notify_delivery"
                  checked={settings.notify_on_delivery}
                  onCheckedChange={(checked) => setSettings({ ...settings, notify_on_delivery: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="notify_driver">Notify Driver on Assignment</Label>
                  <p className="text-sm text-muted-foreground">Send notification to driver when assigned</p>
                </div>
                <Switch
                  id="notify_driver"
                  checked={settings.notify_driver_on_assignment}
                  onCheckedChange={(checked) => setSettings({ ...settings, notify_driver_on_assignment: checked })}
                />
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}
