"use client"

import { Card } from "@/components/ui/card"
import { errorMessage } from "@/lib/error-message"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Plug, 
  CheckCircle2,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { useState, useEffect } from "react"
import Link from "next/link"
import { getIntegrationSettings, updateIntegrationSettings } from "@/app/actions/settings-integration"
import { getGLAccounts } from "@/app/actions/gl-accounts"
import { useSearchParams } from "next/navigation"
import { UpgradeModal } from "@/components/billing/upgrade-modal"

type QuickBooksIntegrationSnapshot = {
  has_quickbooks_connection?: boolean
  quickbooks_sandbox?: boolean
  quickbooks_synced_at?: string | null
  quickbooks_default_income_account_id?: string | null
  quickbooks_default_item_id?: string | null
  quickbooks_gl_account_mappings?: Record<string, string>
  quickbooks_allowed?: boolean
}

export default function IntegrationSettingsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const searchParams = useSearchParams()
  const [integrations, setIntegrations] = useState({
    google_maps_enabled: true, // Auto-enabled (platform API key)
    resend_enabled: true, // Auto-enabled (platform API key)
    quickbooks_enabled: false,
    stripe_enabled: false,
    paypal_enabled: false,
    has_quickbooks_credentials: false,
    has_quickbooks_connection: false,
    has_stripe_api_key: false,
    has_paypal_client_id: false,
    has_google_maps_api_key: false,
    has_resend_api_key: false,
    quickbooks_sandbox: true,
    quickbooks_synced_at: null as string | null,
    quickbooks_default_income_account_id: "" as string,
    quickbooks_default_item_id: "" as string,
    quickbooks_gl_account_mappings: {} as Record<string, string>,
    quickbooks_allowed: false,
    comdata_enabled: false,
    wex_enabled: false,
    efs_enabled: false,
    has_comdata_credentials: false,
    has_wex_credentials: false,
    has_efs_credentials: false,
    comdata_api_base_url: "",
    wex_api_base_url: "",
    efs_api_base_url: "",
    comdata_api_key: "",
    comdata_api_secret: "",
    wex_api_key: "",
    wex_api_secret: "",
    efs_api_key: "",
    efs_api_secret: "",
    fuel_card_last_synced_at: null as string | null,
  })
  const [glAccounts, setGlAccounts] = useState<Array<{ id: string; code: string; name: string; type: string }>>([])
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  function isQuickBooksUpgradeError(message: string | undefined) {
    const text = String(message || "").toLowerCase()
    return text.includes("available on fleet and enterprise plans") || text.includes("upgrade_required")
  }

  useEffect(() => {
    async function loadSettings() {
      setIsLoading(true)
      try {
        const [result, glResult] = await Promise.all([getIntegrationSettings(), getGLAccounts()])
        if (result.error) {
          toast.error(result.error)
        } else if (result.data) {
          const quickBooks = result.data as QuickBooksIntegrationSnapshot
          setIntegrations({
            google_maps_enabled: result.data.google_maps_enabled !== false, // Default to true
            resend_enabled: result.data.resend_enabled !== false, // Default to true
            quickbooks_enabled: !!result.data.quickbooks_enabled,
            stripe_enabled: !!result.data.stripe_enabled,
            paypal_enabled: !!result.data.paypal_enabled,
            has_quickbooks_credentials: !!result.data.has_quickbooks_credentials,
            has_quickbooks_connection: !!quickBooks.has_quickbooks_connection,
            has_stripe_api_key: !!result.data.has_stripe_api_key,
            has_paypal_client_id: !!result.data.has_paypal_client_id,
            has_google_maps_api_key: !!result.data.has_google_maps_api_key,
            has_resend_api_key: !!result.data.has_resend_api_key,
            quickbooks_sandbox: quickBooks.quickbooks_sandbox !== false,
            quickbooks_synced_at: quickBooks.quickbooks_synced_at || null,
            quickbooks_default_income_account_id:
              quickBooks.quickbooks_default_income_account_id || "",
            quickbooks_default_item_id: quickBooks.quickbooks_default_item_id || "",
            quickbooks_gl_account_mappings: quickBooks.quickbooks_gl_account_mappings || {},
            quickbooks_allowed: !!quickBooks.quickbooks_allowed,
            comdata_enabled: !!result.data.comdata_enabled,
            wex_enabled: !!result.data.wex_enabled,
            efs_enabled: !!result.data.efs_enabled,
            has_comdata_credentials: !!result.data.has_comdata_credentials,
            has_wex_credentials: !!result.data.has_wex_credentials,
            has_efs_credentials: !!result.data.has_efs_credentials,
            comdata_api_base_url: result.data.comdata_api_base_url || "",
            wex_api_base_url: result.data.wex_api_base_url || "",
            efs_api_base_url: result.data.efs_api_base_url || "",
            comdata_api_key: "",
            comdata_api_secret: "",
            wex_api_key: "",
            wex_api_secret: "",
            efs_api_key: "",
            efs_api_secret: "",
            fuel_card_last_synced_at: result.data.fuel_card_last_synced_at || null,
          })
        }
        if (!glResult.error && glResult.data) {
          setGlAccounts(glResult.data)
        }
      } catch (error) {
        toast.error("Failed to load integration settings")
      } finally {
        setIsLoading(false)
      }
    }
    loadSettings()
  }, [])

  useEffect(() => {
    const ok = searchParams.get("quickbooks_success")
    const err = searchParams.get("quickbooks_error")
    if (ok) toast.success("QuickBooks connected")
    if (err) {
      if (isQuickBooksUpgradeError(err)) {
        setShowUpgradeModal(true)
      } else {
        toast.error(`QuickBooks error: ${err}`)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  async function disconnectQuickBooks() {
    try {
      const res = await fetch("/api/quickbooks/disconnect", { method: "POST" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || "Disconnect failed")
      toast.success("QuickBooks disconnected")
      // Refresh UI state
      const result = await getIntegrationSettings()
      if (!result.error && result.data) {
        const quickBooks = result.data as QuickBooksIntegrationSnapshot
        setIntegrations((prev) => ({
          ...prev,
          quickbooks_enabled: !!result.data.quickbooks_enabled,
          has_quickbooks_credentials: !!result.data.has_quickbooks_credentials,
          has_quickbooks_connection: !!quickBooks.has_quickbooks_connection,
          quickbooks_sandbox: quickBooks.quickbooks_sandbox !== false,
        }))
      }
    } catch (e: unknown) {
      if (isQuickBooksUpgradeError(errorMessage(e))) {
        setShowUpgradeModal(true)
        return
      }
      toast.error(errorMessage(e, "Failed to disconnect"))
    }
  }

  async function testQuickBooks() {
    try {
      const res = await fetch("/api/quickbooks/test", { method: "POST" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || "Test failed")
      toast.success(`QuickBooks connected: ${json?.companyInfo?.CompanyName || "OK"}`)
    } catch (e: unknown) {
      if (isQuickBooksUpgradeError(errorMessage(e))) {
        setShowUpgradeModal(true)
        return
      }
      toast.error(errorMessage(e, "QuickBooks test failed"))
    }
  }

  async function syncQuickBooks() {
    try {
      const res = await fetch("/api/quickbooks/sync", { method: "POST" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || "Sync failed")
      toast.success(`Synced ${json?.accounts_count ?? 0} accounts`)
      const result = await getIntegrationSettings()
      if (!result.error && result.data) {
        const quickBooks = result.data as QuickBooksIntegrationSnapshot
        setIntegrations((prev) => ({
          ...prev,
          quickbooks_synced_at: quickBooks.quickbooks_synced_at || null,
        }))
      }
    } catch (e: unknown) {
      if (isQuickBooksUpgradeError(errorMessage(e))) {
        setShowUpgradeModal(true)
        return
      }
      toast.error(errorMessage(e, "QuickBooks sync failed"))
    }
  }

  async function saveQuickBooksMapping() {
    try {
      const res = await fetch("/api/actions/settings/integration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quickbooks_default_income_account_id: integrations.quickbooks_default_income_account_id || null,
          quickbooks_default_item_id: integrations.quickbooks_default_item_id || null,
          quickbooks_gl_account_mappings: integrations.quickbooks_gl_account_mappings || {},
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        throw new Error(json?.error || "Failed to save mapping")
      }
      toast.success("QuickBooks mapping saved")
    } catch (e: unknown) {
      toast.error(errorMessage(e, "Failed to save QuickBooks mapping"))
    }
  }

  async function saveFuelCardSettings() {
    try {
      const payload: Parameters<typeof updateIntegrationSettings>[0] = {
        comdata_enabled: integrations.comdata_enabled,
        comdata_api_base_url: integrations.comdata_api_base_url || undefined,
        wex_enabled: integrations.wex_enabled,
        wex_api_base_url: integrations.wex_api_base_url || undefined,
        efs_enabled: integrations.efs_enabled,
        efs_api_base_url: integrations.efs_api_base_url || undefined,
      }
      if (integrations.comdata_api_key) payload.comdata_api_key = integrations.comdata_api_key
      if (integrations.comdata_api_secret) payload.comdata_api_secret = integrations.comdata_api_secret
      if (integrations.wex_api_key) payload.wex_api_key = integrations.wex_api_key
      if (integrations.wex_api_secret) payload.wex_api_secret = integrations.wex_api_secret
      if (integrations.efs_api_key) payload.efs_api_key = integrations.efs_api_key
      if (integrations.efs_api_secret) payload.efs_api_secret = integrations.efs_api_secret

      const result = await updateIntegrationSettings(payload)
      if (!result.success) throw new Error(result.error || "Save failed")
      toast.success("Fuel card settings saved")
      const refreshed = await getIntegrationSettings()
      if (!refreshed.error && refreshed.data) {
        setIntegrations((prev) => ({
          ...prev,
          has_comdata_credentials: !!refreshed.data?.has_comdata_credentials,
          has_wex_credentials: !!refreshed.data?.has_wex_credentials,
          has_efs_credentials: !!refreshed.data?.has_efs_credentials,
          fuel_card_last_synced_at: refreshed.data?.fuel_card_last_synced_at || null,
          comdata_api_key: "",
          comdata_api_secret: "",
          wex_api_key: "",
          wex_api_secret: "",
          efs_api_key: "",
          efs_api_secret: "",
        }))
      }
    } catch (e: unknown) {
      toast.error(errorMessage(e, "Failed to save fuel card settings"))
    }
  }

  function FuelProviderFields(props: {
    label: string
    enabled: boolean
    onEnabledChange: (v: boolean) => void
    baseUrl: string
    onBaseUrlChange: (v: string) => void
    apiKey: string
    onApiKeyChange: (v: string) => void
    apiSecret: string
    onApiSecretChange: (v: string) => void
    hasCredentials: boolean
  }) {
    return (
      <div className="border rounded-lg p-4 bg-card space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h4 className="font-medium">{props.label}</h4>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={props.enabled}
              onChange={(e) => props.onEnabledChange(e.target.checked)}
            />
            Enabled
          </label>
        </div>
        <div className="grid gap-2">
          <input
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
            placeholder="API base URL"
            value={props.baseUrl}
            onChange={(e) => props.onBaseUrlChange(e.target.value)}
          />
          <input
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
            placeholder={props.hasCredentials ? "API key (leave blank to keep)" : "API key"}
            value={props.apiKey}
            onChange={(e) => props.onApiKeyChange(e.target.value)}
          />
          <input
            type="password"
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
            placeholder={props.hasCredentials ? "API secret (leave blank to keep)" : "API secret"}
            value={props.apiSecret}
            onChange={(e) => props.onApiSecretChange(e.target.value)}
          />
        </div>
        {props.hasCredentials && (
          <p className="text-xs text-muted-foreground">Credentials configured</p>
        )}
      </div>
    )
  }


  return (
    <>
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
          <Card className="p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-2">Platform Integrations</h2>
              <p className="text-sm text-muted-foreground">
                These integrations are configured at the platform level. Some are fully active today, others are in progress.
              </p>
            </div>

            <div className="space-y-4">
              {/* Google Maps */}
              <div className="border rounded-lg p-4 bg-card">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">Google Maps</h3>
                      <Badge variant="outline" className="text-xs">Auto-Configured</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Route optimization, distance calculations, and live map views.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {integrations.has_google_maps_api_key ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        <span className="text-sm text-muted-foreground">Active</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-5 h-5 text-amber-500" />
                        <span className="text-sm text-muted-foreground">Not Configured</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                    <span>Platform API key managed by TruckLogics</span>
                  </div>
                  {integrations.has_google_maps_api_key ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                      <span>API key configured - Google Maps is fully functional</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <XCircle className="w-3 h-3 text-amber-500" />
                      <span>API key not configured - contact platform administrator</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Email (Resend) */}
              <div className="border rounded-lg p-4 bg-card">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">Email Service</h3>
                      <Badge variant="outline" className="text-xs">Auto-Configured</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Invoice emails, alerts, and notification delivery.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {integrations.has_resend_api_key ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        <span className="text-sm text-muted-foreground">Active</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-5 h-5 text-amber-500" />
                        <span className="text-sm text-muted-foreground">Not Configured</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {integrations.has_resend_api_key ? (
                    <>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                        <span>API key configured - Email service is fully functional</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                        <span>Used for invoice emails, alerts, and notifications</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <XCircle className="w-3 h-3 text-amber-500" />
                        <span>
                          API key not configured – invoice reminders, driver alerts, and load updates will{' '}
                          <span className="font-semibold">not be sent by email</span> until this is set up.
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <XCircle className="w-3 h-3 text-amber-500" />
                        <span>Contact platform administrator to configure email service</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* QuickBooks Online */}
              <div className="border rounded-lg p-4 bg-card">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">QuickBooks Online</h3>
                      {integrations.has_quickbooks_connection ? (
                        <Badge variant="outline" className="text-xs">Connected</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Not connected</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Sync invoices and payments between TruckLogics and QuickBooks Online.
                    </p>
                    {!integrations.quickbooks_allowed && (
                      <p className="text-xs text-amber-500 mt-1">
                        Available on Fleet and Enterprise plans.
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {integrations.has_quickbooks_connection ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        <span className="text-sm text-muted-foreground">Active</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-5 h-5 text-amber-500" />
                        <span className="text-sm text-muted-foreground">Inactive</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                  <p className="text-xs text-muted-foreground">
                    {integrations.has_quickbooks_connection
                      ? `Connected via OAuth (${integrations.quickbooks_sandbox ? "Sandbox" : "Production"}).`
                      : "Connect your QuickBooks Online account via OAuth."}
                  </p>
                  <div className="flex gap-2">
                    {integrations.has_quickbooks_connection ? (
                      <>
                        <Button variant="outline" size="sm" onClick={syncQuickBooks}>
                          Sync
                        </Button>
                        <Button variant="outline" size="sm" onClick={testQuickBooks}>
                          Test
                        </Button>
                        <Button variant="destructive" size="sm" onClick={disconnectQuickBooks}>
                          Disconnect
                        </Button>
                      </>
                    ) : integrations.quickbooks_allowed ? (
                        <Button asChild size="sm">
                          <Link href="/api/quickbooks/connect">Connect</Link>
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => setShowUpgradeModal(true)}>
                          Upgrade to Connect
                        </Button>
                      )
                    }
                  </div>
                </div>
                {!integrations.quickbooks_allowed && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Upgrade to Fleet or Enterprise to enable QuickBooks sync.
                  </p>
                )}
                {integrations.has_quickbooks_connection && (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Default Income Account ID
                      </label>
                      <input
                        className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                        value={integrations.quickbooks_default_income_account_id}
                        onChange={(e) =>
                          setIntegrations((prev) => ({
                            ...prev,
                            quickbooks_default_income_account_id: e.target.value,
                          }))
                        }
                        placeholder="e.g. 42"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Optional. If set, this Income Account will be used for all synced invoices.
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Default Service Item ID
                      </label>
                      <input
                        className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                        value={integrations.quickbooks_default_item_id}
                        onChange={(e) =>
                          setIntegrations((prev) => ({
                            ...prev,
                            quickbooks_default_item_id: e.target.value,
                          }))
                        }
                        placeholder="e.g. 15"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Optional. If set, this Item will be used instead of auto-creating &quot;Freight Services&quot;.
                      </p>
                    </div>
                    <div className="md:col-span-2 flex justify-end">
                      <Button variant="outline" size="sm" onClick={saveQuickBooksMapping}>
                        Save QuickBooks mapping
                      </Button>
                    </div>
                  </div>
                )}
                {integrations.has_quickbooks_connection && (
                  <div className="mt-4 border rounded-md p-3">
                    <p className="text-xs font-medium text-foreground mb-2">GL Code to QuickBooks Account ID Mapping</p>
                    <p className="text-[11px] text-muted-foreground mb-3">
                      Map each GL code to a QuickBooks Account ID so expense/AP sync lands in the right account.
                    </p>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {glAccounts.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No GL accounts found yet.</p>
                      ) : (
                        glAccounts.map((acc) => (
                          <div key={acc.id} className="grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-2 items-center">
                            <div className="text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">{acc.code}</span> - {acc.name}
                            </div>
                            <input
                              className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                              value={integrations.quickbooks_gl_account_mappings?.[acc.code] || ""}
                              onChange={(e) =>
                                setIntegrations((prev) => ({
                                  ...prev,
                                  quickbooks_gl_account_mappings: {
                                    ...(prev.quickbooks_gl_account_mappings || {}),
                                    [acc.code]: e.target.value,
                                  },
                                }))
                              }
                              placeholder="QuickBooks Account ID"
                            />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
                {integrations.has_quickbooks_connection && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Last synced: {integrations.quickbooks_synced_at ? new Date(integrations.quickbooks_synced_at).toLocaleString() : "Never"}
                  </p>
                )}
                {integrations.has_quickbooks_connection && (
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Note: A company stays on the sandbox/production mode it connected with until they disconnect and reconnect.
                  </p>
                )}
              </div>

              {/* Fuel card providers */}
              <div className="border rounded-lg p-4 bg-card space-y-4">
                <div>
                  <h3 className="font-semibold">Fuel card imports</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Connect Comdata, WEX, or EFS credentials for automated fuel card transaction imports.
                  </p>
                  {integrations.fuel_card_last_synced_at && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Last synced: {new Date(integrations.fuel_card_last_synced_at).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="grid gap-4 md:grid-cols-1">
                  <FuelProviderFields
                    label="Comdata"
                    enabled={integrations.comdata_enabled}
                    onEnabledChange={(v) => setIntegrations((p) => ({ ...p, comdata_enabled: v }))}
                    baseUrl={integrations.comdata_api_base_url}
                    onBaseUrlChange={(v) => setIntegrations((p) => ({ ...p, comdata_api_base_url: v }))}
                    apiKey={integrations.comdata_api_key}
                    onApiKeyChange={(v) => setIntegrations((p) => ({ ...p, comdata_api_key: v }))}
                    apiSecret={integrations.comdata_api_secret}
                    onApiSecretChange={(v) => setIntegrations((p) => ({ ...p, comdata_api_secret: v }))}
                    hasCredentials={integrations.has_comdata_credentials}
                  />
                  <FuelProviderFields
                    label="WEX"
                    enabled={integrations.wex_enabled}
                    onEnabledChange={(v) => setIntegrations((p) => ({ ...p, wex_enabled: v }))}
                    baseUrl={integrations.wex_api_base_url}
                    onBaseUrlChange={(v) => setIntegrations((p) => ({ ...p, wex_api_base_url: v }))}
                    apiKey={integrations.wex_api_key}
                    onApiKeyChange={(v) => setIntegrations((p) => ({ ...p, wex_api_key: v }))}
                    apiSecret={integrations.wex_api_secret}
                    onApiSecretChange={(v) => setIntegrations((p) => ({ ...p, wex_api_secret: v }))}
                    hasCredentials={integrations.has_wex_credentials}
                  />
                  <FuelProviderFields
                    label="EFS"
                    enabled={integrations.efs_enabled}
                    onEnabledChange={(v) => setIntegrations((p) => ({ ...p, efs_enabled: v }))}
                    baseUrl={integrations.efs_api_base_url}
                    onBaseUrlChange={(v) => setIntegrations((p) => ({ ...p, efs_api_base_url: v }))}
                    apiKey={integrations.efs_api_key}
                    onApiKeyChange={(v) => setIntegrations((p) => ({ ...p, efs_api_key: v }))}
                    apiSecret={integrations.efs_api_secret}
                    onApiSecretChange={(v) => setIntegrations((p) => ({ ...p, efs_api_secret: v }))}
                    hasCredentials={integrations.has_efs_credentials}
                  />
                </div>
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => void saveFuelCardSettings()}>
                    Save fuel card settings
                  </Button>
                </div>
              </div>

              {/* Stripe */}
              <div className="border rounded-lg p-4 bg-card">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">Stripe</h3>
                      <Badge variant="secondary" className="text-xs">Coming soon</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Accept card payments for invoices directly from customers.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <XCircle className="w-5 h-5 text-amber-500" />
                    <span className="text-sm text-muted-foreground">Not yet available</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Stripe checkout and hosted payment pages are planned, but not live yet in this environment.
                </p>
              </div>

              {/* PayPal */}
              <div className="border rounded-lg p-4 bg-card">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">PayPal</h3>
                      <Badge variant="secondary" className="text-xs">Coming soon</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Let customers pay invoices using their PayPal account or cards.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <XCircle className="w-5 h-5 text-amber-500" />
                    <span className="text-sm text-muted-foreground">Not yet available</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  PayPal checkout integration is not active yet. Any PayPal-related settings here will not trigger live sync.
                </p>
              </div>
            </div>

            {/* Note about API keys */}
            <Card className="p-4 bg-muted/50 border-dashed">
              <p className="text-xs text-muted-foreground">
                <strong>Platform Services:</strong> Google Maps and Email Service use platform-wide API keys configured by the platform administrator.
                These services are automatically enabled for all companies and work immediately after account creation.
                You don't need to configure anything - they're ready to use!
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                <strong>Coming Soon:</strong> Billing integrations (QuickBooks, Stripe, PayPal) are under active development and marked as{" "}
                <span className="font-semibold">Coming soon</span> until the full OAuth and sync flows are live.
              </p>
            </Card>
          </Card>
        )}
      </div>
    </div>
    <UpgradeModal open={showUpgradeModal} onOpenChange={setShowUpgradeModal} feature="quickbooks" />
    </>
  )
}

