"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { getCompanySettings, updateCompanySettings } from "@/app/actions/number-formats"
import { Save, Package, Info, DollarSign, Settings, Route, Truck, Plus, Trash2, Edit2, Fuel } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { getAccessorials, createAccessorial, updateAccessorial, deleteAccessorial } from "@/app/actions/settings-accessorials"
import type { Accessorial } from "@/app/actions/settings-accessorials"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

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
    
    // Load Charge Settings
    load_charge_type: "per-mile", // 'flat-fee', 'per-mile', 'per-ton', 'per-hundred', 'per-bushel', 'per-kilogram'
    
    // Miles Calculation
    miles_calculation_method: "google-maps", // 'manual', 'google-maps', 'promiles'
    
    // Fuel Surcharge
    fuel_surcharge_method: "percentage", // 'none', 'flat-fee', 'percentage', 'per-mile'
    fuel_surcharge_flat_amount: 0,
    fuel_surcharge_per_mile: 0,
    
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
  const [accessorials, setAccessorials] = useState<Accessorial[]>([])
  const [showAccessorialDialog, setShowAccessorialDialog] = useState(false)
  const [editingAccessorial, setEditingAccessorial] = useState<Accessorial | null>(null)
  const [accessorialForm, setAccessorialForm] = useState({
    name: "",
    code: "",
    description: "",
    default_amount: 0,
    charge_type: "flat" as "flat" | "per_hour" | "per_day" | "percentage",
    is_taxable: false,
    is_active: true,
    is_default: false,
    category: "other" as "pickup" | "delivery" | "transit" | "other",
  })

  useEffect(() => {
    loadData()
    loadAccessorials()
  }, [])

  async function loadAccessorials() {
    try {
      const result = await getAccessorials()
      if (result.data) {
        setAccessorials(result.data)
      }
    } catch (error) {
      console.error("Failed to load accessorials:", error)
    }
  }

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
          load_charge_type: result.data.load_charge_type || "per-mile",
          miles_calculation_method: result.data.miles_calculation_method || "google-maps",
          fuel_surcharge_method: result.data.fuel_surcharge_method || "percentage",
          fuel_surcharge_flat_amount: result.data.fuel_surcharge_flat_amount || 0,
          fuel_surcharge_per_mile: result.data.fuel_surcharge_per_mile || 0,
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
    } catch (error: unknown) {
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
    } catch (error: unknown) {
      toast.error("Failed to save settings")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="w-full">
        <div className="border-b border-border bg-card/50 backdrop-blur px-8 py-4">
          <h1 className="text-2xl font-bold text-foreground">Load Settings</h1>
        </div>
        <div className="p-4 md:p-8">
          <div className="text-center py-8">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
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

      <div className="p-8">
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

            </div>
          </Card>

          {/* Load Charges */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <DollarSign className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Load Charges</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="load_charge_type">Default Load Charge Type</Label>
                <Select value={settings.load_charge_type} onValueChange={(value) => setSettings({ ...settings, load_charge_type: value })}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat-fee">Flat Fee</SelectItem>
                    <SelectItem value="per-mile">Per Mile</SelectItem>
                    <SelectItem value="per-ton">Per Ton</SelectItem>
                    <SelectItem value="per-hundred">Per Hundred (CWT)</SelectItem>
                    <SelectItem value="per-bushel">Per Bushel</SelectItem>
                    <SelectItem value="per-kilogram">Per Kilogram</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-1">How loads will be charged by default</p>
              </div>
            </div>
          </Card>

          {/* Miles Calculation */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Route className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Miles Calculation</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="miles_calculation_method">Miles Calculation Method</Label>
                <Select value={settings.miles_calculation_method} onValueChange={(value) => setSettings({ ...settings, miles_calculation_method: value })}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual Entry</SelectItem>
                    <SelectItem value="google-maps">Google Maps</SelectItem>
                    <SelectItem value="promiles">Promiles</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-1">
                  Method used to calculate miles between pickup and drop-off locations
                </p>
              </div>
            </div>
          </Card>

          {/* Fuel Surcharge */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Fuel className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Fuel Surcharge</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="fuel_surcharge_method">Fuel Surcharge Method</Label>
                <Select value={settings.fuel_surcharge_method} onValueChange={(value) => setSettings({ ...settings, fuel_surcharge_method: value })}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Manual Calculation)</SelectItem>
                    <SelectItem value="flat-fee">Flat Fee</SelectItem>
                    <SelectItem value="percentage">Percentage of Hauling Fee</SelectItem>
                    <SelectItem value="per-mile">Per Mile</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {settings.fuel_surcharge_method === "percentage" && (
                <div>
                  <Label htmlFor="fuel_surcharge_percentage">Fuel Surcharge Percentage (%)</Label>
                  <Input
                    id="fuel_surcharge_percentage"
                    type="number"
                    step="0.01"
                    value={settings.default_fuel_surcharge_percentage}
                    onChange={(e) => setSettings({ ...settings, default_fuel_surcharge_percentage: parseFloat(e.target.value) || 0 })}
                    className="mt-2"
                    min="0"
                    max="100"
                  />
                </div>
              )}

              {settings.fuel_surcharge_method === "flat-fee" && (
                <div>
                  <Label htmlFor="fuel_surcharge_flat">Flat Fee Amount ($)</Label>
                  <Input
                    id="fuel_surcharge_flat"
                    type="number"
                    step="0.01"
                    value={settings.fuel_surcharge_flat_amount}
                    onChange={(e) => setSettings({ ...settings, fuel_surcharge_flat_amount: parseFloat(e.target.value) || 0 })}
                    className="mt-2"
                    min="0"
                  />
                </div>
              )}

              {settings.fuel_surcharge_method === "per-mile" && (
                <div>
                  <Label htmlFor="fuel_surcharge_per_mile">Fuel Surcharge Per Mile ($)</Label>
                  <Input
                    id="fuel_surcharge_per_mile"
                    type="number"
                    step="0.0001"
                    value={settings.fuel_surcharge_per_mile}
                    onChange={(e) => setSettings({ ...settings, fuel_surcharge_per_mile: parseFloat(e.target.value) || 0 })}
                    className="mt-2"
                    min="0"
                  />
                </div>
              )}
            </div>
          </Card>

          {/* Accessorials Management */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold">Accessorials</h2>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingAccessorial(null)
                  setAccessorialForm({
                    name: "",
                    code: "",
                    description: "",
                    default_amount: 0,
                    charge_type: "flat",
                    is_taxable: false,
                    is_active: true,
                    is_default: false,
                    category: "other",
                  })
                  setShowAccessorialDialog(true)
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Accessorial
              </Button>
            </div>
            
            <div className="space-y-2">
              {accessorials.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No accessorials configured. Click "Add Accessorial" to create one.
                </p>
              ) : (
                accessorials.map((accessorial) => (
                  <div
                    key={accessorial.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{accessorial.name}</span>
                        {accessorial.code && (
                          <span className="text-xs text-muted-foreground">({accessorial.code})</span>
                        )}
                        {!accessorial.is_active && (
                          <span className="text-xs px-2 py-0.5 bg-muted rounded">Inactive</span>
                        )}
                        {accessorial.is_default && (
                          <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded">Default</span>
                        )}
                      </div>
                      {accessorial.description && (
                        <p className="text-sm text-muted-foreground mt-1">{accessorial.description}</p>
                      )}
                      <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                        <span>Type: {accessorial.charge_type.replace("_", " ")}</span>
                        {accessorial.default_amount && (
                          <span>Amount: ${accessorial.default_amount}</span>
                        )}
                        <span>Category: {accessorial.category || "Other"}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingAccessorial(accessorial)
                          setAccessorialForm({
                            name: accessorial.name,
                            code: accessorial.code || "",
                            description: accessorial.description || "",
                            default_amount: accessorial.default_amount || 0,
                            charge_type: accessorial.charge_type,
                            is_taxable: accessorial.is_taxable || false,
                            is_active: accessorial.is_active !== false,
                            is_default: accessorial.is_default || false,
                            category: accessorial.category || "other",
                          })
                          setShowAccessorialDialog(true)
                        }}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          if (accessorial.id && confirm("Are you sure you want to delete this accessorial?")) {
                            const result = await deleteAccessorial(accessorial.id)
                            if (result.error) {
                              toast.error(result.error)
                            } else {
                              toast.success("Accessorial deleted")
                              loadAccessorials()
                            }
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
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
      </div>

      {/* Accessorial Dialog */}
      <Dialog open={showAccessorialDialog} onOpenChange={setShowAccessorialDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingAccessorial ? "Edit Accessorial" : "Add New Accessorial"}</DialogTitle>
            <DialogDescription>
              Create or edit an accessorial charge that can be applied to loads
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="accessorial_name">Name *</Label>
              <Input
                id="accessorial_name"
                value={accessorialForm.name}
                onChange={(e) => setAccessorialForm({ ...accessorialForm, name: e.target.value })}
                placeholder="Lumper Fee"
                className="mt-1"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="accessorial_code">Code</Label>
                <Input
                  id="accessorial_code"
                  value={accessorialForm.code}
                  onChange={(e) => setAccessorialForm({ ...accessorialForm, code: e.target.value })}
                  placeholder="LMP"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="accessorial_category">Category</Label>
                <Select
                  value={accessorialForm.category}
                  onValueChange={(value: any) => setAccessorialForm({ ...accessorialForm, category: value })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pickup">Pickup</SelectItem>
                    <SelectItem value="delivery">Delivery</SelectItem>
                    <SelectItem value="transit">Transit</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="accessorial_description">Description</Label>
              <Input
                id="accessorial_description"
                value={accessorialForm.description}
                onChange={(e) => setAccessorialForm({ ...accessorialForm, description: e.target.value })}
                placeholder="Additional charge description"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="accessorial_charge_type">Charge Type *</Label>
                <Select
                  value={accessorialForm.charge_type}
                  onValueChange={(value: any) => setAccessorialForm({ ...accessorialForm, charge_type: value })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat">Flat Fee</SelectItem>
                    <SelectItem value="per_hour">Per Hour</SelectItem>
                    <SelectItem value="per_day">Per Day</SelectItem>
                    <SelectItem value="percentage">Percentage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="accessorial_amount">Default Amount</Label>
                <Input
                  id="accessorial_amount"
                  type="number"
                  step="0.01"
                  value={accessorialForm.default_amount}
                  onChange={(e) => setAccessorialForm({ ...accessorialForm, default_amount: parseFloat(e.target.value) || 0 })}
                  className="mt-1"
                  min="0"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="accessorial_taxable"
                    checked={accessorialForm.is_taxable}
                    onCheckedChange={(checked) => setAccessorialForm({ ...accessorialForm, is_taxable: checked as boolean })}
                  />
                  <Label htmlFor="accessorial_taxable" className="cursor-pointer">Taxable</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="accessorial_default"
                    checked={accessorialForm.is_default}
                    onCheckedChange={(checked) => setAccessorialForm({ ...accessorialForm, is_default: checked as boolean })}
                  />
                  <Label htmlFor="accessorial_default" className="cursor-pointer">Auto-apply to new loads</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="accessorial_active"
                    checked={accessorialForm.is_active}
                    onCheckedChange={(checked) => setAccessorialForm({ ...accessorialForm, is_active: checked as boolean })}
                  />
                  <Label htmlFor="accessorial_active" className="cursor-pointer">Active</Label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAccessorialDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!accessorialForm.name) {
                  toast.error("Name is required")
                  return
                }

                const result = editingAccessorial
                  ? await updateAccessorial(editingAccessorial.id!, accessorialForm)
                  : await createAccessorial(accessorialForm)

                if (result.error) {
                  toast.error(result.error)
                } else {
                  toast.success(editingAccessorial ? "Accessorial updated" : "Accessorial created")
                  setShowAccessorialDialog(false)
                  loadAccessorials()
                }
              }}
            >
              {editingAccessorial ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
