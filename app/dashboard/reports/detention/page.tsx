"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, TrendingUp, Clock, DollarSign, Users } from "lucide-react"
import { getDetentionAnalytics } from "@/app/actions/detention-tracking"
import { toast } from "sonner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function DetentionDashboardPage() {
  const [analytics, setAnalytics] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [startDate, setStartDate] = useState<string>(() => {
    const date = new Date()
    date.setMonth(date.getMonth() - 3) // Default to last 3 months
    return date.toISOString().split("T")[0]
  })
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0]
  })

  useEffect(() => {
    loadAnalytics()
  }, [])

  async function loadAnalytics() {
    setIsLoading(true)
    try {
      const result = await getDetentionAnalytics({
        start_date: startDate,
        end_date: endDate,
        limit: 10,
      })

      if (result.error) {
        toast.error(result.error)
        setAnalytics(null)
      } else {
        setAnalytics(result.data)
      }
    } catch (error: any) {
      toast.error("Failed to load detention analytics")
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount)
  }

  function formatMinutes(minutes: number) {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  return (
    <div className="w-full bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Detention Time Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              Track detention costs by customer to identify revenue opportunities
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Filters */}
          <Card className="p-6">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <Button onClick={loadAnalytics} disabled={isLoading}>
                {isLoading ? "Loading..." : "Apply Filters"}
              </Button>
            </div>
          </Card>

          {/* Summary Cards */}
          {analytics?.summary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">Total Detention Fees</p>
                  <DollarSign className="w-5 h-5 text-green-500" />
                </div>
                <p className="text-3xl font-bold text-foreground">
                  {formatCurrency(analytics.summary.total_fee)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Revenue opportunity
                </p>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">Total Detention Time</p>
                  <Clock className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-3xl font-bold text-foreground">
                  {formatMinutes(analytics.summary.total_minutes)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {analytics.summary.total_count} incidents
                </p>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">Average Fee per Customer</p>
                  <TrendingUp className="w-5 h-5 text-purple-500" />
                </div>
                <p className="text-3xl font-bold text-foreground">
                  {formatCurrency(analytics.summary.average_fee_per_customer)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Across {analytics.top_customers?.length || 0} customers
                </p>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">Top Customers</p>
                  <Users className="w-5 h-5 text-orange-500" />
                </div>
                <p className="text-3xl font-bold text-foreground">
                  {analytics.top_customers?.length || 0}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  In this period
                </p>
              </Card>
            </div>
          )}

          {/* Top Customers Table */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-foreground">Top 10 Customers by Detention Cost</h2>
              <Badge variant="outline">{analytics?.top_customers?.length || 0} customers</Badge>
            </div>

            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading detention analytics...</p>
              </div>
            ) : !analytics?.top_customers || analytics.top_customers.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No detention data found for the selected period.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Detention fees are tracked when drivers exceed free time in geofenced zones.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Customer Name</TableHead>
                      <TableHead className="text-right">Total Fees</TableHead>
                      <TableHead className="text-right">Detention Time</TableHead>
                      <TableHead className="text-right">Incidents</TableHead>
                      <TableHead className="text-right">Avg Fee per Incident</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics.top_customers.map((customer: any, index: number) => (
                      <TableRow key={customer.customer_id}>
                        <TableCell>
                          <Badge variant={index === 0 ? "default" : "outline"}>
                            #{index + 1}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {customer.customer_name}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-green-600">
                          {formatCurrency(customer.total_fee)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMinutes(customer.total_minutes)}
                        </TableCell>
                        <TableCell className="text-right">
                          {customer.detention_count}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(customer.average_fee)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>

          {/* Insights */}
          {analytics?.top_customers && analytics.top_customers.length > 0 && (
            <Card className="p-6 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-500" />
                Revenue Insights
              </h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  • Top customer accounts for{" "}
                  <span className="font-semibold text-foreground">
                    {analytics.top_customers[0]
                      ? formatCurrency(analytics.top_customers[0].total_fee)
                      : "$0"}{" "}
                  </span>
                  in detention fees
                </p>
                <p>
                  • Consider implementing automatic detention billing for customers with frequent
                  delays
                </p>
                <p>
                  • Review geofence detention settings to ensure accurate tracking
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

