"use client"

import { useState, useEffect } from "react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Card } from "@/components/ui/card"
import { TrendingUp } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getRevenueTrend } from "@/app/actions/revenue-trend"

interface RevenueChartProps {
  data?: Array<{ date: string; amount: number }>
}

type Period = 'weekly' | 'monthly' | 'yearly'

export function RevenueChart({ data: initialData }: RevenueChartProps) {
  const [period, setPeriod] = useState<Period>('weekly')
  const [data, setData] = useState<Array<{ date: string; amount: number }>>(initialData || [])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true)
      const result = await getRevenueTrend(period)
      if (result.data) {
        setData(result.data)
      }
      setIsLoading(false)
    }
    fetchData()
  }, [period])

  // Format data for chart based on period
  const chartData = data.map((item) => {
    try {
      if (period === 'weekly') {
        const date = new Date(item.date)
        return {
          date: isNaN(date.getTime()) ? item.date : date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          amount: Number(item.amount) || 0,
        }
      } else if (period === 'monthly') {
        // Format: "2024-01" -> "Jan 2024"
        const [year, month] = item.date.split('-')
        const date = new Date(parseInt(year), parseInt(month) - 1)
        return {
          date: date.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
          amount: Number(item.amount) || 0,
        }
      } else {
        // Format: "2024" -> "2024"
        return {
          date: item.date,
          amount: Number(item.amount) || 0,
        }
      }
    } catch {
      return {
        date: item.date,
        amount: Number(item.amount) || 0,
      }
    }
  })

  const hasData = data && data.length > 0 && data.some(item => Number(item.amount) > 0)
  const isEmpty = !hasData

  const periodLabels = {
    weekly: 'Last 7 Days',
    monthly: 'Last 6 Months',
    yearly: 'Last 6 Years'
  }

  return (
    <Card className={`p-6 border-border bg-card/50 ${isEmpty ? 'md:col-span-2' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Revenue Trend</h3>
        </div>
        <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
          <SelectTrigger className="w-[140px] bg-input border-border text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="yearly">Yearly</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {isLoading ? (
        <div className={`${isEmpty ? 'h-96' : 'h-64'} flex items-center justify-center`}>
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Loading revenue data...</p>
          </div>
        </div>
      ) : isEmpty ? (
        <div className="h-96 flex flex-col items-center justify-center text-muted-foreground">
          <TrendingUp className="w-16 h-16 opacity-20 mb-4" />
          <p className="text-lg font-medium mb-2">No revenue data available</p>
          <p className="text-sm text-center max-w-md">
            Revenue trend will appear once you have invoices or loads with revenue. 
            The chart will show data for {periodLabels[period].toLowerCase()}.
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
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
              tickFormatter={(value) => {
                if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
                if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`
                return `$${value}`
              }}
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
      )}
    </Card>
  )
}

