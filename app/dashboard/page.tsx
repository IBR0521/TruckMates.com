"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { 
  Truck, 
  Plus, 
  TrendingUp, 
  Users, 
  AlertCircle, 
  Package,
  MapPin,
  ArrowRight,
  Route,
  FileText,
  DollarSign,
  Building2,
  Wrench,
  ChevronDown,
} from "lucide-react"
import Link from "next/link"
import { useMemo, useEffect, useState } from "react"
import { getDashboardStats } from "@/app/actions/dashboard"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { ProfitEstimator } from "@/components/dashboard/profit-estimator"
import { RevenueChart } from "@/components/dashboard/revenue-chart"
import { LoadStatusChart } from "@/components/dashboard/load-status-chart"
import { AlertsSection } from "@/components/dashboard/alerts-section"
import { PerformanceMetrics } from "@/components/dashboard/performance-metrics"

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let isMounted = true
    let timeoutId: NodeJS.Timeout | null = null
    
    async function loadStats() {
      try {
        // Only set loading state if we don't have data yet (first load)
        // This prevents data from disappearing during reloads
        if (isMounted && !dashboardData) {
          setIsLoading(true)
        }
        if (isMounted) {
          setError(null)
        }
        
        // Increased timeout to 8 seconds for better reliability
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error("Dashboard timeout"))
          }, 8000) // 8 seconds - more reasonable
        })
        
        // Race between the actual request and timeout
        const result = await Promise.race([
          getDashboardStats(),
          timeoutPromise
        ]) as any
        
        // Clear timeout if request completed
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
        
        // Only update state if component is still mounted
        if (!isMounted) return
        
        // Check for connection errors in result
        if (result?.error) {
          const errorMsg = result.error
          // Only show connection-related errors
          if (errorMsg.includes('Connection') || 
              errorMsg.includes('timeout') || 
              errorMsg.includes('ECONNREFUSED') ||
              errorMsg.includes('Database configuration') ||
              errorMsg.includes('Connection failed')) {
            setError(new Error(errorMsg))
          }
        }
        
        // Always use data if available, even if there's an error
        // Only update if we got new data - preserve existing data on timeout/error
        if (result?.data) {
          setDashboardData(result.data)
        }
        // Don't clear data if result is empty - keep showing existing data
      } catch (err: any) {
        if (!isMounted) return
        
        // Clear timeout if it was set
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
        
        // Don't clear existing data on error - keep showing what we have
        // Only set minimal data if we don't have any data yet
        if (!dashboardData) {
          setDashboardData({
            totalDrivers: 0,
            activeDrivers: 0,
            totalTrucks: 0,
            activeTrucks: 0,
            totalRoutes: 0,
            activeRoutes: 0,
            totalLoads: 0,
            inTransitLoads: 0,
            totalMaintenance: 0,
            scheduledMaintenance: 0,
            fleetUtilization: 0,
            recentActivity: [],
            recentDrivers: [],
            recentTrucks: [],
            recentRoutes: [],
            recentLoads: [],
            totalRevenue: 0,
            totalExpenses: 0,
            netProfit: 0,
            profitMargin: 0,
            outstandingInvoices: 0,
            revenueTrend: [],
            loadStatusDistribution: [],
            upcomingMaintenance: [],
            overdueInvoices: [],
            upcomingDeliveries: [],
          })
        }
        setError(null) // Don't set error to prevent UI blocking
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
      }
    }
    
    // Load stats immediately
    loadStats()
    
    // Refresh every 60 seconds for real-time updates (cached, so fast)
    const interval = setInterval(loadStats, 60000)
    
    return () => {
      isMounted = false
      clearInterval(interval)
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, []) // Load once on mount

  // Memoize stats to prevent unnecessary recalculations
  const stats = useMemo(() => {
    if (!dashboardData) {
      return {
        totalRoutes: 0,
        activeRoutes: 0,
        totalDrivers: 0,
        activeDrivers: 0,
        activeTrucks: 0,
        totalTrucks: 0,
        scheduledMaintenance: 0,
        fleetUtilization: 0,
        totalLoads: 0,
        inTransitLoads: 0,
      }
    }
    return {
      totalRoutes: dashboardData.totalRoutes,
      activeRoutes: dashboardData.activeRoutes,
      totalDrivers: dashboardData.totalDrivers,
      activeDrivers: dashboardData.activeDrivers,
      activeTrucks: dashboardData.activeTrucks,
      totalTrucks: dashboardData.totalTrucks,
      scheduledMaintenance: dashboardData.scheduledMaintenance,
      fleetUtilization: dashboardData.fleetUtilization,
      totalLoads: dashboardData.totalLoads,
      inTransitLoads: dashboardData.inTransitLoads,
    }
  }, [dashboardData])

  // Memoize recent activity
  const recentActivity = useMemo(() => {
    return dashboardData?.recentActivity || []
  }, [dashboardData?.recentActivity])

  // Handle errors with toast (only show once)
  useEffect(() => {
    if (error && error instanceof Error) {
      const errorMessage = error.message || "Failed to load dashboard data"
      // Show connection errors more prominently
      if (errorMessage.includes('Connection') || errorMessage.includes('timeout') || errorMessage.includes('ECONNREFUSED')) {
        toast.error(errorMessage, {
          duration: 5000,
          description: "Please check your internet connection and try refreshing the page."
        })
      } else {
        toast.error(errorMessage)
      }
    }
  }, [error])

  // Show loading skeleton immediately if no data yet
  if (isLoading && !dashboardData) {
    return (
      <div className="w-full p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="h-8 bg-secondary animate-pulse rounded w-64"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="p-6">
                <div className="h-4 bg-secondary animate-pulse rounded w-24 mb-2"></div>
                <div className="h-8 bg-secondary animate-pulse rounded w-16"></div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Page Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dashboard</h1>
              <p className="text-muted-foreground text-sm mt-1">Welcome back, manage your fleet efficiently</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="w-full sm:w-auto">
              <ProfitEstimator />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" />
                  Add New
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/drivers/add" className="flex items-center cursor-pointer">
                    <Users className="w-4 h-4 mr-2" />
                    Add Driver
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/trucks/add" className="flex items-center cursor-pointer">
                    <Truck className="w-4 h-4 mr-2" />
                    Add Vehicle
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/routes/add" className="flex items-center cursor-pointer">
                    <Route className="w-4 h-4 mr-2" />
                    Add Route
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/loads/add" className="flex items-center cursor-pointer">
                    <Package className="w-4 h-4 mr-2" />
                    Add Load
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/customers/add" className="flex items-center cursor-pointer">
                    <Building2 className="w-4 h-4 mr-2" />
                    Add Customer
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/vendors/add" className="flex items-center cursor-pointer">
                    <Building2 className="w-4 h-4 mr-2" />
                    Add Vendor
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/accounting/invoices/create" className="flex items-center cursor-pointer">
                    <FileText className="w-4 h-4 mr-2" />
                    Create Invoice
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/accounting/expenses/add" className="flex items-center cursor-pointer">
                    <DollarSign className="w-4 h-4 mr-2" />
                    Add Expense
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/maintenance/add" className="flex items-center cursor-pointer">
                    <Wrench className="w-4 h-4 mr-2" />
                    Schedule Maintenance
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Financial Overview Section */}
          <div className="grid md:grid-cols-4 gap-4">
            <Card className="border-border bg-card/50 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium mb-2">Total Revenue</p>
                  <p className="text-2xl font-bold text-green-400">
                    {isLoading ? "..." : `$${Number(dashboardData?.totalRevenue || 0).toLocaleString()}`}
                  </p>
                </div>
                <DollarSign className="w-5 h-5 text-green-400 opacity-70" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">All paid invoices</p>
            </Card>

            <Card className="border-border bg-card/50 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium mb-2">Total Expenses</p>
                  <p className="text-2xl font-bold text-red-400">
                    {isLoading ? "..." : `$${Number(dashboardData?.totalExpenses || 0).toLocaleString()}`}
                  </p>
                </div>
                <DollarSign className="w-5 h-5 text-red-400 opacity-70" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">All expenses</p>
            </Card>

            <Card className="border-border bg-card/50 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium mb-2">Net Profit</p>
                  <p className={`text-2xl font-bold ${(dashboardData?.netProfit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {isLoading ? "..." : `$${Number(dashboardData?.netProfit || 0).toLocaleString()}`}
                  </p>
                </div>
                <TrendingUp className={`w-5 h-5 opacity-70 ${(dashboardData?.netProfit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`} />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {dashboardData?.profitMargin ? `${Number(dashboardData.profitMargin).toFixed(1)}% margin` : "0% margin"}
              </p>
            </Card>

            <Card className="border-border bg-card/50 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium mb-2">Outstanding</p>
                  <p className="text-2xl font-bold text-yellow-400">
                    {isLoading ? "..." : `$${Number(dashboardData?.outstandingInvoices || 0).toLocaleString()}`}
                  </p>
                </div>
                <FileText className="w-5 h-5 text-yellow-400 opacity-70" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">Pending invoices</p>
            </Card>
          </div>

          {/* Charts Section */}
          <div className="grid md:grid-cols-2 gap-6">
            {dashboardData?.revenueTrend && (
              <RevenueChart data={dashboardData.revenueTrend} />
            )}
            {dashboardData?.loadStatusDistribution && (
              <LoadStatusChart data={dashboardData.loadStatusDistribution} />
            )}
          </div>

          {/* Alerts Section */}
          {dashboardData && (
            <AlertsSection
              upcomingMaintenance={dashboardData.upcomingMaintenance || []}
              overdueInvoices={dashboardData.overdueInvoices || []}
              upcomingDeliveries={dashboardData.upcomingDeliveries || []}
            />
          )}

          {/* Detailed Stats Cards with Partial Info */}
          {/* First Row: Trucks and Drivers */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Active Trucks Card */}
            <Card className="border-border bg-card/50 p-6 hover:shadow-lg transition-shadow flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Truck className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active Trucks</p>
                    <p className="text-2xl font-bold text-foreground">
                      {isLoading ? "..." : stats.activeTrucks}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{stats.totalTrucks} total</p>
                  </div>
                </div>
              </div>
              {!isLoading && dashboardData?.recentTrucks && dashboardData.recentTrucks.length > 0 && (
                <div className="mb-3 overflow-hidden flex-1 min-h-0 max-h-32">
                  <div className="overflow-y-auto max-h-full space-y-1.5">
                    {dashboardData.recentTrucks.slice(0, 3).map((truck: any) => (
                      <div key={truck.id} className="text-sm text-foreground pb-1.5 border-b border-border/30 last:border-0 last:pb-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium truncate">{truck.truck_number}</span>
                          <span className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${
                            truck.status === "in_use" ? "bg-blue-500/20 text-blue-400" : "bg-green-500/20 text-green-400"
                          }`}>
                            {truck.status === "in_use" ? "In Use" : "Available"}
                          </span>
                        </div>
                        {truck.make && truck.model && (
                          <div className="text-xs text-muted-foreground truncate mt-0.5">
                            {truck.make} {truck.model}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!isLoading && (!dashboardData?.recentTrucks || dashboardData.recentTrucks.length === 0) && (
                <div className="mb-3 overflow-hidden flex-1 min-h-0 max-h-32">
                  <div className="text-sm text-muted-foreground italic">No active trucks</div>
                </div>
              )}
              <Link href="/dashboard/trucks" className="mt-auto">
                <Button variant="outline" size="sm" className="w-full">
                  View All Trucks
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </Card>

            {/* Active Drivers Card */}
            <Card className="border-border bg-card/50 p-6 hover:shadow-lg transition-shadow flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Users className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active Drivers</p>
                    <p className="text-2xl font-bold text-foreground">
                      {isLoading ? "..." : stats.activeDrivers}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{stats.totalDrivers} total</p>
                  </div>
                </div>
              </div>
              {!isLoading && dashboardData?.recentDrivers && dashboardData.recentDrivers.length > 0 && (
                <div className="mb-3 overflow-hidden flex-1 min-h-0 max-h-32">
                  <div className="overflow-y-auto max-h-full space-y-1.5">
                    {dashboardData.recentDrivers.slice(0, 3).map((driver: any) => (
                      <div key={driver.id} className="text-sm text-foreground pb-1.5 border-b border-border/30 last:border-0 last:pb-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium truncate">{driver.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400 flex-shrink-0">
                            {driver.status === "on_route" ? "On Route" : "Active"}
                          </span>
                        </div>
                        {driver.phone && (
                          <div className="text-xs text-muted-foreground truncate mt-0.5">
                            {driver.phone}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!isLoading && (!dashboardData?.recentDrivers || dashboardData.recentDrivers.length === 0) && (
                <div className="mb-3 overflow-hidden flex-1 min-h-0 max-h-32">
                  <div className="text-sm text-muted-foreground italic">No active drivers</div>
                </div>
              )}
              <Link href="/dashboard/drivers" className="mt-auto">
                <Button variant="outline" size="sm" className="w-full">
                  View All Drivers
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </Card>
          </div>

          {/* Second Row: Routes and Loads */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Active Routes Card */}
            <Card className="border-border bg-card/50 p-6 hover:shadow-lg transition-shadow flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <Route className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active Routes</p>
                    <p className="text-2xl font-bold text-foreground">
                      {isLoading ? "..." : stats.activeRoutes}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{stats.totalRoutes} total</p>
                  </div>
                </div>
              </div>
              {!isLoading && dashboardData?.recentRoutes && dashboardData.recentRoutes.length > 0 && (
                <div className="mb-3 overflow-hidden flex-1 min-h-0 max-h-32">
                  <div className="overflow-y-auto max-h-full space-y-1.5">
                    {dashboardData.recentRoutes.slice(0, 3).map((route: any) => (
                      <div key={route.id} className="text-sm text-foreground pb-1.5 border-b border-border/30 last:border-0 last:pb-0">
                        <div className="font-medium truncate">{route.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">
                          {route.origin} → {route.destination}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!isLoading && (!dashboardData?.recentRoutes || dashboardData.recentRoutes.length === 0) && (
                <div className="mb-3 overflow-hidden flex-1 min-h-0 max-h-32">
                  <div className="text-sm text-muted-foreground italic">No active routes</div>
                </div>
              )}
              <Link href="/dashboard/routes" className="mt-auto">
                <Button variant="outline" size="sm" className="w-full">
                  View All Routes
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </Card>

            {/* Recent Loads Card */}
            <Card className="border-border bg-card/50 p-6 hover:shadow-lg transition-shadow flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Package className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Recent Loads</p>
                    <p className="text-2xl font-bold text-foreground">
                      {isLoading ? "..." : stats.inTransitLoads}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">In transit</p>
                  </div>
                </div>
              </div>
              {!isLoading && dashboardData?.recentLoads && dashboardData.recentLoads.length > 0 && (
                <div className="mb-3 overflow-hidden flex-1 min-h-0 max-h-32">
                  <div className="overflow-y-auto max-h-full space-y-1.5">
                    {dashboardData.recentLoads.slice(0, 3).map((load: any) => (
                      <div key={load.id} className="text-sm text-foreground pb-1.5 border-b border-border/30 last:border-0 last:pb-0">
                        <div className="font-medium truncate">{load.shipment_number}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">
                          {load.origin} → {load.destination}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!isLoading && (!dashboardData?.recentLoads || dashboardData.recentLoads.length === 0) && (
                <div className="mb-3 overflow-hidden flex-1 min-h-0 max-h-32">
                  <div className="text-sm text-muted-foreground italic">No recent loads</div>
                </div>
              )}
              <Link href="/dashboard/loads" className="mt-auto">
                <Button variant="outline" size="sm" className="w-full">
                  View All Loads
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </Card>
          </div>

          {/* Performance Metrics */}
          <PerformanceMetrics
            fleetUtilization={stats.fleetUtilization}
            totalLoads={stats.totalLoads}
            onTimeDeliveryRate={dashboardData?.totalLoads > 0 && dashboardData?.inTransitLoads > 0 ? Math.round((dashboardData.inTransitLoads / dashboardData.totalLoads) * 100) : 0}
            averageLoadValue={dashboardData?.totalRevenue && dashboardData?.totalLoads ? (dashboardData.totalRevenue / dashboardData.totalLoads) : 0}
          />

          {/* Recent Activity */}
          <Card className="border-border bg-card/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Recent Activity</h3>
              <Link href="/dashboard/alerts">
                <Button variant="ghost" size="sm" className="text-xs">
                  View All
                </Button>
              </Link>
            </div>
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
                {recentActivity.map((activity: any, index: number) => {
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
