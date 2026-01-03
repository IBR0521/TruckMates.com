"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { getCompanySettings, updateCompanySettings, generateInvoiceNumber } from "@/app/actions/number-formats"
import { Save, FileText, Info } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function InvoiceSettingsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [settings, setSettings] = useState({
    invoice_number_format: "INV-{YEAR}-{MONTH}-{SEQUENCE}",
    invoice_number_sequence: 1,
    default_payment_terms: "Net 30",
    invoice_auto_send: false,
  })
  const [previewNumber, setPreviewNumber] = useState("")

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    // Update preview when format changes
    if (settings.invoice_number_format) {
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const sequence = String(settings.invoice_number_sequence).padStart(4, '0')
      
      let preview = settings.invoice_number_format
        .replace(/{YEAR}/g, String(year))
        .replace(/{MONTH}/g, month)
        .replace(/{DAY}/g, String(now.getDate()).padStart(2, '0'))
        .replace(/{SEQUENCE}/g, sequence)
        .replace(/{COMPANY}/g, "COMP")
      
      setPreviewNumber(preview)
    }
  }, [settings.invoice_number_format, settings.invoice_number_sequence])

  async function loadData() {
    setIsLoading(true)
    try {
      const result = await getCompanySettings()
      if (result.data) {
        setSettings({
          invoice_number_format: result.data.invoice_number_format || "INV-{YEAR}-{MONTH}-{SEQUENCE}",
          invoice_number_sequence: result.data.invoice_number_sequence || 1,
          default_payment_terms: result.data.default_payment_terms || "Net 30",
          invoice_auto_send: result.data.invoice_auto_send || false,
        })
      }
    } catch (error: any) {
      toast.error("Failed to load settings")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      const result = await updateCompanySettings({
        invoice_number_format: settings.invoice_number_format,
        invoice_number_sequence: settings.invoice_number_sequence,
        default_payment_terms: settings.default_payment_terms,
        invoice_auto_send: settings.invoice_auto_send,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Invoice settings updated")
      }
    } catch (error: any) {
      toast.error("Failed to save settings")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-border bg-card/50 backdrop-blur px-8 py-4">
          <h1 className="text-2xl font-bold text-foreground">Invoice Settings</h1>
        </div>
        <main className="flex-1 overflow-auto p-8">
          <div className="text-center py-8">Loading...</div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="border-b border-border bg-card/50 backdrop-blur px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Invoice Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure invoice numbering and defaults</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="bg-primary hover:bg-primary/90">
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Invoice Number Format */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <FileText className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Invoice Number Format</h2>
            </div>
            
            <Alert className="mb-6">
              <Info className="w-4 h-4" />
              <AlertDescription>
                Use tokens: <code className="px-1 py-0.5 bg-muted rounded">{`{YEAR}`}</code>, <code className="px-1 py-0.5 bg-muted rounded">{`{MONTH}`}</code>, <code className="px-1 py-0.5 bg-muted rounded">{`{DAY}`}</code>, <code className="px-1 py-0.5 bg-muted rounded">{`{SEQUENCE}`}</code>, <code className="px-1 py-0.5 bg-muted rounded">{`{COMPANY}`}</code>
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div>
                <Label htmlFor="invoice_format">Format Pattern</Label>
                <Input
                  id="invoice_format"
                  value={settings.invoice_number_format}
                  onChange={(e) => setSettings({ ...settings, invoice_number_format: e.target.value })}
                  placeholder="INV-{YEAR}-{MONTH}-{SEQUENCE}"
                  className="mt-2 font-mono"
                />
              </div>
              
              <div>
                <Label htmlFor="invoice_sequence">Starting Sequence Number</Label>
                <Input
                  id="invoice_sequence"
                  type="number"
                  value={settings.invoice_number_sequence}
                  onChange={(e) => setSettings({ ...settings, invoice_number_sequence: parseInt(e.target.value) || 1 })}
                  className="mt-2"
                  min="1"
                />
              </div>

              <div>
                <Label>Preview</Label>
                <div className="mt-2 p-3 bg-muted rounded-md font-mono text-sm">
                  {previewNumber || "INV-2024-01-0001"}
                </div>
              </div>
            </div>
          </Card>

          {/* Default Settings */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-6">Default Settings</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="payment_terms">Default Payment Terms</Label>
                <Input
                  id="payment_terms"
                  value={settings.default_payment_terms}
                  onChange={(e) => setSettings({ ...settings, default_payment_terms: e.target.value })}
                  placeholder="Net 30"
                  className="mt-2"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="auto_send">Auto-Send Invoices</Label>
                  <p className="text-sm text-muted-foreground">Automatically email invoices when created</p>
                </div>
                <Switch
                  id="auto_send"
                  checked={settings.invoice_auto_send}
                  onCheckedChange={(checked) => setSettings({ ...settings, invoice_auto_send: checked })}
                />
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}




