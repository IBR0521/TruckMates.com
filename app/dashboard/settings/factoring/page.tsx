"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { getCompanySettings, updateCompanySettings } from "@/app/actions/number-formats"
import { Save, Landmark } from "lucide-react"

export default function FactoringSettingsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState({
    factoring_company_name: "",
    factoring_submission_email: "",
    factoring_include_bol: true,
    factoring_include_rate_conf: true,
    factoring_include_pod: true,
    factoring_email_template: "",
    factoring_auto_submit: false,
  })

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    setIsLoading(true)
    try {
      const r = await getCompanySettings()
      if (r.error) {
        toast.error(r.error)
        return
      }
      const s = r.data
      if (s) {
        setForm({
          factoring_company_name: (s as any).factoring_company_name || "",
          factoring_submission_email: (s as any).factoring_submission_email || "",
          factoring_include_bol: (s as any).factoring_include_bol !== false,
          factoring_include_rate_conf: (s as any).factoring_include_rate_conf !== false,
          factoring_include_pod: (s as any).factoring_include_pod !== false,
          factoring_email_template: (s as any).factoring_email_template || "",
          factoring_auto_submit: Boolean((s as any).factoring_auto_submit),
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      const r = await updateCompanySettings({
        factoring_company_name: form.factoring_company_name.trim() || null,
        factoring_submission_email: form.factoring_submission_email.trim() || null,
        factoring_include_bol: form.factoring_include_bol,
        factoring_include_rate_conf: form.factoring_include_rate_conf,
        factoring_include_pod: form.factoring_include_pod,
        factoring_email_template: form.factoring_email_template.trim() || null,
        factoring_auto_submit: form.factoring_auto_submit,
      })
      if (r.error) {
        toast.error(r.error)
        return
      }
      toast.success("Factoring settings saved")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
          <Landmark className="w-8 h-8 text-primary" />
          Factoring
        </h1>
        <p className="text-muted-foreground mt-1">
          Send invoice packets to your factor by email—use the submission address they gave you (portal, welcome
          letter, or factoring rep). We’ll attach the invoice PDF plus the documents you select below, in one message—no
          more downloading and forwarding every load.
        </p>
      </div>

      <Card className="p-6 border-border space-y-6">
        <div className="space-y-2">
          <Label htmlFor="fc-name">Factoring company name</Label>
          <Input
            id="fc-name"
            placeholder="e.g. RTS Financial"
            value={form.factoring_company_name}
            onChange={(e) => setForm((f) => ({ ...f, factoring_company_name: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fc-email">Submission email</Label>
          <Input
            id="fc-email"
            type="email"
            placeholder="e.g. invoices@rtsfactoring.com"
            value={form.factoring_submission_email}
            onChange={(e) => setForm((f) => ({ ...f, factoring_submission_email: e.target.value }))}
          />
        </div>

        <div className="space-y-3">
          <Label>Include documents</Label>
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.factoring_include_bol}
                onCheckedChange={(v) => setForm((f) => ({ ...f, factoring_include_bol: Boolean(v) }))}
              />
              Bill of Lading (generated BOL PDF or uploaded BOL)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.factoring_include_rate_conf}
                onCheckedChange={(v) => setForm((f) => ({ ...f, factoring_include_rate_conf: Boolean(v) }))}
              />
              Rate confirmation (load documents matching rate / confirmation)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.factoring_include_pod}
                onCheckedChange={(v) => setForm((f) => ({ ...f, factoring_include_pod: Boolean(v) }))}
              />
              Proof of delivery (POD photos / documents on the load)
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fc-template">Email body template (plain text)</Label>
          <Textarea
            id="fc-template"
            rows={12}
            className="font-mono text-sm"
            placeholder={`Please find attached invoice #{INVOICE_NUMBER} for factoring.

Load: {LOAD_NUMBER}
Customer: {CUSTOMER_NAME}
Amount: {AMOUNT}

Documents attached:
{DOCUMENTS_LIST}

Thank you,
{COMPANY_NAME}`}
            value={form.factoring_email_template}
            onChange={(e) => setForm((f) => ({ ...f, factoring_email_template: e.target.value }))}
          />
          <p className="text-xs text-muted-foreground">
            Tokens: {"{INVOICE_NUMBER}"}, {"{LOAD_NUMBER}"}, {"{LOAD}"}, {"{CUSTOMER_NAME}"}, {"{AMOUNT}"},{" "}
            {"{DOCUMENTS_LIST}"}, {"{COMPANY_NAME}"}
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div>
            <p className="font-medium text-foreground">Auto-submit on POD</p>
            <p className="text-sm text-muted-foreground">
              When POD creates an invoice automatically, email the factoring packet immediately (if submission email is
              set).
            </p>
          </div>
          <Switch
            checked={form.factoring_auto_submit}
            onCheckedChange={(v) => setForm((f) => ({ ...f, factoring_auto_submit: v }))}
          />
        </div>

        <Button onClick={() => void handleSave()} disabled={isSaving} className="w-full sm:w-auto">
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Saving…" : "Save factoring settings"}
        </Button>
      </Card>
    </div>
  )
}
