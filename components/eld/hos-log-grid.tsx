"use client"

import { useMemo } from "react"
import { Card } from "@/components/ui/card"
import type { EldLogLike } from "@/lib/hos/compute-daily-remaining"

const ROWS: { key: string; label: string; className: string }[] = [
  { key: "off_duty", label: "Off duty", className: "bg-emerald-500/85" },
  { key: "sleeper_berth", label: "Sleeper berth", className: "bg-violet-500/85" },
  { key: "driving", label: "Driving", className: "bg-sky-500/90" },
  { key: "on_duty", label: "On duty", className: "bg-amber-400/90" },
]

const MINUTES_PER_DAY = 24 * 60

type Segment = {
  rowKey: string
  leftPct: number
  widthPct: number
}

/** YYYY-MM-DD as UTC day window — matches UTC-stored `start_time` / `end_time` on `eld_logs`. */
function parseLogDateUtcDayBounds(logDate: string): { start: number; end: number } {
  const [y, m, d] = logDate.split("-").map((x) => parseInt(x, 10))
  if (!y || !m || !d) {
    const now = new Date()
    const s = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    return { start: s, end: s + MINUTES_PER_DAY * 60 * 1000 }
  }
  const start = Date.UTC(y, m - 1, d, 0, 0, 0, 0)
  return { start, end: start + MINUTES_PER_DAY * 60 * 1000 }
}

function buildSegments(
  logs: readonly EldLogLike[],
  logDate: string,
  nowMs: number
): Segment[] {
  const { start: dayStart, end: dayEnd } = parseLogDateUtcDayBounds(logDate)
  const timeline = [...logs].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  )
  const out: Segment[] = []

  timeline.forEach((log, idx) => {
    const rowKey = ROWS.some((r) => r.key === log.log_type) ? log.log_type : "off_duty"
    let start = new Date(log.start_time).getTime()
    let end: number
    if (log.end_time) {
      end = new Date(log.end_time).getTime()
    } else {
      const nextStart = timeline[idx + 1]?.start_time
        ? new Date(timeline[idx + 1].start_time).getTime()
        : null
      end = Math.min(nextStart || nowMs, dayEnd)
    }
    start = Math.max(start, dayStart)
    end = Math.min(end, dayEnd)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return

    const fromMidnightMin = (start - dayStart) / 60000
    const durMin = (end - start) / 60000
    out.push({
      rowKey,
      leftPct: (fromMidnightMin / MINUTES_PER_DAY) * 100,
      widthPct: (durMin / MINUTES_PER_DAY) * 100,
    })
  })

  return out
}

type Props = {
  logDate: string
  logs: EldLogLike[]
  /**
   * Reference time for open-ended log segments. Pass `Date.now()` for today (live).
   * Omit for historical days (segments close at end of that calendar day).
   */
  nowMs?: number
}

export function HosLogGrid({ logDate, logs, nowMs }: Props) {
  const referenceMs = useMemo(() => {
    if (nowMs != null) return nowMs
    const { end } = parseLogDateUtcDayBounds(logDate)
    return end - 1
  }, [logDate, nowMs])

  const segments = useMemo(
    () => buildSegments(logs, logDate, referenceMs),
    [logs, logDate, referenceMs]
  )

  return (
    <Card className="border-border bg-card/50 overflow-hidden p-3 md:p-4">
      <div className="mb-2 flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-base font-semibold text-foreground">24h log</h2>
        <p className="text-xs text-muted-foreground">UTC calendar day (matches log timestamps)</p>
      </div>

      <div className="mb-1.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
        {ROWS.map((r) => (
          <span key={r.key} className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-2.5 w-2.5 rounded-sm ${r.className}`} />
            {r.label}
          </span>
        ))}
      </div>

      <div className="relative rounded-md border border-border bg-muted/20">
        <div className="relative ml-28 flex h-6 items-end border-b border-border/80 pb-0.5 pr-1 text-[10px] tabular-nums text-muted-foreground md:ml-36">
          {["12a", "6a", "12p", "6p", "12a"].map((label, i) => (
            <div
              key={label + i}
              className="flex-1 text-center first:text-left last:text-right"
            >
              {label}
            </div>
          ))}
        </div>

        <div className="relative">
          {ROWS.map((row) => (
            <div
              key={row.key}
              className="relative h-9 border-b border-border/40 last:border-b-0"
            >
              <div className="absolute inset-y-0 left-0 flex w-28 shrink-0 items-center border-r border-border/40 bg-muted/30 px-1.5 text-[11px] font-medium text-foreground md:w-36">
                <span className="line-clamp-2 leading-tight">{row.label}</span>
              </div>
              <div className="absolute inset-y-0 left-28 right-0 md:left-36">
                <div className="relative h-full w-full">
                  {segments
                    .filter((s) => s.rowKey === row.key)
                    .map((s, i) => (
                      <div
                        key={`${row.key}-${i}`}
                        className={`absolute top-0.5 bottom-0.5 rounded-sm ${ROWS.find((r) => r.key === row.key)?.className ?? "bg-muted"}`}
                        style={{
                          left: `${s.leftPct}%`,
                          width: `${Math.max(s.widthPct, 0.15)}%`,
                        }}
                        title={`${s.widthPct.toFixed(1)}% of day`}
                      />
                    ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
