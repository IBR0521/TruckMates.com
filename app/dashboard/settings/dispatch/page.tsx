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
import { Save, Radio, Info, Users, Bell, Route, MapPin } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"

export default function DispatchSettingsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [settings, setSettings] = useState({
    // Check Call Settings
    default_check_call_interval: 4,
    check_call_reminder_minutes: 15,
    require_check_call_at_pickup: true,
    require_check_call_at_delivery: true,
    require_check_call_at_milestones: false,
    check_call_timeout_minutes: 30,
    auto_escalate_missed_calls: true,
    
    // Driver Assignment
    driver_assignment_method: "manual", // 'manual', 'auto', 'smart'
    consider_driver_proximity: true,
    consider_driver_hours: true,
    consider_driver_experience: false,
    max_assignment_distance: 100, // miles
    preferred_driver_priority: false,
    
    // Route Optimization
    auto_optimize_routes: false,
    route_optimization_algorithm: "distance", // 'distance', 'time', 'cost', 'balanced'
    consider_traffic: true,
    consider_tolls: false,
    allow_route_deviations: true,
    max_route_deviation_miles: 10,
    
    // Notification Preferences
    notify_on_dispatch: true,
    notify_on_check_call_missed: true,
    notify_on_driver_late: true,
    notify_on_route_deviation: false,
    notify_on_delivery_delay: true,
    notification_channels: ["email", "in_app"], // 'email', 'sms', 'in_app', 'push'
    
    // Dispatch Workflow
    require_confirmation_before_dispatch: false,
    auto_dispatch_on_ready: false,
    dispatch_approval_required: false,
    allow_bulk_dispatch: true,
    
    // Location Tracking
    track_driver_location: true,
    location_update_interval: 5, // minutes
    geofence_enabled: false,
    geofence_radius: 1, // miles
    
    // Emergency Settings
    emergency_contact_required: true,
    auto_notify_on_emergency: true,
    emergency_escalation_minutes: 15,
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setIsLoading(true)
    try {
      const result = await getCompanySettings()
      if (result.data) {
        setSettings({
          default_check_call_interval: result.data.default_check_call_interval || 4,
          check_call_reminder_minutes: result.data.check_call_reminder_minutes || 15,
          require_check_call_at_pickup: result.data.require_check_call_at_pickup !== false,
          require_check_call_at_delivery: result.data.require_check_call_at_delivery !== false,
          require_check_call_at_milestones: result.data.require_check_call_at_milestones || false,
          check_call_timeout_minutes: result.data.check_call_timeout_minutes || 30,
          auto_escalate_missed_calls: result.data.auto_escalate_missed_calls !== false,
          driver_assignment_method: result.data.driver_assignment_method || "manual",
          consider_driver_proximity: result.data.consider_driver_proximity !== false,
          consider_driver_hours: result.data.consider_driver_hours !== false,
          consider_driver_experience: result.data.consider_driver_experience || false,
          max_assignment_distance: result.data.max_assignment_distance || 100,
          preferred_driver_priority: result.data.preferred_driver_priority || false,
          auto_optimize_routes: result.data.auto_optimize_routes || false,
          route_optimization_algorithm: result.data.route_optimization_algorithm || "distance",
          consider_traffic: result.data.consider_traffic !== false,
          consider_tolls: result.data.consider_tolls || false,
          allow_route_deviations: result.data.allow_route_deviations !== false,
          max_route_deviation_miles: result.data.max_route_deviation_miles || 10,
          notify_on_dispatch: result.data.notify_on_dispatch !== false,
          notify_on_check_call_missed: result.data.notify_on_check_call_missed !== false,
          notify_on_driver_late: result.data.notify_on_driver_late !== false,
          notify_on_route_deviation: result.data.notify_on_route_deviation || false,
          notify_on_delivery_delay: result.data.notify_on_delivery_delay !== false,
          notification_channels: result.data.notification_channels || ["email", "in_app"],
          require_confirmation_before_dispatch: result.data.require_confirmation_before_dispatch || false,
          auto_dispatch_on_ready: result.data.auto_dispatch_on_ready || false,
          dispatch_approval_required: result.data.dispatch_approval_required || false,
          allow_bulk_dispatch: result.data.allow_bulk_dispatch !== false,
          track_driver_location: result.data.track_driver_location !== false,
          location_update_interval: result.data.location_update_interval || 5,
          geofence_enabled: result.data.geofence_enabled || false,
          geofence_radius: result.data.geofence_radius || 1,
          emergency_contact_required: result.data.emergency_contact_required !== false,
          auto_notify_on_emergency: result.data.auto_notify_on_emergency !== false,
          emergency_escalation_minutes: result.data.emergency_escalation_minutes || 15,
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
        toast.success("Dispatch settings updated")
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
          <h1 className="text-2xl font-bold text-foreground">Dispatch Settings</h1>
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
          <h1 className="text-2xl font-bold text-foreground">Dispatch Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure check calls, driver assignment, route optimization, and notifications</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="bg-primary hover:bg-primary/90">
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Check Call Settings */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Radio className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Check Call Settings</h2>
            </div>
            
            <Alert className="mb-6">
              <Info className="w-4 h-4" />
              <AlertDescription>
                Check calls help you track driver progress and ensure timely communication during routes.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div>
                <Label htmlFor="check_call_interval">Default Check Call Interval (hours)</Label>
                <Input
                  id="check_call_interval"
                  type="number"
                  value={settings.default_check_call_interval}
                  onChange={(e) => setSettings({ ...settings, default_check_call_interval: parseInt(e.target.value) || 4 })}
                  className="mt-2"
                  min="1"
                  max="24"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  How often drivers should check in during a route
                </p>
              </div>

              <div>
                <Label htmlFor="reminder_minutes">Reminder Minutes Before Check Call</Label>
                <Input
                  id="reminder_minutes"
                  type="number"
                  value={settings.check_call_reminder_minutes}
                  onChange={(e) => setSettings({ ...settings, check_call_reminder_minutes: parseInt(e.target.value) || 15 })}
                  className="mt-2"
                  min="0"
                  max="60"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Send reminder this many minutes before scheduled check call
                </p>
              </div>

              <div>
                <Label htmlFor="timeout_minutes">Check Call Timeout (minutes)</Label>
                <Input
                  id="timeout_minutes"
                  type="number"
                  value={settings.check_call_timeout_minutes}
                  onChange={(e) => setSettings({ ...settings, check_call_timeout_minutes: parseInt(e.target.value) || 30 })}
                  className="mt-2"
                  min="5"
                  max="120"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Mark check call as missed if not completed within this time
                </p>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="pickup_check">Require Check Call at Pickup</Label>
                  <p className="text-sm text-muted-foreground">Driver must check in when picking up load</p>
                </div>
                <Switch
                  id="pickup_check"
                  checked={settings.require_check_call_at_pickup}
                  onCheckedChange={(checked) => setSettings({ ...settings, require_check_call_at_pickup: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="delivery_check">Require Check Call at Delivery</Label>
                  <p className="text-sm text-muted-foreground">Driver must check in when delivering load</p>
                </div>
                <Switch
                  id="delivery_check"
                  checked={settings.require_check_call_at_delivery}
                  onCheckedChange={(checked) => setSettings({ ...settings, require_check_call_at_delivery: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="milestone_check">Require Check Call at Milestones</Label>
                  <p className="text-sm text-muted-foreground">Driver must check in at route milestones</p>
                </div>
                <Switch
                  id="milestone_check"
                  checked={settings.require_check_call_at_milestones}
                  onCheckedChange={(checked) => setSettings({ ...settings, require_check_call_at_milestones: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="auto_escalate">Auto-Escalate Missed Calls</Label>
                  <p className="text-sm text-muted-foreground">Automatically escalate missed check calls</p>
                </div>
                <Switch
                  id="auto_escalate"
                  checked={settings.auto_escalate_missed_calls}
                  onCheckedChange={(checked) => setSettings({ ...settings, auto_escalate_missed_calls: checked })}
                />
              </div>
            </div>
          </Card>

          {/* Driver Assignment */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Users className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Driver Assignment</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="assignment_method">Assignment Method</Label>
                <Select value={settings.driver_assignment_method} onValueChange={(value) => setSettings({ ...settings, driver_assignment_method: value })}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual Only</SelectItem>
                    <SelectItem value="auto">Automatic</SelectItem>
                    <SelectItem value="smart">Smart (AI-Powered)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-1">
                  How drivers are assigned to loads
                </p>
              </div>

              {settings.driver_assignment_method !== "manual" && (
                <>
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="consider_proximity">Consider Driver Proximity</Label>
                      <p className="text-sm text-muted-foreground">Prefer drivers closer to pickup location</p>
                    </div>
                    <Switch
                      id="consider_proximity"
                      checked={settings.consider_driver_proximity}
                      onCheckedChange={(checked) => setSettings({ ...settings, consider_driver_proximity: checked })}
                    />
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
                      <Label htmlFor="consider_experience">Consider Driver Experience</Label>
                      <p className="text-sm text-muted-foreground">Prefer drivers with route experience</p>
                    </div>
                    <Switch
                      id="consider_experience"
                      checked={settings.consider_driver_experience}
                      onCheckedChange={(checked) => setSettings({ ...settings, consider_driver_experience: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="preferred_priority">Preferred Driver Priority</Label>
                      <p className="text-sm text-muted-foreground">Prioritize preferred drivers for routes</p>
                    </div>
                    <Switch
                      id="preferred_priority"
                      checked={settings.preferred_driver_priority}
                      onCheckedChange={(checked) => setSettings({ ...settings, preferred_driver_priority: checked })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="max_distance">Max Assignment Distance (miles)</Label>
                    <Input
                      id="max_distance"
                      type="number"
                      value={settings.max_assignment_distance}
                      onChange={(e) => setSettings({ ...settings, max_assignment_distance: parseInt(e.target.value) || 100 })}
                      className="mt-2"
                      min="0"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Maximum distance from driver to pickup for auto-assignment
                    </p>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Route Optimization */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Route className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Route Optimization</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="auto_optimize">Auto-Optimize Routes</Label>
                  <p className="text-sm text-muted-foreground">Automatically optimize route order</p>
                </div>
                <Switch
                  id="auto_optimize"
                  checked={settings.auto_optimize_routes}
                  onCheckedChange={(checked) => setSettings({ ...settings, auto_optimize_routes: checked })}
                />
              </div>

              {settings.auto_optimize_routes && (
                <>
                  <div>
                    <Label htmlFor="optimization_algorithm">Optimization Algorithm</Label>
                    <Select value={settings.route_optimization_algorithm} onValueChange={(value) => setSettings({ ...settings, route_optimization_algorithm: value })}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="distance">Minimize Distance</SelectItem>
                        <SelectItem value="time">Minimize Time</SelectItem>
                        <SelectItem value="cost">Minimize Cost</SelectItem>
                        <SelectItem value="balanced">Balanced</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="consider_traffic">Consider Traffic</Label>
                      <p className="text-sm text-muted-foreground">Use real-time traffic data</p>
                    </div>
                    <Switch
                      id="consider_traffic"
                      checked={settings.consider_traffic}
                      onCheckedChange={(checked) => setSettings({ ...settings, consider_traffic: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="consider_tolls">Consider Tolls</Label>
                      <p className="text-sm text-muted-foreground">Factor toll costs into optimization</p>
                    </div>
                    <Switch
                      id="consider_tolls"
                      checked={settings.consider_tolls}
                      onCheckedChange={(checked) => setSettings({ ...settings, consider_tolls: checked })}
                    />
                  </div>
                </>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="allow_deviations">Allow Route Deviations</Label>
                  <p className="text-sm text-muted-foreground">Allow drivers to deviate from planned route</p>
                </div>
                <Switch
                  id="allow_deviations"
                  checked={settings.allow_route_deviations}
                  onCheckedChange={(checked) => setSettings({ ...settings, allow_route_deviations: checked })}
                />
              </div>

              {settings.allow_route_deviations && (
                <div>
                  <Label htmlFor="max_deviation">Max Route Deviation (miles)</Label>
                  <Input
                    id="max_deviation"
                    type="number"
                    value={settings.max_route_deviation_miles}
                    onChange={(e) => setSettings({ ...settings, max_route_deviation_miles: parseInt(e.target.value) || 10 })}
                    className="mt-2"
                    min="0"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Maximum allowed deviation before alert is triggered
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Notification Preferences */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Bell className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Notification Preferences</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="notify_dispatch">Notify on Dispatch</Label>
                  <p className="text-sm text-muted-foreground">Send notification when load is dispatched</p>
                </div>
                <Switch
                  id="notify_dispatch"
                  checked={settings.notify_on_dispatch}
                  onCheckedChange={(checked) => setSettings({ ...settings, notify_on_dispatch: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="notify_missed">Notify on Check Call Missed</Label>
                  <p className="text-sm text-muted-foreground">Send alert when check call is missed</p>
                </div>
                <Switch
                  id="notify_missed"
                  checked={settings.notify_on_check_call_missed}
                  onCheckedChange={(checked) => setSettings({ ...settings, notify_on_check_call_missed: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="notify_late">Notify on Driver Late</Label>
                  <p className="text-sm text-muted-foreground">Send alert when driver is running late</p>
                </div>
                <Switch
                  id="notify_late"
                  checked={settings.notify_on_driver_late}
                  onCheckedChange={(checked) => setSettings({ ...settings, notify_on_driver_late: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="notify_deviation">Notify on Route Deviation</Label>
                  <p className="text-sm text-muted-foreground">Send alert when driver deviates from route</p>
                </div>
                <Switch
                  id="notify_deviation"
                  checked={settings.notify_on_route_deviation}
                  onCheckedChange={(checked) => setSettings({ ...settings, notify_on_route_deviation: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="notify_delay">Notify on Delivery Delay</Label>
                  <p className="text-sm text-muted-foreground">Send alert when delivery is delayed</p>
                </div>
                <Switch
                  id="notify_delay"
                  checked={settings.notify_on_delivery_delay}
                  onCheckedChange={(checked) => setSettings({ ...settings, notify_on_delivery_delay: checked })}
                />
              </div>
            </div>
          </Card>

          {/* Dispatch Workflow */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Info className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Dispatch Workflow</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="require_confirmation">Require Confirmation Before Dispatch</Label>
                  <p className="text-sm text-muted-foreground">Require driver confirmation before dispatching</p>
                </div>
                <Switch
                  id="require_confirmation"
                  checked={settings.require_confirmation_before_dispatch}
                  onCheckedChange={(checked) => setSettings({ ...settings, require_confirmation_before_dispatch: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="auto_dispatch">Auto-Dispatch on Ready</Label>
                  <p className="text-sm text-muted-foreground">Automatically dispatch when load is ready</p>
                </div>
                <Switch
                  id="auto_dispatch"
                  checked={settings.auto_dispatch_on_ready}
                  onCheckedChange={(checked) => setSettings({ ...settings, auto_dispatch_on_ready: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="approval_required">Dispatch Approval Required</Label>
                  <p className="text-sm text-muted-foreground">Require manager approval for dispatch</p>
                </div>
                <Switch
                  id="approval_required"
                  checked={settings.dispatch_approval_required}
                  onCheckedChange={(checked) => setSettings({ ...settings, dispatch_approval_required: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="bulk_dispatch">Allow Bulk Dispatch</Label>
                  <p className="text-sm text-muted-foreground">Enable dispatching multiple loads at once</p>
                </div>
                <Switch
                  id="bulk_dispatch"
                  checked={settings.allow_bulk_dispatch}
                  onCheckedChange={(checked) => setSettings({ ...settings, allow_bulk_dispatch: checked })}
                />
              </div>
            </div>
          </Card>

          {/* Location Tracking */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <MapPin className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Location Tracking</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="track_location">Track Driver Location</Label>
                  <p className="text-sm text-muted-foreground">Enable real-time location tracking</p>
                </div>
                <Switch
                  id="track_location"
                  checked={settings.track_driver_location}
                  onCheckedChange={(checked) => setSettings({ ...settings, track_driver_location: checked })}
                />
              </div>

              {settings.track_driver_location && (
                <>
                  <div>
                    <Label htmlFor="update_interval">Location Update Interval (minutes)</Label>
                    <Input
                      id="update_interval"
                      type="number"
                      value={settings.location_update_interval}
                      onChange={(e) => setSettings({ ...settings, location_update_interval: parseInt(e.target.value) || 5 })}
                      className="mt-2"
                      min="1"
                      max="60"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="geofence">Enable Geofencing</Label>
                      <p className="text-sm text-muted-foreground">Alert when driver enters/leaves geofenced areas</p>
                    </div>
                    <Switch
                      id="geofence"
                      checked={settings.geofence_enabled}
                      onCheckedChange={(checked) => setSettings({ ...settings, geofence_enabled: checked })}
                    />
                  </div>

                  {settings.geofence_enabled && (
                    <div>
                      <Label htmlFor="geofence_radius">Geofence Radius (miles)</Label>
                      <Input
                        id="geofence_radius"
                        type="number"
                        step="0.1"
                        value={settings.geofence_radius}
                        onChange={(e) => setSettings({ ...settings, geofence_radius: parseFloat(e.target.value) || 1 })}
                        className="mt-2"
                        min="0.1"
                        max="10"
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>

          {/* Emergency Settings */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Info className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Emergency Settings</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="emergency_contact">Emergency Contact Required</Label>
                  <p className="text-sm text-muted-foreground">Require emergency contact for all drivers</p>
                </div>
                <Switch
                  id="emergency_contact"
                  checked={settings.emergency_contact_required}
                  onCheckedChange={(checked) => setSettings({ ...settings, emergency_contact_required: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="auto_notify_emergency">Auto-Notify on Emergency</Label>
                  <p className="text-sm text-muted-foreground">Automatically notify contacts on emergency</p>
                </div>
                <Switch
                  id="auto_notify_emergency"
                  checked={settings.auto_notify_on_emergency}
                  onCheckedChange={(checked) => setSettings({ ...settings, auto_notify_on_emergency: checked })}
                />
              </div>

              <div>
                <Label htmlFor="escalation_minutes">Emergency Escalation (minutes)</Label>
                <Input
                  id="escalation_minutes"
                  type="number"
                  value={settings.emergency_escalation_minutes}
                  onChange={(e) => setSettings({ ...settings, emergency_escalation_minutes: parseInt(e.target.value) || 15 })}
                  className="mt-2"
                  min="1"
                  max="60"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Time before escalating emergency to next level
                </p>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}
