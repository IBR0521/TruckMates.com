"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Download, TrendingUp, Loader2 } from "lucide-react"
import { exportToExcel } from "@/lib/export-utils"
import { toast } from "sonner"
import { useState, useEffect } from "react"
import { getRevenueReport, getMonthlyRevenueTrend } from "@/app/actions/reports"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function RevenuePage() {
  const [selectedPeriod, setSelectedPeriod] = useState("This Month")
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [customDateRange, setCustomDateRange] = useState(false)
  const [reportData, setReportData] = useState<{
    revenueByCustomer: Array<{ customer: string; loads: number; revenue: number; avgPerLoad: number }>
    totalRevenue: number
    totalLoads: number
    avgPerLoad: number
  } | null>(null)
  const [trendData, setTrendData] = useState<Array<{ month: string; amount: number }>>([])

  useEffect(() => {
    loadReportData()
  }, [selectedPeriod, startDate, endDate])

  const getDateRange = () => {
    const now = new Date()
    let start = ""
    let end = new Date().toISOString().split("T")[0]

    if (selectedPeriod === "This Month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
    } else if (selectedPeriod === "Last Month") {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      start = lastMonth.toISOString().split("T")[0]
      end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0]
    } else if (selectedPeriod === "Quarter") {
      const quarter = Math.floor(now.getMonth() / 3)
      start = new Date(now.getFullYear(), quarter * 3, 1).toISOString().split("T")[0]
    } else if (selectedPeriod === "Year") {
      start = new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0]
    } else if (selectedPeriod === "Custom" && startDate && endDate) {
      start = startDate
      end = endDate
    }

    return { start, end }
  }

  const loadReportData = async () => {
    setLoading(true)
    try {
      const { start, end } = getDateRange()
      const result = await getRevenueReport(start || undefined, end || undefined)
      
      if (result.error) {
        toast.error(result.error)
        setReportData(null)
      } else {
        setReportData(result.data)
      }

      // Load trend data
      const trendResult = await getMonthlyRevenueTrend(6)
      if (trendResult.error) {
        console.error("Error loading trend data:", trendResult.error)
        toast.error(`Failed to load revenue trend: ${trendResult.error}`)
        setTrendData([])
      } else {
        setTrendData(trendResult.data || [])
      }
    } catch (error) {
      toast.error("Failed to load revenue report")
      setReportData(null)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    if (!reportData) {
      toast.error("No data to export")
      return
    }

    try {
      const exportData = reportData.revenueByCustomer.map((item) => ({
        Customer: item.customer,
        "Total Loads": item.loads,
        "Total Revenue": `$${item.revenue.toFixed(2)}`,
        "Avg Per Load": `$${item.avgPerLoad.toFixed(2)}`,
      }))
      exportToExcel(exportData, `revenue-report-${selectedPeriod.toLowerCase().replace(" ", "-")}`)
      toast.success("Revenue report exported successfully")
    } catch (error) {
      toast.error("Failed to export report")
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
  }

  const formatMonth = (monthKey: string) => {
    const [year, month] = monthKey.split("-")
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return date.toLocaleDateString("en-US", { month: "short" })
  }

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Revenue Report</h1>
          <p className="text-muted-foreground text-sm mt-1">Track revenue by customer and route</p>
        </div>
        <Button
          onClick={handleExport}
          variant="outline"
          disabled={!reportData || loading}
          className="border-border/50 bg-transparent hover:bg-secondary/50 text-foreground"
        >
          <Download className="w-4 h-4 mr-2" />
          Export Report
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
              <p className="text-muted-foreground">No revenue data available for the selected period.</p>
              <p className="text-sm text-muted-foreground mt-2">Try selecting a different time period or create invoices/loads with revenue.</p>
            </Card>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid md:grid-cols-4 gap-6">
                <Card className="border border-border/50 p-6">
                  <p className="text-muted-foreground text-sm font-medium mb-2">Total Revenue</p>
                  <p className="text-3xl font-bold text-green-400">{formatCurrency(reportData.totalRevenue)}</p>
                </Card>
                <Card className="border border-border/50 p-6">
                  <p className="text-muted-foreground text-sm font-medium mb-2">Period</p>
                  <p className="text-3xl font-bold text-foreground">{selectedPeriod}</p>
                </Card>
                <Card className="border border-border/50 p-6">
                  <p className="text-muted-foreground text-sm font-medium mb-2">Total Loads</p>
                  <p className="text-3xl font-bold text-foreground">{reportData.totalLoads}</p>
                </Card>
                <Card className="border border-border/50 p-6">
                  <p className="text-muted-foreground text-sm font-medium mb-2">Avg Per Load</p>
                  <p className="text-3xl font-bold text-foreground">{formatCurrency(reportData.avgPerLoad)}</p>
                </Card>
              </div>

              {/* Revenue by Customer */}
              {reportData.revenueByCustomer.length > 0 ? (
                <Card className="border border-border/50 overflow-hidden shadow-sm">
                  <div className="p-6 border-b border-border">
                    <h3 className="text-lg font-semibold text-foreground">Revenue by Customer</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border bg-secondary/30">
                          <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Customer</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Total Loads</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Total Revenue</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Avg Per Load</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.revenueByCustomer.map((item, i) => (
                          <tr key={i} className="border-b border-border hover:bg-secondary/20 transition">
                            <td className="px-6 py-4 text-foreground font-medium">{item.customer}</td>
                            <td className="px-6 py-4 text-foreground">{item.loads}</td>
                            <td className="px-6 py-4 text-green-400 font-semibold text-lg">
                              {formatCurrency(item.revenue)}
                            </td>
                            <td className="px-6 py-4 text-foreground">{formatCurrency(item.avgPerLoad)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ) : (
                <Card className="p-8 text-center border-border/50">
                  <p className="text-muted-foreground">No customer revenue data available for the selected period.</p>
                </Card>
              )}

              {/* Monthly Trend */}
              <Card className="border border-border/50 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-foreground mb-4">Monthly Revenue Trend (Last 6 Months)</h3>
                {trendData && trendData.length > 0 ? (
                  <div className="h-64 flex items-end gap-4">
                    {trendData.map((item, i) => {
                      const amounts = trendData.map((d) => d.amount).filter(a => a > 0)
                      const maxAmount = amounts.length > 0 ? Math.max(...amounts) : 1
                      const height = maxAmount > 0 ? (item.amount / maxAmount) * 100 : 0
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-2">
                          <div
                            className="w-full bg-primary/80 hover:bg-primary transition rounded-t"
                            style={{ 
                              height: `${Math.max(height, item.amount > 0 ? 5 : 2)}%`,
                              minHeight: item.amount > 0 ? '20px' : '4px'
                            }}
                          />
                          <p className="text-xs text-muted-foreground">{formatMonth(item.month)}</p>
                          <p className="text-xs font-semibold text-foreground">
                            ${item.amount > 0 ? item.amount.toFixed(1) : '0.0'}k
                          </p>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <p className="mb-2">No revenue data available</p>
                      <p className="text-sm">Revenue trend will appear once you have invoices or loads with revenue</p>
                    </div>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
