import { AppFrame } from "./AppFrame"

type LoadRow = {
  id: string
  route: string
  driver: string
  initials: string
  avatarBg: string
  status: string
  statusStyle: { bg: string; color: string }
  rate: string
  eta: string
  etaColor?: string
}

const LOADS: LoadRow[] = [
  {
    id: "#TM-4821",
    route: "Dallas → Memphis",
    driver: "M. Delgado",
    initials: "MD",
    avatarBg: "rgba(59,130,246,0.25)",
    status: "In Transit",
    statusStyle: { bg: "var(--w-green-bg)", color: "var(--w-green)" },
    rate: "$2,450",
    eta: "Tue 3:40 PM",
  },
  {
    id: "#TM-4830",
    route: "Houston → Atlanta",
    driver: "R. Okafor",
    initials: "RO",
    avatarBg: "rgba(34,211,238,0.2)",
    status: "Loading",
    statusStyle: { bg: "var(--w-amber-bg)", color: "var(--w-amber)" },
    rate: "$3,120",
    eta: "Wed 9:15 AM",
  },
  {
    id: "#TM-4844",
    route: "Phoenix → Denver",
    driver: "T. Vasquez",
    initials: "TV",
    avatarBg: "rgba(16,185,129,0.2)",
    status: "Delayed",
    statusStyle: { bg: "var(--w-red-bg)", color: "var(--w-red)" },
    rate: "$2,890",
    eta: "Delayed 1h",
    etaColor: "var(--w-red)",
  },
  {
    id: "#TM-4848",
    route: "Newark → Columbus",
    driver: "J. Park",
    initials: "JP",
    avatarBg: "rgba(245,158,11,0.2)",
    status: "In Transit",
    statusStyle: { bg: "var(--w-green-bg)", color: "var(--w-green)" },
    rate: "$1,980",
    eta: "Tue 6:20 PM",
  },
  {
    id: "#TM-4851",
    route: "Laredo → San Antonio",
    driver: "L. Romero",
    initials: "LR",
    avatarBg: "rgba(139,92,246,0.2)",
    status: "Delivered",
    statusStyle: { bg: "var(--w-blue-dim)", color: "var(--w-blue)" },
    rate: "$890",
    eta: "Mon 2:00 PM",
  },
  {
    id: "#TM-4855",
    route: "Fresno → Reno",
    driver: "D. Boone",
    initials: "DB",
    avatarBg: "rgba(236,72,153,0.2)",
    status: "In Transit",
    statusStyle: { bg: "var(--w-green-bg)", color: "var(--w-green)" },
    rate: "$1,640",
    eta: "Wed 11:30 AM",
  },
]

const COLS = ["Load", "Route", "Driver", "Status", "Rate", "ETA"] as const

function StatusBadge({ label, style }: { label: string; style: { bg: string; color: string } }) {
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ background: style.bg, color: style.color, fontFamily: "var(--font-jakarta), sans-serif" }}
    >
      {label}
    </span>
  )
}

export function DispatchBoard({ className = "" }: { className?: string }) {
  return (
    <AppFrame className={className} url="app.truckmates.com/dispatch">
      <div className="overflow-x-auto">
        <div
          className="grid min-w-[640px] border-b px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-wide"
          style={{
            gridTemplateColumns: "1fr 1.4fr 1.2fr 0.9fr 0.7fr 0.9fr",
            borderColor: "var(--w-border)",
            color: "var(--w-text-2)",
            fontFamily: "var(--font-bricolage), sans-serif",
          }}
        >
          {COLS.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
        {LOADS.map((row, i) => (
          <div
            key={row.id}
            className="grid min-w-[640px] items-center px-3.5 py-3 text-[13px]"
            style={{
              gridTemplateColumns: "1fr 1.4fr 1.2fr 0.9fr 0.7fr 0.9fr",
              background: i % 2 === 1 ? "rgba(255,255,255,0.015)" : "transparent",
              fontFamily: "var(--font-jakarta), sans-serif",
            }}
          >
            <span
              className="font-medium"
              style={{ color: "var(--w-text)", fontFamily: "var(--font-mono-display), monospace", fontSize: 12 }}
            >
              {row.id}
            </span>
            <span style={{ color: "var(--w-text-2)" }}>{row.route}</span>
            <span className="flex items-center gap-2">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                style={{ background: row.avatarBg, color: "var(--w-text)" }}
              >
                {row.initials}
              </span>
              <span style={{ color: "var(--w-text)" }}>{row.driver}</span>
            </span>
            <StatusBadge label={row.status} style={row.statusStyle} />
            <span
              className="font-medium"
              style={{ color: "var(--w-green)", fontFamily: "var(--font-mono-display), monospace" }}
            >
              {row.rate}
            </span>
            <span style={{ color: row.etaColor ?? "var(--w-text-2)", fontSize: 12 }}>{row.eta}</span>
          </div>
        ))}
      </div>
    </AppFrame>
  )
}
