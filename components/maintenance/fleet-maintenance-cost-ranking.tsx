"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { DollarSign, Truck } from "lucide-react"
import Link from "next/link"
import {
  getTruckMaintenanceCostHistory,
  type TruckMaintenanceCostSummary,
} from "@/app/actions/maintenance"

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount)
}

export function FleetMaintenanceCostRanking() {
  const [fleet, setFleet] = useState<TruckMaintenanceCostSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void getTruckMaintenanceCostHistory().then((result) => {
      if (cancelled) return
      if (result.error) {
        setError(result.error)
        setFleet([])
      } else {
        setFleet(result.data?.fleet ?? [])
        setError(null)
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <Card className="border border-border/50 p-6">
        <p className="text-sm text-muted-foreground">Loading cost by truck…</p>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border border-border/50 p-6">
        <p className="text-sm text-rose-400">{error}</p>
      </Card>
    )
  }

  const withSpend = fleet.filter((t) => t.total_record_count > 0)

  if (withSpend.length === 0) {
    return (
      <Card className="border border-border/50 p-6">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Cost by truck</h2>
        </div>
        <p className="text-sm text-muted-foreground">No maintenance recorded yet</p>
      </Card>
    )
  }

  return (
    <Card className="border border-border/50 p-6">
      <div className="flex items-center gap-2 mb-1">
        <DollarSign className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Cost by truck</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Ranked by actual spend (completed work). Open estimates shown separately.
      </p>
      <div className="space-y-2">
        {withSpend.map((row, index) => (
          <div
            key={row.truck_id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 p-3 hover:bg-muted/20 transition"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs font-mono text-muted-foreground w-6">#{index + 1}</span>
              <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
              <Link
                href={`/dashboard/trucks/${row.truck_id}`}
                className="font-medium text-foreground hover:text-primary truncate"
              >
                {row.truck_number ? `Unit ${row.truck_number}` : row.truck_id.slice(0, 8)}
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="text-right">
                <p className="text-[10px] uppercase text-muted-foreground">Actual spent</p>
                <p className="font-semibold text-emerald-400">{formatUsd(row.total_actual_cost)}</p>
              </div>
              {row.total_estimated_cost > 0 && (
                <div className="text-right">
                  <p className="text-[10px] uppercase text-muted-foreground">Open est.</p>
                  <p className="font-semibold text-amber-400">{formatUsd(row.total_estimated_cost)}</p>
                </div>
              )}
              <div className="text-right text-xs text-muted-foreground">
                {row.completed_count} done · {row.open_count} open
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
