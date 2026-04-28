"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { 
  Truck,
  Plus, 
  Users,
  FileText,
  AlertCircle, 
  Package,
  ArrowRight,
  Route,
  DollarSign,
  Building2,
  Wrench,
  ChevronDown,
  Activity,
  ShieldAlert,
  CalendarClock,
} from "lucide-react"
import Link from "next/link"
import { useMemo, useState, useEffect, Suspense } from "react"
import { toast } from "sonner"
import { useDashboardPageData } from "@/lib/hooks/use-dashboard-page"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import dynamic from "next/dynamic"
import { checkEmailServiceConfigured } from "@/app/actions/settings-integration"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { LucideIcon } from "lucide-react"
import type { DashboardBootstrapResult } from "@/lib/hooks/use-dashboard-page"

type MetricCardProps = {
  title: string
  icon: LucideIcon
  tone: "good" | "warning" | "danger" | "neutral"
  primary: string
  secondary?: Array<{ label: string; value: string | number; tone?: "good" | "warning" | "danger" | "neutral" }>
}

const TONE_STYLES = {
  good: "text-emerald-400 border-emerald-500/35 bg-emerald-500/8",
  warning: "text-amber-400 border-amber-500/35 bg-amber-500/8",
  danger: "text-rose-400 border-rose-500/35 bg-rose-500/8",
  neutral: "text-foreground border-border/60 bg-background/50",
}

