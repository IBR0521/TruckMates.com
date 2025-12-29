"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Download, TrendingUp, TrendingDown, Loader2 } from "lucide-react"
import { exportToPDF } from "@/lib/export-utils"
import { toast } from "sonner"
import { useState, useEffect } from "react"
import { getProfitLossReport } from "@/app/actions/reports"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function ProfitLossPage() {
  const [selectedPeriod, setSelectedPeriod] = useState("This Month")
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [customDateRange, setCustomDateRange] = useState(false)
  const [reportData, setReportData] = useState<{
    totalRevenue: number
    totalExpenses: number
    netProfit: number
    revenueBreakdown: Array<{ category: string; amount: number; percentage: number }>
    expenseBreakdown: Array<{ category: string; amount: number; percentage: number }>
  } | null>(null)
  const [previousPeriodData, setPreviousPeriodData] = useState<{
    totalRevenue: number
    totalExpenses: number
    netProfit: number
  } | null>(null)

  useEffect(() => {
    loadReportData()
  }, [selectedPeriod, startDate, endDate])

  const getDateRange = (period?: string) => {
    const periodToUse = period || selectedPeriod
    const now = new Date()
    let start = ""
    let end = new Date().toISOString().split("T")[0]

    if (periodToUse === "This Month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
    } else if (periodToUse === "Last Month") {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      start = lastMonth.toISOString().split("T")[0]
      end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0]
    } else if (periodToUse === "Quarter") {
      const quarter = Math.floor(now.getMonth() / 3)
      start = new Date(now.getFullYear(), quarter * 3, 1).toISOString().split("T")[0]
    } else if (periodToUse === "Year") {
      start = new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0]
    } else if (periodToUse === "Custom" && startDate && endDate) {
      start = startDate
      end = endDate
    }

    return { start, end }
  }

  const getPreviousPeriodRange = () => {
    const now = new Date()
    let start = ""
    let end = ""

    if (selectedPeriod === "This Month") {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      start = lastMonth.toISOString().split("T")[0]
      end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0]
    } else if (selectedPeriod === "Last Month") {
      const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      start = twoMonthsAgo.toISOString().split("T")[0]
      end = new Date(now.getFullYear(), now.getMonth() - 1, 0).toISOString().split("T")[0]
    } else if (selectedPeriod === "Quarter") {
      const quarter = Math.floor(now.getMonth() / 3)
      const prevQuarter = quarter === 0 ? 3 : quarter - 1
      const prevQuarterYear = quarter === 0 ? now.getFullYear() - 1 : now.getFullYear()
      start = new Date(prevQuarterYear, prevQuarter * 3, 1).toISOString().split("T")[0]
      end = new Date(prevQuarterYear, (prevQuarter + 1) * 3, 0).toISOString().split("T")[0]
    } else if (selectedPeriod === "Year") {
      start = new Date(now.getFullYear() - 1, 0, 1).toISOString().split("T")[0]
      end = new Date(now.getFullYear() - 1, 11, 31).toISOString().split("T")[0]
    }

    return { start, end }
  }

  const loadReportData = async () => {
    setLoading(true)
    try {
      const { start, end } = getDateRange()
      const result = await getProfitLossReport(start || undefined, end || undefined)

      if (result.error) {
        toast.error(result.error)
        setReportData(null)
      } else {
        setReportData(result.data)
      }

      // Load previous period for comparison
      const prevRange = getPreviousPeriodRange()
      if (prevRange.start && prevRange.end) {
        const prevResult = await getProfitLossReport(prevRange.start, prevRange.end)
        if (prevResult.data) {
          setPreviousPeriodData(prevResult.data)
        }
      }
    } catch (error) {
      toast.error("Failed to load profit & loss report")
      setReportData(null)
    } finally {
      setLoading(false)
    }
  }

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  }

  const handleExport = () => {
    if (!reportData) {
      toast.error("No data to export")
      return
    }

    try {
      const content = `
        <h1>Profit & Loss Report - ${selectedPeriod}</h1>
        <h2>Summary</h2>
        <p>Total Revenue: ${formatCurrency(reportData.totalRevenue)}</p>
        <p>Total Expenses: ${formatCurrency(reportData.totalExpenses)}</p>
        <p>Net Profit: ${formatCurrency(reportData.netProfit)}</p>
        <h2>Revenue Breakdown</h2>
        ${reportData.revenueBreakdown.map((item) => `<p>${item.category}: ${formatCurrency(item.amount)} (${item.percentage.toFixed(1)}%)</p>`).join("")}
        <h2>Expense Breakdown</h2>
        ${reportData.expenseBreakdown.map((item) => `<p>${item.category}: ${formatCurrency(item.amount)} (${item.percentage.toFixed(1)}%)</p>`).join("")}
      `
      exportToPDF(content, `profit-loss-${selectedPeriod.toLowerCase().replace(" ", "-")}`)
      toast.success("Report exported successfully")
    } catch (error) {
      toast.error("Failed to export report")
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
  }

  const revenueChange = reportData && previousPeriodData
    ? calculateChange(reportData.totalRevenue, previousPeriodData.totalRevenue)
    : 0
  const expenseChange = reportData && previousPeriodData
    ? calculateChange(reportData.totalExpenses, previousPeriodData.totalExpenses)
    : 0
  const profitChange = reportData && previousPeriodData
    ? calculateChange(reportData.netProfit, previousPeriodData.netProfit)
    : 0

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Profit & Loss Report</h1>
          <p className="text-muted-foreground text-sm mt-1">Financial performance overview</p>
        </div>
        <Button
          onClick={handleExport}
          variant="outline"
          disabled={!reportData || loading}
          className="border-border/50 bg-transparent hover:bg-secondary/50 text-foreground"
        >
          <Download className="w-4 h-4 mr-2" />
          Export PDF
        </Button>
      </div>

      <div className="p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Period Selector */}
          <div className="flex flex-wrap gap-2 items-center">
            {["This Month", "Last Month", "Quarter", "Year", "Custom"].map((period) => (
              <Button
                key={period}
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedPeriod(period)
                  if (period === "Custom") {
                    setCustomDateRange(true)
                  } else {
                    setCustomDateRange(false)
                  }
                }}
                className={`border-border/50 ${
                  period === selectedPeriod
                    ? "bg-primary text-primary-foreground"
                    : "bg-transparent hover:bg-secondary/50"
                }`}
              >
                {period}
              </Button>
            ))}
          </div>

          {/* Custom Date Range */}
          {customDateRange && (
            <Card className="p-4 border-border/50">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="end-date">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </Card>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : !reportData ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No financial data available for the selected period.</p>
            </Card>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid md:grid-cols-3 gap-6">
                <Card className="border border-border/50 p-6">
                  <p className="text-muted-foreground text-sm font-medium mb-2">Total Revenue</p>
                  <p className="text-4xl font-bold text-green-400 mb-2">{formatCurrency(reportData.totalRevenue)}</p>
                  {previousPeriodData && (
                    <div className={`flex items-center gap-1 text-sm ${revenueChange >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {revenueChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      <span>
                        {revenueChange >= 0 ? "+" : ""}
                        {revenueChange.toFixed(1)}% from previous period
                      </span>
                    </div>
                  )}
                </Card>
                <Card className="border border-border/50 p-6">
                  <p className="text-muted-foreground text-sm font-medium mb-2">Total Expenses</p>
                  <p className="text-4xl font-bold text-red-400 mb-2">{formatCurrency(reportData.totalExpenses)}</p>
                  {previousPeriodData && (
                    <div className={`flex items-center gap-1 text-sm ${expenseChange <= 0 ? "text-green-400" : "text-red-400"}`}>
                      {expenseChange <= 0 ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                      <span>
                        {expenseChange >= 0 ? "+" : ""}
                        {expenseChange.toFixed(1)}% from previous period
                      </span>
                    </div>
                  )}
                </Card>
                <Card className="border border-border/50 p-6 bg-primary/10 border-primary/30">
                  <p className="text-muted-foreground text-sm font-medium mb-2">Net Profit</p>
                  <p className={`text-4xl font-bold mb-2 ${reportData.netProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {formatCurrency(reportData.netProfit)}
                  </p>
                  {previousPeriodData && (
                    <div className={`flex items-center gap-1 text-sm ${profitChange >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {profitChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      <span>
                        {profitChange >= 0 ? "+" : ""}
                        {profitChange.toFixed(1)}% from previous period
                      </span>
                    </div>
                  )}
                </Card>
              </div>

              {/* Revenue Breakdown */}
              {reportData.revenueBreakdown.length > 0 && (
                <Card className="border border-border/50 p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Revenue Breakdown</h3>
                  <div className="space-y-4">
                    {reportData.revenueBreakdown.map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-secondary/20 rounded-lg">
                        <div className="flex-1">
                          <p className="text-foreground font-medium">{item.category}</p>
                          <div className="mt-2 w-full bg-secondary/50 rounded-full h-2">
                            <div
                              className="bg-green-400 h-2 rounded-full transition-all"
                              style={{ width: `${item.percentage}%` }}
                            />
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{item.percentage.toFixed(1)}% of total</p>
                        </div>
                        <p className="text-xl font-bold text-green-400 ml-4">{formatCurrency(item.amount)}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Expense Breakdown */}
              {reportData.expenseBreakdown.length > 0 && (
                <Card className="border border-border/50 p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Expense Breakdown</h3>
                  <div className="space-y-4">
                    {reportData.expenseBreakdown.map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-secondary/20 rounded-lg">
                        <div className="flex-1">
                          <p className="text-foreground font-medium">{item.category}</p>
                          <div className="mt-2 w-full bg-secondary/50 rounded-full h-2">
                            <div
                              className="bg-red-400 h-2 rounded-full transition-all"
                              style={{ width: `${item.percentage}%` }}
                            />
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{item.percentage.toFixed(1)}% of total</p>
                        </div>
                        <p className="text-xl font-bold text-red-400 ml-4">{formatCurrency(item.amount)}</p>
                      </div>
                    ))}
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
