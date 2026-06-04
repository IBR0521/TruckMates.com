"use client"

import {
  Bot,
  DollarSign,
  FileText,
  LayoutDashboard,
  Map,
  Truck,
} from "lucide-react"
import { AppFrame } from "./AppFrame"

const NAV_ICONS = [
  { icon: LayoutDashboard, active: true },
  { icon: Truck, active: false },
  { icon: Map, active: false },
  { icon: FileText, active: false },
  { icon: DollarSign, active: false },
  { icon: Bot, active: false },
] as const

const TRUCKS = [
  { top: "18%", left: "22%", status: "green", pulse: true },
  { top: "32%", left: "38%", status: "green", pulse: true },
  { top: "45%", left: "55%", status: "green", pulse: true },
  { top: "28%", left: "68%", status: "green", pulse: false },
  { top: "58%", left: "42%", status: "green", pulse: false },
  { top: "52%", left: "72%", status: "amber", pulse: false },
  { top: "38%", left: "82%", status: "amber", pulse: false },
  { top: "65%", left: "28%", status: "red", pulse: false, selected: true },
] as const

const STATUS_COLORS = {
  green: { bg: "var(--w-green-bg)", border: "var(--w-green)", icon: "var(--w-green)" },
  amber: { bg: "var(--w-amber-bg)", border: "var(--w-amber)", icon: "var(--w-amber)" },
  red: { bg: "var(--w-red-bg)", border: "var(--w-red)", icon: "var(--w-red)" },
} as const

const LOADS = [
  { id: "#TM-4821", route: "Dallas → Memphis", status: "In Transit", style: "green" as const },
  { id: "#TM-4830", route: "Houston → Atlanta", status: "Loading", style: "amber" as const },
  { id: "#TM-4848", route: "Newark → Columbus", status: "Delivered", style: "blue" as const },
]

const BADGE = {
  green: { bg: "var(--w-green-bg)", color: "var(--w-green)" },
  amber: { bg: "var(--w-amber-bg)", color: "var(--w-amber)" },
  blue: { bg: "var(--w-blue-dim)", color: "var(--w-blue)" },
}

function TruckMarker({
  top,
  left,
  status,
  pulse,
  selected,
}: {
  top: string
  left: string
  status: keyof typeof STATUS_COLORS
  pulse: boolean
  selected?: boolean
}) {
  const c = STATUS_COLORS[status]
  return (
    <div className="absolute z-10" style={{ top, left }}>
      <div
        className={`flex items-center justify-center rounded-md border ${pulse ? "w-truck-pulse" : ""} ${selected ? "h-[22px] w-[22px]" : "h-[18px] w-[18px]"}`}
        style={{
          background: c.bg,
          borderColor: c.border,
        }}
      >
        <Truck className={selected ? "h-3 w-3" : "h-2.5 w-2.5"} style={{ color: c.icon }} />
      </div>
      {selected ? (
        <div
          className="absolute top-full left-1/2 z-20 mt-2 w-[140px] -translate-x-1/2 rounded-lg border p-2 shadow-lg"
          style={{
            background: "var(--w-card-2)",
            borderColor: "var(--w-border-md)",
          }}
        >
          <p
            className="text-[10px] font-semibold text-[var(--w-text)]"
            style={{ fontFamily: "var(--font-mono-display), monospace" }}
          >
            Unit 247 · M. Delgado
          </p>
          <p
            className="text-[10px] text-[var(--w-text-2)]"
            style={{ fontFamily: "var(--font-mono-display), monospace" }}
          >
            I-10 W · 64 mph
          </p>
          <p
            className="text-[10px]"
            style={{ color: "var(--w-green)", fontFamily: "var(--font-mono-display), monospace" }}
          >
            HOS: 6h 12m
          </p>
        </div>
      ) : null}
    </div>
  )
}

