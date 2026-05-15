"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { FeatureLock } from "@/components/billing/feature-lock"
import { getDwellTimeReport } from "@/app/actions/geofences"
import { Clock, ArrowRight } from "lucide-react"

export function DwellTimeWidget() {
  const [rows, setRows] = useState<
    Array<{
      group_key: string
      group_label: string
      total_dwell_hours: number
      detention_candidate_count: number
    }>
  >([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void getDwellTimeReport({ daysBack: 30, groupBy: "customer" }).then((r) => {
      if (!alive) return
      if (r.error) setErr(r.error)
      setRows((r.data ?? []).slice(0, 5))
    })
    return () => {
      alive = false
    }
  }, [])

  return (
    <FeatureLock
      featureKey="geofencing_automation"
      title="Geofence dwell (approx.)"
      description="Dwell totals are inferred from ELD telemetry spacing — useful for detention conversations, not legal precision."
    >
      <Card className="border-border/70 bg-card/80 p-4 md:p-6">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Top dwell (30d)</h3>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/billing/detention-candidates" className="text-xs">
              Detention candidates <ArrowRight className="h-3 w-3 ml-1 inline" />
            </Link>
          </Button>
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        {!err && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">No exit dwell data yet — geofence cron needs telemetry + exit events.</p>
        )}
        <ul className="space-y-2 text-sm">
          {rows.map((r) => (
            <li key={r.group_key} className="flex justify-between gap-2 border-b border-border/40 pb-2 last:border-0">
              <span className="truncate text-muted-foreground">{r.group_label}</span>
              <span className="shrink-0 font-medium">
                {r.total_dwell_hours}h ·{" "}
                <span className={r.detention_candidate_count > 0 ? "text-amber-500" : ""}>
                  {r.detention_candidate_count} candidate{r.detention_candidate_count === 1 ? "" : "s"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </FeatureLock>
  )
}
