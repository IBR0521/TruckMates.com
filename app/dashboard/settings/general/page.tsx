"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { getCompany, updateCompany } from "@/app/actions/company"
import { getCompanySettings, updateCompanySettings } from "@/app/actions/number-formats"
import { Settings as SettingsIcon, Save } from "lucide-react"

export default function GeneralSettingsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [companyData, setCompanyData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    company_type: null as 'broker' | 'carrier' | 'both' | null,
  })
  const [settings, setSettings] = useState({
    timezone: "America/New_York",
    date_format: "MM/DD/YYYY",
    time_format: "12h",
    currency: "USD",
    currency_symbol: "$",
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setIsLoading(true)
    try {
      const [companyResult, settingsResult] = await Promise.all([
        getCompany(),
        getCompanySettings(),
      ])

      if (companyResult.data) {
        setCompanyData({
          name: companyResult.data.name || "",
          email: companyResult.data.email || "",
          phone: companyResult.data.phone || "",
          address: companyResult.data.address || "",
          company_type: companyResult.data.company_type || null,
        })
      }

      if (settingsResult.data) {
        setSettings({
          timezone: settingsResult.data.timezone || "America/New_York",
          date_format: settingsResult.data.date_format || "MM/DD/YYYY",
          time_format: settingsResult.data.time_format || "12h",
          currency: settingsResult.data.currency || "USD",
          currency_symbol: settingsResult.data.currency_symbol || "$",
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
      const formData = new FormData()
      formData.append("name", companyData.name)
      formData.append("email", companyData.email)
      formData.append("phone", companyData.phone)
      if (companyData.address) formData.append("address", companyData.address)
      formData.append("company_type", companyData.company_type || "regular")

      const [companyResult, settingsResult] = await Promise.all([
        updateCompany(formData),
        updateCompanySettings(settings),
      ])

      if (companyResult.error) {
        toast.error(companyResult.error)
      } else {
        toast.success("Company information updated")
      }

      if (settingsResult.error) {
        toast.error(settingsResult.error)
      } else {
        toast.success("General settings updated")
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
          <h1 className="text-2xl font-bold text-foreground">General Settings</h1>
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
          <h1 className="text-2xl font-bold text-foreground">General Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Company information and general preferences</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="bg-primary hover:bg-primary/90">
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <div className="p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Company Information */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <SettingsIcon className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Company Information</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="name">Company Name</Label>
                <Input
                  id="name"
                  value={companyData.name}
                  onChange={(e) => setCompanyData({ ...companyData, name: e.target.value })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={companyData.email}
                  onChange={(e) => setCompanyData({ ...companyData, email: e.target.value })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={companyData.phone}
                  onChange={(e) => setCompanyData({ ...companyData, phone: e.target.value })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={companyData.address}
                  onChange={(e) => setCompanyData({ ...companyData, address: e.target.value })}
                  className="mt-2"
                />
              </div>
            </div>
          </Card>

          {/* Regional Settings */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-6">Regional Settings</h2>
            <div className="grid md:grid-cols-2 gap-6">
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
                    <SelectItem value="America/Phoenix">Arizona Time</SelectItem>
                    <SelectItem value="America/Anchorage">Alaska Time</SelectItem>
                    <SelectItem value="Pacific/Honolulu">Hawaii Time</SelectItem>
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
                    <SelectItem value="12h">12 Hour (AM/PM)</SelectItem>
                    <SelectItem value="24h">24 Hour</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="currency">Currency</Label>
                <Select value={settings.currency} onValueChange={(value) => setSettings({ ...settings, currency: value })}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="CAD">CAD (C$)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                    <SelectItem value="MXN">MXN ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {/* Company Type */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <SettingsIcon className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Company Type</h2>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="company_type">Marketplace Access</Label>
                <Select 
                  value={companyData.company_type || "regular"} 
                  onValueChange={(value) => setCompanyData({ ...companyData, company_type: value === "regular" ? null : value as 'broker' | 'carrier' | 'both' })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select company type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">Regular Company (Fleet Management Only)</SelectItem>
                    <SelectItem value="broker">Broker (Post Loads to Marketplace)</SelectItem>
                    <SelectItem value="carrier">Carrier (Accept Loads from Marketplace)</SelectItem>
                    <SelectItem value="both">Both (Post & Accept Loads)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-2">
                  {companyData.company_type === "broker" && "You can post loads to the marketplace. Accepted loads will appear in your dashboard."}
                  {companyData.company_type === "carrier" && "You can accept loads from the marketplace. Accepted loads will automatically appear in your loads list."}
                  {companyData.company_type === "both" && "You can post and accept loads in the marketplace."}
                  {(!companyData.company_type || companyData.company_type === "regular") && "Standard fleet management platform access. No marketplace access."}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

