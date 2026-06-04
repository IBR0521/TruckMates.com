"use client"

import { TrendingUp } from "lucide-react"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Card } from "@/components/ui/card"
import { MarketingPreviewFrame } from "./marketing-preview-frame"

const CHART_DATA = [
  { date: "Jan", amount: 180 },
  { date: "Feb", amount: 195 },
  { date: "Mar", amount: 210 },
  { date: "Apr", amount: 225 },
  { date: "May", amount: 238 },
  { date: "Jun", amount: 248 },
]

const KPIS = [
  { label: "Revenue (MTD)", value: "$248.5k", delta: "↑ 12%" },
  { label: "Loads delivered", value: "1,284", delta: "↑ 8%" },
  { label: "On-time %", value: "96.2%", delta: "↑ 1.4%" },
  { label: "Open violations", value: "0", delta: "Last 30 days", muted: true },
] as const

export function ReportsPreview({ className }: { className?: string }) {
  return (
    <MarketingPreviewFrame className={className} url="app.truckmates.com/reports">
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {KPIS.map((kpi) => (
          <Card key={kpi.label} className="min-w-0 border-border/60 bg-card/70 p-3 shadow-sm sm:p-4">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/90 sm:text-[11px]">
              {kpi.label}
            </p>
            <p className="mt-1.5 truncate text-lg font-bold leading-none text-foreground sm:text-xl">
              {kpi.value}
            </p>
            <p
              className={`mt-1 text-[11px] ${
                "muted" in kpi && kpi.muted ? "text-muted-foreground" : "text-emerald-400"
              }`}
            >
              {kpi.delta}
            </p>
          </Card>
        ))}
      </div>

      <Card className="mt-3 border-border/60 bg-card/70 p-3 shadow-sm sm:p-4">
        <div className="mb-2 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 shrink-0 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Revenue trend</h3>
        </div>
        <div className="h-[140px] w-full min-h-[140px]">
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={CHART_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="marketingRevenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(148,163,184,0.15)" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${v}k`}
              />
              <Tooltip
                formatter={(value) => [`$${value}k`, "Revenue"]}
                contentStyle={{
                  background: "#0f1421",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#marketingRevenueFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </MarketingPreviewFrame>
  )
}
