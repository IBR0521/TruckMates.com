"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { getCompanySettings, updateCompanySettings } from "@/app/actions/number-formats"
import { Save, FileText, Info, DollarSign, Mail, Receipt, Percent } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"

export default function InvoiceSettingsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [settings, setSettings] = useState({
    // Number Format
    invoice_number_format: "INV-{YEAR}-{MONTH}-{SEQUENCE}",
    invoice_number_sequence: 1,
    
    // Default Settings
    default_payment_terms: "Net 30",
    invoice_auto_send: false,
    invoice_email_template: "",
    
    // Tax Settings
    tax_enabled: false,
    default_tax_rate: 0,
    tax_name: "Tax",
    tax_inclusive: false,
    
    // Late Fee Settings
    late_fee_enabled: false,
    late_fee_type: "percentage", // 'percentage' or 'fixed'
    late_fee_value: 0,
    late_fee_grace_period_days: 0,
    
    // Discount Settings
    discount_enabled: false,
    default_discount_type: "percentage", // 'percentage' or 'fixed'
    early_payment_discount_enabled: false,
    early_payment_discount_percentage: 0,
    early_payment_discount_days: 10,
    
    // Email Settings
    invoice_email_subject: "Invoice {INVOICE_NUMBER} from {COMPANY_NAME}",
    invoice_email_body: "",
    send_copy_to_company: false,
    cc_emails: "",
    bcc_emails: "",
    
    // Invoice Template
    invoice_template: "default",
    show_company_logo: true,
    show_payment_instructions: true,
    payment_instructions: "",
    footer_text: "",
    
    // Auto-Generation
    auto_generate_on_delivery: true,
    auto_attach_documents: false,
    include_bol_in_invoice: false,
  })
  const [previewNumber, setPreviewNumber] = useState("")

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
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
          invoice_email_template: result.data.invoice_email_template || "",
          tax_enabled: result.data.tax_enabled || false,
          default_tax_rate: result.data.default_tax_rate || 0,
          tax_name: result.data.tax_name || "Tax",
          tax_inclusive: result.data.tax_inclusive || false,
          late_fee_enabled: result.data.late_fee_enabled || false,
          late_fee_type: result.data.late_fee_type || "percentage",
          late_fee_value: result.data.late_fee_value || 0,
          late_fee_grace_period_days: result.data.late_fee_grace_period_days || 0,
          discount_enabled: result.data.discount_enabled || false,
          default_discount_type: result.data.default_discount_type || "percentage",
          early_payment_discount_enabled: result.data.early_payment_discount_enabled || false,
          early_payment_discount_percentage: result.data.early_payment_discount_percentage || 0,
          early_payment_discount_days: result.data.early_payment_discount_days || 10,
          invoice_email_subject: result.data.invoice_email_subject || "Invoice {INVOICE_NUMBER} from {COMPANY_NAME}",
          invoice_email_body: result.data.invoice_email_body || "",
          send_copy_to_company: result.data.send_copy_to_company || false,
          cc_emails: result.data.cc_emails || "",
          bcc_emails: result.data.bcc_emails || "",
          invoice_template: result.data.invoice_template || "default",
          show_company_logo: result.data.show_company_logo !== false,
          show_payment_instructions: result.data.show_payment_instructions !== false,
          payment_instructions: result.data.payment_instructions || "",
          footer_text: result.data.footer_text || "",
          auto_generate_on_delivery: result.data.auto_generate_on_delivery !== false,
          auto_attach_documents: result.data.auto_attach_documents || false,
          include_bol_in_invoice: result.data.include_bol_in_invoice || false,
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
      const result = await updateCompanySettings(settings)

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
          <p className="text-sm text-muted-foreground mt-1">Configure invoice numbering, defaults, taxes, fees, and templates</p>
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
            <div className="flex items-center gap-2 mb-6">
              <Receipt className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Default Settings</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="payment_terms">Default Payment Terms</Label>
                <Select value={settings.default_payment_terms} onValueChange={(value) => setSettings({ ...settings, default_payment_terms: value })}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
                    <SelectItem value="Net 7">Net 7</SelectItem>
                    <SelectItem value="Net 15">Net 15</SelectItem>
                    <SelectItem value="Net 30">Net 30</SelectItem>
                    <SelectItem value="Net 45">Net 45</SelectItem>
                    <SelectItem value="Net 60">Net 60</SelectItem>
                    <SelectItem value="Net 90">Net 90</SelectItem>
                  </SelectContent>
                </Select>
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

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="auto_generate">Auto-Generate on Delivery</Label>
                  <p className="text-sm text-muted-foreground">Automatically create invoice when load is delivered</p>
                </div>
                <Switch
                  id="auto_generate"
                  checked={settings.auto_generate_on_delivery}
                  onCheckedChange={(checked) => setSettings({ ...settings, auto_generate_on_delivery: checked })}
                />
              </div>
            </div>
          </Card>

          {/* Tax Settings */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Percent className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Tax Settings</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="tax_enabled">Enable Tax</Label>
                  <p className="text-sm text-muted-foreground">Apply tax to invoices</p>
                </div>
                <Switch
                  id="tax_enabled"
                  checked={settings.tax_enabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, tax_enabled: checked })}
                />
              </div>

              {settings.tax_enabled && (
                <>
                  <div>
                    <Label htmlFor="tax_name">Tax Name</Label>
                    <Input
                      id="tax_name"
                      value={settings.tax_name}
                      onChange={(e) => setSettings({ ...settings, tax_name: e.target.value })}
                      placeholder="Sales Tax"
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="tax_rate">Default Tax Rate (%)</Label>
                    <Input
                      id="tax_rate"
                      type="number"
                      step="0.01"
                      value={settings.default_tax_rate}
                      onChange={(e) => setSettings({ ...settings, default_tax_rate: parseFloat(e.target.value) || 0 })}
                      className="mt-2"
                      min="0"
                      max="100"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="tax_inclusive">Tax Inclusive Pricing</Label>
                      <p className="text-sm text-muted-foreground">Tax is included in the base price</p>
                    </div>
                    <Switch
                      id="tax_inclusive"
                      checked={settings.tax_inclusive}
                      onCheckedChange={(checked) => setSettings({ ...settings, tax_inclusive: checked })}
                    />
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Late Fee Settings */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <DollarSign className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Late Fee Settings</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="late_fee_enabled">Enable Late Fees</Label>
                  <p className="text-sm text-muted-foreground">Automatically add late fees to overdue invoices</p>
                </div>
                <Switch
                  id="late_fee_enabled"
                  checked={settings.late_fee_enabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, late_fee_enabled: checked })}
                />
              </div>

              {settings.late_fee_enabled && (
                <>
                  <div>
                    <Label htmlFor="late_fee_type">Late Fee Type</Label>
                    <Select value={settings.late_fee_type} onValueChange={(value) => setSettings({ ...settings, late_fee_type: value })}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage of Invoice</SelectItem>
                        <SelectItem value="fixed">Fixed Amount</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="late_fee_value">
                      {settings.late_fee_type === "percentage" ? "Late Fee Percentage (%)" : "Late Fee Amount ($)"}
                    </Label>
                    <Input
                      id="late_fee_value"
                      type="number"
                      step={settings.late_fee_type === "percentage" ? "0.01" : "0.01"}
                      value={settings.late_fee_value}
                      onChange={(e) => setSettings({ ...settings, late_fee_value: parseFloat(e.target.value) || 0 })}
                      className="mt-2"
                      min="0"
                    />
                  </div>

                  <div>
                    <Label htmlFor="grace_period">Grace Period (days)</Label>
                    <Input
                      id="grace_period"
                      type="number"
                      value={settings.late_fee_grace_period_days}
                      onChange={(e) => setSettings({ ...settings, late_fee_grace_period_days: parseInt(e.target.value) || 0 })}
                      className="mt-2"
                      min="0"
                    />
                    <p className="text-sm text-muted-foreground mt-1">Days after due date before late fee is applied</p>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Discount Settings */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Percent className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Discount Settings</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="discount_enabled">Enable Discounts</Label>
                  <p className="text-sm text-muted-foreground">Allow discounts on invoices</p>
                </div>
                <Switch
                  id="discount_enabled"
                  checked={settings.discount_enabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, discount_enabled: checked })}
                />
              </div>

              {settings.discount_enabled && (
                <div>
                  <Label htmlFor="discount_type">Default Discount Type</Label>
                  <Select value={settings.default_discount_type} onValueChange={(value) => setSettings({ ...settings, default_discount_type: value })}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="early_payment">Early Payment Discount</Label>
                  <p className="text-sm text-muted-foreground">Offer discount for early payment</p>
                </div>
                <Switch
                  id="early_payment"
                  checked={settings.early_payment_discount_enabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, early_payment_discount_enabled: checked })}
                />
              </div>

              {settings.early_payment_discount_enabled && (
                <>
                  <div>
                    <Label htmlFor="early_discount_percent">Discount Percentage (%)</Label>
                    <Input
                      id="early_discount_percent"
                      type="number"
                      step="0.01"
                      value={settings.early_payment_discount_percentage}
                      onChange={(e) => setSettings({ ...settings, early_payment_discount_percentage: parseFloat(e.target.value) || 0 })}
                      className="mt-2"
                      min="0"
                      max="100"
                    />
                  </div>

                  <div>
                    <Label htmlFor="early_discount_days">Discount Period (days)</Label>
                    <Input
                      id="early_discount_days"
                      type="number"
                      value={settings.early_payment_discount_days}
                      onChange={(e) => setSettings({ ...settings, early_payment_discount_days: parseInt(e.target.value) || 10 })}
                      className="mt-2"
                      min="1"
                    />
                    <p className="text-sm text-muted-foreground mt-1">Discount applies if paid within this many days</p>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Email Settings */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Mail className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Email Settings</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="email_subject">Email Subject Template</Label>
                <Input
                  id="email_subject"
                  value={settings.invoice_email_subject}
                  onChange={(e) => setSettings({ ...settings, invoice_email_subject: e.target.value })}
                  placeholder="Invoice {INVOICE_NUMBER} from {COMPANY_NAME}"
                  className="mt-2"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Tokens: <code className="px-1 py-0.5 bg-muted rounded">{`{INVOICE_NUMBER}`}</code>, <code className="px-1 py-0.5 bg-muted rounded">{`{COMPANY_NAME}`}</code>, <code className="px-1 py-0.5 bg-muted rounded">{`{AMOUNT}`}</code>
                </p>
              </div>

              <div>
                <Label htmlFor="email_body">Email Body Template</Label>
                <Textarea
                  id="email_body"
                  value={settings.invoice_email_body}
                  onChange={(e) => setSettings({ ...settings, invoice_email_body: e.target.value })}
                  placeholder="Dear {CUSTOMER_NAME},&#10;&#10;Please find attached invoice {INVOICE_NUMBER} for {AMOUNT}.&#10;&#10;Payment is due by {DUE_DATE}.&#10;&#10;Thank you!"
                  className="mt-2 min-h-32"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Tokens: <code className="px-1 py-0.5 bg-muted rounded">{`{CUSTOMER_NAME}`}</code>, <code className="px-1 py-0.5 bg-muted rounded">{`{INVOICE_NUMBER}`}</code>, <code className="px-1 py-0.5 bg-muted rounded">{`{AMOUNT}`}</code>, <code className="px-1 py-0.5 bg-muted rounded">{`{DUE_DATE}`}</code>
                </p>
              </div>

              <div>
                <Label htmlFor="cc_emails">CC Emails (comma-separated)</Label>
                <Input
                  id="cc_emails"
                  value={settings.cc_emails}
                  onChange={(e) => setSettings({ ...settings, cc_emails: e.target.value })}
                  placeholder="accounting@company.com, manager@company.com"
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="bcc_emails">BCC Emails (comma-separated)</Label>
                <Input
                  id="bcc_emails"
                  value={settings.bcc_emails}
                  onChange={(e) => setSettings({ ...settings, bcc_emails: e.target.value })}
                  placeholder="archive@company.com"
                  className="mt-2"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="send_copy">Send Copy to Company</Label>
                  <p className="text-sm text-muted-foreground">Send a copy of all invoices to company email</p>
                </div>
                <Switch
                  id="send_copy"
                  checked={settings.send_copy_to_company}
                  onCheckedChange={(checked) => setSettings({ ...settings, send_copy_to_company: checked })}
                />
              </div>
            </div>
          </Card>

          {/* Invoice Template */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <FileText className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Invoice Template</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="template">Template Style</Label>
                <Select value={settings.invoice_template} onValueChange={(value) => setSettings({ ...settings, invoice_template: value })}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default</SelectItem>
                    <SelectItem value="modern">Modern</SelectItem>
                    <SelectItem value="classic">Classic</SelectItem>
                    <SelectItem value="minimal">Minimal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="show_logo">Show Company Logo</Label>
                  <p className="text-sm text-muted-foreground">Display company logo on invoices</p>
                </div>
                <Switch
                  id="show_logo"
                  checked={settings.show_company_logo}
                  onCheckedChange={(checked) => setSettings({ ...settings, show_company_logo: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="show_payment">Show Payment Instructions</Label>
                  <p className="text-sm text-muted-foreground">Display payment instructions on invoice</p>
                </div>
                <Switch
                  id="show_payment"
                  checked={settings.show_payment_instructions}
                  onCheckedChange={(checked) => setSettings({ ...settings, show_payment_instructions: checked })}
                />
              </div>

              {settings.show_payment_instructions && (
                <div>
                  <Label htmlFor="payment_instructions">Payment Instructions</Label>
                  <Textarea
                    id="payment_instructions"
                    value={settings.payment_instructions}
                    onChange={(e) => setSettings({ ...settings, payment_instructions: e.target.value })}
                    placeholder="Payment can be made via check, wire transfer, or online payment.&#10;Bank: ABC Bank&#10;Account: 123456789&#10;Routing: 987654321"
                    className="mt-2 min-h-24"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="footer_text">Footer Text</Label>
                <Textarea
                  id="footer_text"
                  value={settings.footer_text}
                  onChange={(e) => setSettings({ ...settings, footer_text: e.target.value })}
                  placeholder="Thank you for your business!"
                  className="mt-2 min-h-20"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="include_bol">Include BOL in Invoice</Label>
                  <p className="text-sm text-muted-foreground">Attach BOL document to invoice PDF</p>
                </div>
                <Switch
                  id="include_bol"
                  checked={settings.include_bol_in_invoice}
                  onCheckedChange={(checked) => setSettings({ ...settings, include_bol_in_invoice: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="auto_attach">Auto-Attach Documents</Label>
                  <p className="text-sm text-muted-foreground">Automatically attach related documents to invoice email</p>
                </div>
                <Switch
                  id="auto_attach"
                  checked={settings.auto_attach_documents}
                  onCheckedChange={(checked) => setSettings({ ...settings, auto_attach_documents: checked })}
                />
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}
