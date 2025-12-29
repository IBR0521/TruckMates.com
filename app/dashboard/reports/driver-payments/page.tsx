"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Download, Loader2 } from "lucide-react"
import { exportToExcel } from "@/lib/export-utils"
import { toast } from "sonner"
import { useState, useEffect } from "react"
import { getDriverPaymentsReport } from "@/app/actions/reports"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function DriverPaymentsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState("This Month")
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [customDateRange, setCustomDateRange] = useState(false)
  const [reportData, setReportData] = useState<{
    paymentsByDriver: Array<{
      driverId: string
      driverName: string
      loads: number
      totalPay: number
      avgPerLoad: number
      ytd: number
    }>
    totalPaid: number
    totalLoads: number
    avgPerDriver: number
    avgPerLoad: number
  } | null>(null)

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
      const result = await getDriverPaymentsReport(start || undefined, end || undefined)

      if (result.error) {
        toast.error(result.error)
        setReportData(null)
      } else {
        setReportData(result.data)
      }
    } catch (error) {
      toast.error("Failed to load driver payments report")
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
      const exportData = reportData.paymentsByDriver.map((item) => ({
        "Driver Name": item.driverName,
        "Loads (Period)": item.loads,
        "Total Pay (Period)": `$${item.totalPay.toFixed(2)}`,
        "Avg Per Load": `$${item.avgPerLoad.toFixed(2)}`,
        "YTD Earnings": `$${item.ytd.toFixed(2)}`,
      }))
      exportToExcel(exportData, `driver-payments-${selectedPeriod.toLowerCase().replace(" ", "-")}`)
      toast.success("Driver payments report exported successfully")
    } catch (error) {
      toast.error("Failed to export report")
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
  }

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Driver Payment Report</h1>
          <p className="text-muted-foreground text-sm mt-1">Track driver earnings and payments</p>
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
              <p className="text-muted-foreground">No driver payment data available for the selected period.</p>
            </Card>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid md:grid-cols-4 gap-6">
                <Card className="border border-border/50 p-6">
                  <p className="text-muted-foreground text-sm font-medium mb-2">Total Paid ({selectedPeriod})</p>
                  <p className="text-3xl font-bold text-green-400">{formatCurrency(reportData.totalPaid)}</p>
                </Card>
                <Card className="border border-border/50 p-6">
                  <p className="text-muted-foreground text-sm font-medium mb-2">Avg Per Driver</p>
                  <p className="text-3xl font-bold text-foreground">{formatCurrency(reportData.avgPerDriver)}</p>
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

              {/* Driver Payments Table */}
              {reportData.paymentsByDriver.length > 0 ? (
                <Card className="border border-border/50 overflow-hidden shadow-sm">
                  <div className="p-6 border-b border-border">
                    <h3 className="text-lg font-semibold text-foreground">Payment Breakdown by Driver</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border bg-secondary/30">
                          <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Driver Name</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Loads (Period)</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Total Pay (Period)</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Avg Per Load</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">YTD Earnings</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.paymentsByDriver.map((payment, i) => (
                          <tr key={i} className="border-b border-border hover:bg-secondary/20 transition">
                            <td className="px-6 py-4 text-foreground font-medium">{payment.driverName}</td>
                            <td className="px-6 py-4 text-foreground">{payment.loads}</td>
                            <td className="px-6 py-4 text-green-400 font-semibold text-lg">
                              {formatCurrency(payment.totalPay)}
                            </td>
                            <td className="px-6 py-4 text-foreground">{formatCurrency(payment.avgPerLoad)}</td>
                            <td className="px-6 py-4 text-foreground font-semibold">{formatCurrency(payment.ytd)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ) : (
                <Card className="p-8 text-center border-border/50">
                  <p className="text-muted-foreground">No driver payment data available for the selected period.</p>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
