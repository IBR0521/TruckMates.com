"use client"

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, defs, linearGradient, stop } from "recharts"
import { Card } from "@/components/ui/card"
import { TrendingUp } from "lucide-react"

interface RevenueChartProps {
  data: Array<{ date: string; amount: number }>
}

export function RevenueChart({ data }: RevenueChartProps) {
  // Format data for chart
  const chartData = data.map((item) => ({
    date: new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    amount: Number(item.amount),
  }))

  // If no data, show empty state
  if (!data || data.length === 0) {
    return (
      <Card className="p-6 border-border bg-card/50">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Revenue Trend (Last 7 Days)</h3>
        </div>
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          <p>No revenue data available</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6 border-border bg-card/50">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Revenue Trend (Last 7 Days)</h3>
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" opacity={0.3} />
          <XAxis 
            dataKey="date" 
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            axisLine={{ stroke: "hsl(var(--border))" }}
          />
          <YAxis 
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            axisLine={{ stroke: "hsl(var(--border))" }}
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: "hsl(var(--card))", 
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
            }}
            formatter={(value: number) => [`$${value.toLocaleString()}`, "Revenue"]}
            labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
          />
          <Area 
            type="monotone" 
            dataKey="amount" 
            stroke="#10b981" 
            strokeWidth={2.5}
            fill="url(#colorRevenue)"
            dot={{ fill: "#10b981", r: 4, strokeWidth: 2, stroke: "#ffffff" }}
            activeDot={{ r: 6, fill: "#10b981", stroke: "#ffffff", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  )
}

