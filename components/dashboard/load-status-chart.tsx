"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"
import { Card } from "@/components/ui/card"
import { Package } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface LoadStatusChartProps {
  data: Array<{ status: string; count: number }>
}

// Status-specific colors for better meaning
const STATUS_COLORS: Record<string, string> = {
  delivered: "#10b981",      // Green - success
  in_transit: "#3b82f6",     // Blue - active
  pending: "#f59e0b",        // Amber - waiting
  scheduled: "#8b5cf6",      // Purple - planned
  cancelled: "#ef4444",      // Red - cancelled
  draft: "#6b7280",          // Gray - draft
  unknown: "#9ca3af",        // Light gray - unknown
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

// Custom label function to show both count and percentage
const renderCustomLabel = ({ name, value, percent }: any) => {
  if (percent < 0.05) return null // Don't show labels for very small slices
  return `${(percent * 100).toFixed(0)}%`
}

export function LoadStatusChart({ data }: LoadStatusChartProps) {
  // Format data for chart
  const chartData = data
    .map((item) => ({
      name: STATUS_LABELS[item.status] || item.status,
      value: Number(item.count),
      status: item.status,
    }))
    .filter((item) => item.value > 0) // Filter out zero values
    .sort((a, b) => b.value - a.value) // Sort by value descending

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
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Load Status Distribution</h3>
        </div>
        <Badge variant="outline" className="text-sm">
          Total: {total}
        </Badge>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomLabel}
            outerRadius={90}
            innerRadius={40}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((entry) => (
              <Cell 
                key={`cell-${entry.status}`} 
                fill={STATUS_COLORS[entry.status] || "#9ca3af"}
                stroke="hsl(var(--card))"
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              backgroundColor: "hsl(var(--card))", 
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
            }}
            formatter={(value: number, name: string, props: any) => {
              const percent = ((value / total) * 100).toFixed(1)
              return [`${value} loads (${percent}%)`, name]
            }}
            labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
          />
          <Legend 
            verticalAlign="bottom"
            height={36}
            formatter={(value, entry: any) => {
              const item = chartData.find(d => d.name === value)
              const count = item?.value || 0
              const percent = item ? ((count / total) * 100).toFixed(1) : '0'
              return `${value} (${count} - ${percent}%)`
            }}
            wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  )
}

