"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { getCompanySettings, updateCompanySettings } from "@/app/actions/number-formats"
import { Save, Building2, FileText, Gauge, Info } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function BusinessSettingsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [settings, setSettings] = useState({
    bol_number_format: "BOL-{YEAR}-{SEQUENCE}",
    bol_number_sequence: 1,
    bol_auto_generate: false,
    bol_template: "",
    auto_attach_bol_to_load: false,
    auto_email_bol_to_customer: false,
    document_retention_days: 365,
    odometer_validation_enabled: true,
    max_odometer_increase_per_day: 1000,
    odometer_auto_sync_from_eld: true,
  })
  const [previewNumber, setPreviewNumber] = useState("")

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (settings.bol_number_format) {
      const now = new Date()
      const year = now.getFullYear()
      const sequence = String(settings.bol_number_sequence).padStart(4, '0')
      
      let preview = settings.bol_number_format
        .replace(/{YEAR}/g, String(year))
        .replace(/{MONTH}/g, String(now.getMonth() + 1).padStart(2, '0'))
        .replace(/{DAY}/g, String(now.getDate()).padStart(2, '0'))
        .replace(/{SEQUENCE}/g, sequence)
        .replace(/{COMPANY}/g, "COMP")
      
      setPreviewNumber(preview)
    }
  }, [settings.bol_number_format, settings.bol_number_sequence])

  async function loadData() {
    setIsLoading(true)
    try {
      const result = await getCompanySettings()
      if (result.data) {
        setSettings({
          bol_number_format: result.data.bol_number_format || "BOL-{YEAR}-{SEQUENCE}",
          bol_number_sequence: result.data.bol_number_sequence || 1,
          bol_auto_generate: result.data.bol_auto_generate || false,
          bol_template: result.data.bol_template || "",
          auto_attach_bol_to_load: result.data.auto_attach_bol_to_load || false,
          auto_email_bol_to_customer: result.data.auto_email_bol_to_customer || false,
          document_retention_days: result.data.document_retention_days || 365,
          odometer_validation_enabled: result.data.odometer_validation_enabled !== false,
          max_odometer_increase_per_day: result.data.max_odometer_increase_per_day || 1000,
          odometer_auto_sync_from_eld: result.data.odometer_auto_sync_from_eld !== false,
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
        toast.success("Business settings updated")
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
          <h1 className="text-2xl font-bold text-foreground">Business Settings</h1>
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
          <h1 className="text-2xl font-bold text-foreground">Business Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">BOL, document, and odometer settings</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="bg-primary hover:bg-primary/90">
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* BOL Settings */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <FileText className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">BOL (Bill of Lading) Settings</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="bol_format">BOL Number Format</Label>
                <Input
                  id="bol_format"
                  value={settings.bol_number_format}
                  onChange={(e) => setSettings({ ...settings, bol_number_format: e.target.value })}
                  placeholder="BOL-{YEAR}-{SEQUENCE}"
                  className="mt-2 font-mono"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Use tokens: <code className="px-1 py-0.5 bg-muted rounded">{`{YEAR}`}</code>, <code className="px-1 py-0.5 bg-muted rounded">{`{MONTH}`}</code>, <code className="px-1 py-0.5 bg-muted rounded">{`{DAY}`}</code>, <code className="px-1 py-0.5 bg-muted rounded">{`{SEQUENCE}`}</code>, <code className="px-1 py-0.5 bg-muted rounded">{`{COMPANY}`}</code>
                </p>
              </div>
              
              <div>
                <Label htmlFor="bol_sequence">Starting Sequence Number</Label>
                <Input
                  id="bol_sequence"
                  type="number"
                  value={settings.bol_number_sequence}
                  onChange={(e) => setSettings({ ...settings, bol_number_sequence: parseInt(e.target.value) || 1 })}
                  className="mt-2"
                  min="1"
                />
              </div>

              <div>
                <Label>Preview</Label>
                <div className="mt-2 p-3 bg-muted rounded-md font-mono text-sm">
                  {previewNumber || "BOL-2024-0001"}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div>
                  <Label htmlFor="bol_auto">Auto-Generate BOL</Label>
                  <p className="text-sm text-muted-foreground">Automatically generate BOL when load is created</p>
                </div>
                <Switch
                  id="bol_auto"
                  checked={settings.bol_auto_generate}
                  onCheckedChange={(checked) => setSettings({ ...settings, bol_auto_generate: checked })}
                />
              </div>

              <div>
                <Label htmlFor="bol_template">BOL Template</Label>
                <Input
                  id="bol_template"
                  value={settings.bol_template}
                  onChange={(e) => setSettings({ ...settings, bol_template: e.target.value })}
                  className="mt-2"
                  placeholder="Enter BOL template text..."
                />
              </div>
            </div>
          </Card>

          {/* Document Settings */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <FileText className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Document Settings</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="auto_attach">Auto-Attach BOL to Load</Label>
                  <p className="text-sm text-muted-foreground">Automatically attach BOL documents to loads</p>
                </div>
                <Switch
                  id="auto_attach"
                  checked={settings.auto_attach_bol_to_load}
                  onCheckedChange={(checked) => setSettings({ ...settings, auto_attach_bol_to_load: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="auto_email">Auto-Email BOL to Customer</Label>
                  <p className="text-sm text-muted-foreground">Automatically email BOL to customer when created</p>
                </div>
                <Switch
                  id="auto_email"
                  checked={settings.auto_email_bol_to_customer}
                  onCheckedChange={(checked) => setSettings({ ...settings, auto_email_bol_to_customer: checked })}
                />
              </div>

              <div>
                <Label htmlFor="retention">Document Retention (days)</Label>
                <Input
                  id="retention"
                  type="number"
                  value={settings.document_retention_days}
                  onChange={(e) => setSettings({ ...settings, document_retention_days: parseInt(e.target.value) || 365 })}
                  className="mt-2"
                  min="30"
                  max="3650"
                />
                <p className="text-sm text-muted-foreground mt-1">How long to keep documents before auto-deletion</p>
              </div>
            </div>
          </Card>

          {/* Odometer Settings */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Gauge className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Odometer Settings</h2>
            </div>
            
            <Alert className="mb-6">
              <Info className="w-4 h-4" />
              <AlertDescription>
                Odometer validation helps prevent data entry errors and ensures accurate mileage tracking.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="odometer_validation">Enable Odometer Validation</Label>
                  <p className="text-sm text-muted-foreground">Validate odometer readings to prevent unrealistic values</p>
                </div>
                <Switch
                  id="odometer_validation"
                  checked={settings.odometer_validation_enabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, odometer_validation_enabled: checked })}
                />
              </div>

              {settings.odometer_validation_enabled && (
                <div>
                  <Label htmlFor="max_increase">Max Odometer Increase Per Day (miles)</Label>
                  <Input
                    id="max_increase"
                    type="number"
                    value={settings.max_odometer_increase_per_day}
                    onChange={(e) => setSettings({ ...settings, max_odometer_increase_per_day: parseInt(e.target.value) || 1000 })}
                    className="mt-2"
                    min="100"
                    max="5000"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Maximum allowed increase in odometer reading per day (prevents data entry errors)
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="auto_sync">Auto-Sync from ELD</Label>
                  <p className="text-sm text-muted-foreground">Automatically update odometer from ELD devices</p>
                </div>
                <Switch
                  id="auto_sync"
                  checked={settings.odometer_auto_sync_from_eld}
                  onCheckedChange={(checked) => setSettings({ ...settings, odometer_auto_sync_from_eld: checked })}
                />
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}

