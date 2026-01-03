"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { 
  Bell, 
  Save,
  Mail,
  MessageSquare,
  Calendar,
} from "lucide-react"
import { toast } from "sonner"
import { useState, useEffect } from "react"
import { getReminderSettings, updateReminderSettings } from "@/app/actions/settings-reminder"

export default function ReminderSettingsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [reminders, setReminders] = useState({
    email_enabled: true,
    sms_enabled: false,
    maintenance_reminders: true,
    license_expiry_reminders: true,
    insurance_expiry_reminders: true,
    invoice_reminders: true,
    load_reminders: true,
    route_reminders: true,
    days_before_reminder: 7,
    reminder_frequency: "daily",
  })

  useEffect(() => {
    async function loadSettings() {
      setIsLoading(true)
      try {
        const result = await getReminderSettings()
        if (result.error) {
          toast.error(result.error)
        } else if (result.data) {
          setReminders({
            email_enabled: result.data.email_enabled ?? true,
            sms_enabled: result.data.sms_enabled ?? false,
            maintenance_reminders: result.data.maintenance_reminders ?? true,
            license_expiry_reminders: result.data.license_expiry_reminders ?? true,
            insurance_expiry_reminders: result.data.insurance_expiry_reminders ?? true,
            invoice_reminders: result.data.invoice_reminders ?? true,
            load_reminders: result.data.load_reminders ?? true,
            route_reminders: result.data.route_reminders ?? true,
            days_before_reminder: result.data.days_before_reminder ?? 7,
            reminder_frequency: result.data.reminder_frequency ?? "daily",
          })
        }
      } catch (error) {
        toast.error("Failed to load reminder settings")
      } finally {
        setIsLoading(false)
      }
    }
    loadSettings()
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const result = await updateReminderSettings({
        email_enabled: reminders.email_enabled,
        sms_enabled: reminders.sms_enabled,
        maintenance_reminders: reminders.maintenance_reminders,
        license_expiry_reminders: reminders.license_expiry_reminders,
        insurance_expiry_reminders: reminders.insurance_expiry_reminders,
        invoice_reminders: reminders.invoice_reminders,
        load_reminders: reminders.load_reminders,
        route_reminders: reminders.route_reminders,
        days_before_reminder: reminders.days_before_reminder,
        reminder_frequency: reminders.reminder_frequency,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Reminder settings saved successfully")
      }
    } catch (error) {
      toast.error("Failed to save reminder settings")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="w-full p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <Bell className="w-6 h-6" />
            Reminder Settings
          </h1>
          <p className="text-muted-foreground mt-2">
            Configure notifications and reminders for your fleet
          </p>
        </div>

        {isLoading ? (
          <Card className="p-6">
            <p className="text-muted-foreground">Loading...</p>
          </Card>
        ) : (
          <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Notification Channels</h2>
          
          <div className="space-y-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-muted-foreground" />
                <div>
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive reminders via email</p>
                </div>
              </div>
              <Switch
                checked={reminders.email_enabled}
                onCheckedChange={(checked) => setReminders({ ...reminders, email_enabled: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-muted-foreground" />
                <div>
                  <Label>SMS Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive reminders via SMS</p>
                </div>
              </div>
              <Switch
                checked={reminders.sms_enabled}
                onCheckedChange={(checked) => setReminders({ ...reminders, sms_enabled: checked })}
              />
            </div>
          </div>

          <h2 className="text-lg font-semibold mb-4 mt-6">Reminder Types</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Maintenance Reminders</Label>
                <p className="text-sm text-muted-foreground">Get notified about scheduled maintenance</p>
              </div>
              <Switch
                checked={reminders.maintenance_reminders}
                onCheckedChange={(checked) => setReminders({ ...reminders, maintenance_reminders: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>License Expiry Reminders</Label>
                <p className="text-sm text-muted-foreground">Get notified before licenses expire</p>
              </div>
              <Switch
                checked={reminders.license_expiry_reminders}
                onCheckedChange={(checked) => setReminders({ ...reminders, license_expiry_reminders: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Insurance Expiry Reminders</Label>
                <p className="text-sm text-muted-foreground">Get notified before insurance expires</p>
              </div>
              <Switch
                checked={reminders.insurance_expiry_reminders}
                onCheckedChange={(checked) => setReminders({ ...reminders, insurance_expiry_reminders: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Invoice Reminders</Label>
                <p className="text-sm text-muted-foreground">Get notified about pending invoices</p>
              </div>
              <Switch
                checked={reminders.invoice_reminders}
                onCheckedChange={(checked) => setReminders({ ...reminders, invoice_reminders: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Load Reminders</Label>
                <p className="text-sm text-muted-foreground">Get notified about load updates</p>
              </div>
              <Switch
                checked={reminders.load_reminders}
                onCheckedChange={(checked) => setReminders({ ...reminders, load_reminders: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Route Reminders</Label>
                <p className="text-sm text-muted-foreground">Get notified about route updates</p>
              </div>
              <Switch
                checked={reminders.route_reminders}
                onCheckedChange={(checked) => setReminders({ ...reminders, route_reminders: checked })}
              />
            </div>
          </div>

          <div className="mt-6 space-y-2">
            <Label>Days Before Reminder</Label>
            <Input
              type="number"
              value={reminders.days_before_reminder}
              onChange={(e) => setReminders({ ...reminders, days_before_reminder: parseInt(e.target.value) || 7 })}
              min="1"
              max="30"
            />
            <p className="text-sm text-muted-foreground">Send reminders this many days before the event</p>
          </div>

          <div className="mt-6 flex justify-end">
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </Card>
        )}
      </div>
    </div>
  )
}

