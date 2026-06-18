"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Download, KeyRound, Shield } from "lucide-react"
import { errorMessage } from "@/lib/error-message"
import {
  getSsoRecentActivity,
  getSsoSettings,
  saveSsoSettings,
  setSsoActive,
  type CompanySsoConfig,
  type SsoLoginAttemptRow,
} from "@/app/actions/sso-settings"

type SpSummary = {
  entityId: string
  acsUrl: string
  metadataUrl: string
}

export function SsoSettingsClientPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [config, setConfig] = useState<CompanySsoConfig | null>(null)
  const [sp, setSp] = useState<SpSummary | null>(null)
  const [form, setForm] = useState({
    idp_entity_id: "",
    idp_sso_url: "",
    idp_x509_cert: "",
    email_domain: "",
    is_active: false,
  })
  const [activity, setActivity] = useState<SsoLoginAttemptRow[]>([])
  const [activityLoading, setActivityLoading] = useState(true)

  const loadSettings = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getSsoSettings()
      if (result.error) {
        toast.error(result.error)
        return
      }
      const loaded = result.data?.config ?? null
      const spInfo = result.data?.sp ?? null
      setConfig(loaded)
      setSp(spInfo)
      if (loaded) {
        setForm({
          idp_entity_id: loaded.idp_entity_id,
          idp_sso_url: loaded.idp_sso_url,
          idp_x509_cert: loaded.idp_x509_cert,
          email_domain: loaded.email_domain,
          is_active: loaded.is_active,
        })
      }

      setActivityLoading(true)
      const activityResult = await getSsoRecentActivity()
      if (!activityResult.error && activityResult.data) {
        setActivity(activityResult.data)
      }
      setActivityLoading(false)
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Failed to load SSO settings"))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const result = await saveSsoSettings(form)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("SSO configuration saved")
        setConfig(result.data)
        if (result.data) {
          setForm({
            idp_entity_id: result.data.idp_entity_id,
            idp_sso_url: result.data.idp_sso_url,
            idp_x509_cert: result.data.idp_x509_cert,
            email_domain: result.data.email_domain,
            is_active: result.data.is_active,
          })
        }
      }
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Failed to save SSO settings"))
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(checked: boolean) {
    setToggling(true)
    try {
      const result = await setSsoActive(checked)
      if (result.error) {
        toast.error(result.error)
        return
      }
      setForm((prev) => ({ ...prev, is_active: checked }))
      setConfig(result.data)
      toast.success(checked ? "SSO enabled for your company" : "SSO disabled")
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Failed to update SSO status"))
    } finally {
      setToggling(false)
    }
  }

  const metadataUrl = sp?.metadataUrl ?? "/api/sso/metadata"

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" aria-hidden />
          SAML SSO
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your identity provider (Okta, Azure AD, Google Workspace, etc.) and share TruckMates
          service provider details with your IT team.
        </p>
      </div>

      <Alert>
        <AlertDescription>
          SAML SSO is live for users on your configured email domain. Use recent activity below to
          troubleshoot failed sign-in attempts.
        </AlertDescription>
      </Alert>

      <Card className="p-6 border-border space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-muted-foreground" aria-hidden />
          <h2 className="text-lg font-semibold">TruckMates service provider (SP)</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Give these values to your IdP administrator when creating the SAML application.
        </p>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="font-medium text-foreground">SP Entity ID</dt>
              <dd className="mt-1 font-mono text-xs break-all text-muted-foreground bg-muted/50 rounded px-2 py-1.5">
                {sp?.entityId ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Assertion Consumer Service (ACS) URL</dt>
              <dd className="mt-1 font-mono text-xs break-all text-muted-foreground bg-muted/50 rounded px-2 py-1.5">
                {sp?.acsUrl ?? "—"}
              </dd>
              <p className="text-xs text-muted-foreground mt-1">
                Configure this URL as the ACS / Reply URL in your IdP.
              </p>
            </div>
            <div className="pt-2">
              <Button variant="outline" size="sm" asChild>
                <a href={metadataUrl} download="truckmates-sp-metadata.xml">
                  <Download className="w-4 h-4 mr-2" />
                  Download SP metadata
                </a>
              </Button>
            </div>
          </dl>
        )}
      </Card>

      <Card className="p-6 border-border">
        <h2 className="text-lg font-semibold mb-1">Identity provider (IdP)</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Paste the SAML settings from your IdP. Users with matching email domains sign in via your
          IdP from the TruckMates login page.
        </p>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading configuration…</p>
        ) : (
          <form onSubmit={handleSave} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email_domain">Email domain</Label>
              <Input
                id="email_domain"
                value={form.email_domain}
                onChange={(e) => setForm({ ...form, email_domain: e.target.value })}
                placeholder="acmetrucking.com"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Users with @{form.email_domain || "yourdomain.com"} addresses will use this IdP.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="idp_entity_id">IdP Entity ID</Label>
              <Input
                id="idp_entity_id"
                value={form.idp_entity_id}
                onChange={(e) => setForm({ ...form, idp_entity_id: e.target.value })}
                placeholder="https://idp.example.com/entity"
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="idp_sso_url">IdP SSO URL</Label>
              <Input
                id="idp_sso_url"
                type="url"
                value={form.idp_sso_url}
                onChange={(e) => setForm({ ...form, idp_sso_url: e.target.value })}
                placeholder="https://idp.example.com/sso/saml"
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="idp_x509_cert">IdP X.509 certificate (PEM)</Label>
              <Textarea
                id="idp_x509_cert"
                value={form.idp_x509_cert}
                onChange={(e) => setForm({ ...form, idp_x509_cert: e.target.value })}
                placeholder={"-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"}
                rows={8}
                className="font-mono text-xs"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <p className="font-medium text-sm">Enable SSO</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {config
                    ? "Stored config will be marked active for your company."
                    : "Save IdP settings first, then enable."}
                </p>
              </div>
              <Switch
                checked={form.is_active}
                disabled={!config || toggling || saving}
                onCheckedChange={(checked) => void handleToggleActive(checked)}
                aria-label="Enable SSO"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : config ? "Save changes" : "Save configuration"}
              </Button>
            </div>
          </form>
        )}
      </Card>

      <Card className="p-6 border-border">
        <h2 className="text-lg font-semibold mb-1">Recent SSO activity</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Last 20 sign-in attempts for your company (success and failure).
        </p>
        {activityLoading ? (
          <p className="text-sm text-muted-foreground">Loading activity…</p>
        ) : activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No SSO attempts recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Time</th>
                  <th className="py-2 pr-4 font-medium">Outcome</th>
                  <th className="py-2 pr-4 font-medium">Email / domain</th>
                  <th className="py-2 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((row) => (
                  <tr key={row.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={
                          row.outcome === "success"
                            ? "text-green-600 dark:text-green-400"
                            : "text-destructive"
                        }
                      >
                        {row.outcome}
                      </span>
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">
                      {row.email || row.email_domain || "—"}
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {row.outcome === "failure" ? row.failure_category || "unknown" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
