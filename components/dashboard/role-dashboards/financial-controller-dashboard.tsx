"use client"

import { Card } from "@/components/ui/card"
import { FileText, DollarSign, Receipt, TrendingUp } from "lucide-react"
import { useState, useEffect } from "react"
import { getCurrentUser } from "@/app/actions/user"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export function FinancialControllerDashboard() {
  const [invoicingQueue, setInvoicingQueue] = useState<any[]>([])
  const [settlementTracker, setSettlementTracker] = useState<any[]>([])
  const [iftaSummary, setIftaSummary] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setIsLoading(true)
    try {
      const userResult = await getCurrentUser()
      if (userResult.data?.company_id) {
        const supabase = createClient()

        // Get loads marked "Delivered" but not yet invoiced
        const { data: deliveredLoads } = await supabase
          .from("loads")
          .select("id, shipment_number, destination, delivered_date, total_rate, value")
          .eq("company_id", userResult.data.company_id)
          .eq("status", "delivered")
          .is("invoice_id", null)
          .order("delivered_date", { ascending: false })
          .limit(10)

        setInvoicingQueue(deliveredLoads || [])

        // Get settlement tracker (what is owed to drivers)
        const { data: settlements } = await supabase
          .from("settlements")
          .select("id, driver_id, period_start, period_end, net_pay, status, drivers:driver_id(name)")
          .eq("company_id", userResult.data.company_id)
          .in("status", ["pending", "approved"])
          .order("period_end", { ascending: false })
          .limit(10)

        setSettlementTracker(settlements || [])

        // Get IFTA summary (quarterly fuel tax data)
        const currentQuarter = Math.floor(new Date().getMonth() / 3) + 1
        const currentYear = new Date().getFullYear()

        const { data: ifta } = await supabase
          .from("ifta_reports")
          .select("*")
          .eq("company_id", userResult.data.company_id)
          .eq("quarter", currentQuarter)
          .eq("year", currentYear)
          .single()

        setIftaSummary(ifta)
      }
    } catch (error) {
      console.error("Error loading financial controller dashboard:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  const totalPendingInvoicing = invoicingQueue.reduce(
    (sum, load) => sum + (Number(load.total_rate) || Number(load.value) || 0),
    0
  )
  const totalPendingSettlements = settlementTracker.reduce(
    (sum, settlement) => sum + (Number(settlement.net_pay) || 0),
    0
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Financial Controller</h1>
        <p className="text-muted-foreground">Order-to-Cash cycle and financial management</p>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-border bg-card/50 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-muted-foreground text-sm font-medium mb-2">Pending Invoicing</p>
              <p className="text-2xl font-bold text-yellow-400">
                ${totalPendingInvoicing.toLocaleString()}
              </p>
            </div>
            <FileText className="w-5 h-5 text-yellow-400 opacity-70" />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {invoicingQueue.length} loads awaiting invoice
          </p>
        </Card>

        <Card className="border-border bg-card/50 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-muted-foreground text-sm font-medium mb-2">Pending Settlements</p>
              <p className="text-2xl font-bold text-blue-400">
                ${totalPendingSettlements.toLocaleString()}
              </p>
            </div>
            <DollarSign className="w-5 h-5 text-blue-400 opacity-70" />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {settlementTracker.length} settlements pending
          </p>
        </Card>
      </div>

      {/* Invoicing Queue */}
      <Card className="border-border bg-card/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">Invoicing Queue</h2>
          <Link href="/dashboard/accounting/invoices">
            <Button variant="outline" size="sm">View All Invoices</Button>
          </Link>
        </div>
        <div className="space-y-3">
          {invoicingQueue.length > 0 ? (
            invoicingQueue.map((load: any) => (
              <div
                key={load.id}
                className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {load.shipment_number || load.id}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Delivered:{" "}
                      {load.delivered_date
                        ? new Date(load.delivered_date).toLocaleDateString()
                        : "N/A"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">
                    ${(Number(load.total_rate) || Number(load.value) || 0).toLocaleString()}
                  </p>
                  <Button variant="outline" size="sm" className="mt-1">
                    Create Invoice
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No loads awaiting invoicing
            </p>
          )}
        </div>
      </Card>

      {/* Settlement Tracker */}
      <Card className="border-border bg-card/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">Settlement Tracker</h2>
          <Link href="/dashboard/accounting/settlements">
            <Button variant="outline" size="sm">View All Settlements</Button>
          </Link>
        </div>
        <div className="space-y-3">
          {settlementTracker.length > 0 ? (
            settlementTracker.map((settlement: any) => (
              <div
                key={settlement.id}
                className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Receipt className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {settlement.drivers?.name || "Driver"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Period: {new Date(settlement.period_start).toLocaleDateString()} -{" "}
                      {new Date(settlement.period_end).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">
                    ${Number(settlement.net_pay || 0).toLocaleString()}
                  </p>
                  <span className="text-xs text-muted-foreground capitalize">
                    {settlement.status}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No pending settlements
            </p>
          )}
        </div>
      </Card>

      {/* IFTA Summary */}
      <Card className="border-border bg-card/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">IFTA Summary</h2>
          <Link href="/dashboard/ifta">
            <Button variant="outline" size="sm">View IFTA Reports</Button>
          </Link>
        </div>
        {iftaSummary ? (
          <div className="p-4 bg-secondary/30 rounded-lg">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Quarter</p>
                <p className="text-lg font-semibold text-foreground">
                  Q{iftaSummary.quarter} {iftaSummary.year}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Miles</p>
                <p className="text-lg font-semibold text-foreground">
                  {Number(iftaSummary.total_miles || 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Status</p>
                <p className="text-lg font-semibold text-foreground capitalize">
                  {iftaSummary.status || "Pending"}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No IFTA data for current quarter
          </p>
        )}
      </Card>
    </div>
  )
}

