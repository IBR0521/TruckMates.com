"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { 
  Plug, 
  Save,
  CheckCircle2,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { useState, useEffect } from "react"
import { getIntegrationSettings, updateIntegrationSettings } from "@/app/actions/settings-integration"

export default function IntegrationSettingsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [integrations, setIntegrations] = useState({
    quickbooks_enabled: false,
    quickbooks_api_key: "",
    stripe_enabled: false,
    stripe_api_key: "",
    paypal_enabled: false,
    paypal_client_id: "",
    google_maps_enabled: false,
    google_maps_api_key: "",
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
            stripe_enabled: result.data.stripe_enabled || false,
            stripe_api_key: result.data.stripe_api_key || "",
            paypal_enabled: result.data.paypal_enabled || false,
            paypal_client_id: result.data.paypal_client_id || "",
            google_maps_enabled: result.data.google_maps_enabled || false,
            google_maps_api_key: result.data.google_maps_api_key || "",
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
        stripe_enabled: integrations.stripe_enabled,
        stripe_api_key: integrations.stripe_api_key,
        paypal_enabled: integrations.paypal_enabled,
        paypal_client_id: integrations.paypal_client_id,
        google_maps_enabled: integrations.google_maps_enabled,
        google_maps_api_key: integrations.google_maps_api_key,
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
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold">QuickBooks</h3>
                  <p className="text-sm text-muted-foreground">Sync accounting data with QuickBooks</p>
                </div>
                <div className="flex items-center gap-2">
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
              </div>
            </div>

            {/* Stripe */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold">Stripe</h3>
                  <p className="text-sm text-muted-foreground">Process payments with Stripe</p>
                </div>
                <div className="flex items-center gap-2">
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
                  placeholder="Enter Stripe API key"
                  disabled={!integrations.stripe_enabled}
                />
              </div>
            </div>

            {/* Google Maps */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold">Google Maps</h3>
                  <p className="text-sm text-muted-foreground">Enhanced mapping and routing</p>
                </div>
                <div className="flex items-center gap-2">
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

