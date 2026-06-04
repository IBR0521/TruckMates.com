const METRICS = [
  {
    label: "Revenue (MTD)",
    value: "$248,500",
    delta: "↑ 12%",
    deltaColor: "var(--w-green)",
    valueColor: "var(--w-green)",
    spark: [28, 35, 42, 52],
  },
  {
    label: "Loads Delivered",
    value: "1,284",
    delta: "↑ 8%",
    deltaColor: "var(--w-green)",
    valueColor: "var(--w-text)",
    spark: [30, 38, 44, 50],
  },
  {
    label: "On-Time %",
    value: "96.2%",
    delta: "↑ 1.4%",
    deltaColor: "var(--w-green)",
    valueColor: "var(--w-text)",
    spark: [40, 42, 44, 46],
  },
  {
    label: "Open Violations",
    value: "0",
    delta: "Last 30 days",
    deltaColor: "var(--w-text-2)",
    valueColor: "var(--w-text)",
    spark: null,
  },
] as const

function Sparkline({ heights }: { heights: number[] }) {
  return (
    <svg width="48" height="24" viewBox="0 0 48 24" className="mt-3" aria-hidden>
      {heights.map((h, i) => (
        <rect
          key={i}
          x={i * 12 + 2}
          y={24 - h * 0.45}
          width={8}
          height={h * 0.45}
          rx={1}
          fill="var(--w-green)"
          opacity={0.5 + i * 0.12}
        />
      ))}
    </svg>
  )
}

export function MetricsRow({ className = "" }: { className?: string }) {
  return (
    <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 ${className}`}>
      {METRICS.map((m) => (
        <div
          key={m.label}
          className="rounded-xl border p-[18px]"
          style={{ background: "var(--w-card)", borderColor: "var(--w-border)" }}
        >
          <p
            className="text-xs font-medium uppercase tracking-wide"
            style={{ color: "var(--w-text-2)", fontFamily: "var(--font-jakarta), sans-serif" }}
          >
            {m.label}
          </p>
          <p
            className="mt-2 text-[28px] leading-none font-medium"
            style={{ color: m.valueColor, fontFamily: "var(--font-mono-display), monospace" }}
          >
            {m.value}
          </p>
          <p
            className="mt-1 text-[11px]"
            style={{ color: m.deltaColor, fontFamily: "var(--font-mono-display), monospace" }}
          >
            {m.delta}
          </p>
          {m.spark ? <Sparkline heights={[...m.spark]} /> : null}
        </div>
      ))}
    </div>
  )
}