function MetricCard({ title, icon: Icon, tone, primary, secondary = [] }: MetricCardProps) {
  return (
    <Card className="min-w-0 border-border/60 bg-card/70 p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/90">{title}</p>
          <p className={`mt-2 text-2xl font-bold leading-none ${TONE_STYLES[tone].split(" ")[0]}`}>{primary}</p>
        </div>
        <div className={`rounded-lg border p-2 ${TONE_STYLES[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      {secondary.length > 0 && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border/40 pt-3 md:grid-cols-3">
          {secondary.map((item) => (
            <div key={item.label} className="min-w-0">
              <p className="text-[11px] text-muted-foreground">{item.label}</p>
              <p
                className={`text-sm font-semibold ${
                  item.tone === "danger"
                    ? "text-rose-400"
                    : item.tone === "warning"
                      ? "text-amber-400"
                      : item.tone === "good"
                        ? "text-emerald-400"
                        : "text-foreground"
                }`}
              >
                {item.value}
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// Heavy widgets are now on-demand only.
const ProfitEstimator = dynamic(() => import("@/components/dashboard/profit-estimator").then(mod => ({ default: mod.ProfitEstimator })), {
  loading: () => <div className="h-64 animate-pulse bg-muted rounded-lg" aria-label="Loading profit estimator" />,
  ssr: false
})

const RevenueChart = dynamic(() => import("@/components/dashboard/revenue-chart").then(mod => ({ default: mod.RevenueChart })), {
  loading: () => <div className="h-64 animate-pulse bg-muted rounded-lg" aria-label="Loading revenue chart" />,
  ssr: false
})

const LoadStatusChart = dynamic(() => import("@/components/dashboard/load-status-chart").then(mod => ({ default: mod.LoadStatusChart })), {
  loading: () => <div className="h-64 animate-pulse bg-muted rounded-lg" aria-label="Loading load status chart" />,
  ssr: false
})

const AlertsSection = dynamic(() => import("@/components/dashboard/alerts-section").then(mod => ({ default: mod.AlertsSection })), {
  loading: () => <div className="h-48 animate-pulse bg-muted rounded-lg" aria-label="Loading alerts" />,
  ssr: false
})

const RemindersWidget = dynamic(
  () => import("@/components/dashboard/reminders-widget").then((mod) => ({ default: mod.RemindersWidget })),
  {
    loading: () => <div className="h-48 animate-pulse bg-muted rounded-lg" aria-label="Loading reminders" />,
    ssr: false,
  }
)

const PerformanceMetrics = dynamic(() => import("@/components/dashboard/performance-metrics").then(mod => ({ default: mod.PerformanceMetrics })), {
  loading: () => <div className="h-48 animate-pulse bg-muted rounded-lg" aria-label="Loading performance metrics" />,
  ssr: false
})

function TimeAgo({ timestamp }: { timestamp: string | null | undefined }) {
  const [timeAgo, setTimeAgo] = useState<string>("")
  
  useEffect(() => {
    if (!timestamp) {
      setTimeAgo("Unknown time")
      return
    }
    
    try {
      const now = new Date()
      const activityTime = new Date(timestamp)
      
      // Check if date is valid
      if (isNaN(activityTime.getTime())) {
        setTimeAgo("Invalid date")
        return
      }
      
      const diffMs = now.getTime() - activityTime.getTime()
      
      if (diffMs < 0) {
        setTimeAgo("Just now")
        return
      }
      
      const diffMins = Math.floor(diffMs / 60000)
      const diffHours = Math.floor(diffMs / 3600000)
      const diffDays = Math.floor(diffMs / 86400000)

      if (diffMins < 1) {
        setTimeAgo("Just now")
      } else if (diffMins < 60) {
        setTimeAgo(`${diffMins} minute${diffMins > 1 ? "s" : ""} ago`)
      } else if (diffHours < 24) {
        setTimeAgo(`${diffHours} hour${diffHours > 1 ? "s" : ""} ago`)
      } else {
        setTimeAgo(`${diffDays} day${diffDays > 1 ? "s" : ""} ago`)
      }
    } catch {
      setTimeAgo("Unknown time")
    }
  }, [timestamp])
  
  return <span>{timeAgo || "..."}</span>
}

/** Fleet / operations dashboard (financial + fleet metrics). Not used for `driver` role. */
export default function FleetDashboardPage({
  initialBootstrap = null,
  initialSessionUserId = null,
}: {
  initialBootstrap?: DashboardBootstrapResult | null
  initialSessionUserId?: string | null
}) {
  const { data, isLoading, error, isFetching } = useDashboardPageData(
    initialBootstrap,
    initialSessionUserId
  )
  const authCompany = data?.authCompany ?? null
  const dashboardData = data?.dashboardData
  const [now, setNow] = useState<Date>(new Date())

  const [emailServiceStatus, setEmailServiceStatus] = useState<{ configured: boolean; isManager: boolean } | null>(null)
  const [dismissedEmailBanner, setDismissedEmailBanner] = useState(false)
  const [showTourResetBanner, setShowTourResetBanner] = useState(false)

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && localStorage.getItem("dashboard-dismiss-email-banner") === "1") {
        setDismissedEmailBanner(true)
      }
      if (typeof window !== "undefined" && localStorage.getItem("dashboard-tour-reset-banner") === "1") {
        setShowTourResetBanner(true)
        localStorage.removeItem("dashboard-tour-reset-banner")
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    async function checkEmailConfig() {
      const result = await checkEmailServiceConfigured()
      setEmailServiceStatus(result)
    }
    checkEmailConfig()
  }, [])

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])

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

  const recentActivity = useMemo(() => {
    return dashboardData?.recentActivity || []
  }, [dashboardData?.recentActivity])

  const alertsCount = useMemo(() => {
    if (!dashboardData) return 0
    return (
      (dashboardData.overdueInvoices?.length || 0) +
      (dashboardData.upcomingMaintenance?.length || 0) +
      (dashboardData.upcomingDeliveries?.length || 0)
    )
  }, [dashboardData])

  const loadStatusStats = useMemo(() => {
    const distribution = dashboardData?.loadStatusDistribution || []
    const map = distribution.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = Number(item.count || 0)
      return acc
    }, {})
    const inTransit = map.in_transit || 0
    const scheduled = map.scheduled || 0
    const delivered = map.delivered || 0
    const cancelled = map.cancelled || 0
    const pending = map.pending || 0
    return { inTransit, scheduled, delivered, cancelled, pending }
  }, [dashboardData?.loadStatusDistribution])

  const lastActivityLabel = useMemo(() => {
    const latest = recentActivity[0]?.time
    if (!latest) return "No recent updates"
    const diff = now.getTime() - new Date(latest).getTime()
    if (Number.isNaN(diff)) return "No recent updates"
    const mins = Math.max(0, Math.floor(diff / 60000))
    if (mins < 1) return "Updated just now"
    if (mins < 60) return `Updated ${mins}m ago`
    return `Updated ${Math.floor(mins / 60)}h ago`
  }, [recentActivity, now])

  const getActivityVisual = (action: string) => {
    const value = String(action || "").toLowerCase()
    if (value.includes("dvir")) return { icon: ShieldAlert, tone: "text-amber-400 bg-amber-500/15 border-amber-500/30" }
    if (value.includes("bol")) return { icon: FileText, tone: "text-violet-400 bg-violet-500/15 border-violet-500/30" }
    if (value.includes("route")) return { icon: Route, tone: "text-cyan-400 bg-cyan-500/15 border-cyan-500/30" }
    if (value.includes("driver")) return { icon: Users, tone: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30" }
    if (value.includes("truck") || value.includes("vehicle")) return { icon: Truck, tone: "text-blue-400 bg-blue-500/15 border-blue-500/30" }
    if (value.includes("invoice")) return { icon: DollarSign, tone: "text-amber-400 bg-amber-500/15 border-amber-500/30" }
    return { icon: Activity, tone: "text-muted-foreground bg-muted/50 border-border/60" }
  }

  if (error) {
    const errorMessage = error.message || "Failed to load dashboard data"
    if (errorMessage.includes('Connection') || errorMessage.includes('timeout') || errorMessage.includes('ECONNREFUSED')) {
      toast.error(errorMessage, {
        duration: 5000,
        description: "Please check your internet connection and try refreshing the page."
      })
    }
  }

  if (isLoading && !data) {
    return (
      <div className="w-full p-4 md:p-8">
        <div className="mx-auto w-full max-w-[1800px] space-y-6">
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
    <div className="w-full min-h-full bg-gradient-to-b from-background via-background to-muted/[0.08]">
      <div className="relative border-b border-border/60 bg-card/40 px-4 py-5 backdrop-blur-md md:px-8 md:py-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_80%_at_50%_0%,hsl(var(--primary)/0.08),transparent_70%)]" />
        <div className="relative flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground md:text-3xl">Dashboard</h1>
              <p className="mt-1 text-sm text-muted-foreground">Morning Operations View</p>
              {authCompany?.companyName && (
                <p className="mt-1 text-xs text-muted-foreground" data-testid="dashboard-company">
                  Viewing <span className="font-semibold text-foreground">{authCompany.companyName}</span>
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1.5 text-xs text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${isFetching ? "animate-pulse bg-emerald-400" : "bg-emerald-400/80"}`} />
              <span className="font-medium text-foreground">Live</span>
              <span>•</span>
              <span>{lastActivityLabel}</span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="w-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 sm:w-auto">
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

      <div className="p-4 md:p-8">
        <div className="mx-auto w-full max-w-[1800px] space-y-6">
          {emailServiceStatus?.isManager && !emailServiceStatus.configured && !dismissedEmailBanner && (
            <Alert className="border-yellow-500/50 bg-yellow-500/10">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription>
                <div className="flex items-start justify-between gap-4 w-full">
                  <div className="flex-1">
                    <p className="font-medium text-yellow-900 dark:text-yellow-100 mb-1">
                      Email service not configured
                    </p>
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      Invoice reminders, driver alerts, and load updates will <strong>not be sent by email</strong> until this is set up.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="border-yellow-600 text-yellow-900 dark:text-yellow-100 hover:bg-yellow-500/20"
                    >
                      <Link href="/dashboard/settings/integration">
                        Configure Email
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setDismissedEmailBanner(true)
                        try {
                          localStorage.setItem("dashboard-dismiss-email-banner", "1")
                        } catch {
                          /* ignore */
                        }
                      }}
                      className="text-yellow-800 dark:text-yellow-200 hover:bg-yellow-500/20"
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {showTourResetBanner && (
            <Alert className="border-primary/40 bg-primary/10">
              <AlertCircle className="h-4 w-4 text-primary" />
              <AlertDescription>
                <div className="flex items-start justify-between gap-4 w-full">
                  <div className="flex-1">
                    <p className="font-medium text-foreground mb-1">Onboarding tour reset successful</p>
                    <p className="text-sm text-muted-foreground">
                      The guided tour is enabled again and will launch for this session.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowTourResetBanner(false)}
                    className="text-muted-foreground hover:bg-primary/20"
                  >
                    Dismiss
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Ops Morning View: the 5 checks */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-5">
            <MetricCard
              title="Loads Today"
              icon={Package}
              tone={loadStatusStats.cancelled > 0 ? "warning" : "good"}
              primary={isLoading ? "..." : String(loadStatusStats.inTransit)}
              secondary={[
                { label: "Scheduled", value: isLoading ? "..." : loadStatusStats.scheduled },
                { label: "Delivered", value: isLoading ? "..." : loadStatusStats.delivered, tone: "good" },
                { label: "Cancelled", value: isLoading ? "..." : loadStatusStats.cancelled, tone: loadStatusStats.cancelled > 0 ? "warning" : "neutral" },
              ]}
            />
            <MetricCard
              title="Driver Coverage"
              icon={Users}
              tone={stats.activeDrivers > 0 ? "good" : "warning"}
              primary={isLoading ? "..." : `${stats.activeDrivers} active`}
              secondary={[
                { label: "Total", value: isLoading ? "..." : stats.totalDrivers },
                { label: "Idle", value: isLoading ? "..." : Math.max(0, stats.totalDrivers - stats.activeDrivers), tone: "warning" },
                { label: "Coverage", value: isLoading ? "..." : `${stats.totalDrivers > 0 ? Math.round((stats.activeDrivers / stats.totalDrivers) * 100) : 0}%` },
              ]}
            />
            <MetricCard
              title="Receivables"
              icon={FileText}
              tone={(dashboardData?.outstandingInvoices || 0) > 0 ? "warning" : "good"}
              primary={isLoading ? "..." : `$${Number(dashboardData?.outstandingInvoices || 0).toLocaleString()}`}
              secondary={[
                { label: "Revenue", value: isLoading ? "..." : `$${Number(dashboardData?.totalRevenue || 0).toLocaleString()}`, tone: "good" },
                { label: "Expenses", value: isLoading ? "..." : `$${Number(dashboardData?.totalExpenses || 0).toLocaleString()}` },
                { label: "Net", value: isLoading ? "..." : `$${Number(dashboardData?.netProfit || 0).toLocaleString()}`, tone: (dashboardData?.netProfit || 0) >= 0 ? "good" : "danger" },
              ]}
            />
            <MetricCard
              title="Exceptions"
              icon={AlertCircle}
              tone={alertsCount > 0 ? "danger" : "good"}
              primary={isLoading ? "..." : `${alertsCount} total`}
              secondary={[
                { label: "Invoices", value: isLoading ? "..." : dashboardData?.overdueInvoices?.length || 0, tone: "danger" },
                { label: "Deliveries", value: isLoading ? "..." : dashboardData?.upcomingDeliveries?.length || 0, tone: "warning" },
                { label: "Maintenance", value: isLoading ? "..." : dashboardData?.upcomingMaintenance?.length || 0, tone: "warning" },
              ]}
            />
            <MetricCard
              title="Fleet Readiness"
              icon={Wrench}
              tone={stats.scheduledMaintenance > 0 ? "warning" : "good"}
              primary={isLoading ? "..." : `${stats.activeTrucks}/${stats.totalTrucks}`}
              secondary={[
                { label: "Utilization", value: isLoading ? "..." : `${stats.fleetUtilization}%`, tone: stats.fleetUtilization >= 80 ? "good" : "warning" },
                { label: "Maint.", value: isLoading ? "..." : stats.scheduledMaintenance, tone: stats.scheduledMaintenance > 0 ? "warning" : "good" },
                { label: "Routes", value: isLoading ? "..." : `${stats.activeRoutes}/${stats.totalRoutes}` },
              ]}
            />
          </div>

          <Card className="border-border/70 bg-card/40 p-4 shadow-sm md:p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-foreground">Operations & Financial Insights</h2>
                <p className="text-sm text-muted-foreground">Live operational context with finance signals in one view.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card className="border-border/60 bg-card/60 p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground/90">Total Revenue</p>
                      <p className="mt-3 text-3xl font-bold text-green-400">
                        {isLoading ? "..." : `$${Number(dashboardData?.totalRevenue || 0).toLocaleString()}`}
                      </p>
                    </div>
                    <DollarSign className="w-5 h-5 text-green-400 opacity-70" />
                  </div>
                </Card>
                <Card className="border-border/60 bg-card/60 p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground/90">Total Expenses</p>
                      <p className="mt-3 text-3xl font-bold text-red-400">
                        {isLoading ? "..." : `$${Number(dashboardData?.totalExpenses || 0).toLocaleString()}`}
                      </p>
                    </div>
                    <DollarSign className="w-5 h-5 text-red-400 opacity-70" />
                  </div>
                </Card>
                <Card className="border-border/60 bg-card/60 p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground/90">Net Profit</p>
                      <p className={`mt-3 text-3xl font-bold ${(dashboardData?.netProfit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {isLoading ? "..." : `$${Number(dashboardData?.netProfit || 0).toLocaleString()}`}
                      </p>
                    </div>
                    <Route className={`w-5 h-5 opacity-70 ${(dashboardData?.netProfit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`} />
                  </div>
                </Card>
                <Card className="border-border/60 bg-card/60 p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground/90">Fleet Utilization</p>
                      <p className="mt-3 text-3xl font-bold text-foreground">
                        {isLoading ? "..." : `${stats.fleetUtilization}%`}
                      </p>
                    </div>
                    <Truck className="w-5 h-5 text-primary opacity-70" />
                  </div>
                </Card>
              </div>

              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <Suspense fallback={<div className="h-64 animate-pulse bg-muted rounded-lg" />}>
                  <ProfitEstimator />
                </Suspense>
                <Suspense fallback={<div className="h-64 animate-pulse bg-muted rounded-lg" />}>
                  <RevenueChart data={dashboardData?.revenueTrend || []} />
                </Suspense>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {dashboardData?.loadStatusDistribution && dashboardData.loadStatusDistribution.length > 0 && (
                  <Suspense fallback={<div className="h-64 animate-pulse bg-muted rounded-lg" />}>
                    <LoadStatusChart data={dashboardData.loadStatusDistribution} />
                  </Suspense>
                )}
                <Suspense fallback={<div className="h-48 animate-pulse bg-muted rounded-lg" />}>
                  <RemindersWidget />
                </Suspense>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {dashboardData && (
                  <Suspense fallback={<div className="h-48 animate-pulse bg-muted rounded-lg" />}>
                    <AlertsSection
                      upcomingMaintenance={dashboardData.upcomingMaintenance || []}
                      overdueInvoices={dashboardData.overdueInvoices || []}
                      upcomingDeliveries={dashboardData.upcomingDeliveries || []}
                    />
                  </Suspense>
                )}
                <Suspense fallback={<div className="h-48 animate-pulse bg-muted rounded-lg" />}>
                  <PerformanceMetrics
                    fleetUtilization={stats.fleetUtilization}
                    totalLoads={stats.totalLoads}
                    onTimeDeliveryRate={
                      stats.totalLoads > 0 && stats.inTransitLoads > 0
                        ? Math.round((stats.inTransitLoads / stats.totalLoads) * 100)
                        : 0
                    }
                    averageLoadValue={
                      dashboardData && dashboardData.totalLoads > 0
                        ? dashboardData.totalRevenue / dashboardData.totalLoads
                        : 0
                    }
                  />
                </Suspense>
              </div>

              <Card className="border-border/60 bg-card/60 p-5">
                <h3 className="mb-4 text-lg font-semibold text-foreground">Recent Activity</h3>
                {recentActivity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent activity</p>
                ) : (
                  <div className="space-y-1">
                    {recentActivity.map((activity: any, index: number) => (
                      <div key={index} className="flex items-start gap-3 rounded-md border-b border-border/30 py-3 last:border-0">
                        <div className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-md border ${getActivityVisual(activity.action).tone}`}>
                          {(() => {
                            const Icon = getActivityVisual(activity.action).icon
                            return <Icon className="h-3.5 w-3.5" />
                          })()}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-foreground">{activity.action}</p>
                          <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarClock className="h-3 w-3" />
                            <TimeAgo timestamp={activity.time} />
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </Card>
        </div>
      </div>
    </div>
  )
}
