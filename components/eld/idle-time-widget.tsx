"use client"

import { useEffect, useState } from "react"
import { Timer } from "lucide-react"
import { Card } from "@/components/ui/card"
import { FeatureLock } from "@/components/billing/feature-lock"
import { getIdleSessionSummary } from "@/app/actions/eld-events"

export function IdleTimeWidget() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getIdleSessionSummary>>["data"]>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    async function load() {
      const res = await getIdleSessionSummary({ daysBack: 7 })
      if (!alive) return
      if (res.error) {
        setError(res.error)
        return
      }
      setData(res.data)
      setError(null)
    }
    void load()
    return () => {
      alive = false
    }
  }, [])

  return (
    <FeatureLock
      featureKey="eld_idle_tracking"
      title="Idle time & fuel waste"
      description="Estimated idle from ELD samples (Professional+). Upgrade to unlock cost signals."
    >
      <Card className="border-border/70 bg-card/70 p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/90">Idle — last 7 days</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{error ? "—" : `${data?.total_idle_hours ?? 0} h`}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {error
                ? error
                : `Est. fuel ${data?.total_fuel_gallons ?? 0} gal · ~$${(data?.total_fuel_cost_usd ?? 0).toLocaleString()}`}
            </p>
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground/90">
              Idle data is estimated from periodic ELD samples and may not capture brief idle periods.
            </p>
            {data && data.top_trucks.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-foreground/90">
                {data.top_trucks.map((t) => (
                  <li key={t.truck_id} className="flex justify-between gap-2">
                    <span className="truncate">{t.truck_number}</span>
                    <span className="shrink-0 text-muted-foreground">{(t.idle_seconds / 3600).toFixed(1)} h</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-2 text-sky-400">
            <Timer className="h-4 w-4" aria-hidden />
          </div>
        </div>
      </Card>
    </FeatureLock>
  )
}
