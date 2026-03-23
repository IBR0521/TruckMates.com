"use client"

import { useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Download, FileText, Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import {
  generateYearEndTaxReport,
  generateYearEndTaxReportPdfBase64,
  getYearEndTaxReportHtml,
  type YearEndTaxReportData,
} from "@/app/actions/year-end-tax-report"

const currentYear = new Date().getFullYear()
const yearOptions = Array.from({ length: 8 }, (_, i) => currentYear - i)

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n)
}

export default function YearEndTaxReportPage() {
  const [year, setYear] = useState(String(currentYear))
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<YearEndTaxReportData | null>(null)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)

  const runGenerate = useCallback(async () => {
    const y = parseInt(year, 10)
    setLoading(true)
    try {
      const [reportRes, htmlRes] = await Promise.all([
        generateYearEndTaxReport(y),
        getYearEndTaxReportHtml(y),
      ])
      if (reportRes.error) {
        toast.error(reportRes.error)
        setData(null)
        setPreviewHtml(null)
        return
      }
      setData(reportRes.data)
      if (htmlRes.error) {
        setPreviewHtml(null)
      } else {
        setPreviewHtml(htmlRes.html)
      }
      toast.success(`Year-end data loaded for ${y}`)
    } catch {
      toast.error("Failed to generate report")
      setData(null)
      setPreviewHtml(null)
    } finally {
      setLoading(false)
    }
  }, [year])

  const downloadPdf = async () => {
    const y = parseInt(year, 10)
    setLoading(true)
    try {
      const res = await generateYearEndTaxReportPdfBase64(y)
      if (res.base64) {
        const binary = atob(res.base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        const blob = new Blob([bytes], { type: "application/pdf" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = res.filename
        a.click()
        URL.revokeObjectURL(url)
        toast.success("PDF downloaded")
        return
      }
      if (res.htmlFallback) {
        const blob = new Blob([res.htmlFallback], { type: "text/html;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `year-end-tax-report-${y}.html`
        a.click()
        URL.revokeObjectURL(url)
        toast.message("PDF engine unavailable — saved HTML version instead")
        return
      }
      toast.error(res.error || "Could not generate PDF")
    } catch {
      toast.error("Download failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FileText className="h-7 w-7 text-primary" />
          Year-End Tax Report
        </h1>
        <p className="text-muted-foreground mt-1">
          Fiscal-year summary for your accountant: income, expenses, net profit, IFTA, and per-truck totals.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tax year</CardTitle>
          <CardDescription>Select the calendar year (Jan 1 – Dec 31), then generate or download.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Tax year</label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={runGenerate} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Generate report
          </Button>
          <Button variant="secondary" onClick={downloadPdf} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
            Download PDF
          </Button>
        </CardContent>
      </Card>

      {data && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Gross revenue</CardDescription>
              <CardTitle className="text-xl">{formatMoney(data.income.grossRevenue)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total expenses</CardDescription>
              <CardTitle className="text-xl">{formatMoney(data.expenses.totalExpenses)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Net profit (loss)</CardDescription>
              <CardTitle className="text-xl">{formatMoney(data.net.netProfit)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Profit margin</CardDescription>
              <CardTitle className="text-xl">{data.net.profitMarginPct.toFixed(1)}%</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>Formatted report (same content as PDF). Use Download PDF for your records.</CardDescription>
        </CardHeader>
        <CardContent>
          {!previewHtml && !data && (
            <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground text-sm">
              Select a year and click <strong>Generate report</strong> to preview.
            </div>
          )}
          {previewHtml && (
            <div className="rounded-lg border bg-white overflow-hidden">
              <iframe
                title="Year-end tax report preview"
                srcDoc={previewHtml}
                className="w-full min-h-[720px] border-0 bg-white"
                sandbox="allow-same-origin"
              />
            </div>
          )}
          {data && !previewHtml && (
            <p className="text-sm text-muted-foreground">Preview HTML unavailable; summary cards above reflect loaded data.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
