"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"
import { Card } from "@/components/ui/card"
import { Package } from "lucide-react"

interface LoadStatusChartProps {
  data: Array<{ status: string; count: number }>
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--blue-500))",
  "hsl(var(--green-500))",
  "hsl(var(--yellow-500))",
  "hsl(var(--red-500))",
  "hsl(var(--purple-500))",
]

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_transit: "In Transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
  scheduled: "Scheduled",
  unknown: "Unknown",
}

export function LoadStatusChart({ data }: LoadStatusChartProps) {
  // Format data for chart
  const chartData = data.map((item) => ({
    name: STATUS_LABELS[item.status] || item.status,
    value: Number(item.count),
  }))

  // If no data, show empty state
  if (!data || data.length === 0) {
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
      <div className="flex items-center gap-2 mb-4">
        <Package className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Load Status Distribution</h3>
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              backgroundColor: "hsl(var(--card))", 
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px"
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  )
}

