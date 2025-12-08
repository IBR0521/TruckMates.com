"use client"

import { Card } from "@/components/ui/card"
import { Truck, Users, AlertCircle, TrendingUp } from "lucide-react"
import { useEffect, useState } from "react"
import { getDashboardStats } from "@/app/actions/dashboard"

export default function StatsOverview() {
  const [stats, setStats] = useState({
    activeTrucks: 0,
    activeDrivers: 0,
    activeRoutes: 0,
    scheduledMaintenance: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      const result = await getDashboardStats()
      if (result.data) {
        setStats({
          activeTrucks: result.data.activeTrucks,
          activeDrivers: result.data.activeDrivers,
          activeRoutes: result.data.activeRoutes,
          scheduledMaintenance: result.data.scheduledMaintenance,
        })
      }
      setIsLoading(false)
    }
    loadStats()
  }, [])

  const statsData = [
    {
      label: "Active Trucks",
      value: stats.activeTrucks.toString(),
      icon: Truck,
      trend: `${stats.activeTrucks} available`,
      color: "text-primary",
    },
    {
      label: "Active Drivers",
      value: stats.activeDrivers.toString(),
      icon: Users,
      trend: `${stats.activeDrivers} on duty`,
      color: "text-blue-400",
    },
    {
      label: "Active Routes",
      value: stats.activeRoutes.toString(),
      icon: TrendingUp,
      trend: `${stats.activeRoutes} in progress`,
      color: "text-green-400",
    },
    {
      label: "Maintenance Alerts",
      value: stats.scheduledMaintenance.toString(),
      icon: AlertCircle,
      trend: `${stats.scheduledMaintenance} scheduled`,
      color: "text-red-400",
    },
  ]

  if (isLoading) {
    return (
      <div className="grid md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-border bg-card/50 p-6">
            <div className="animate-pulse">
              <div className="h-4 bg-muted rounded w-24 mb-2"></div>
              <div className="h-8 bg-muted rounded w-16 mb-2"></div>
              <div className="h-3 bg-muted rounded w-32"></div>
            </div>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid md:grid-cols-4 gap-4">
      {statsData.map((stat, i) => {
        const Icon = stat.icon
        return (
          <Card key={i} className="border-border bg-card/50 p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-2">{stat.trend}</p>
              </div>
              <div className={`p-3 bg-primary/10 rounded-lg ${stat.color}`}>
                <Icon className="w-6 h-6" />
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
