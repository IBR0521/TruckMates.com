"use client"

import { Card } from "@/components/ui/card"
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
import { getIntegrationSettings } from "@/app/actions/settings-integration"

export default function IntegrationSettingsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [integrations, setIntegrations] = useState({
    google_maps_enabled: true, // Auto-enabled (platform API key)
    resend_enabled: true, // Auto-enabled (platform API key)
    quickbooks_enabled: false,
    stripe_enabled: false,
    paypal_enabled: false,
    has_quickbooks_credentials: false,
    has_stripe_api_key: false,
    has_paypal_client_id: false,
    has_google_maps_api_key: false,
    has_resend_api_key: false,
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
            google_maps_enabled: result.data.google_maps_enabled !== false, // Default to true
            resend_enabled: result.data.resend_enabled !== false, // Default to true
            quickbooks_enabled: !!result.data.quickbooks_enabled,
            stripe_enabled: !!result.data.stripe_enabled,
            paypal_enabled: !!result.data.paypal_enabled,
            has_quickbooks_credentials: !!result.data.has_quickbooks_credentials,
            has_stripe_api_key: !!result.data.has_stripe_api_key,
            has_paypal_client_id: !!result.data.has_paypal_client_id,
            has_google_maps_api_key: !!result.data.has_google_maps_api_key,
            has_resend_api_key: !!result.data.has_resend_api_key,
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
                      <Badge variant="secondary" className="text-xs">Coming soon</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Sync invoices and payments between TruckLogics and QuickBooks Online.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <XCircle className="w-5 h-5 text-amber-500" />
                    <span className="text-sm text-muted-foreground">Not yet available</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  OAuth connection and automatic sync are in development. You can&apos;t connect QuickBooks yet,
                  but this integration is planned.
                </p>
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
  )
}

