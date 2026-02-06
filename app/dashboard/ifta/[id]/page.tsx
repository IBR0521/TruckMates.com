"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, Download } from "lucide-react"
import Link from "next/link"
import { use } from "react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { getIFTAReport } from "@/app/actions/tax-fuel-reconciliation"
import { generateIFTAReportPDF } from "@/app/actions/ifta-pdf"

export default function IFTADetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id === "generate") {
      router.replace("/dashboard/ifta/generate")
      return
    }
    loadReport()
  }, [id, router])

  async function loadReport() {
    if (id === "generate") return
    setLoading(true)
    try {
      const result = await getIFTAReport(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        setReport(result.data)
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to load IFTA report")
    } finally {
      setLoading(false)
    }
  }

  if (id === "generate") {
    return null
  }

  if (loading) {
    return (
      <div className="w-full p-8">
        <Card className="p-8">
          <p className="text-center text-muted-foreground">Loading IFTA report...</p>
        </Card>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="w-full p-8">
        <Card className="p-8">
          <p className="text-center text-muted-foreground">IFTA report not found</p>
        </Card>
      </div>
    )
  }

  const handleDownload = async () => {
    try {
      const result = await generateIFTAReportPDF(id)
      if (result.error) {
        toast.error(result.error)
        return
      }

      // Open PDF in new window for printing/downloading
      const printWindow = window.open("", "_blank")
      if (printWindow) {
        printWindow.document.write(result.html)
        printWindow.document.close()
        // Auto-trigger print dialog
        setTimeout(() => {
          printWindow.print()
        }, 250)
        toast.success("IFTA report PDF opened for download")
      } else {
        toast.error("Please allow popups to download the PDF")
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to generate IFTA report PDF")
    }
  }

  const quarterLabel = `Q${report.quarter} ${report.year}`
  const statusColors: Record<string, string> = {
    draft: "bg-yellow-500/20 text-yellow-400",
    submitted: "bg-blue-500/20 text-blue-400",
    approved: "bg-green-500/20 text-green-400",
    rejected: "bg-red-500/20 text-red-400",
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
            <h1 className="text-3xl font-bold text-foreground">IFTA Report - {quarterLabel}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {report.submitted_at ? `Submitted on ${new Date(report.submitted_at).toLocaleDateString()}` : "Draft"}
            </p>
          </div>
          <Button onClick={handleDownload} variant="outline" className="border-border bg-transparent">
            <Download className="w-4 h-4 mr-2" />
            Download Report
          </Button>
        </div>
      </div>

      <div className="p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="grid md:grid-cols-4 gap-6">
            <Card className="border-border p-6">
              <p className="text-muted-foreground text-sm mb-2">Total Miles</p>
              <p className="text-3xl font-bold text-foreground">{report.total_miles?.toLocaleString() || 0}</p>
            </Card>
            <Card className="border-border p-6">
              <p className="text-muted-foreground text-sm mb-2">Total Gallons</p>
              <p className="text-3xl font-bold text-foreground">{report.total_gallons?.toLocaleString() || 0}</p>
            </Card>
            <Card className="border-border p-6">
              <p className="text-muted-foreground text-sm mb-2">Tax Paid</p>
              <p className="text-3xl font-bold text-foreground">${report.total_tax_paid?.toFixed(2) || "0.00"}</p>
            </Card>
            <Card className="border-border p-6 bg-yellow-500/10 border-yellow-500/30">
              <p className="text-muted-foreground text-sm mb-2">Net Tax Due</p>
              <p className="text-3xl font-bold text-yellow-400">${report.net_tax_due?.toFixed(2) || "0.00"}</p>
            </Card>
          </div>

          <Card className="border-border p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-foreground">State-by-State Breakdown</h3>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusColors[report.status] || statusColors.draft}`}>
                {report.status?.charAt(0).toUpperCase() + report.status?.slice(1) || "Draft"}
              </span>
            </div>

            {report.state_breakdown && report.state_breakdown.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">State</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Miles</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Gallons</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Tax Rate</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Tax Due</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Tax Paid</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Net Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.state_breakdown.map((state: any, i: number) => (
                      <tr key={i} className="border-b border-border hover:bg-secondary/20 transition">
                        <td className="px-6 py-4 text-foreground font-medium">{state.state}</td>
                        <td className="px-6 py-4 text-foreground">{state.miles?.toLocaleString() || 0}</td>
                        <td className="px-6 py-4 text-foreground">{state.gallons?.toLocaleString() || 0}</td>
                        <td className="px-6 py-4 text-foreground">${state.tax_rate?.toFixed(4) || "0.0000"}</td>
                        <td className="px-6 py-4 text-foreground">${state.tax_due?.toFixed(2) || "0.00"}</td>
                        <td className="px-6 py-4 text-foreground">${state.tax_paid?.toFixed(2) || "0.00"}</td>
                        <td className="px-6 py-4 text-foreground font-semibold">${state.net_tax_due?.toFixed(2) || "0.00"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border">
                      <td colSpan={4} className="px-6 py-4 text-right font-semibold text-foreground">
                        Total:
                      </td>
                      <td className="px-6 py-4 text-foreground font-semibold">${report.total_tax_due?.toFixed(2) || "0.00"}</td>
                      <td className="px-6 py-4 text-foreground font-semibold">${report.total_tax_paid?.toFixed(2) || "0.00"}</td>
                      <td className="px-6 py-4 text-yellow-400 font-bold text-lg">${report.net_tax_due?.toFixed(2) || "0.00"}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No state breakdown available</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
