"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { getCompanySettings, updateCompanySettings } from "@/app/actions/number-formats"
import { Save, Building2, FileText, Gauge, Info, Globe, DollarSign, Calendar, Image } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"

export default function BusinessSettingsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [settings, setSettings] = useState({
    // BOL Settings
    bol_number_format: "BOL-{YEAR}-{SEQUENCE}",
    bol_number_sequence: 1,
    bol_auto_generate: false,
    bol_template: "",
    auto_attach_bol_to_load: false,
    auto_email_bol_to_customer: false,
    
    // Document Settings
    document_retention_days: 365,
    
    // Odometer Settings
    odometer_validation_enabled: true,
    max_odometer_increase_per_day: 1000,
    odometer_auto_sync_from_eld: true,
    
    // Regional Settings
    timezone: "America/New_York",
    date_format: "MM/DD/YYYY",
    time_format: "12h", // '12h' or '24h'
    currency: "USD",
    currency_symbol: "$",
    number_format: "1,234.56", // '1,234.56' or '1.234,56'
    
    // Company Branding
    company_logo_url: "",
    company_primary_color: "#3b82f6",
    company_secondary_color: "#64748b",
    company_name_display: "",
    company_tagline: "",
    company_website: "",
    
    // Business Information
    business_type: "llc", // 'llc', 'corporation', 'partnership', 'sole_proprietorship'
    tax_id: "",
    license_number: "",
    dot_number: "",
    mc_number: "",
    
    // Contact Information
    business_phone: "",
    business_email: "",
    business_address: "",
    business_city: "",
    business_state: "",
    business_zip: "",
    business_country: "United States",
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
          timezone: result.data.timezone || "America/New_York",
          date_format: result.data.date_format || "MM/DD/YYYY",
          time_format: result.data.time_format || "12h",
          currency: result.data.currency || "USD",
          currency_symbol: result.data.currency_symbol || "$",
          number_format: result.data.number_format || "1,234.56",
          company_logo_url: result.data.company_logo_url || "",
          company_primary_color: result.data.company_primary_color || "#3b82f6",
          company_secondary_color: result.data.company_secondary_color || "#64748b",
          company_name_display: result.data.company_name_display || "",
          company_tagline: result.data.company_tagline || "",
          company_website: result.data.company_website || "",
          business_type: result.data.business_type || "llc",
          tax_id: result.data.tax_id || "",
          license_number: result.data.license_number || "",
          dot_number: result.data.dot_number || "",
          mc_number: result.data.mc_number || "",
          business_phone: result.data.business_phone || "",
          business_email: result.data.business_email || "",
          business_address: result.data.business_address || "",
          business_city: result.data.business_city || "",
          business_state: result.data.business_state || "",
          business_zip: result.data.business_zip || "",
          business_country: result.data.business_country || "United States",
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
      <div className="w-full">
        <div className="border-b border-border bg-card/50 backdrop-blur px-8 py-4">
          <h1 className="text-2xl font-bold text-foreground">Business Settings</h1>
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
          <h1 className="text-2xl font-bold text-foreground">Business Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure company info, regional settings, branding, BOL, documents, and odometer</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="bg-primary hover:bg-primary/90">
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <div className="p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Company Information */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Building2 className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Company Information</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="company_name">Company Display Name</Label>
                <Input
                  id="company_name"
                  value={settings.company_name_display}
                  onChange={(e) => setSettings({ ...settings, company_name_display: e.target.value })}
                  placeholder="Your Company Name"
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="company_tagline">Company Tagline</Label>
                <Input
                  id="company_tagline"
                  value={settings.company_tagline}
                  onChange={(e) => setSettings({ ...settings, company_tagline: e.target.value })}
                  placeholder="Your company tagline or slogan"
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="company_website">Company Website</Label>
                <Input
                  id="company_website"
                  type="url"
                  value={settings.company_website}
                  onChange={(e) => setSettings({ ...settings, company_website: e.target.value })}
                  placeholder="https://www.example.com"
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="business_type">Business Type</Label>
                <Select value={settings.business_type} onValueChange={(value) => setSettings({ ...settings, business_type: value })}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="llc">LLC</SelectItem>
                    <SelectItem value="corporation">Corporation</SelectItem>
                    <SelectItem value="partnership">Partnership</SelectItem>
                    <SelectItem value="sole_proprietorship">Sole Proprietorship</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="tax_id">Tax ID / EIN</Label>
                <Input
                  id="tax_id"
                  value={settings.tax_id}
                  onChange={(e) => setSettings({ ...settings, tax_id: e.target.value })}
                  placeholder="12-3456789"
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="dot_number">DOT Number</Label>
                <Input
                  id="dot_number"
                  value={settings.dot_number}
                  onChange={(e) => setSettings({ ...settings, dot_number: e.target.value })}
                  placeholder="1234567"
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="mc_number">MC Number</Label>
                <Input
                  id="mc_number"
                  value={settings.mc_number}
                  onChange={(e) => setSettings({ ...settings, mc_number: e.target.value })}
                  placeholder="MC-123456"
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="license_number">Business License Number</Label>
                <Input
                  id="license_number"
                  value={settings.license_number}
                  onChange={(e) => setSettings({ ...settings, license_number: e.target.value })}
                  placeholder="BL-123456"
                  className="mt-2"
                />
              </div>
            </div>
          </Card>

          {/* Contact Information */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Building2 className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Contact Information</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="business_phone">Business Phone</Label>
                <Input
                  id="business_phone"
                  type="tel"
                  value={settings.business_phone}
                  onChange={(e) => setSettings({ ...settings, business_phone: e.target.value })}
                  placeholder="(555) 123-4567"
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="business_email">Business Email</Label>
                <Input
                  id="business_email"
                  type="email"
                  value={settings.business_email}
                  onChange={(e) => setSettings({ ...settings, business_email: e.target.value })}
                  placeholder="contact@company.com"
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="business_address">Business Address</Label>
                <Input
                  id="business_address"
                  value={settings.business_address}
                  onChange={(e) => setSettings({ ...settings, business_address: e.target.value })}
                  placeholder="123 Main Street"
                  className="mt-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="business_city">City</Label>
                  <Input
                    id="business_city"
                    value={settings.business_city}
                    onChange={(e) => setSettings({ ...settings, business_city: e.target.value })}
                    placeholder="City"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="business_state">State</Label>
                  <Input
                    id="business_state"
                    value={settings.business_state}
                    onChange={(e) => setSettings({ ...settings, business_state: e.target.value })}
                    placeholder="State"
                    className="mt-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="business_zip">ZIP Code</Label>
                  <Input
                    id="business_zip"
                    value={settings.business_zip}
                    onChange={(e) => setSettings({ ...settings, business_zip: e.target.value })}
                    placeholder="12345"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="business_country">Country</Label>
                  <Input
                    id="business_country"
                    value={settings.business_country}
                    onChange={(e) => setSettings({ ...settings, business_country: e.target.value })}
                    placeholder="United States"
                    className="mt-2"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Regional Settings */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Globe className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Regional Settings</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <Select value={settings.timezone} onValueChange={(value) => setSettings({ ...settings, timezone: value })}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                    <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                    <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                    <SelectItem value="America/Anchorage">Alaska Time (AKT)</SelectItem>
                    <SelectItem value="Pacific/Honolulu">Hawaii Time (HST)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="date_format">Date Format</Label>
                <Select value={settings.date_format} onValueChange={(value) => setSettings({ ...settings, date_format: value })}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                    <SelectItem value="DD.MM.YYYY">DD.MM.YYYY</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="time_format">Time Format</Label>
                <Select value={settings.time_format} onValueChange={(value) => setSettings({ ...settings, time_format: value })}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12h">12-Hour (AM/PM)</SelectItem>
                    <SelectItem value="24h">24-Hour</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="currency">Currency</Label>
                <Select value={settings.currency} onValueChange={(value) => {
                  const symbols: Record<string, string> = {
                    "USD": "$",
                    "EUR": "€",
                    "GBP": "£",
                    "CAD": "C$",
                    "AUD": "A$",
                    "JPY": "¥",
                    "MXN": "MX$",
                  }
                  setSettings({ ...settings, currency: value, currency_symbol: symbols[value] || "$" })
                }}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD - US Dollar ($)</SelectItem>
                    <SelectItem value="EUR">EUR - Euro (€)</SelectItem>
                    <SelectItem value="GBP">GBP - British Pound (£)</SelectItem>
                    <SelectItem value="CAD">CAD - Canadian Dollar (C$)</SelectItem>
                    <SelectItem value="AUD">AUD - Australian Dollar (A$)</SelectItem>
                    <SelectItem value="JPY">JPY - Japanese Yen (¥)</SelectItem>
                    <SelectItem value="MXN">MXN - Mexican Peso (MX$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="currency_symbol">Currency Symbol</Label>
                <Input
                  id="currency_symbol"
                  value={settings.currency_symbol}
                  onChange={(e) => setSettings({ ...settings, currency_symbol: e.target.value })}
                  placeholder="$"
                  className="mt-2"
                  maxLength={5}
                />
              </div>

              <div>
                <Label htmlFor="number_format">Number Format</Label>
                <Select value={settings.number_format} onValueChange={(value) => setSettings({ ...settings, number_format: value })}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1,234.56">1,234.56 (US)</SelectItem>
                    <SelectItem value="1.234,56">1.234,56 (European)</SelectItem>
                    <SelectItem value="1 234,56">1 234,56 (French)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {/* Company Branding */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Image className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Company Branding</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="company_logo">Company Logo URL</Label>
                <Input
                  id="company_logo"
                  type="url"
                  value={settings.company_logo_url}
                  onChange={(e) => setSettings({ ...settings, company_logo_url: e.target.value })}
                  placeholder="https://example.com/logo.png"
                  className="mt-2"
                />
                <p className="text-sm text-muted-foreground mt-1">URL to your company logo image</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="primary_color">Primary Color</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      id="primary_color"
                      type="color"
                      value={settings.company_primary_color}
                      onChange={(e) => setSettings({ ...settings, company_primary_color: e.target.value })}
                      className="w-20 h-10"
                    />
                    <Input
                      value={settings.company_primary_color}
                      onChange={(e) => setSettings({ ...settings, company_primary_color: e.target.value })}
                      placeholder="#3b82f6"
                      className="flex-1"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="secondary_color">Secondary Color</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      id="secondary_color"
                      type="color"
                      value={settings.company_secondary_color}
                      onChange={(e) => setSettings({ ...settings, company_secondary_color: e.target.value })}
                      className="w-20 h-10"
                    />
                    <Input
                      value={settings.company_secondary_color}
                      onChange={(e) => setSettings({ ...settings, company_secondary_color: e.target.value })}
                      placeholder="#64748b"
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
            </div>
          </Card>

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
                <Textarea
                  id="bol_template"
                  value={settings.bol_template}
                  onChange={(e) => setSettings({ ...settings, bol_template: e.target.value })}
                  placeholder="Enter BOL template text..."
                  className="mt-2 min-h-24"
                />
              </div>

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
            </div>
          </Card>

          {/* Document Settings */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <FileText className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Document Settings</h2>
            </div>
            
            <div className="space-y-4">
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
      </div>
    </div>
  )
}
