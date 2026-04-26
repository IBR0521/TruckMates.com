"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CheckCircle2, Plus, Trash2 } from "lucide-react"
import { deleteVendorInvoice, getVendorInvoices, markVendorInvoicePaid } from "@/app/actions/vendor-invoices"

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount || 0)
}

function badgeClass(status: string) {
  const s = String(status || "").toLowerCase()
  if (s === "paid") return "bg-green-500/20 text-green-400 border-green-500/30"
  if (s === "overdue") return "bg-orange-500/20 text-orange-400 border-orange-500/30"
  if (s === "approved") return "bg-blue-500/20 text-blue-400 border-blue-500/30"
  return "bg-slate-500/20 text-slate-300 border-slate-500/30"
}

export default function VendorInvoicesPage() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [markPaidId, setMarkPaidId] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState("ach")
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10))
  const [submittingPaid, setSubmittingPaid] = useState(false)

  async function loadData() {
    setLoading(true)
    try {
      const result = await getVendorInvoices({ limit: 500 })
      if (result.error || !result.data) {
        toast.error(result.error || "Failed to load vendor invoices")
        setRows([])
      } else {
        setRows(result.data)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  async function handleMarkPaid() {
    if (!markPaidId) return
    setSubmittingPaid(true)
    try {
      const result = await markVendorInvoicePaid({
        id: markPaidId,
        payment_method: paymentMethod,
        paid_date: paidDate,
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Invoice marked as paid")
      setMarkPaidId(null)
      await loadData()
    } finally {
      setSubmittingPaid(false)
    }
  }

  async function handleDelete(id: string) {
    const result = await deleteVendorInvoice(id)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success("Vendor invoice deleted")
    await loadData()
  }

  const outstanding = rows
    .filter((r) => String(r.status || "").toLowerCase() !== "paid")
    .reduce((sum, r) => sum + Number(r.amount || 0), 0)

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Vendor Invoices</h1>
            <p className="text-muted-foreground text-sm mt-1">Track payables owed to vendors and mark bills paid.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard/payables/reconcile">
              <Button variant="outline">Reconcile</Button>
            </Link>
            <Link href="/dashboard/payables/ap-aging">
              <Button variant="outline">AP Aging</Button>
            </Link>
            <Link href="/dashboard/payables/vendor-invoices/create">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Vendor Invoice
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border border-border/50 p-6">
              <p className="text-muted-foreground text-sm font-medium mb-2">Open Payables</p>
              <p className="text-3xl font-bold text-amber-500">{formatCurrency(outstanding)}</p>
            </Card>
            <Card className="border border-border/50 p-6">
              <p className="text-muted-foreground text-sm font-medium mb-2">Invoice Count</p>
              <p className="text-3xl font-bold text-foreground">{rows.length}</p>
            </Card>
          </div>

          <Card className="border border-border/50 overflow-hidden shadow-sm">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Loading vendor invoices...</div>
            ) : rows.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No vendor invoices found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Vendor</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Invoice #</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Dates</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Amount</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-b border-border hover:bg-secondary/10">
                        <td className="px-4 py-3 text-sm text-foreground">
                          {row.vendors?.company_name || row.vendors?.name || "Unknown Vendor"}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">{row.invoice_number}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          <div>Inv: {row.invoice_date || "-"}</div>
                          <div>Due: {row.due_date || "-"}</div>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-foreground">{formatCurrency(Number(row.amount || 0))}</td>
                        <td className="px-4 py-3">
                          <Badge className={badgeClass(row.status)}>
                            {String(row.status || "").replaceAll("_", " ").toUpperCase()}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {String(row.status || "").toLowerCase() !== "paid" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setMarkPaidId(row.id)
                                  setPaymentMethod("ach")
                                  setPaidDate(new Date().toISOString().slice(0, 10))
                                }}
                              >
                                <CheckCircle2 className="w-4 h-4 mr-1" />
                                Mark Paid
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => void handleDelete(row.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>

      <Dialog open={!!markPaidId} onOpenChange={(open) => !open && setMarkPaidId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Invoice as Paid</DialogTitle>
            <DialogDescription>Capture payment method and paid date for AP history.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ach">ACH</SelectItem>
                  <SelectItem value="wire">Wire</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Paid Date</Label>
              <Input className="mt-1" type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={() => void handleMarkPaid()} disabled={submittingPaid}>
                {submittingPaid ? "Saving..." : "Confirm Paid"}
              </Button>
              <Button variant="outline" onClick={() => setMarkPaidId(null)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
