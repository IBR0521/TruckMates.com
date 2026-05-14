"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowDownRight, ArrowUpRight, ShieldAlert } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FeatureLock } from "@/components/billing/feature-lock"
import { getHarshEventsForCompany } from "@/app/actions/eld-events"

const TYPE_LABEL: Record<string, string> = {
  harsh_brake: "Harsh brakes",
  harsh_acceleration: "Harsh acceleration",
  harsh_cornering: "Harsh cornering",
  speeding: "Speeding",
  mobile_usage: "Mobile usage",
  seatbelt_violation: "Seatbelt",
  following_distance: "Following distance",
  rolling_stop: "Rolling stops",
  other: "Other",
}

function formatTopTypes(byType: Record<string, number>): string {
  const entries = Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 3)
  if (entries.length === 0) return "No events synced yet"
  return entries.map(([k, n]) => `${n} ${TYPE_LABEL[k] || k}`).join(" · ")
}

export function HarshEventsWidget() {
  const [currTotal, setCurrTotal] = useState(0)
  const [prevTotal, setPrevTotal] = useState(0)
  const [byType, setByType] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    async function load() {
      const res = await getHarshEventsForCompany({ daysBack: 14, limit: 500 })
      if (!alive) return
      if (res.error) {
        setError(res.error)
        return
      }
      const now = Date.now()
      const d7 = now - 7 * 86400000
      const d14 = now - 14 * 86400000
      let c = 0
      let p = 0
      const types: Record<string, number> = {}
      for (const ev of res.data || []) {
        const t = new Date(ev.occurred_at).getTime()
        if (!Number.isFinite(t)) continue
        if (t >= d7) {
          c += 1
          types[ev.event_type] = (types[ev.event_type] || 0) + 1
        } else if (t >= d14) {
          p += 1
        }
      }
      setCurrTotal(c)
      setPrevTotal(p)
      setByType(types)
      setError(null)
    }
    void load()
    return () => {
      alive = false
    }
  }, [])

  const trend = currTotal > prevTotal ? "up" : currTotal < prevTotal ? "down" : "flat"

  return (
    <FeatureLock
      featureKey="eld_harsh_events"
      title="Harsh driving events"
      description="Sync safety events from Samsara, Motive, and Geotab on Professional+ to see trends here."
    >
      <Card className="border-border/70 bg-card/70 p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/90">Safety — last 7 days</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{error ? "—" : currTotal}</p>
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {error ? error : formatTopTypes(byType)}
            </p>
            <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
              vs prior 7 days:{" "}
              {trend === "up" ? (
                <span className="inline-flex items-center text-amber-500">
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                  higher
                </span>
              ) : trend === "down" ? (
                <span className="inline-flex items-center text-emerald-500">
                  <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />
                  lower
                </span>
              ) : (
                <span>flat</span>
              )}
            </p>
          </div>
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-rose-400">
            <ShieldAlert className="h-4 w-4" aria-hidden />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" size="sm" className="h-8 text-xs" asChild>
            <Link href="/dashboard/eld/safety">View all events</Link>
          </Button>
        </div>
      </Card>
    </FeatureLock>
  )
}
