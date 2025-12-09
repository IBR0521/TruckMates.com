"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Truck, Plus, TrendingUp, Users, AlertCircle, Package } from "lucide-react"
import StatsOverview from "@/components/dashboard/stats-overview"
import Link from "next/link"
import { useEffect, useState } from "react"
import { getDashboardStats } from "@/app/actions/dashboard"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalRoutes: 0,
    activeRoutes: 0,
    totalDrivers: 0,
    activeDrivers: 0,
    fleetUtilization: 0,
    totalLoads: 0,
  })
  const [recentActivity, setRecentActivity] = useState<Array<{ action: string; time: string; type: string }>>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      const result = await getDashboardStats()
      if (result.data) {
        setStats(result.data)
        setRecentActivity(result.data.recentActivity || [])
      }
      setIsLoading(false)
    }
    loadStats()
    
    // Refresh every 30 seconds for real-time updates
    const interval = setInterval(() => {
      loadStats()
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="w-full">
      {/* Page Header */}
      <div className="border-b border-border bg-card/30 backdrop-blur px-8 py-6">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Welcome back, manage your fleet efficiently</p>
      </div>

      {/* Content Area */}
      <div className="p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Stats Overview */}
          <StatsOverview />

          {/* Quick Actions */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border border-border/50 p-6 hover:border-border/80 hover:bg-card/60 transition-all shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">Add New Driver</h3>
                <Plus className="w-5 h-5 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Register a new truck driver to your fleet management system
              </p>
              <Link href="/dashboard/drivers/add">
                <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition">
                  Add Driver
                </Button>
              </Link>
            </Card>

            <Card className="border border-border/50 p-6 hover:border-border/80 hover:bg-card/60 transition-all shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">View Fleet Status</h3>
                <Truck className="w-5 h-5 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Monitor all trucks and their real-time status information
              </p>
              <Link href="/dashboard/trucks">
                <Button className="w-full bg-secondary hover:bg-secondary/90 text-foreground shadow-md hover:shadow-lg transition">
                  View Fleet
                </Button>
              </Link>
            </Card>
          </div>

          {/* Key Metrics Section */}
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="border border-border/50 p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium mb-2">Active Routes</p>
                  <p className="text-3xl font-bold text-foreground">{isLoading ? "..." : stats.activeRoutes}</p>
                </div>
                <TrendingUp className="w-5 h-5 text-primary opacity-70" />
              </div>
              <p className="text-xs text-muted-foreground mt-4">{stats.totalRoutes} total routes</p>
            </Card>

            <Card className="border border-border/50 p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium mb-2">Total Drivers</p>
                  <p className="text-3xl font-bold text-foreground">{isLoading ? "..." : stats.totalDrivers}</p>
                </div>
                <Users className="w-5 h-5 text-primary opacity-70" />
              </div>
              <p className="text-xs text-muted-foreground mt-4">{stats.activeDrivers} active drivers</p>
            </Card>

            <Card className="border border-border/50 p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium mb-2">Fleet Utilization</p>
                  <p className="text-3xl font-bold text-foreground">{isLoading ? "..." : `${stats.fleetUtilization}%`}</p>
                </div>
                <Truck className="w-5 h-5 text-primary opacity-70" />
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                {stats.fleetUtilization >= 80 ? "Optimal performance" : stats.fleetUtilization >= 50 ? "Good performance" : "Room for improvement"}
              </p>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card className="border border-border/50 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-foreground mb-4">Recent Activity</h3>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse flex items-center gap-3">
                    <div className="h-2 bg-muted rounded w-2"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-muted rounded w-1/4"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground">No recent activity</p>
                <p className="text-sm text-muted-foreground mt-1">Activity will appear here as you use the system</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((activity, index) => {
                  const timeAgo = (() => {
                    const now = new Date()
                    const activityTime = new Date(activity.time)
                    const diffMs = now.getTime() - activityTime.getTime()
                    const diffMins = Math.floor(diffMs / 60000)
                    const diffHours = Math.floor(diffMs / 3600000)
                    const diffDays = Math.floor(diffMs / 86400000)

                    if (diffMins < 1) return "Just now"
                    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`
                    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`
                    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`
                  })()

                  const typeColors = {
                    success: "bg-green-500/20 text-green-400",
                    error: "bg-red-500/20 text-red-400",
                    warning: "bg-yellow-500/20 text-yellow-400",
                    info: "bg-blue-500/20 text-blue-400",
                    default: "bg-gray-500/20 text-gray-400",
                  }

                  return (
                    <div key={index} className="flex items-start gap-3 pb-3 border-b border-border/30 last:border-0">
                      <div className={`w-2 h-2 rounded-full mt-2 ${typeColors[activity.type as keyof typeof typeColors] || typeColors.default}`}></div>
                      <div className="flex-1">
                        <p className="text-sm text-foreground">{activity.action}</p>
                        <p className="text-xs text-muted-foreground mt-1">{timeAgo}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
