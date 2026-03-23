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
      // Fetch PDF from API route
      const response = await fetch(`/api/ifta/${id}/pdf`)
      if (!response.ok) {
        const error = await response.json()
        toast.error(error.error || "Failed to generate PDF")
        return
      }

      // FIXED: Handle actual PDF binary instead of HTML
      const contentType = response.headers.get("content-type")
      
      if (contentType === "application/pdf") {
        // Download actual PDF file
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `ifta-report-${id}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast.success("IFTA report PDF downloaded")
      } else {
        // Fallback: Handle HTML if PDF generation failed
        const html = await response.text()
        const printWindow = window.open("", "_blank")
        if (printWindow) {
          printWindow.document.write(html)
          printWindow.document.close()
          setTimeout(() => {
            printWindow.print()
          }, 250)
          toast.success("IFTA report opened for printing (HTML fallback)")
        } else {
          toast.error("Please allow popups to download the PDF")
        }
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to generate IFTA report PDF")
    }
  }

  // FIXED: Normalize quarter label to prevent "QQ1 2025" if quarter already has Q prefix
  const quarterLabel = String(report.quarter).startsWith("Q")
    ? `${report.quarter} ${report.year}`
    : `Q${report.quarter} ${report.year}`
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

          {report.ifta_data_sources && (
            <Card className="border-border p-4 bg-secondary/20">
              <p className="text-sm font-medium text-foreground mb-1">Mileage data sources</p>
              <p className="text-sm text-muted-foreground">
                {(report.ifta_data_sources as any).summary ||
                  "GPS/trip sheet mix (see per-state below)."}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {(report.ifta_data_sources as any).uses_gps && (
                  <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40">
                    GPS / ELD crossings
                  </span>
                )}
                {(report.ifta_data_sources as any).uses_trip_sheets && (
                  <span className="text-xs px-2 py-1 rounded bg-amber-500/20 text-amber-200 border border-amber-500/40">
                    Manual trip sheets
                  </span>
                )}
              </div>
            </Card>
          )}

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
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Source</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Miles</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Gallons</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Tax Rate</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Tax Due</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Tax Paid</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Net Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.state_breakdown.map((state: any, i: number) => {
                      // FIXED: Align field names with what createIFTAReport actually stores
                      // createIFTAReport stores: state, miles, fuel (number), tax (number), taxRate
                      // Detail page expects: state, miles, gallons, tax_rate, tax_due, tax_paid, net_tax_due
                      const miles = state.miles || 0
                      const fuel = typeof state.fuel === 'number' ? state.fuel : parseFloat((state.fuel || "0").toString().replace(/[^0-9.]/g, ""))
                      const taxRate = state.taxRate || state.tax_rate || 0.25
                      const taxDue = state.tax || (fuel * taxRate) || 0
                      // Tax paid and net tax due are not stored in current schema, calculate if needed
                      const taxPaid = state.tax_paid || 0
                      const netTaxDue = state.net_tax_due || (taxDue - taxPaid)
                      const src = state.mileage_source as string | undefined
                      const srcLabel =
                        src === "gps"
                          ? "GPS/ELD"
                          : src === "trip_sheet"
                            ? "Trip sheet"
                            : src === "both"
                              ? "GPS + sheet"
                              : "—"

                      return (
                        <tr key={i} className="border-b border-border hover:bg-secondary/20 transition">
                          <td className="px-6 py-4 text-foreground font-medium">{state.state}</td>
                          <td className="px-6 py-4 text-muted-foreground text-sm">{srcLabel}</td>
                          <td className="px-6 py-4 text-foreground">{miles.toLocaleString()}</td>
                          <td className="px-6 py-4 text-foreground">{fuel.toLocaleString()}</td>
                          <td className="px-6 py-4 text-foreground">${taxRate.toFixed(4)}</td>
                          <td className="px-6 py-4 text-foreground">${taxDue.toFixed(2)}</td>
                          <td className="px-6 py-4 text-foreground">${taxPaid.toFixed(2)}</td>
                          <td className="px-6 py-4 text-foreground font-semibold">${netTaxDue.toFixed(2)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border">
                      <td colSpan={5} className="px-6 py-4 text-right font-semibold text-foreground">
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
