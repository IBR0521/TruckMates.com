"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { 
  ArrowLeft, 
  Save, 
  TestTube,
  CheckCircle2,
  XCircle,
  ExternalLink,
  RefreshCw
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { 
  getExternalBrokerIntegrations, 
  upsertExternalBrokerIntegration,
  testExternalBrokerConnection 
} from "@/app/actions/external-broker-integrations"

export default function ExternalLoadBoardsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState<string | null>(null)
  const [integrations, setIntegrations] = useState<any[]>([])
  const [selectedProvider, setSelectedProvider] = useState<"dat" | "truckstop" | "123loadboard" | "other">("dat")
  const [formData, setFormData] = useState({
    provider: "dat" as "dat" | "truckstop" | "123loadboard" | "other",
    dat_enabled: false,
    dat_api_key: "",
    dat_api_secret: "",
    dat_username: "",
    dat_password: "",
    dat_subscription_tier: "standard",
    dat_sync_enabled: false,
    truckstop_enabled: false,
    truckstop_api_key: "",
    truckstop_api_secret: "",
    truckstop_username: "",
    truckstop_password: "",
    truckstop_subscription_tier: "basic",
    truckstop_sync_enabled: false,
    loadboard123_enabled: false,
    loadboard123_api_key: "",
    loadboard123_username: "",
    loadboard123_password: "",
    loadboard123_sync_enabled: false,
    other_provider_name: "",
    other_api_key: "",
    other_api_secret: "",
    other_api_url: "",
    other_sync_enabled: false,
    auto_sync_enabled: false,
    sync_interval_minutes: 15,
    max_loads_per_sync: 100,
  })

  useEffect(() => {
    loadIntegrations()
  }, [])

  async function loadIntegrations() {
    setIsLoading(true)
    try {
      const result = await getExternalBrokerIntegrations()
      if (result.error) {
        toast.error(result.error)
      } else {
        setIntegrations(result.data || [])
        // Load existing integration data if available
        if (result.data && result.data.length > 0) {
          const existing = result.data[0]
          setFormData({
            ...formData,
            ...existing,
            provider: existing.provider || "dat",
          })
          setSelectedProvider(existing.provider || "dat")
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to load integrations")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      const result = await upsertExternalBrokerIntegration({
        ...formData,
        provider: selectedProvider,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Integration saved successfully!")
        loadIntegrations()
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to save integration")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleTest(integrationId: string) {
    setIsTesting(integrationId)
    try {
      const result = await testExternalBrokerConnection(integrationId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Connection test successful!")
      }
    } catch (error: any) {
      toast.error(error.message || "Connection test failed")
    } finally {
      setIsTesting(null)
    }
  }

  const providers = [
    { value: "dat", label: "DAT (DAT One / DAT Power)", description: "Largest load board in North America" },
    { value: "truckstop", label: "Truckstop.com", description: "Major load board with broker tools" },
    { value: "123loadboard", label: "123Loadboard", description: "Affordable alternative load board" },
    { value: "other", label: "Other Provider", description: "Custom load board integration" },
  ]

  return (
    <div className="w-full p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <Link href="/dashboard/settings/integration" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Integrations
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <ExternalLink className="w-6 h-6" />
            External Load Board Integrations
          </h1>
          <p className="text-muted-foreground mt-2">
            Connect to external load boards to automatically sync available loads
          </p>
        </div>

        {isLoading ? (
          <Card className="p-6">
            <p className="text-muted-foreground">Loading...</p>
          </Card>
        ) : (
          <Card className="p-6">
            {/* Provider Selection */}
            <div className="mb-6">
              <Label className="mb-2 block">Select Load Board Provider</Label>
              <Select value={selectedProvider} onValueChange={(value: any) => setSelectedProvider(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((provider) => (
                    <SelectItem key={provider.value} value={provider.value}>
                      {provider.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-2">
                {providers.find(p => p.value === selectedProvider)?.description}
              </p>
            </div>

            {/* DAT Configuration */}
            {selectedProvider === "dat" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable DAT Integration</Label>
                  <Switch
                    checked={formData.dat_enabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, dat_enabled: checked })}
                  />
                </div>
                {formData.dat_enabled && (
                  <>
                    <div>
                      <Label>API Key</Label>
                      <Input
                        type="password"
                        value={formData.dat_api_key}
                        onChange={(e) => setFormData({ ...formData, dat_api_key: e.target.value })}
                        placeholder="Enter DAT API key"
                      />
                    </div>
                    <div>
                      <Label>API Secret</Label>
                      <Input
                        type="password"
                        value={formData.dat_api_secret}
                        onChange={(e) => setFormData({ ...formData, dat_api_secret: e.target.value })}
                        placeholder="Enter DAT API secret"
                      />
                    </div>
                    <div>
                      <Label>Username</Label>
                      <Input
                        value={formData.dat_username}
                        onChange={(e) => setFormData({ ...formData, dat_username: e.target.value })}
                        placeholder="Enter DAT username"
                      />
                    </div>
                    <div>
                      <Label>Password</Label>
                      <Input
                        type="password"
                        value={formData.dat_password}
                        onChange={(e) => setFormData({ ...formData, dat_password: e.target.value })}
                        placeholder="Enter DAT password"
                      />
                    </div>
                    <div>
                      <Label>Subscription Tier</Label>
                      <Select
                        value={formData.dat_subscription_tier}
                        onValueChange={(value) => setFormData({ ...formData, dat_subscription_tier: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">Standard</SelectItem>
                          <SelectItem value="enhanced">Enhanced</SelectItem>
                          <SelectItem value="pro">Pro</SelectItem>
                          <SelectItem value="select">Select</SelectItem>
                          <SelectItem value="office">Office</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Enable Auto-Sync</Label>
                      <Switch
                        checked={formData.dat_sync_enabled}
                        onCheckedChange={(checked) => setFormData({ ...formData, dat_sync_enabled: checked })}
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Truckstop Configuration */}
            {selectedProvider === "truckstop" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable Truckstop Integration</Label>
                  <Switch
                    checked={formData.truckstop_enabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, truckstop_enabled: checked })}
                  />
                </div>
                {formData.truckstop_enabled && (
                  <>
                    <div>
                      <Label>API Key</Label>
                      <Input
                        type="password"
                        value={formData.truckstop_api_key}
                        onChange={(e) => setFormData({ ...formData, truckstop_api_key: e.target.value })}
                        placeholder="Enter Truckstop API key"
                      />
                    </div>
                    <div>
                      <Label>API Secret</Label>
                      <Input
                        type="password"
                        value={formData.truckstop_api_secret}
                        onChange={(e) => setFormData({ ...formData, truckstop_api_secret: e.target.value })}
                        placeholder="Enter Truckstop API secret"
                      />
                    </div>
                    <div>
                      <Label>Username</Label>
                      <Input
                        value={formData.truckstop_username}
                        onChange={(e) => setFormData({ ...formData, truckstop_username: e.target.value })}
                        placeholder="Enter Truckstop username"
                      />
                    </div>
                    <div>
                      <Label>Password</Label>
                      <Input
                        type="password"
                        value={formData.truckstop_password}
                        onChange={(e) => setFormData({ ...formData, truckstop_password: e.target.value })}
                        placeholder="Enter Truckstop password"
                      />
                    </div>
                    <div>
                      <Label>Subscription Tier</Label>
                      <Select
                        value={formData.truckstop_subscription_tier}
                        onValueChange={(value) => setFormData({ ...formData, truckstop_subscription_tier: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="basic">Basic</SelectItem>
                          <SelectItem value="advanced">Advanced</SelectItem>
                          <SelectItem value="pro">Pro</SelectItem>
                          <SelectItem value="premium">Premium</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Enable Auto-Sync</Label>
                      <Switch
                        checked={formData.truckstop_sync_enabled}
                        onCheckedChange={(checked) => setFormData({ ...formData, truckstop_sync_enabled: checked })}
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 123Loadboard Configuration */}
            {selectedProvider === "123loadboard" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable 123Loadboard Integration</Label>
                  <Switch
                    checked={formData.loadboard123_enabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, loadboard123_enabled: checked })}
                  />
                </div>
                {formData.loadboard123_enabled && (
                  <>
                    <div>
                      <Label>API Key</Label>
                      <Input
                        type="password"
                        value={formData.loadboard123_api_key}
                        onChange={(e) => setFormData({ ...formData, loadboard123_api_key: e.target.value })}
                        placeholder="Enter 123Loadboard API key"
                      />
                    </div>
                    <div>
                      <Label>Username</Label>
                      <Input
                        value={formData.loadboard123_username}
                        onChange={(e) => setFormData({ ...formData, loadboard123_username: e.target.value })}
                        placeholder="Enter 123Loadboard username"
                      />
                    </div>
                    <div>
                      <Label>Password</Label>
                      <Input
                        type="password"
                        value={formData.loadboard123_password}
                        onChange={(e) => setFormData({ ...formData, loadboard123_password: e.target.value })}
                        placeholder="Enter 123Loadboard password"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Enable Auto-Sync</Label>
                      <Switch
                        checked={formData.loadboard123_sync_enabled}
                        onCheckedChange={(checked) => setFormData({ ...formData, loadboard123_sync_enabled: checked })}
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Other Provider Configuration */}
            {selectedProvider === "other" && (
              <div className="space-y-4">
                <div>
                  <Label>Provider Name</Label>
                  <Input
                    value={formData.other_provider_name}
                    onChange={(e) => setFormData({ ...formData, other_provider_name: e.target.value })}
                    placeholder="Enter provider name"
                  />
                </div>
                <div>
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    value={formData.other_api_key}
                    onChange={(e) => setFormData({ ...formData, other_api_key: e.target.value })}
                    placeholder="Enter API key"
                  />
                </div>
                <div>
                  <Label>API Secret</Label>
                  <Input
                    type="password"
                    value={formData.other_api_secret}
                    onChange={(e) => setFormData({ ...formData, other_api_secret: e.target.value })}
                    placeholder="Enter API secret"
                  />
                </div>
                <div>
                  <Label>API URL</Label>
                  <Input
                    value={formData.other_api_url}
                    onChange={(e) => setFormData({ ...formData, other_api_url: e.target.value })}
                    placeholder="https://api.example.com/v1"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Auto-Sync</Label>
                  <Switch
                    checked={formData.other_sync_enabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, other_sync_enabled: checked })}
                  />
                </div>
              </div>
            )}

            {/* Common Sync Settings */}
            <div className="mt-6 pt-6 border-t space-y-4">
              <h3 className="font-semibold">Sync Settings</h3>
              <div className="flex items-center justify-between">
                <Label>Enable Auto-Sync</Label>
                <Switch
                  checked={formData.auto_sync_enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, auto_sync_enabled: checked })}
                />
              </div>
              {formData.auto_sync_enabled && (
                <>
                  <div>
                    <Label>Sync Interval (minutes)</Label>
                    <Select
                      value={formData.sync_interval_minutes.toString()}
                      onValueChange={(value) => setFormData({ ...formData, sync_interval_minutes: parseInt(value) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="60">60 minutes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Max Loads Per Sync</Label>
                    <Input
                      type="number"
                      value={formData.max_loads_per_sync}
                      onChange={(e) => setFormData({ ...formData, max_loads_per_sync: parseInt(e.target.value) || 100 })}
                      placeholder="100"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="mt-6 flex gap-2">
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? "Saving..." : "Save Integration"}
              </Button>
              {integrations.length > 0 && integrations[0]?.id && (
                <Button
                  variant="outline"
                  onClick={() => handleTest(integrations[0].id)}
                  disabled={isTesting === integrations[0].id}
                >
                  <TestTube className="w-4 h-4 mr-2" />
                  {isTesting === integrations[0].id ? "Testing..." : "Test Connection"}
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* Info Card */}
        <Card className="p-6 bg-muted/50">
          <h3 className="font-semibold mb-2">Getting API Credentials</h3>
          <p className="text-sm text-muted-foreground mb-4">
            To use external load board integrations, you need to:
          </p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Have an active subscription with the load board provider</li>
            <li>Ensure your subscription includes API access</li>
            <li>Obtain API credentials from the provider's developer portal</li>
            <li>Configure the integration with your credentials</li>
          </ul>
          <div className="mt-4">
            <Link href="/docs/integrations/external-broker-integrations">
              <Button variant="outline" size="sm">
                View Documentation
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}




