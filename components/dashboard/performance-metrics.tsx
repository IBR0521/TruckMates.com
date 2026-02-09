"use client"

import { Card } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Clock, Target } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface PerformanceMetricsProps {
  fleetUtilization: number
  totalLoads: number
  onTimeDeliveryRate?: number
  averageLoadValue?: number
}

export function PerformanceMetrics({ 
  fleetUtilization, 
  totalLoads,
  onTimeDeliveryRate = 0,
  averageLoadValue = 0
}: PerformanceMetricsProps) {
  const getUtilizationColor = (util: number) => {
    if (util >= 80) return "text-green-400"
    if (util >= 50) return "text-yellow-400"
    return "text-red-400"
  }

  const getUtilizationStatus = (util: number) => {
    if (util >= 80) return "Optimal"
    if (util >= 50) return "Good"
    return "Needs Improvement"
  }

  return (
    <Card className="p-6 border-border bg-card/50">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Performance Metrics</h3>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Fleet Utilization */}
        <div className="p-4 bg-muted/30 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Fleet Utilization</p>
            <TrendingUp className={`w-4 h-4 ${getUtilizationColor(fleetUtilization)}`} />
          </div>
          <p className={`text-2xl font-bold ${getUtilizationColor(fleetUtilization)}`}>
            {fleetUtilization}%
          </p>
          <Badge 
            variant={fleetUtilization >= 80 ? "default" : fleetUtilization >= 50 ? "secondary" : "destructive"}
            className="mt-2 text-xs"
          >
            {getUtilizationStatus(fleetUtilization)}
          </Badge>
        </div>

        {/* Total Loads */}
        <div className="p-4 bg-muted/30 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Total Loads</p>
            <Target className="w-4 h-4 text-primary" />
          </div>
          <p className="text-2xl font-bold text-foreground">{totalLoads}</p>
          <p className="text-xs text-muted-foreground mt-2">All time</p>
        </div>

        {/* On-Time Delivery Rate */}
        <div className="p-4 bg-muted/30 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">On-Time Rate</p>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <p className={`text-2xl font-bold ${onTimeDeliveryRate >= 90 ? "text-green-400" : onTimeDeliveryRate >= 70 ? "text-yellow-400" : "text-red-400"}`}>
            {onTimeDeliveryRate.toFixed(1)}%
          </p>
          <p className="text-xs text-muted-foreground mt-2">Delivery performance</p>
        </div>

        {/* Average Load Value */}
        <div className="p-4 bg-muted/30 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Avg Load Value</p>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-foreground">
            ${averageLoadValue > 0 ? averageLoadValue.toLocaleString() : "0"}
          </p>
          <p className="text-xs text-muted-foreground mt-2">Per load</p>
        </div>
      </div>
    </Card>
  )
}












