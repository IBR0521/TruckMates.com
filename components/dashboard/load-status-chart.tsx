"use client"

import { Card } from "@/components/ui/card"
import { Package } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface LoadStatusChartProps {
  data: Array<{ status: string; count: number }>
}

const STATUS_COLORS: Record<string, string> = {
  delivered: "bg-green-500",
  in_transit: "bg-blue-500",
  pending: "bg-amber-500",
  scheduled: "bg-purple-500",
  cancelled: "bg-red-500",
  draft: "bg-gray-500",
  unknown: "bg-gray-400",
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_transit: "In Transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
  scheduled: "Scheduled",
  draft: "Draft",
  unknown: "Unknown",
}

export function LoadStatusChart({ data }: LoadStatusChartProps) {
  // Format data for chart
  const chartData = data
    .map((item) => ({
      name: STATUS_LABELS[item.status] || item.status,
      value: Number(item.count),
      status: item.status,
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)

  const total = chartData.reduce((sum, item) => sum + item.value, 0)

  // If no data, show empty state
  if (!data || data.length === 0 || total === 0) {
    return (
      <Card className="p-6 border-border bg-card/50">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Load Status Distribution</h3>
        </div>
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          <p>No load data available</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6 border-border bg-card/50">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Load Status Distribution</h3>
        </div>
        <Badge variant="outline" className="text-sm font-semibold">
          {total} Total
        </Badge>
      </div>
      
      <div className="space-y-4">
        {chartData.map((item) => {
          const percent = total > 0 ? (item.value / total) * 100 : 0
          return (
            <div key={item.status} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${STATUS_COLORS[item.status] || "bg-gray-400"}`} />
                  <span className="font-medium text-foreground">{item.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">{item.value}</span>
                  <span className="text-muted-foreground font-medium w-12 text-right">{percent.toFixed(1)}%</span>
                </div>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full ${STATUS_COLORS[item.status] || "bg-gray-400"} transition-all duration-500 rounded-full`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

