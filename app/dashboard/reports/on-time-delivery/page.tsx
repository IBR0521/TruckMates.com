"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Clock, TrendingUp, TrendingDown, CheckCircle, XCircle, Users } from "lucide-react"
import { getOnTimeDeliveryAnalytics } from "@/app/actions/on-time-delivery"
import { getCustomers } from "@/app/actions/customers"
import { toast } from "sonner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function OnTimeDeliveryScorecardPage() {
  const [analytics, setAnalytics] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [customers, setCustomers] = useState<any[]>([])
  const [filters, setFilters] = useState({
    start_date: "",
    end_date: "",
    customer_id: "all",
  })

  useEffect(() => {
    loadCustomers()
  }, [])

  useEffect(() => {
    loadAnalytics()
  }, [filters])

  async function loadCustomers() {
    const result = await getCustomers()
    if (result.data) {
      setCustomers(result.data)
    }
  }

  async function loadAnalytics() {
    setIsLoading(true)
    try {
      const analyticsFilters: any = {}
      if (filters.start_date) analyticsFilters.start_date = filters.start_date
      if (filters.end_date) analyticsFilters.end_date = filters.end_date
      if (filters.customer_id !== "all") analyticsFilters.customer_id = filters.customer_id

      const result = await getOnTimeDeliveryAnalytics(analyticsFilters)

      if (result.error) {
        toast.error(result.error)
        setAnalytics(null)
      } else {
        setAnalytics(result.data)
      }
    } catch (error: unknown) {
      toast.error("Failed to load on-time delivery analytics")
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  function getOnTimeBadge(percentage: number) {
    if (percentage >= 95) {
      return (
        <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
          Excellent ({percentage}%)
        </Badge>
      )
    } else if (percentage >= 85) {
      return (
        <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
          Good ({percentage}%)
        </Badge>
      )
    } else if (percentage >= 75) {
      return (
        <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
          Fair ({percentage}%)
        </Badge>
      )
    } else {
      return (
        <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
          Poor ({percentage}%)
        </Badge>
      )
    }
  }

  return (
    <div className="w-full bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">On-Time Delivery Scorecard</h1>
            <p className="text-muted-foreground mt-2">
              Track delivery performance by customer to improve service quality
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Filters */}
          <Card className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={filters.start_date}
                  onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={filters.end_date}
                  onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Customer</Label>
                <Select
                  value={filters.customer_id}
                  onValueChange={(value) => setFilters({ ...filters, customer_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Customers</SelectItem>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name || customer.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={() =>
                    setFilters({ start_date: "", end_date: "", customer_id: "all" })
                  }
                  variant="outline"
                  className="w-full"
                >
                  Clear
                </Button>
              </div>
            </div>
          </Card>

          {/* Summary Cards */}
          {analytics?.summary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">Overall On-Time %</p>
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
                <p className="text-3xl font-bold text-foreground">
                  {analytics.summary.on_time_percentage}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {analytics.summary.on_time_loads} of {analytics.summary.total_loads} loads
                </p>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">Late Deliveries</p>
                  <XCircle className="w-5 h-5 text-red-500" />
                </div>
                <p className="text-3xl font-bold text-foreground">
                  {analytics.summary.late_loads}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {analytics.summary.total_loads > 0
                    ? Math.round((analytics.summary.late_loads / analytics.summary.total_loads) * 100)
                    : 0}% of total
                </p>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">Early Deliveries</p>
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-3xl font-bold text-foreground">
                  {analytics.summary.early_loads}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {analytics.summary.total_loads > 0
                    ? Math.round((analytics.summary.early_loads / analytics.summary.total_loads) * 100)
                    : 0}% of total
                </p>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">Total Loads</p>
                  <Users className="w-5 h-5 text-purple-500" />
                </div>
                <p className="text-3xl font-bold text-foreground">
                  {analytics.summary.total_loads}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  In this period
                </p>
              </Card>
            </div>
          )}

          {/* Customer Performance Table */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-foreground">Customer Performance</h2>
              <Badge variant="outline">
                {analytics?.customers?.length || 0} customers
              </Badge>
            </div>

            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading on-time delivery data...</p>
              </div>
            ) : !analytics?.customers || analytics.customers.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground">
                  No delivery data found for the selected period.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  On-time delivery tracking requires loads with estimated and actual delivery dates.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Total Loads</TableHead>
                      <TableHead className="text-right">On-Time</TableHead>
                      <TableHead className="text-right">Late</TableHead>
                      <TableHead className="text-right">Early</TableHead>
                      <TableHead className="text-right">On-Time %</TableHead>
                      <TableHead className="text-right">Avg Days Late</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics.customers.map((customer: any, index: number) => (
                      <TableRow key={customer.customer_id}>
                        <TableCell className="font-medium">
                          {customer.customer_name}
                        </TableCell>
                        <TableCell className="text-right">
                          {customer.total_loads}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            {customer.on_time_loads}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <XCircle className="w-4 h-4 text-red-500" />
                            {customer.late_loads}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <TrendingUp className="w-4 h-4 text-blue-500" />
                            {customer.early_loads}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {getOnTimeBadge(customer.on_time_percentage)}
                        </TableCell>
                        <TableCell className="text-right">
                          {customer.average_days_late > 0 ? (
                            <span className="text-red-500">
                              +{customer.average_days_late} days
                            </span>
                          ) : customer.average_days_early > 0 ? (
                            <span className="text-blue-500">
                              -{customer.average_days_early} days
                            </span>
                          ) : (
                            <span className="text-muted-foreground">On time</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>

          {/* Insights */}
          {analytics?.customers && analytics.customers.length > 0 && (
            <Card className="p-6 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-500" />
                Performance Insights
              </h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                {analytics.summary.on_time_percentage >= 95 ? (
                  <p>
                    • Excellent overall performance! Your fleet is maintaining{" "}
                    <span className="font-semibold text-foreground">
                      {analytics.summary.on_time_percentage}%
                    </span>{" "}
                    on-time delivery rate.
                  </p>
                ) : analytics.summary.on_time_percentage >= 85 ? (
                  <p>
                    • Good performance with{" "}
                    <span className="font-semibold text-foreground">
                      {analytics.summary.on_time_percentage}%
                    </span>{" "}
                    on-time rate. Focus on the customers with lower scores to improve.
                  </p>
                ) : (
                  <p>
                    • Current on-time rate is{" "}
                    <span className="font-semibold text-foreground">
                      {analytics.summary.on_time_percentage}%
                    </span>
                    . Review routing and scheduling to improve delivery performance.
                  </p>
                )}
                {analytics.customers.length > 0 && (
                  <p>
                    • Top performer:{" "}
                    <span className="font-semibold text-foreground">
                      {analytics.customers[0].customer_name}
                    </span>{" "}
                    with {analytics.customers[0].on_time_percentage}% on-time delivery.
                  </p>
                )}
                {analytics.summary.late_loads > 0 && (
                  <p>
                    • {analytics.summary.late_loads} late delivery
                    {analytics.summary.late_loads !== 1 ? "ies" : ""} detected. Consider buffer
                    time in scheduling.
                  </p>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

