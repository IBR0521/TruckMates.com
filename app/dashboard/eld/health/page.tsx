"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Truck, 
  Users,
  TrendingUp,
  TrendingDown,
  Clock,
  Shield
} from "lucide-react"
import { getFleetHealth, getPredictiveAlerts } from "@/app/actions/eld-advanced"
import { toast } from "sonner"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ELDRealtimeMap } from "@/components/eld-realtime-map"

export default function FleetHealthPage() {
  const [health, setHealth] = useState<any>(null)
  const [alerts, setAlerts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [])

  async function loadData() {
    try {
      const [healthResult, alertsResult] = await Promise.all([
        getFleetHealth(),
        getPredictiveAlerts(),
      ])

      if (healthResult.error) {
        toast.error(healthResult.error)
      } else if (healthResult.data) {
        setHealth(healthResult.data)
      }

      if (alertsResult.error) {
        toast.error(alertsResult.error)
      } else if (alertsResult.data) {
        setAlerts(alertsResult.data)
      }
    } catch (error) {
      toast.error("Failed to load fleet health data")
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "excellent":
        return "bg-green-500/20 text-green-500 border-green-500/50"
      case "good":
        return "bg-blue-500/20 text-blue-500 border-blue-500/50"
      case "fair":
        return "bg-yellow-500/20 text-yellow-500 border-yellow-500/50"
      case "poor":
        return "bg-red-500/20 text-red-500 border-red-500/50"
      default:
        return "bg-gray-500/20 text-gray-500 border-gray-500/50"
    }
  }

  if (isLoading) {
    return (
      <div className="w-full">
        <div className="border-b border-border bg-card/50 backdrop-blur px-8 py-4">
          <h1 className="text-2xl font-bold text-foreground">Fleet Health Dashboard</h1>
        </div>
        <div className="p-4 md:p-8">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fleet Health Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time overview of your fleet status</p>
        </div>
        <Link href="/dashboard/eld">
          <Button variant="outline">Back to ELD</Button>
        </Link>
      </div>

      {/* Content */}
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Compliance Score */}
            <Card className="p-6 border-border">
              <div className="flex items-center justify-between mb-4">
                <Shield className="w-8 h-8 text-primary" />
                <Badge className={getStatusColor(health?.status || "good")}>
                  {health?.status || "Good"}
                </Badge>
              </div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Compliance Score</h3>
              <p className="text-3xl font-bold text-foreground">{health?.complianceScore || 0}</p>
              <p className="text-xs text-muted-foreground mt-2">Out of 100</p>
            </Card>

            {/* Active Devices */}
            <Card className="p-6 border-border">
              <div className="flex items-center justify-between mb-4">
                <Truck className="w-8 h-8 text-blue-500" />
                <Activity className="w-5 h-5 text-green-500" />
              </div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Active Devices</h3>
              <p className="text-3xl font-bold text-foreground">{health?.devices?.active || 0}</p>
              <p className="text-xs text-muted-foreground mt-2">
                of {health?.devices?.total || 0} total
              </p>
            </Card>

            {/* Active Violations */}
            <Card className="p-6 border-border">
              <div className="flex items-center justify-between mb-4">
                <AlertTriangle className="w-8 h-8 text-red-500" />
                {health?.violations?.total > 0 && (
                  <Badge className="bg-red-500/20 text-red-500 border-red-500/50">
                    {health?.violations?.critical || 0} Critical
                  </Badge>
                )}
              </div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Active Violations</h3>
              <p className="text-3xl font-bold text-foreground">{health?.violations?.total || 0}</p>
              <p className="text-xs text-muted-foreground mt-2">Last 24 hours</p>
            </Card>

            {/* Drivers Approaching Limit */}
            <Card className="p-6 border-border">
              <div className="flex items-center justify-between mb-4">
                <Users className="w-8 h-8 text-yellow-500" />
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Approaching Limits</h3>
              <p className="text-3xl font-bold text-foreground">
                {health?.drivers?.approachingLimit || 0}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                of {health?.drivers?.total || 0} drivers
              </p>
            </Card>
          </div>

          {/* Predictive Alerts */}
          {alerts.length > 0 && (
            <Card className="p-6 border-border">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                <h2 className="text-lg font-semibold text-foreground">Predictive Alerts</h2>
                <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/50">
                  {alerts.length}
                </Badge>
              </div>
              <div className="space-y-3">
                {alerts.map((alert, index) => (
                  <Card
                    key={index}
                    className={`p-4 border ${
                      alert.severity === "critical"
                        ? "bg-red-500/10 border-red-500/20"
                        : "bg-yellow-500/10 border-yellow-500/20"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertTriangle
                            className={`w-4 h-4 ${
                              alert.severity === "critical" ? "text-red-500" : "text-yellow-500"
                            }`}
                          />
                          <h3 className="font-semibold text-foreground">{alert.title}</h3>
                          <Badge
                            className={
                              alert.severity === "critical"
                                ? "bg-red-500/20 text-red-500 border-red-500/50"
                                : "bg-yellow-500/20 text-yellow-500 border-yellow-500/50"
                            }
                          >
                            {alert.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{alert.description}</p>
                        {alert.remainingHours !== undefined && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {alert.remainingHours.toFixed(1)} hours remaining
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          )}

          {/* Real-Time Map */}
          <ELDRealtimeMap />

          {/* Device Status Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6 border-border">
              <h2 className="text-lg font-semibold text-foreground mb-4">Device Status</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full" />
                    <span className="text-sm text-foreground">Active</span>
                  </div>
                  <span className="font-semibold text-foreground">
                    {health?.devices?.active || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-gray-500 rounded-full" />
                    <span className="text-sm text-foreground">Inactive</span>
                  </div>
                  <span className="font-semibold text-foreground">
                    {health?.devices?.inactive || 0}
                  </span>
                </div>
              </div>
            </Card>

            <Card className="p-6 border-border">
              <h2 className="text-lg font-semibold text-foreground mb-4">Violation Breakdown</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span className="text-sm text-foreground">Critical</span>
                  </div>
                  <span className="font-semibold text-foreground text-red-500">
                    {health?.violations?.critical || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm text-foreground">Warning</span>
                  </div>
                  <span className="font-semibold text-foreground text-yellow-500">
                    {health?.violations?.warning || 0}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
