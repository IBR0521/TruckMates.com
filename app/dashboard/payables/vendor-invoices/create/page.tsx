"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { getVendors } from "@/app/actions/vendors"
import { createVendorInvoice } from "@/app/actions/vendor-invoices"
import { getGLAccounts } from "@/app/actions/gl-accounts"

export default function CreateVendorInvoicePage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [vendors, setVendors] = useState<any[]>([])
  const [glAccounts, setGlAccounts] = useState<Array<{ id: string; code: string; name: string }>>([])
  const [loadingVendors, setLoadingVendors] = useState(true)
  const [form, setForm] = useState({
    vendor_id: "",
    invoice_number: "",
    invoice_date: "",
    due_date: "",
    amount: "",
    status: "draft",
    gl_code: "",
  })

  useEffect(() => {
    async function loadVendors() {
      setLoadingVendors(true)
      const [result, glResult] = await Promise.all([getVendors({ limit: 500 }), getGLAccounts("expense")])
      if (result.error) toast.error(result.error)
      else setVendors(result.data || [])
      if (!glResult.error) setGlAccounts(glResult.data || [])
      setLoadingVendors(false)
    }
    void loadVendors()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const result = await createVendorInvoice({
        vendor_id: form.vendor_id,
        invoice_number: form.invoice_number,
        invoice_date: form.invoice_date,
        due_date: form.due_date,
        amount: Number(form.amount || 0),
        status: form.status as "draft" | "approved" | "paid" | "overdue",
        gl_code: form.gl_code || null,
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Vendor invoice created")
      router.push("/dashboard/payables/vendor-invoices")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6">
        <h1 className="text-3xl font-bold text-foreground">New Vendor Invoice</h1>
        <p className="text-muted-foreground text-sm mt-1">Create a payable bill tied to an existing vendor.</p>
      </div>

      <div className="p-8">
        <div className="max-w-3xl mx-auto">
          <Card className="border border-border/50 p-6">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <Label>Vendor</Label>
                <Select value={form.vendor_id} onValueChange={(v) => setForm((p) => ({ ...p, vendor_id: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={loadingVendors ? "Loading vendors..." : "Select vendor"} />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.company_name || v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Invoice Number</Label>
                  <Input
                    className="mt-1"
                    value={form.invoice_number}
                    onChange={(e) => setForm((p) => ({ ...p, invoice_number: e.target.value }))}
                    placeholder="INV-10045"
                  />
                </div>
                <div>
                  <Label>GL Code</Label>
                  <Select value={form.gl_code || "none"} onValueChange={(v) => setForm((p) => ({ ...p, gl_code: v === "none" ? "" : v }))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select GL code (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {glAccounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.code}>
                          {acc.code} - {acc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <Label>Invoice Date</Label>
                  <Input
                    className="mt-1"
                    type="date"
                    value={form.invoice_date}
                    onChange={(e) => setForm((p) => ({ ...p, invoice_date: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Due Date</Label>
                  <Input
                    className="mt-1"
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Amount</Label>
                  <Input
                    className="mt-1"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Create Invoice"}
                </Button>
                <Link href="/dashboard/payables/vendor-invoices">
                  <Button variant="outline" type="button">Cancel</Button>
                </Link>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  )
}