export function CommandCenter({ className = "" }: { className?: string }) {
  return (
    <AppFrame className={className}>
      <div className="flex min-h-0 flex-col md:flex-row">
        {/* Icon rail */}
        <div
          className="hidden shrink-0 flex-col items-center gap-4 border-r py-4 sm:flex"
          style={{ width: 52, background: "var(--w-bg-3)", borderColor: "var(--w-border)" }}
        >
          <div className="h-2 w-2 rounded-full" style={{ background: "var(--w-blue)" }} />
          {NAV_ICONS.map(({ icon: Icon, active }, i) => (
            <div key={i} className="relative flex w-full justify-center">
              {active ? (
                <span
                  className="absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-r"
                  style={{ background: "var(--w-blue)" }}
                />
              ) : null}
              <Icon
                className="h-5 w-5"
                style={{ color: active ? "var(--w-blue)" : "var(--w-text-3)" }}
                strokeWidth={1.75}
              />
            </div>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          {/* Top strip */}
          <div
            className="flex h-[52px] flex-wrap items-center justify-between gap-2 border-b px-4"
            style={{ borderColor: "var(--w-border)" }}
          >
            <span
              className="text-[15px] font-semibold text-[var(--w-text)]"
              style={{ fontFamily: "var(--font-bricolage), sans-serif" }}
            >
              Fleet Command
            </span>
            <div className="flex flex-wrap gap-3 text-[12px]" style={{ fontFamily: "var(--font-mono-display), monospace" }}>
              <span className="flex items-center gap-1.5" style={{ color: "var(--w-text-2)" }}>
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--w-green)]" />
                18 Active
              </span>
              <span className="flex items-center gap-1.5" style={{ color: "var(--w-text-2)" }}>
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--w-amber)]" />
                2 Idle
              </span>
              <span className="flex items-center gap-1.5" style={{ color: "var(--w-text-2)" }}>
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--w-red)]" />
                1 Alert
              </span>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row">
            {/* Fleet map */}
            <div
              className="relative min-h-[280px] flex-[1.6] lg:min-h-[360px]"
              style={{
                background: "radial-gradient(circle at 30% 40%, #0d1a2e, #06080f)",
              }}
            >
              <svg className="absolute inset-0 h-full w-full" aria-hidden>
                <path
                  d="M 40 80 Q 120 60 200 90 T 360 70"
                  fill="none"
                  stroke="var(--w-border-md)"
                  strokeWidth="0.5"
                />
                <path
                  d="M 60 200 Q 150 180 240 210 T 400 190"
                  fill="none"
                  stroke="var(--w-border-md)"
                  strokeWidth="0.5"
                />
                <path
                  d="M 80 120 L 180 100 L 280 130 L 380 110"
                  fill="none"
                  stroke="var(--w-cyan)"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  opacity="0.5"
                />
                <path
                  d="M 50 160 L 150 140 L 250 170 L 350 150"
                  fill="none"
                  stroke="var(--w-cyan)"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  opacity="0.4"
                />
                <path
                  d="M 100 60 L 200 80 L 300 50"
                  fill="none"
                  stroke="var(--w-cyan)"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                  opacity="0.35"
                />
              </svg>

              {TRUCKS.map((t, i) => (
                <TruckMarker
                  key={i}
                  top={t.top}
                  left={t.left}
                  status={t.status}
                  pulse={t.pulse}
                  selected={"selected" in t && t.selected}
                />
              ))}

              <div
                className="absolute bottom-3 left-3 flex gap-3 text-[10px]"
                style={{ color: "var(--w-text-3)", fontFamily: "var(--font-mono-display), monospace" }}
              >
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--w-green)]" />
                  Moving
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--w-amber)]" />
                  Idle
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--w-red)]" />
                  Alert
                </span>
              </div>
            </div>

            {/* Right column */}
            <div
              className="flex flex-[1] flex-col gap-3 border-t p-3.5 lg:border-t-0 lg:border-l"
              style={{
                background: "var(--w-bg-2)",
                borderColor: "var(--w-border)",
              }}
            >
              <div>
                <p
                  className="text-[11px] font-semibold uppercase tracking-wide"
                  style={{ color: "var(--w-text-2)", fontFamily: "var(--font-bricolage), sans-serif" }}
                >
                  Live Loads
                </p>
                <div className="mt-2 space-y-2">
                  {LOADS.map((load) => {
                    const b = BADGE[load.style]
                    return (
                      <div key={load.id} className="flex items-start justify-between gap-2">
                        <div>
                          <p
                            className="text-[12px] font-medium text-[var(--w-text)]"
                            style={{ fontFamily: "var(--font-mono-display), monospace" }}
                          >
                            {load.id}
                          </p>
                          <p
                            className="text-[11px]"
                            style={{ color: "var(--w-text-2)", fontFamily: "var(--font-jakarta), sans-serif" }}
                          >
                            {load.route}
                          </p>
                        </div>
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{ background: b.bg, color: b.color }}
                        >
                          {load.status}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div>
                <p
                  className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide"
                  style={{ color: "var(--w-text-2)", fontFamily: "var(--font-bricolage), sans-serif" }}
                >
                  <Bot className="h-3 w-3 text-[var(--w-blue)]" />
                  AI Assistant
                </p>
                <div className="mt-2 space-y-1.5">
                  <p
                    className="ml-4 rounded-md px-2 py-1.5 text-right text-[11px] leading-snug text-[var(--w-text)]"
                    style={{
                      background: "var(--w-blue-dim)",
                      fontFamily: "var(--font-jakarta), sans-serif",
                    }}
                  >
                    Who can cover load #4830 out of Houston?
                  </p>
                  <p
                    className="rounded-md border-l-2 px-2 py-1.5 text-[11px] leading-snug text-[var(--w-text)]"
                    style={{
                      background: "var(--w-card-2)",
                      borderLeftColor: "var(--w-blue)",
                      fontFamily: "var(--font-jakarta), sans-serif",
                    }}
                  >
                    R. Okafor — 8h 40m HOS, 12 mi from pickup, dry van. Assign?
                  </p>
                </div>
              </div>

              <div>
                <p
                  className="text-[11px] font-semibold uppercase tracking-wide"
                  style={{ color: "var(--w-text-2)", fontFamily: "var(--font-bricolage), sans-serif" }}
                >
                  Compliance
                </p>
                <div className="mt-2 space-y-2">
                  {[
                    { name: "M. Delgado", pct: 70, color: "var(--w-green)", label: "6h 12m" },
                    { name: "T. Vasquez", pct: 22, color: "var(--w-amber)", label: "1h 48m" },
                  ].map((row) => (
                    <div key={row.name}>
                      <div className="mb-0.5 flex justify-between text-[10px]">
                        <span style={{ color: "var(--w-text)", fontFamily: "var(--font-jakarta), sans-serif" }}>
                          {row.name}
                        </span>
                        <span
                          style={{
                            color: row.color,
                            fontFamily: "var(--font-mono-display), monospace",
                          }}
                        >
                          {row.label}
                        </span>
                      </div>
                      <div
                        className="h-1.5 overflow-hidden rounded-full"
                        style={{ background: "rgba(255,255,255,0.06)" }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${row.pct}%`, background: row.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppFrame>
  )
}
