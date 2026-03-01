"use client"

import { Card } from "@/components/ui/card"
import { ArrowLeft, BarChart3, TrendingUp, Truck, DollarSign, Package, Users, Calendar, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { getMonthlyRevenueTrend } from "@/app/actions/reports"
import { getAnalyticsData } from "@/app/actions/analytics"

export default function AnalyticsPage() {
  const [stats, setStats] = useState({
    totalLoads: 0,
    activeLoads: 0,
    completedLoads: 0,
    totalRevenue: 0,
    activeTrucks: 0,
    activeDrivers: 0,
    onTimeDeliveries: 0,
    averageRevenuePerLoad: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [dateRange, setDateRange] = useState("30") // days
  const [trendData, setTrendData] = useState<Array<{ month: string; amount: number }>>([])

  useEffect(() => {
    loadAnalytics()
  }, [dateRange])

  async function loadAnalytics() {
    setIsLoading(true)
    try {
      // FIXED: Use server action instead of browser-side select(*) queries
      const analyticsResult = await getAnalyticsData(parseInt(dateRange))
      
      if (analyticsResult.error) {
        toast.error(analyticsResult.error)
        setIsLoading(false)
        return
      }

      if (analyticsResult.data) {
        setStats(analyticsResult.data)
      }

      // Load revenue trend data
      const trendResult = await getMonthlyRevenueTrend(6)
      if (trendResult.error) {
        console.error("Error loading trend data:", trendResult.error)
        setTrendData([])
      } else {
        setTrendData(trendResult.data || [])
      }
    } catch (error) {
      toast.error("Failed to load analytics")
    } finally {
      setIsLoading(false)
    }
  }

  const formatMonth = (monthKey: string) => {
    if (!monthKey || typeof monthKey !== 'string') return monthKey
    const parts = monthKey.split("-")
    if (parts.length !== 2) return monthKey
    const year = parseInt(parts[0])
    const month = parseInt(parts[1])
    if (isNaN(year) || isNaN(month)) return monthKey
    const date = new Date(year, month - 1)
    if (isNaN(date.getTime())) return monthKey
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" })
  }

  const statCards = [
    {
      title: "Total Loads",
      value: stats.totalLoads,
      icon: Package,
      color: "text-blue-400",
      bgColor: "bg-blue-500/20",
    },
    {
      title: "Active Loads",
      value: stats.activeLoads,
      icon: TrendingUp,
      color: "text-green-400",
      bgColor: "bg-green-500/20",
    },
    {
      title: "Completed Loads",
      value: stats.completedLoads,
      icon: CheckCircle2,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/20",
    },
    {
      title: "Total Revenue",
      value: `$${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/20",
    },
    {
      title: "Active Trucks",
      value: stats.activeTrucks,
      icon: Truck,
      color: "text-purple-400",
      bgColor: "bg-purple-500/20",
    },
    {
      title: "Active Drivers",
      value: stats.activeDrivers,
      icon: Users,
      color: "text-cyan-400",
      bgColor: "bg-cyan-500/20",
    },
  ]

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Analytics Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">Fleet performance and business insights</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 bg-background border border-border rounded-md text-foreground text-sm"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {statCards.map((stat, index) => {
              const Icon = stat.icon
              return (
                <Card key={index} className="border-border p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                      <Icon className={`w-6 h-6 ${stat.color}`} />
                    </div>
                  </div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">{stat.title}</h3>
                  {isLoading ? (
                    <div className="h-8 w-24 bg-secondary/50 animate-pulse rounded" />
                  ) : (
                    <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                  )}
                </Card>
              )
            })}
          </div>

          {/* Performance Metrics */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-border p-6">
              <div className="flex items-center gap-2 mb-6">
                <BarChart3 className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Performance Metrics</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">On-Time Delivery Rate</span>
                    <span className="text-sm font-medium text-foreground">
                      {stats.completedLoads > 0
                        ? `${Math.round((stats.onTimeDeliveries / stats.completedLoads) * 100)}%`
                        : "0%"}
                    </span>
                  </div>
                  <div className="w-full bg-secondary/50 rounded-full h-2">
                    <div
                      className="bg-green-400 h-2 rounded-full transition-all"
                      style={{
                        width: `${stats.completedLoads > 0 ? (stats.onTimeDeliveries / stats.completedLoads) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">Average Revenue per Load</span>
                    <span className="text-sm font-medium text-foreground">
                      ${(stats.averageRevenuePerLoad || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">Completion Rate</span>
                    <span className="text-sm font-medium text-foreground">
                      {stats.totalLoads > 0
                        ? `${Math.round((stats.completedLoads / stats.totalLoads) * 100)}%`
                        : "0%"}
                    </span>
                  </div>
                  <div className="w-full bg-secondary/50 rounded-full h-2">
                    <div
                      className="bg-blue-400 h-2 rounded-full transition-all"
                      style={{
                        width: `${stats.totalLoads > 0 ? (stats.completedLoads / stats.totalLoads) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </Card>

            <Card className="border-border p-6">
              <div className="flex items-center gap-2 mb-6">
                <Calendar className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Fleet Utilization</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Active Fleet</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-secondary/30 rounded-lg">
                      <p className="text-2xl font-bold text-foreground">{stats.activeTrucks}</p>
                      <p className="text-xs text-muted-foreground mt-1">Trucks in Use</p>
                    </div>
                    <div className="p-4 bg-secondary/30 rounded-lg">
                      <p className="text-2xl font-bold text-foreground">{stats.activeDrivers}</p>
                      <p className="text-xs text-muted-foreground mt-1">Active Drivers</p>
                    </div>
                  </div>
                </div>
                <div className="pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground mb-2">Load Status Distribution</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Active</span>
                      <span className="font-medium text-foreground">{stats.activeLoads}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Completed</span>
                      <span className="font-medium text-foreground">{stats.completedLoads}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Pending</span>
                      <span className="font-medium text-foreground">{stats.totalLoads - stats.activeLoads - stats.completedLoads}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Revenue Trends Chart */}
          <Card className="border-border p-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Revenue Trends (Last 6 Months)</h2>
            </div>
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
                      <p className="text-xs text-muted-foreground text-center">{formatMonth(item.month)}</p>
                      <p className="text-xs font-semibold text-foreground">
                        {/* FIXED: Use amountInThousands if available, otherwise calculate from amount */}
                        ${(item.amountInThousands !== undefined ? item.amountInThousands : (item.amount || 0) / 1000).toFixed(1)}k
                      </p>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center bg-secondary/20 rounded-lg border border-border">
                <div className="text-center">
                  <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No revenue data available</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Revenue trend will appear once you have invoices or loads with revenue
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

