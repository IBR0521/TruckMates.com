"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { getCompanySettings, updateCompanySettings } from "@/app/actions/number-formats"
import { Save, Radio, Info } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function DispatchSettingsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [settings, setSettings] = useState({
    default_check_call_interval: 4,
    check_call_reminder_minutes: 15,
    require_check_call_at_pickup: true,
    require_check_call_at_delivery: true,
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
      const result = await updateCompanySettings({
        default_check_call_interval: settings.default_check_call_interval,
        check_call_reminder_minutes: settings.check_call_reminder_minutes,
        require_check_call_at_pickup: settings.require_check_call_at_pickup,
        require_check_call_at_delivery: settings.require_check_call_at_delivery,
      })

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
          <p className="text-sm text-muted-foreground mt-1">Configure check calls and dispatch preferences</p>
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

              <div className="flex items-center justify-between pt-4 border-t">
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
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}




