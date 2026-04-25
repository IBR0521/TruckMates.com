"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Send, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { getARAgingReport, sendARAgingBucketReminders } from "@/app/actions/reports"

type BucketKey = "0-30" | "31-60" | "61-90" | "90+"

type ARAgingData = {
  buckets: Array<{
    key: BucketKey
    label: string
    total_outstanding: number
    invoice_count: number
    customers: Array<{
      customer_name: string
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
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
}

export default function ARAgingPage() {
  const [loading, setLoading] = useState(true)
  const [sendingBucket, setSendingBucket] = useState<BucketKey | null>(null)
  const [data, setData] = useState<ARAgingData | null>(null)

  async function loadReport() {
    setLoading(true)
    try {
      const result = await getARAgingReport()
      if (result.error || !result.data) {
        toast.error(result.error || "Failed to load AR aging report")
        setData(null)
      } else {
        setData(result.data as ARAgingData)
      }
    } catch {
      toast.error("Failed to load AR aging report")
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadReport()
  }, [])

  async function handleSendReminder(bucket: BucketKey) {
    setSendingBucket(bucket)
    try {
      const result = await sendARAgingBucketReminders(bucket)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Created ${result.data?.created || 0} reminder${(result.data?.created || 0) === 1 ? "" : "s"}`)
      }
    } catch {
      toast.error("Failed to create reminders")
    } finally {
      setSendingBucket(null)
    }
  }

  const bucketOrder: BucketKey[] = ["0-30", "31-60", "61-90", "90+"]
  const buckets = bucketOrder.map((key) => data?.buckets.find((b) => b.key === key)).filter(Boolean)

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6">
        <h1 className="text-3xl font-bold text-foreground">AR Aging Report</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Outstanding invoices bucketed by days from due date.
        </p>
      </div>

      <div className="p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : !data ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No AR aging data available.</p>
            </Card>
          ) : (
            <>
              <div className="grid md:grid-cols-2 gap-6">
                <Card className="border border-border/50 p-6">
                  <p className="text-muted-foreground text-sm font-medium mb-2">Total Outstanding</p>
                  <p className="text-3xl font-bold text-amber-500">{formatCurrency(data.totals.total_outstanding)}</p>
                </Card>
                <Card className="border border-border/50 p-6">
                  <p className="text-muted-foreground text-sm font-medium mb-2">Open Invoices</p>
                  <p className="text-3xl font-bold text-foreground">{data.totals.total_invoices}</p>
                </Card>
              </div>

              <Card className="border border-border/50 overflow-hidden shadow-sm">
                <div className="p-6 border-b border-border">
                  <h3 className="text-lg font-semibold text-foreground">Aging Buckets</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Bucket</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Invoices</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Outstanding</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {buckets.map((bucket) => (
                        <tr key={bucket!.key} className="border-b border-border hover:bg-secondary/20 transition">
                          <td className="px-6 py-4 text-foreground font-medium">{bucket!.label}</td>
                          <td className="px-6 py-4 text-foreground">{bucket!.invoice_count}</td>
                          <td className="px-6 py-4 text-amber-500 font-semibold">{formatCurrency(bucket!.total_outstanding)}</td>
                          <td className="px-6 py-4">
                            {(bucket!.key === "61-90" || bucket!.key === "90+") && bucket!.invoice_count > 0 ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSendReminder(bucket!.key)}
                                disabled={sendingBucket === bucket!.key}
                              >
                                {sendingBucket === bucket!.key ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <Send className="w-4 h-4 mr-2" />
                                )}
                                Send reminder
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-muted/30">
                        <td className="px-6 py-4 text-foreground font-semibold">Total</td>
                        <td className="px-6 py-4 text-foreground font-semibold">{data.totals.total_invoices}</td>
                        <td className="px-6 py-4 text-amber-500 font-bold">{formatCurrency(data.totals.total_outstanding)}</td>
                        <td className="px-6 py-4 text-muted-foreground">-</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>

              {buckets.map((bucket) => (
                <Card key={`breakdown-${bucket!.key}`} className="border border-border/50 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">{bucket!.label} - Customer Breakdown</h3>
                    <Badge variant="outline">{bucket!.invoice_count} invoices</Badge>
                  </div>
                  {bucket!.customers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No invoices in this bucket.</p>
                  ) : (
                    <div className="space-y-3">
                      {bucket!.customers.map((customer) => (
                        <div key={`${bucket!.key}-${customer.customer_name}`} className="rounded-md border border-border/50 p-3">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-foreground">{customer.customer_name}</p>
                            <p className="text-amber-500 font-semibold">{formatCurrency(customer.total_outstanding)}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{customer.invoice_count} invoice(s)</p>
                          <div className="mt-2 space-y-1">
                            {customer.invoices.slice(0, 5).map((inv) => (
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

              {(data.buckets.find((b) => b.key === "90+")?.invoice_count || 0) > 0 && (
                <Card className="border border-amber-500/30 bg-amber-500/5 p-4">
                  <div className="flex items-start gap-2 text-sm">
                    <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-500" />
                    <p className="text-muted-foreground">
                      90+ bucket invoices are at high collection risk. Send reminders and escalate to direct follow-up.
                    </p>
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

