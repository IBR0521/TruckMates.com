"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowDownRight, ArrowUpRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { FeatureLock } from "@/components/billing/feature-lock"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  getFleetScorecards,
  getScorecardSnapshotDates,
  generateScorecardOnDemand,
} from "@/app/actions/safety-scorecards"

type Row = NonNullable<Awaited<ReturnType<typeof getFleetScorecards>>["data"]>[number]

function gradeRowClass(grade: string): string {
  switch (grade) {
    case "A":
      return "bg-emerald-500/5"
    case "B":
      return "bg-sky-500/5"
    case "C":
      return "bg-amber-500/5"
    case "D":
      return "bg-orange-500/5"
    case "F":
      return "bg-rose-500/5"
    default:
      return ""
  }
}

export default function FleetSafetyScorecardsPage() {
  const [dates, setDates] = useState<string[]>([])
  const [snapshotDate, setSnapshotDate] = useState<string>("")
  const [sortBy, setSortBy] = useState<"score_asc" | "score_desc" | "rank" | "change_desc">("rank")
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadDates = useCallback(async () => {
    const d = await getScorecardSnapshotDates()
    if (d.error) {
      toast.error(d.error)
      return
    }
    const list = d.data || []
    setDates(list)
    setSnapshotDate((prev) => prev || list[0] || "")
  }, [])

  const loadRows = useCallback(async () => {
    if (!snapshotDate) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    const r = await getFleetScorecards({ snapshotDate, sortBy, limit: 500 })
    setLoading(false)
    if (r.error) {
      toast.error(r.error)
      setRows([])
      return
    }
    setRows(r.data || [])
  }, [snapshotDate, sortBy])

  useEffect(() => {
    void loadDates()
  }, [loadDates])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  const summary = useMemo(() => {
    if (!rows.length) return null
    const avg = rows.reduce((s, x) => s + x.score, 0) / rows.length
    const avgGrade = avg >= 90 ? "A" : avg >= 80 ? "B" : avg >= 70 ? "C" : avg >= 60 ? "D" : "F"
    const top = [...rows].sort((a, b) => a.fleet_rank - b.fleet_rank)[0]
    const withChange = rows.filter((x) => x.score_change_vs_prior != null) as Array<
      Row & { score_change_vs_prior: number }
    >
    const improved =
      withChange.length > 0
        ? withChange.reduce((best, x) => (x.score_change_vs_prior > best.score_change_vs_prior ? x : best))
        : null
    const pool = rows.filter((x) => x.miles_driven >= 200)
    const bottomSource = pool.length ? pool : rows
    const needs = bottomSource.reduce((min, x) => (x.score < min.score ? x : min), bottomSource[0])
    return { avg, avgGrade, top, improved, needs }
  }, [rows])

  async function onRefresh() {
    setRefreshing(true)
    const r = await generateScorecardOnDemand()
    setRefreshing(false)
    if (r.error) return toast.error(r.error)
    toast.success(`Refreshed: ${r.data?.generated ?? 0} drivers processed.`)
    void loadDates()
    void loadRows()
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <FeatureLock
        featureKey="driver_safety_scorecards"
        title="Driver safety scorecards"
        description="Upgrade to Professional or Fleet for rolling scorecards, coaching records, and fleet ranking."
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Driver safety scorecards</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Fleet leaderboard from nightly snapshots (UTC). Scores blend harsh driving, speeding, and HOS signals per
              thousand miles with a documented decay model.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={snapshotDate} onValueChange={setSnapshotDate} disabled={dates.length === 0}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Snapshot date" />
              </SelectTrigger>
              <SelectContent>
                {dates.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rank">Sort: Fleet rank</SelectItem>
                <SelectItem value="score_desc">Sort: Score high → low</SelectItem>
                <SelectItem value="score_asc">Sort: Score low → high</SelectItem>
                <SelectItem value="change_desc">Sort: Week-over-week gain</SelectItem>
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="sm" disabled={refreshing} onClick={() => void onRefresh()}>
              {refreshing ? "Refreshing…" : "Refresh now"}
            </Button>
          </div>
        </div>

        {summary ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/70 bg-card/80 p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Fleet average</p>
              <p className="mt-2 text-2xl font-bold text-foreground">
                {summary.avg.toFixed(1)} <span className="text-muted-foreground">/ {summary.avgGrade}</span>
              </p>
            </Card>
            <Card className="border-border/70 bg-card/80 p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Top performer</p>
              <p className="mt-2 truncate text-lg font-semibold text-foreground">{summary.top.driver_name}</p>
              <p className="text-sm text-emerald-600 dark:text-emerald-400">{summary.top.score.toFixed(1)}</p>
            </Card>
            <Card className="border-border/70 bg-card/80 p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Most improved (vs prior week)</p>
              {summary.improved ? (
                <>
                  <p className="mt-2 truncate text-lg font-semibold text-foreground">{summary.improved.driver_name}</p>
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">
                    +{summary.improved.score_change_vs_prior?.toFixed(1)}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No week-over-week data on this snapshot.</p>
              )}
            </Card>
            <Card className="border-border/70 bg-card/80 p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Coaching support</p>
              <p className="mt-2 truncate text-lg font-semibold text-foreground">{summary.needs.driver_name}</p>
              <p className="text-sm text-muted-foreground">
                May benefit from extra coaching this period — lowest score among drivers with meaningful miles.
              </p>
            </Card>
          </div>
        ) : null}

        <Card className="border-border/70 bg-card/80 overflow-hidden">
          {loading ? (
            <div className="p-8 text-sm text-muted-foreground">Loading leaderboard…</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-sm text-muted-foreground">
              No scorecards for this date yet. Cron runs nightly at 07:00 UTC, or use Refresh (once per company per
              UTC day).
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">Rank</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead className="text-right">Trend</TableHead>
                  <TableHead className="text-right">Miles</TableHead>
                  <TableHead className="text-right">Events</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const ch = r.score_change_vs_prior
                  return (
                    <TableRow key={r.driver_id} className={gradeRowClass(r.letter_grade)}>
                      <TableCell className="font-medium">{r.fleet_rank}</TableCell>
                      <TableCell className="font-medium">{r.driver_name}</TableCell>
                      <TableCell className="text-right">
                        {r.data_confidence === "low" && r.miles_driven < 500 ? "—" : r.score.toFixed(1)}
                      </TableCell>
                      <TableCell>{r.letter_grade}</TableCell>
                      <TableCell className="text-right">
                        {ch == null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : ch > 0 ? (
                          <span className="inline-flex items-center justify-end gap-1 text-emerald-600 dark:text-emerald-400">
                            +{ch.toFixed(1)}
                            <ArrowUpRight className="h-4 w-4" aria-hidden />
                          </span>
                        ) : ch < 0 ? (
                          <span className="inline-flex items-center justify-end gap-1 text-rose-600 dark:text-rose-400">
                            {ch.toFixed(1)}
                            <ArrowDownRight className="h-4 w-4" aria-hidden />
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{r.miles_driven.toFixed(0)}</TableCell>
                      <TableCell className="text-right">{r.total_events}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/dashboard/drivers/${r.driver_id}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </FeatureLock>
    </div>
  )
}
