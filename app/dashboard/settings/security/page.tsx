"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Shield, ArrowLeft, Loader2, Copy, Check } from "lucide-react"
import { toast } from "sonner"
import {
  getTotpStatus,
  initiateTotpSetup,
  confirmTotpSetup,
  disableTotp,
} from "@/app/actions/totp"

type SetupState = {
  otpauthUri: string
  secret: string
} | null

export default function SecuritySettingsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null)
  const [setup, setSetup] = useState<SetupState>(null)
  const [setupCode, setSetupCode] = useState("")
  const [disableCode, setDisableCode] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [copied, setCopied] = useState<"uri" | "secret" | null>(null)

  async function loadStatus() {
    setIsLoading(true)
    const result = await getTotpStatus()
    if (result.error) {
      toast.error(result.error)
    } else if (result.data) {
      setEnabled(result.data.enabled)
      setVerifiedAt(result.data.verified_at)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    void loadStatus()
  }, [])

  async function handleStartSetup() {
    setIsSubmitting(true)
    const result = await initiateTotpSetup()
    if (result.error) {
      toast.error(result.error)
    } else if (result.data) {
      setSetup(result.data)
      toast.success("Scan the setup link in your authenticator app, then enter the code to confirm.")
    }
    setIsSubmitting(false)
  }

  async function handleConfirmSetup(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    const result = await confirmTotpSetup(setupCode)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Two-factor authentication is now enabled.")
      setSetup(null)
      setSetupCode("")
      await loadStatus()
    }
    setIsSubmitting(false)
  }

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    const result = await disableTotp(disableCode)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Two-factor authentication has been disabled.")
      setDisableCode("")
      await loadStatus()
    }
    setIsSubmitting(false)
  }

  async function copyText(text: string, kind: "uri" | "secret") {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(kind)
      setTimeout(() => setCopied(null), 2000)
      toast.success("Copied to clipboard")
    } catch {
      toast.error("Could not copy to clipboard")
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/settings"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Security
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Protect your account with time-based one-time passwords (TOTP).
          </p>
        </div>
      </div>

      <Card className="border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Two-factor authentication</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Use an authenticator app (Google Authenticator, 1Password, Authy, etc.).
            </p>
          </div>
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          ) : enabled ? (
            <Badge variant="default">Enabled</Badge>
          ) : (
            <Badge variant="secondary">Disabled</Badge>
          )}
        </div>

        {!isLoading && enabled && verifiedAt && (
          <p className="text-xs text-muted-foreground mb-4">
            Enabled since {new Date(verifiedAt).toLocaleString()}
          </p>
        )}

        {!isLoading && !enabled && !setup && (
          <Button onClick={handleStartSetup} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Starting setup…
              </>
            ) : (
              "Enable two-factor authentication"
            )}
          </Button>
        )}

        {setup && !enabled && (
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Add this account to your authenticator app using the setup link or secret below, then enter
              the 6-digit code to confirm.
            </p>

            <div className="p-4 bg-secondary/50 rounded-lg space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Setup link (otpauth URI)</Label>
                <div className="flex gap-2 mt-1">
                  <Input readOnly value={setup.otpauthUri} className="font-mono text-xs" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => copyText(setup.otpauthUri, "uri")}
                    aria-label="Copy setup link"
                  >
                    {copied === "uri" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <a
                  href={setup.otpauthUri}
                  className="text-xs text-primary underline mt-2 inline-block break-all"
                >
                  Open in authenticator app
                </a>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Manual entry secret</Label>
                <div className="flex gap-2 mt-1">
                  <Input readOnly value={setup.secret} className="font-mono text-sm tracking-wider" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => copyText(setup.secret, "secret")}
                    aria-label="Copy secret"
                  >
                    {copied === "secret" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </div>

            <form onSubmit={handleConfirmSetup} className="space-y-3">
              <div>
                <Label htmlFor="setup-code">Verification code</Label>
                <Input
                  id="setup-code"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={setupCode}
                  onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="max-w-xs mt-1"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={isSubmitting || setupCode.length !== 6}>
                  {isSubmitting ? "Confirming…" : "Confirm and enable"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setSetup(null)
                    setSetupCode("")
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {!isLoading && enabled && (
          <form onSubmit={handleDisable} className="space-y-3 mt-4 border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              To disable two-factor authentication, enter a current code from your authenticator app.
            </p>
            <div>
              <Label htmlFor="disable-code">Current authentication code</Label>
              <Input
                id="disable-code"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="max-w-xs mt-1"
              />
            </div>
            <Button
              type="submit"
              variant="destructive"
              disabled={isSubmitting || disableCode.length !== 6}
            >
              {isSubmitting ? "Disabling…" : "Disable two-factor authentication"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  )
}
