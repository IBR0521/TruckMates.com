"use client"

import { Card } from "@/components/ui/card"
import { DollarSign, Truck, Users, Activity, TrendingUp, AlertCircle } from "lucide-react"
import { useState, useEffect } from "react"
import { getDashboardStats } from "@/app/actions/dashboard"
import { getCurrentUser } from "@/app/actions/user"
import { createClient } from "@/lib/supabase/client"

export function SuperAdminDashboard() {
  const [stats, setStats] = useState<any>(null)
  const [userActivity, setUserActivity] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setIsLoading(true)
    try {
      const [dashboardResult, userResult] = await Promise.all([
        getDashboardStats(),
        getCurrentUser(),
      ])

      if (dashboardResult.data) {
        setStats(dashboardResult.data)
      }

      // Load user activity (who is logged in and what they're changing)
      if (userResult.data?.company_id) {
        const supabase = createClient()
        const { data: activity } = await supabase
          .from("audit_logs")
          .select("action, resource_type, user_id, created_at, users:user_id(full_name, email)")
          .eq("company_id", userResult.data.company_id)
          .order("created_at", { ascending: false })
          .limit(10)

        setUserActivity(activity || [])
      }
    } catch (error) {
      console.error("Error loading super admin dashboard:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Global Overview</h1>
        <p className="text-muted-foreground">Complete visibility across all operations</p>
      </div>

      {/* Financial Overview */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-border bg-card/50 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-muted-foreground text-sm font-medium mb-2">Total Revenue</p>
              <p className="text-2xl font-bold text-green-400">
                ${Number(stats?.totalRevenue || 0).toLocaleString()}
              </p>
            </div>
            <DollarSign className="w-5 h-5 text-green-400 opacity-70" />
          </div>
          <p className="text-xs text-muted-foreground mt-2">All paid invoices</p>
        </Card>

        <Card className="border-border bg-card/50 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-muted-foreground text-sm font-medium mb-2">Net Profit</p>
              <p className="text-2xl font-bold text-green-400">
                ${Number(stats?.netProfit || 0).toLocaleString()}
              </p>
            </div>
            <TrendingUp className="w-5 h-5 text-green-400 opacity-70" />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {stats?.profitMargin ? `${stats.profitMargin.toFixed(1)}% margin` : "Calculated by AI"}
          </p>
        </Card>
      </div>

      {/* Fleet Health */}
      <Card className="border-border bg-card/50 p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">Fleet Health</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 bg-secondary/30 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Active Trucks</span>
              <Truck className="w-4 h-4 text-primary" />
            </div>
            <p className="text-2xl font-bold text-foreground">{stats?.activeTrucks || 0}</p>
            <p className="text-xs text-muted-foreground mt-1">
              of {stats?.totalTrucks || 0} total
            </p>
          </div>
          <div className="p-4 bg-secondary/30 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">In Maintenance</span>
              <AlertCircle className="w-4 h-4 text-yellow-400" />
            </div>
            <p className="text-2xl font-bold text-foreground">
              {(stats?.totalTrucks || 0) - (stats?.activeTrucks || 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Requiring attention</p>
          </div>
        </div>
      </Card>

      {/* User Activity */}
      <Card className="border-border bg-card/50 p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">Live User Activity</h2>
        <div className="space-y-3">
          {userActivity.length > 0 ? (
            userActivity.map((activity: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {activity.users?.full_name || activity.users?.email || "Unknown User"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {activity.action} {activity.resource_type}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(activity.created_at).toLocaleTimeString()}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
          )}
        </div>
      </Card>
    </div>
  )
}

