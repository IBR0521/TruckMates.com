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

export default function IFTADetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)

  useEffect(() => {
    if (id === "generate") {
      router.replace("/dashboard/ifta/generate")
    }
  }, [id, router])

  if (id === "generate") {
    return null
  }

  const handleDownload = () => {
    try {
      const content = `
        <h1>IFTA Report - ${report.quarter}</h1>
        <p>Period: ${report.period}</p>
        <p>Total Miles: ${report.totalMiles}</p>
        <p>Tax Owed: ${report.taxOwed}</p>
      `
      exportToPDF(content, `ifta-report-${report.quarter.toLowerCase().replace(" ", "-")}`)
      toast.success("IFTA report downloaded successfully")
    } catch (error) {
      toast.error("Failed to download IFTA report")
    }
  }

  const report = {
    id: id,
    quarter: "Q4 2024",
    period: "Oct-Dec 2024",
    totalMiles: "45,280 mi",
    taxableMiles: "42,150 mi",
    fuelPurchased: "12,450 gal",
    taxOwed: "$3,245.00",
    status: "Filed",
    filedDate: "01/05/2025",
    stateBreakdown: [
      { state: "California", miles: "12,450", fuel: "3,200 gal", tax: "$985.00" },
      { state: "Texas", miles: "18,200", fuel: "4,850 gal", tax: "$1,125.00" },
      { state: "Arizona", miles: "8,350", fuel: "2,180 gal", tax: "$645.00" },
      { state: "Nevada", miles: "6,280", fuel: "1,620 gal", tax: "$490.00" },
    ],
  }

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6">
        <Link href="/dashboard/ifta">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to IFTA Reports
          </Button>
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">IFTA Report - {report.quarter}</h1>
            <p className="text-muted-foreground text-sm mt-1">Filed on {report.filedDate}</p>
          </div>
          <Button onClick={handleDownload} variant="outline" className="border-border bg-transparent">
            <Download className="w-4 h-4 mr-2" />
            Download Report
          </Button>
        </div>
      </div>

      <div className="p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="border-border p-6">
              <p className="text-muted-foreground text-sm mb-2">Total Miles</p>
              <p className="text-3xl font-bold text-foreground">{report.totalMiles}</p>
            </Card>
            <Card className="border-border p-6">
              <p className="text-muted-foreground text-sm mb-2">Fuel Purchased</p>
              <p className="text-3xl font-bold text-foreground">{report.fuelPurchased}</p>
            </Card>
            <Card className="border-border p-6 bg-yellow-500/10 border-yellow-500/30">
              <p className="text-muted-foreground text-sm mb-2">Tax Owed</p>
              <p className="text-3xl font-bold text-yellow-400">{report.taxOwed}</p>
            </Card>
          </div>

          <Card className="border-border p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-foreground">State-by-State Breakdown</h3>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-green-500/20 text-green-400">
                {report.status}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">State</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Miles Traveled</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Fuel Purchased</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Tax Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {report.stateBreakdown.map((state, i) => (
                    <tr key={i} className="border-b border-border hover:bg-secondary/20 transition">
                      <td className="px-6 py-4 text-foreground font-medium">{state.state}</td>
                      <td className="px-6 py-4 text-foreground">{state.miles}</td>
                      <td className="px-6 py-4 text-foreground">{state.fuel}</td>
                      <td className="px-6 py-4 text-foreground font-semibold">{state.tax}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border">
                    <td colSpan={3} className="px-6 py-4 text-right font-semibold text-foreground">
                      Total Tax Owed:
                    </td>
                    <td className="px-6 py-4 text-yellow-400 font-bold text-lg">{report.taxOwed}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
