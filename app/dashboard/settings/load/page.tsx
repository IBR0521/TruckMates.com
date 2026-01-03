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
import { Save, Package, Info } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function LoadSettingsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [settings, setSettings] = useState({
    load_number_format: "LOAD-{YEAR}-{SEQUENCE}",
    load_number_sequence: 1,
    default_load_type: "ftl",
    default_carrier_type: "dry-van",
    auto_create_route: true,
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
        load_number_format: settings.load_number_format,
        load_number_sequence: settings.load_number_sequence,
        default_load_type: settings.default_load_type,
        default_carrier_type: settings.default_carrier_type,
        auto_create_route: settings.auto_create_route,
      })

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
          <p className="text-sm text-muted-foreground mt-1">Configure load numbering and defaults</p>
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
            <h2 className="text-xl font-semibold mb-6">Default Settings</h2>
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
        </div>
      </main>
    </div>
  )
}




