"use client"

import { Card } from "@/components/ui/card"
import { Activity, Clock3, Target, Truck } from "lucide-react"
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
  const utilizationTone = fleetUtilization >= 80 ? "text-emerald-400" : fleetUtilization >= 50 ? "text-amber-400" : "text-rose-400"
  const onTimeTone = onTimeDeliveryRate >= 90 ? "text-emerald-400" : onTimeDeliveryRate >= 70 ? "text-amber-400" : "text-rose-400"

  return (
    <Card className="border-border bg-card/50 p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Performance Metrics</h3>
        </div>
        <Badge variant="outline" className="text-xs">
          Snapshot
        </Badge>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Fleet Utilization</p>
            <Truck className={`h-4 w-4 ${utilizationTone}`} />
          </div>
          <p className={`text-2xl font-bold ${utilizationTone}`}>{fleetUtilization}%</p>
        </div>

        <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Total Loads</p>
            <Target className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold text-foreground">{totalLoads.toLocaleString()}</p>
        </div>

        <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">On-Time Rate</p>
            <Clock3 className={`h-4 w-4 ${onTimeTone}`} />
          </div>
          <p className={`text-2xl font-bold ${onTimeTone}`}>{(onTimeDeliveryRate || 0).toFixed(1)}%</p>
        </div>

        <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Avg Load Value</p>
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold text-foreground">${(averageLoadValue || 0).toLocaleString()}</p>
        </div>
      </div>
    </Card>
  )
}












