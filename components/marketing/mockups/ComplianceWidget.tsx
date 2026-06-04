import { AppFrame } from "./AppFrame"

const HOS_ROWS = [
  { name: "M. Delgado", pct: 70, color: "var(--w-green)", label: "6h 12m" },
  { name: "R. Okafor", pct: 55, color: "var(--w-green)", label: "8h 40m" },
  { name: "T. Vasquez", pct: 22, color: "var(--w-amber)", label: "1h 48m" },
  { name: "J. Park", pct: 12, color: "var(--w-red)", label: "48m" },
] as const

const DOCS = [
  { item: "Unit 312 — Registration", status: "Expires in 18 days", color: "var(--w-amber)" },
  { item: "M. Delgado — Medical Cert", status: "Valid · 240 days", color: "var(--w-green)" },
  { item: "Unit 089 — Insurance", status: "Expires in 4 days", color: "var(--w-red)" },
] as const

const CSA_BARS = [
  { h: 28, color: "var(--w-green)" },
  { h: 22, color: "var(--w-green)" },
  { h: 35, color: "var(--w-blue)" },
  { h: 18, color: "var(--w-green)" },
  { h: 42, color: "var(--w-amber)" },
  { h: 24, color: "var(--w-green)" },
  { h: 20, color: "var(--w-green)" },
] as const

export function ComplianceWidget({ className = "" }: { className?: string }) {
  return (
    <AppFrame className={className} url="app.truckmates.com/compliance">
      <div className="space-y-5 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3
            className="text-sm font-semibold text-[var(--w-text)]"
            style={{ fontFamily: "var(--font-bricolage), sans-serif" }}
          >
            Compliance Monitor
          </h3>
          <span
            className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
            style={{ background: "var(--w-red-bg)", color: "var(--w-red)" }}
          >
            1 Alert
          </span>
        </div>

        <div>
          <p
            className="mb-3 text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--w-text-2)", fontFamily: "var(--font-bricolage), sans-serif" }}
          >
            HOS clocks
          </p>
          <div className="space-y-2.5">
            {HOS_ROWS.map((row) => (
              <div key={row.name} className="flex items-center gap-3">
                <span
                  className="w-24 shrink-0 text-[12px]"
                  style={{ color: "var(--w-text)", fontFamily: "var(--font-jakarta), sans-serif" }}
                >
                  {row.name}
                </span>
                <div
                  className="h-2 flex-1 overflow-hidden rounded-full"
                  style={{ background: "rgba(255,255,255,0.06)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${row.pct}%`, background: row.color }}
                  />
                </div>
                <span
                  className="w-12 shrink-0 text-right text-[11px]"
                  style={{ color: row.color, fontFamily: "var(--font-mono-display), monospace" }}
                >
                  {row.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p
            className="mb-3 text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--w-text-2)", fontFamily: "var(--font-bricolage), sans-serif" }}
          >
            Document expiry
          </p>
          <div className="space-y-2">
            {DOCS.map((d) => (
              <div
                key={d.item}
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[12px]"
                style={{ background: "rgba(255,255,255,0.02)" }}
              >
                <span style={{ color: "var(--w-text)", fontFamily: "var(--font-jakarta), sans-serif" }}>
                  {d.item}
                </span>
                <span style={{ color: d.color, fontFamily: "var(--font-jakarta), sans-serif", fontSize: 11 }}>
                  {d.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p
            className="mb-2 text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--w-text-2)", fontFamily: "var(--font-bricolage), sans-serif" }}
          >
            CSA BASICs
          </p>
          <div className="relative flex h-16 items-end justify-between gap-1 px-1">
            <div
              className="pointer-events-none absolute right-0 left-0 border-t border-dashed"
              style={{ top: "35%", borderColor: "var(--w-amber)", opacity: 0.5 }}
              aria-hidden
            />
            {CSA_BARS.map((bar, i) => (
              <div
                key={i}
                className="w-full max-w-[28px] rounded-t"
                style={{ height: bar.h, background: bar.color, opacity: 0.85 }}
              />
            ))}
          </div>
        </div>
      </div>
    </AppFrame>
  )
}
