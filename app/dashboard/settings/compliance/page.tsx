"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { getCompanySettings, updateCompanySettings } from "@/app/actions/number-formats"
import { Save, Shield, Bell, ExternalLink } from "lucide-react"
import { Separator } from "@/components/ui/separator"

export default function ComplianceSettingsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [settings, setSettings] = useState({
    dot_number: "",
    consider_driver_hours: true,
    compliance_expiry_lead_days: "60,30,7",
    notify_on_document_expiry: true,
    notify_on_permit_expiry: true,
    notify_on_roadside_oos: true,
    notify_on_dot_reportable_incident: true,
    compliance_notification_channels: ["email", "in_app"] as string[],
  })

  useEffect(() => {
    void (async () => {
      const result = await getCompanySettings()
      if (result.data) {
        const lead = Array.isArray(result.data.compliance_expiry_lead_days)
          ? result.data.compliance_expiry_lead_days.join(",")
          : "60,30,7"
        setSettings({
          dot_number: result.data.dot_number || "",
          consider_driver_hours: result.data.consider_driver_hours !== false,
          compliance_expiry_lead_days: lead,
          notify_on_document_expiry: result.data.notify_on_document_expiry !== false,
          notify_on_permit_expiry: result.data.notify_on_permit_expiry !== false,
          notify_on_roadside_oos: result.data.notify_on_roadside_oos !== false,
          notify_on_dot_reportable_incident: result.data.notify_on_dot_reportable_incident !== false,
          compliance_notification_channels: Array.isArray(result.data.compliance_notification_channels)
            ? result.data.compliance_notification_channels.map(String)
            : ["email", "in_app"],
        })
      }
      setIsLoading(false)
    })()
  }, [])

  async function handleSave() {
    setIsSaving(true)
    const leadDays = settings.compliance_expiry_lead_days
      .split(",")
      .map((v) => parseInt(v.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0)

    const result = await updateCompanySettings({
      dot_number: settings.dot_number,
      consider_driver_hours: settings.consider_driver_hours,
      compliance_expiry_lead_days: leadDays,
      notify_on_document_expiry: settings.notify_on_document_expiry,
      notify_on_permit_expiry: settings.notify_on_permit_expiry,
      notify_on_roadside_oos: settings.notify_on_roadside_oos,
      notify_on_dot_reportable_incident: settings.notify_on_dot_reportable_incident,
      compliance_notification_channels: settings.compliance_notification_channels,
    })
    if (result.error) toast.error(result.error)
    else toast.success("Compliance settings saved")
    setIsSaving(false)
  }

  if (isLoading) {
    return <div className="p-8 text-muted-foreground">Loading…</div>
  }

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 px-8 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Compliance Settings</h1>
          <p className="text-sm text-muted-foreground">DOT, HOS policy, and compliance alert preferences</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Saving…" : "Save"}
        </Button>
      </div>

      <div className="p-4 md:p-8 max-w-3xl space-y-6">
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">DOT & HOS</h2>
          </div>
          <div>
            <Label htmlFor="dot_number">DOT number</Label>
            <Input
              id="dot_number"
              value={settings.dot_number}
              onChange={(e) => setSettings({ ...settings, dot_number: e.target.value })}
              placeholder="Used for CSA score sync"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Block dispatch when driver is out of hours</Label>
              <p className="text-xs text-muted-foreground">
                When enabled, <code>consider_driver_hours</code> hard-blocks dispatch (not just auto-assign).
              </p>
            </div>
            <Switch
              checked={settings.consider_driver_hours}
              onCheckedChange={(checked) => setSettings({ ...settings, consider_driver_hours: checked })}
            />
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Expiry alerts</h2>
          </div>
          <div>
            <Label>Lead days (comma-separated)</Label>
            <Input
              value={settings.compliance_expiry_lead_days}
              onChange={(e) => setSettings({ ...settings, compliance_expiry_lead_days: e.target.value })}
              placeholder="60,30,7"
            />
          </div>
          {(
            [
              ["notify_on_document_expiry", "Document & license expiry"],
              ["notify_on_permit_expiry", "Permit expiry"],
              ["notify_on_roadside_oos", "Roadside out-of-service"],
              ["notify_on_dot_reportable_incident", "DOT-reportable incidents"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between">
              <Label>{label}</Label>
              <Switch
                checked={settings[key]}
                onCheckedChange={(checked) => setSettings({ ...settings, [key]: checked })}
              />
            </div>
          ))}
          <Separator />
          <p className="text-sm font-medium">Notification channels</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(["email", "sms", "in_app", "push"] as const).map((channel) => (
              <label key={channel} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={settings.compliance_notification_channels.includes(channel)}
                  onCheckedChange={(checked) => {
                    const next = checked
                      ? [...settings.compliance_notification_channels, channel]
                      : settings.compliance_notification_channels.filter((c) => c !== channel)
                    if (next.length === 0) {
                      toast.error("At least one channel is required")
                      return
                    }
                    setSettings({ ...settings, compliance_notification_channels: next })
                  }}
                />
                <span className="capitalize">{channel.replace(/_/g, " ")}</span>
              </label>
            ))}
          </div>
        </Card>

        <Card className="p-6 space-y-2 text-sm">
          <p className="font-medium">Related settings</p>
          <Link href="/dashboard/accounting/ifta/tax-rates" className="flex items-center gap-1 text-primary hover:underline">
            IFTA tax rates <ExternalLink className="w-3 h-3" />
          </Link>
          <Link href="/dashboard/settings/reminder" className="flex items-center gap-1 text-primary hover:underline">
            Reminders <ExternalLink className="w-3 h-3" />
          </Link>
        </Card>
      </div>
    </div>
  )
}
