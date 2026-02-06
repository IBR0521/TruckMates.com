"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Plug, 
  CheckCircle2,
  XCircle,
  ExternalLink,
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
          <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Platform Integrations</h2>
          <p className="text-sm text-muted-foreground mb-6">
            These integrations are automatically available to all users. API keys are managed platform-wide.
          </p>
          
          <div className="space-y-4">
            {/* Google Maps */}
            <div className="border rounded-lg p-4 bg-card">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">Google Maps</h3>
                    <Badge variant="outline" className="text-xs">Auto-Configured</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Route optimization and mapping features</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span className="text-sm text-muted-foreground">Active</span>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Route optimization, distance calculations, and mapping features are automatically available. 
                  No configuration needed - API key is managed platform-wide.
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                  <span>Route optimization enabled</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                  <span>Real-time traffic data enabled</span>
                </div>
              </div>
            </div>

            {/* Resend Email */}
            <div className="border rounded-lg p-4 bg-card">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">Email Service</h3>
                    <Badge variant="outline" className="text-xs">Auto-Configured</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Send invoices and notifications via email</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span className="text-sm text-muted-foreground">Active</span>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Email notifications, invoice emails, and customer communications are automatically enabled. 
                  No configuration needed - email service is managed platform-wide.
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                  <span>Invoice emails enabled</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                  <span>Notification emails enabled</span>
                </div>
              </div>
            </div>

            {/* External Load Boards */}
            <div className="border rounded-lg p-4 border-primary/20 bg-primary/5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold">External Load Boards</h3>
                  <p className="text-sm text-muted-foreground">Connect to DAT, Truckstop, 123Loadboard to sync loads automatically</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-3">
                  Sync loads from external load boards directly into your system. Requires API credentials from the load board provider.
                </p>
                <Link href="/dashboard/loads/external">
                  <Button variant="outline" className="w-full sm:w-auto">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Manage External Load Boards
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Note about API keys */}
          <Card className="p-4 bg-muted/50 border-dashed mt-6">
            <p className="text-xs text-muted-foreground">
              <strong>Note:</strong> Google Maps and Email Service integrations use platform-wide API keys 
              configured by the administrator. Individual users don't need to configure API keys - these features are 
              automatically available to all users.
            </p>
          </Card>
        </Card>
        )}
      </div>
    </div>
  )
}

