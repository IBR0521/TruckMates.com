"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { 
  Plug, 
  Save,
  CheckCircle2,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { useState, useEffect } from "react"
import { getIntegrationSettings, updateIntegrationSettings } from "@/app/actions/settings-integration"
import { testQuickBooksConnection } from "@/app/actions/integrations-quickbooks"
import { Button as TestButton } from "@/components/ui/button"

export default function IntegrationSettingsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState<string | null>(null)
  const [integrations, setIntegrations] = useState({
    quickbooks_enabled: false,
    quickbooks_api_key: "",
    quickbooks_api_secret: "",
    quickbooks_company_id: "",
    stripe_enabled: false,
    stripe_api_key: "",
    paypal_enabled: false,
    paypal_client_id: "",
    google_maps_enabled: false,
    google_maps_api_key: "",
    resend_enabled: false,
    resend_api_key: "",
    resend_from_email: "",
  })

  useEffect(() => {
    async function loadSettings() {
      setIsLoading(true)
      try {
        const result = await getIntegrationSettings()
        if (result.error) {
          toast.error(result.error)
        } else if (result.data) {
          setIntegrations({
            quickbooks_enabled: result.data.quickbooks_enabled || false,
            quickbooks_api_key: result.data.quickbooks_api_key || "",
            quickbooks_api_secret: result.data.quickbooks_api_secret || "",
            quickbooks_company_id: result.data.quickbooks_company_id || "",
            stripe_enabled: result.data.stripe_enabled || false,
            stripe_api_key: result.data.stripe_api_key || "",
            paypal_enabled: result.data.paypal_enabled || false,
            paypal_client_id: result.data.paypal_client_id || "",
            google_maps_enabled: result.data.google_maps_enabled || false,
            google_maps_api_key: result.data.google_maps_api_key || "",
            resend_enabled: result.data.resend_enabled || false,
            resend_api_key: result.data.resend_api_key || "",
            resend_from_email: result.data.resend_from_email || "",
          })
        }
      } catch (error) {
        toast.error("Failed to load integration settings")
      } finally {
        setIsLoading(false)
      }
    }
    loadSettings()
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const result = await updateIntegrationSettings({
        quickbooks_enabled: integrations.quickbooks_enabled,
        quickbooks_api_key: integrations.quickbooks_api_key,
        quickbooks_api_secret: integrations.quickbooks_api_secret,
        quickbooks_company_id: integrations.quickbooks_company_id,
        stripe_enabled: integrations.stripe_enabled,
        stripe_api_key: integrations.stripe_api_key,
        paypal_enabled: integrations.paypal_enabled,
        paypal_client_id: integrations.paypal_client_id,
        google_maps_enabled: integrations.google_maps_enabled,
        google_maps_api_key: integrations.google_maps_api_key,
        resend_enabled: integrations.resend_enabled,
        resend_api_key: integrations.resend_api_key,
        resend_from_email: integrations.resend_from_email,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Integration settings saved successfully")
      }
    } catch (error) {
      toast.error("Failed to save integration settings")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="w-full p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <Plug className="w-6 h-6" />
            Integration Settings
          </h1>
          <p className="text-muted-foreground mt-2">
            Connect third-party services to enhance your fleet management
          </p>
        </div>

        {isLoading ? (
          <Card className="p-6">
            <p className="text-muted-foreground">Loading...</p>
          </Card>
        ) : (
          <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Available Integrations</h2>
          
          <div className="space-y-4">
            {/* QuickBooks */}
            <div className="border rounded-lg p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold">QuickBooks</h3>
                  <p className="text-sm text-muted-foreground">Sync accounting data with QuickBooks</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {integrations.quickbooks_enabled ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Enable QuickBooks</Label>
                  <Switch
                    checked={integrations.quickbooks_enabled}
                    onCheckedChange={(checked) => setIntegrations({
                      ...integrations,
                      quickbooks_enabled: checked
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    value={integrations.quickbooks_api_key}
                    onChange={(e) => setIntegrations({
                      ...integrations,
                      quickbooks_api_key: e.target.value
                    })}
                    placeholder="Enter QuickBooks API key"
                    disabled={!integrations.quickbooks_enabled}
                  />
                  <Label>API Secret</Label>
                  <Input
                    type="password"
                    value={integrations.quickbooks_api_secret}
                    onChange={(e) => setIntegrations({
                      ...integrations,
                      quickbooks_api_secret: e.target.value
                    })}
                    placeholder="Enter QuickBooks API secret"
                    disabled={!integrations.quickbooks_enabled}
                  />
                  <Label>Company ID</Label>
                  <Input
                    type="text"
                    value={integrations.quickbooks_company_id}
                    onChange={(e) => setIntegrations({
                      ...integrations,
                      quickbooks_company_id: e.target.value
                    })}
                    placeholder="Enter QuickBooks Company ID"
                    disabled={!integrations.quickbooks_enabled}
                  />
                  <TestButton
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      setIsTesting("quickbooks")
                      const result = await testQuickBooksConnection()
                      setIsTesting(null)
                      if (result.error) {
                        toast.error(result.error)
                      } else {
                        toast.success(`Connected to QuickBooks: ${result.data?.company || "Success"}`)
                      }
                    }}
                    disabled={!integrations.quickbooks_enabled || isTesting === "quickbooks"}
                  >
                    {isTesting === "quickbooks" ? "Testing..." : "Test Connection"}
                  </TestButton>
                </div>
              </div>
            </div>

            {/* Stripe - Optional (requires bank account) */}
            <div className="border rounded-lg p-4 opacity-75">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">Stripe</h3>
                    <Badge variant="outline" className="text-xs">Optional</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Process payments with Stripe (requires bank account)</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {integrations.stripe_enabled ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Enable Stripe</Label>
                  <Switch
                    checked={integrations.stripe_enabled}
                    onCheckedChange={(checked) => setIntegrations({
                      ...integrations,
                      stripe_enabled: checked
                    })}
                    disabled={true}
                  />
                </div>
                <Label>API Key</Label>
                <Input
                  type="password"
                  value={integrations.stripe_api_key}
                  onChange={(e) => setIntegrations({
                    ...integrations,
                    stripe_api_key: e.target.value
                  })}
                  placeholder="Enter Stripe API key (configure when bank account is ready)"
                  disabled={true}
                />
                <p className="text-xs text-muted-foreground">Configure this when you have a bank account set up</p>
              </div>
            </div>

            {/* Google Maps */}
            <div className="border rounded-lg p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold">Google Maps</h3>
                  <p className="text-sm text-muted-foreground">Enhanced mapping and routing</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {integrations.google_maps_enabled ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Enable Google Maps</Label>
                  <Switch
                    checked={integrations.google_maps_enabled}
                    onCheckedChange={(checked) => setIntegrations({
                      ...integrations,
                      google_maps_enabled: checked
                    })}
                  />
                </div>
                <Label>API Key</Label>
                <Input
                  type="password"
                  value={integrations.google_maps_api_key}
                  onChange={(e) => setIntegrations({
                    ...integrations,
                    google_maps_api_key: e.target.value
                  })}
                  placeholder="Enter Google Maps API key"
                  disabled={!integrations.google_maps_enabled}
                />
              </div>
            </div>

            {/* Resend Email */}
            <div className="border rounded-lg p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold">Resend Email</h3>
                  <p className="text-sm text-muted-foreground">Send invoices and notifications via email</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {integrations.resend_enabled ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Enable Resend</Label>
                  <Switch
                    checked={integrations.resend_enabled}
                    onCheckedChange={(checked) => setIntegrations({
                      ...integrations,
                      resend_enabled: checked
                    })}
                  />
                </div>
                <Label>API Key</Label>
                <Input
                  type="password"
                  value={integrations.resend_api_key}
                  onChange={(e) => setIntegrations({
                    ...integrations,
                    resend_api_key: e.target.value
                  })}
                  placeholder="Enter Resend API key (re_...)"
                  disabled={!integrations.resend_enabled}
                />
                <Label>From Email</Label>
                <Input
                  type="email"
                  value={integrations.resend_from_email}
                  onChange={(e) => setIntegrations({
                    ...integrations,
                    resend_from_email: e.target.value
                  })}
                  placeholder="TruckMates <notifications@yourdomain.com>"
                  disabled={!integrations.resend_enabled}
                />
                <p className="text-xs text-muted-foreground">
                  Use your verified domain email or onboarding@resend.dev for testing
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
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

