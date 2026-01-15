"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { getAlertRules, createAlertRule } from "@/app/actions/alerts"
// import { getUsers } from "@/app/actions/user" // Will be implemented later
import { Bell, Plus, Trash2, Edit2, Save } from "lucide-react"

export default function AlertsSettingsPage() {
  const [alertRules, setAlertRules] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    event_type: "load_status_change",
    conditions: {} as any,
    send_email: false,
    send_sms: false,
    send_in_app: true,
    notify_users: [] as string[],
    escalation_enabled: false,
    escalation_delay_minutes: 30,
    priority: "normal",
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setIsLoading(true)
    try {
      const rulesResult = await getAlertRules()

      if (rulesResult.data) {
        setAlertRules(rulesResult.data)
      }
    } catch (error: any) {
      toast.error("Failed to load alert rules")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCreate() {
    setIsSaving(true)
    try {
      // Build conditions based on event type
      const conditions: any = {}
      
      if (formData.event_type === "load_status_change") {
        conditions.status = formData.conditions.status || "any"
      } else if (formData.event_type === "driver_late") {
        conditions.hours_late = formData.conditions.hours_late || 2
      } else if (formData.event_type === "check_call_missed") {
        conditions.minutes_overdue = formData.conditions.minutes_overdue || 15
      }

      const result = await createAlertRule({
        ...formData,
        conditions,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Alert rule created")
        setIsCreateOpen(false)
        setFormData({
          name: "",
          description: "",
          event_type: "load_status_change",
          conditions: {},
          send_email: false,
          send_sms: false,
          send_in_app: true,
          notify_users: [],
          escalation_enabled: false,
          escalation_delay_minutes: 30,
          priority: "normal",
        })
        loadData()
      }
    } catch (error: any) {
      toast.error("Failed to create alert rule")
    } finally {
      setIsSaving(false)
    }
  }

  function getEventTypeLabel(type: string) {
    return type.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")
  }

  if (isLoading) {
    return (
      <div className="w-full">
        <div className="border-b border-border bg-card/50 backdrop-blur px-8 py-4">
          <h1 className="text-2xl font-bold text-foreground">Alert Rules</h1>
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
          <h1 className="text-2xl font-bold text-foreground">Alert Rules</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure automated alerts and notifications</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" />
              Create Alert Rule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Alert Rule</DialogTitle>
              <DialogDescription>Set up automated alerts that trigger based on events</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Rule Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-2"
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="event_type">Event Type *</Label>
                <Select value={formData.event_type} onValueChange={(value) => setFormData({ ...formData, event_type: value })}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="load_status_change">Load Status Change</SelectItem>
                    <SelectItem value="driver_late">Driver Late</SelectItem>
                    <SelectItem value="check_call_missed">Check Call Missed</SelectItem>
                    <SelectItem value="delivery_window">Delivery Window Approaching</SelectItem>
                    <SelectItem value="hos_violation">HOS Violation</SelectItem>
                    <SelectItem value="maintenance_due">Maintenance Due</SelectItem>
                    <SelectItem value="custom">Custom Event</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Condition-specific fields */}
              {formData.event_type === "load_status_change" && (
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.conditions.status || "any"}
                    onValueChange={(value) => setFormData({
                      ...formData,
                      conditions: { ...formData.conditions, status: value }
                    })}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any Status Change</SelectItem>
                      <SelectItem value="in_transit">In Transit</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formData.event_type === "driver_late" && (
                <div>
                  <Label htmlFor="hours_late">Hours Late</Label>
                  <Input
                    id="hours_late"
                    type="number"
                    value={formData.conditions.hours_late || 2}
                    onChange={(e) => setFormData({
                      ...formData,
                      conditions: { ...formData.conditions, hours_late: parseInt(e.target.value) || 2 }
                    })}
                    className="mt-2"
                    min="1"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notification Methods</Label>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Send Email</span>
                  <Switch
                    checked={formData.send_email}
                    onCheckedChange={(checked) => setFormData({ ...formData, send_email: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Send SMS</span>
                  <Switch
                    checked={formData.send_sms}
                    onCheckedChange={(checked) => setFormData({ ...formData, send_sms: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">In-App Notification</span>
                  <Switch
                    checked={formData.send_in_app}
                    onCheckedChange={(checked) => setFormData({ ...formData, send_in_app: checked })}
                  />
                </div>
              </div>

              <Button onClick={handleCreate} className="w-full" disabled={!formData.name || isSaving}>
                {isSaving ? "Creating..." : "Create Alert Rule"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {alertRules.length === 0 ? (
            <Card className="p-8 text-center">
              <Bell className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">No alert rules configured</p>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Alert Rule
              </Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {alertRules.map((rule) => (
                <Card key={rule.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">{rule.name}</h3>
                        <Badge variant={rule.is_active ? "success" : "secondary"}>
                          {rule.is_active ? "Active" : "Inactive"}
                        </Badge>
                        <Badge variant="outline">{getEventTypeLabel(rule.event_type)}</Badge>
                        <Badge variant="outline">{rule.priority}</Badge>
                      </div>
                      {rule.description && (
                        <p className="text-muted-foreground mb-3">{rule.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {rule.send_email && <span>📧 Email</span>}
                        {rule.send_sms && <span>📱 SMS</span>}
                        {rule.send_in_app && <span>🔔 In-App</span>}
                        {rule.escalation_enabled && (
                          <span>⚡ Escalation ({rule.escalation_delay_minutes} min)</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

