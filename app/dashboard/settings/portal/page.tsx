"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { 
  Link as LinkIcon, 
  Save,
  Copy,
  ExternalLink,
} from "lucide-react"
import { toast } from "sonner"
import { useState, useEffect } from "react"
import { getPortalSettings, updatePortalSettings } from "@/app/actions/settings-portal"

export default function PortalSettingsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [portal, setPortal] = useState({
    enabled: true,
    custom_url: "",
    portal_url: "",
    allow_customer_login: true,
    allow_load_tracking: true,
    allow_invoice_viewing: true,
    allow_document_download: true,
    allow_load_submission: false,
    require_authentication: true,
    session_timeout_minutes: 60,
  })

  useEffect(() => {
    async function loadSettings() {
      setIsLoading(true)
      try {
        const result = await getPortalSettings()
        if (result.error) {
          toast.error(result.error)
        } else if (result.data) {
          setPortal({
            enabled: result.data.enabled ?? true,
            custom_url: result.data.custom_url || "",
            portal_url: result.data.portal_url || "",
            allow_customer_login: result.data.allow_customer_login ?? true,
            allow_load_tracking: result.data.allow_load_tracking ?? true,
            allow_invoice_viewing: result.data.allow_invoice_viewing ?? true,
            allow_document_download: result.data.allow_document_download ?? true,
            allow_load_submission: result.data.allow_load_submission ?? false,
            require_authentication: result.data.require_authentication ?? true,
            session_timeout_minutes: result.data.session_timeout_minutes ?? 60,
          })
        }
      } catch (error) {
        toast.error("Failed to load portal settings")
      } finally {
        setIsLoading(false)
      }
    }
    loadSettings()
  }, [])

  const portalUrl = portal.portal_url || (portal.custom_url ? `https://truckmates.com/portal/${portal.custom_url}` : "https://truckmates.com/portal/default")

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(portalUrl)
    toast.success("Portal URL copied to clipboard")
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const result = await updatePortalSettings({
        enabled: portal.enabled,
        custom_url: portal.custom_url,
        allow_customer_login: portal.allow_customer_login,
        allow_load_tracking: portal.allow_load_tracking,
        allow_invoice_viewing: portal.allow_invoice_viewing,
        allow_document_download: portal.allow_document_download,
        allow_load_submission: portal.allow_load_submission,
        require_authentication: portal.require_authentication,
        session_timeout_minutes: portal.session_timeout_minutes,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Portal settings saved successfully")
        // Reload to get updated portal URL
        const reloadResult = await getPortalSettings()
        if (reloadResult.data) {
          setPortal({ ...portal, portal_url: reloadResult.data.portal_url || portalUrl })
        }
      }
    } catch (error) {
      toast.error("Failed to save portal settings")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="w-full p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <LinkIcon className="w-6 h-6" />
            Portal URL Settings
          </h1>
          <p className="text-muted-foreground mt-2">
            Configure your customer portal URL and access settings
          </p>
        </div>

        {isLoading ? (
          <Card className="p-6">
            <p className="text-muted-foreground">Loading...</p>
          </Card>
        ) : (
          <Card className="p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Customer Portal</Label>
                <p className="text-sm text-muted-foreground">Allow customers to access the portal</p>
              </div>
              <Switch
                checked={portal.enabled}
                onCheckedChange={(checked) => setPortal({ ...portal, enabled: checked })}
              />
            </div>

            {portal.enabled && (
              <>
                <div className="space-y-2">
                  <Label>Custom Portal URL</Label>
                  <Input
                    value={portal.custom_url}
                    onChange={(e) => setPortal({ ...portal, custom_url: e.target.value })}
                    placeholder="your-company-name"
                  />
                  <p className="text-sm text-muted-foreground">Customize your portal URL (optional)</p>
                </div>

                <div className="p-4 bg-secondary rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm text-muted-foreground">Portal URL</Label>
                      <p className="font-mono text-sm mt-1">{portalUrl}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleCopyUrl}>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <a href={portalUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Open
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <h3 className="font-semibold">Portal Features</h3>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Allow Customer Login</Label>
                      <p className="text-sm text-muted-foreground">Customers can log in to view their information</p>
                    </div>
                    <Switch
                      checked={portal.allow_customer_login}
                      onCheckedChange={(checked) => setPortal({ ...portal, allow_customer_login: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Allow Load Tracking</Label>
                      <p className="text-sm text-muted-foreground">Customers can track their loads in real-time</p>
                    </div>
                    <Switch
                      checked={portal.allow_load_tracking}
                      onCheckedChange={(checked) => setPortal({ ...portal, allow_load_tracking: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Allow Invoice Viewing</Label>
                      <p className="text-sm text-muted-foreground">Customers can view and download invoices</p>
                    </div>
                    <Switch
                      checked={portal.allow_invoice_viewing}
                      onCheckedChange={(checked) => setPortal({ ...portal, allow_invoice_viewing: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Allow Document Download</Label>
                      <p className="text-sm text-muted-foreground">Customers can download documents</p>
                    </div>
                    <Switch
                      checked={portal.allow_document_download}
                      onCheckedChange={(checked) => setPortal({ ...portal, allow_document_download: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Allow Load Submission</Label>
                      <p className="text-sm text-muted-foreground">Customers can submit new loads</p>
                    </div>
                    <Switch
                      checked={portal.allow_load_submission}
                      onCheckedChange={(checked) => setPortal({ ...portal, allow_load_submission: checked })}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-end pt-4 border-t">
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </Card>
        )}
      </div>
    </div>
  )
}

