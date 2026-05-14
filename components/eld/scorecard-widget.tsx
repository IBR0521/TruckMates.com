"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Card } from "@/components/ui/card"
import { FeatureLock } from "@/components/billing/feature-lock"
import { getFleetScorecards } from "@/app/actions/safety-scorecards"

export function ScorecardWidget() {
  const [avg, setAvg] = useState<number | null>(null)
  const [gradeHint, setGradeHint] = useState<string>("")
  const [top, setTop] = useState<Array<{ name: string; score: number }>>([])
  const [support, setSupport] = useState<Array<{ name: string; score: number }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    void getFleetScorecards({ sortBy: "rank", limit: 200 }).then((r) => {
      if (!alive) return
      setLoading(false)
      if (r.error || !r.data?.length) {
        setAvg(null)
        setTop([])
        setSupport([])
        return
      }
      const rows = r.data
      const mean = rows.reduce((s, x) => s + x.score, 0) / rows.length
      setAvg(Math.round(mean * 10) / 10)
      setGradeHint(mean >= 90 ? "A" : mean >= 80 ? "B" : mean >= 70 ? "C" : mean >= 60 ? "D" : "F")
      setTop(rows.slice(0, 3).map((x) => ({ name: x.driver_name, score: x.score })))
      const tail = [...rows].sort((a, b) => a.score - b.score).slice(0, 2)
      setSupport(tail.map((x) => ({ name: x.driver_name, score: x.score })))
    })
    return () => {
      alive = false
    }
  }, [])

  return (
    <FeatureLock
      featureKey="driver_safety_scorecards"
      title="Driver safety scorecards"
      description="See fleet-wide safety scores on Professional and Fleet."
    >
      <Card className="border-border/70 bg-card/80 p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/90">
              Safety scorecards
            </p>
            {loading ? (
              <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
            ) : avg == null ? (
              <p className="mt-2 text-sm text-muted-foreground">No snapshots yet. Nightly job will populate data.</p>
            ) : (
              <p className="mt-2 text-2xl font-bold text-foreground">
                {avg.toFixed(1)} <span className="text-lg font-semibold text-muted-foreground">/ {gradeHint}</span>
              </p>
            )}
          </div>
        </div>
        {!loading && avg != null ? (
          <div className="mt-4 grid gap-4 border-t border-border/40 pt-4 md:grid-cols-2">
            <div>
              <p className="text-[11px] font-medium uppercase text-muted-foreground">Top performers</p>
              <ol className="mt-2 space-y-1 text-sm">
                {top.map((t, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="truncate text-foreground">{i + 1}. {t.name}</span>
                    <span className="shrink-0 font-medium text-emerald-600 dark:text-emerald-400">{t.score.toFixed(1)}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase text-muted-foreground">Coaching support</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {support.map((t, i) => (
                  <li key={`${t.name}-${i}`} className="flex justify-between gap-2">
                    <span className="truncate">{t.name}</span>
                    <span className="shrink-0 font-medium text-foreground">{t.score.toFixed(1)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                Lowest scores on this snapshot — good candidates for proactive coaching, not discipline labels.
              </p>
            </div>
          </div>
        ) : null}
        <Link
          href="/dashboard/eld/scorecards"
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          View full scorecards
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </Card>
    </FeatureLock>
  )
}
