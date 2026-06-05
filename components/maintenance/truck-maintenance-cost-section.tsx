"use client"

import { useEffect, useState } from "react"
import { DetailSection } from "@/components/dashboard/detail-page-layout"
import { Wrench, DollarSign } from "lucide-react"
import {
  getTruckMaintenanceCostHistory,
  type TruckMaintenanceCostSummary,
} from "@/app/actions/maintenance"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-")
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
}

export function TruckMaintenanceCostSection({ truckId }: { truckId: string }) {
  const [summary, setSummary] = useState<TruckMaintenanceCostSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void getTruckMaintenanceCostHistory(truckId).then((result) => {
      if (cancelled) return
      if (result.error) {
        setError(result.error)
        setSummary(null)
      } else {
        setSummary(result.data?.truck ?? null)
        setError(null)
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [truckId])

  if (loading) {
    return (
      <DetailSection title="Maintenance Cost" icon={<DollarSign className="w-5 h-5" />} className="border-border/70 bg-card/80">
        <p className="text-sm text-muted-foreground">Loading cost history…</p>
      </DetailSection>
    )
  }

  if (error) {
    return (
      <DetailSection title="Maintenance Cost" icon={<DollarSign className="w-5 h-5" />} className="border-border/70 bg-card/80">
        <p className="text-sm text-rose-400">{error}</p>
      </DetailSection>
    )
  }

  if (!summary || summary.total_record_count === 0) {
    return (
      <DetailSection title="Maintenance Cost" icon={<DollarSign className="w-5 h-5" />} className="border-border/70 bg-card/80">
        <p className="text-sm text-muted-foreground">No maintenance recorded yet</p>
      </DetailSection>
    )
  }

  const chartData = summary.monthly_trend.map((m) => ({
    month: formatMonthLabel(m.month),
    actual: m.actual_cost,
  }))

  return (
    <DetailSection title="Maintenance Cost" icon={<DollarSign className="w-5 h-5" />} className="border-border/70 bg-card/80">
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <div className="rounded-md border border-border/60 bg-muted/10 p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Total spent (actual)</p>
          <p className="mt-1 text-2xl font-bold text-emerald-400">
            {formatUsd(summary.total_actual_cost)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {summary.completed_count} completed record{summary.completed_count !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="rounded-md border border-border/60 bg-muted/10 p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Open estimates (projected)</p>
          <p className="mt-1 text-2xl font-bold text-amber-400">
            {formatUsd(summary.total_estimated_cost)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {summary.open_count} open record{summary.open_count !== 1 ? "s" : ""} — not spent yet
          </p>
        </div>
        <div className="rounded-md border border-border/60 bg-muted/10 p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Cost per mile</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {summary.cost_per_mile != null
              ? `$${summary.cost_per_mile.toFixed(2)}/mi`
              : "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {summary.cost_per_mile != null
              ? "Based on mileage span across completed work"
              : "Needs 2+ completed records with mileage"}
          </p>
        </div>
      </div>

      {summary.by_service_type.length > 0 && (
        <div className="mb-6">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1">
            <Wrench className="h-3.5 w-3.5" />
            By service type
          </p>
          <div className="overflow-x-auto rounded-md border border-border/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20 text-left">
                  <th className="px-4 py-2 font-medium">Service</th>
                  <th className="px-4 py-2 font-medium text-emerald-400">Actual (spent)</th>
                  <th className="px-4 py-2 font-medium text-amber-400">Estimated (open)</th>
                </tr>
              </thead>
              <tbody>
                {summary.by_service_type.map((row) => (
                  <tr key={row.service_type} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-2 capitalize">{row.service_type.replace(/_/g, " ")}</td>
                    <td className="px-4 py-2 text-emerald-400">
                      {row.actual_total > 0 ? formatUsd(row.actual_total) : "—"}
                    </td>
                    <td className="px-4 py-2 text-amber-400">
                      {row.estimated_total > 0 ? formatUsd(row.estimated_total) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {chartData.length > 0 ? (
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            Monthly spend trend (actual)
          </p>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  formatter={(value: number) => [formatUsd(value), "Actual spent"]}
                />
                <Bar dataKey="actual" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No completed maintenance with dates yet for trend chart.</p>
      )}
    </DetailSection>
  )
}
