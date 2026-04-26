"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { getAPAgingReport } from "@/app/actions/vendor-invoices"

type BucketKey = "0-30" | "31-60" | "61-90" | "90+"

type APAgingData = {
  buckets: Array<{
    key: BucketKey
    label: string
    total_outstanding: number
    invoice_count: number
    vendors: Array<{
      vendor_name: string
      total_outstanding: number
      invoice_count: number
      invoices: Array<{
        id: string
        invoice_number: string
        due_date: string
        days_outstanding: number
        outstanding_amount: number
      }>
    }>
  }>
  totals: {
    total_outstanding: number
    total_invoices: number
  }
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount || 0)
}

export default function APAgingPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<APAgingData | null>(null)

  async function loadReport() {
    setLoading(true)
    try {
      const result = await getAPAgingReport()
      if (result.error || !result.data) {
        toast.error(result.error || "Failed to load AP aging")
        setData(null)
      } else {
        setData(result.data as APAgingData)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadReport()
  }, [])

  const bucketOrder: BucketKey[] = ["0-30", "31-60", "61-90", "90+"]
  const buckets = bucketOrder.map((key) => data?.buckets.find((b) => b.key === key)).filter(Boolean)

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6">
        <h1 className="text-3xl font-bold text-foreground">AP Aging Report</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Open vendor bills bucketed by due-date aging.
        </p>
      </div>

      <div className="p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : !data ? (
            <Card className="p-8 text-center text-muted-foreground">No AP aging data available.</Card>
          ) : (
            <>
              <div className="grid md:grid-cols-2 gap-6">
                <Card className="border border-border/50 p-6">
                  <p className="text-muted-foreground text-sm font-medium mb-2">Total Outstanding AP</p>
                  <p className="text-3xl font-bold text-amber-500">{formatCurrency(data.totals.total_outstanding)}</p>
                </Card>
                <Card className="border border-border/50 p-6">
                  <p className="text-muted-foreground text-sm font-medium mb-2">Open Vendor Invoices</p>
                  <p className="text-3xl font-bold text-foreground">{data.totals.total_invoices}</p>
                </Card>
              </div>

              <Card className="border border-border/50 overflow-hidden shadow-sm">
                <div className="p-6 border-b border-border">
                  <h3 className="text-lg font-semibold text-foreground">AP Aging Buckets</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Bucket</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Invoices</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Outstanding</th>
                      </tr>
                    </thead>
                    <tbody>
                      {buckets.map((bucket) => (
                        <tr key={bucket!.key} className="border-b border-border hover:bg-secondary/20 transition">
                          <td className="px-6 py-4 text-foreground font-medium">{bucket!.label}</td>
                          <td className="px-6 py-4 text-foreground">{bucket!.invoice_count}</td>
                          <td className="px-6 py-4 text-amber-500 font-semibold">{formatCurrency(bucket!.total_outstanding)}</td>
                        </tr>
                      ))}
                      <tr className="bg-muted/30">
                        <td className="px-6 py-4 text-foreground font-semibold">Total</td>
                        <td className="px-6 py-4 text-foreground font-semibold">{data.totals.total_invoices}</td>
                        <td className="px-6 py-4 text-amber-500 font-bold">{formatCurrency(data.totals.total_outstanding)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>

              {buckets.map((bucket) => (
                <Card key={`breakdown-${bucket!.key}`} className="border border-border/50 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">{bucket!.label} - Vendor Breakdown</h3>
                    <Badge variant="outline">{bucket!.invoice_count} invoices</Badge>
                  </div>
                  {bucket!.vendors.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No invoices in this bucket.</p>
                  ) : (
                    <div className="space-y-3">
                      {bucket!.vendors.map((vendor) => (
                        <div key={`${bucket!.key}-${vendor.vendor_name}`} className="rounded-md border border-border/50 p-3">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-foreground">{vendor.vendor_name}</p>
                            <p className="text-amber-500 font-semibold">{formatCurrency(vendor.total_outstanding)}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{vendor.invoice_count} invoice(s)</p>
                          <div className="mt-2 space-y-1">
                            {vendor.invoices.slice(0, 5).map((inv) => (
                              <div key={inv.id} className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>
                                  {inv.invoice_number} - {inv.days_outstanding} days
                                </span>
                                <span>{formatCurrency(inv.outstanding_amount)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
