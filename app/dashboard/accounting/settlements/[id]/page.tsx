"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, Download } from "lucide-react"
import Link from "next/link"
import { use } from "react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { exportToPDF } from "@/lib/export-utils"
import { toast } from "sonner"

export default function SettlementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  useEffect(() => {
    if (id === "create") {
      router.replace("/dashboard/accounting/settlements/create")
    }
  }, [id, router])

  if (id === "create") {
    return null
  }

  const handleDownload = () => {
    try {
      const content = `
        <h1>Settlement Details</h1>
        <p>Driver: ${settlement.driver}</p>
        <p>Period: ${settlement.period}</p>
        <p>Net Pay: ${settlement.netPay}</p>
      `
      exportToPDF(content, `settlement-${id}`)
      toast.success("Settlement downloaded successfully")
    } catch (error) {
      toast.error("Failed to download settlement")
    }
  }

  const settlement = {
    id: id,
    driver: "John Smith",
    period: "12/25/24 - 01/01/25",
    totalLoads: 8,
    grossPay: "$4,200.00",
    fuelDeduction: "$220.00",
    advanceDeduction: "$100.00",
    otherDeductions: "$0.00",
    totalDeductions: "$320.00",
    netPay: "$3,880.00",
    status: "Paid",
    paidDate: "01/05/2025",
    paymentMethod: "Direct Deposit",
    loads: [
      { id: "LD-234", destination: "Philadelphia, PA", amount: "$525.00" },
      { id: "LD-235", destination: "Cleveland, OH", amount: "$480.00" },
      { id: "LD-236", destination: "Detroit, MI", amount: "$545.00" },
    ],
  }

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6">
        <Link href="/dashboard/accounting/settlements">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Settlements
          </Button>
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Settlement Details</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {settlement.driver} - {settlement.period}
            </p>
          </div>
          <Button onClick={handleDownload} variant="outline" className="border-border bg-transparent">
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
        </div>
      </div>

      <div className="p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="border-border p-6">
              <p className="text-muted-foreground text-sm mb-2">Gross Pay</p>
              <p className="text-3xl font-bold text-foreground">{settlement.grossPay}</p>
            </Card>
            <Card className="border-border p-6">
              <p className="text-muted-foreground text-sm mb-2">Total Deductions</p>
              <p className="text-3xl font-bold text-red-400">{settlement.totalDeductions}</p>
            </Card>
            <Card className="border-border p-6 bg-green-500/10 border-green-500/30">
              <p className="text-muted-foreground text-sm mb-2">Net Pay</p>
              <p className="text-3xl font-bold text-green-400">{settlement.netPay}</p>
            </Card>
          </div>

          <Card className="border-border p-8">
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Driver</p>
                  <p className="text-lg font-semibold text-foreground">{settlement.driver}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Settlement Period</p>
                  <p className="text-foreground">{settlement.period}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Loads</p>
                  <p className="text-foreground font-semibold">{settlement.totalLoads}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Status</p>
                  <span className="px-3 py-1 rounded-full text-sm font-semibold bg-green-500/20 text-green-400">
                    {settlement.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Paid Date</p>
                  <p className="text-foreground">{settlement.paidDate}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Payment Method</p>
                  <p className="text-foreground">{settlement.paymentMethod}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Deduction Breakdown</h3>
              <div className="space-y-3">
                <div className="flex justify-between py-2">
                  <span className="text-foreground">Fuel Charges</span>
                  <span className="text-red-400 font-medium">{settlement.fuelDeduction}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-foreground">Advances</span>
                  <span className="text-red-400 font-medium">{settlement.advanceDeduction}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-foreground">Other</span>
                  <span className="text-red-400 font-medium">{settlement.otherDeductions}</span>
                </div>
                <div className="flex justify-between py-2 border-t border-border pt-3">
                  <span className="text-foreground font-semibold">Total Deductions</span>
                  <span className="text-red-400 font-bold text-lg">{settlement.totalDeductions}</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
