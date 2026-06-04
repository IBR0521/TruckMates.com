import type { ReactNode } from "react"
import { Bell, LayoutGrid } from "lucide-react"

export function AppFrame({
  children,
  className = "",
  url = "app.truckmates.com/dashboard",
}: {
  children: ReactNode
  className?: string
  url?: string
}) {
  return (
    <div
      className={`overflow-hidden rounded-[14px] border ${className}`}
      style={{
        background: "var(--w-card)",
        borderColor: "var(--w-border-md)",
        boxShadow: "0 40px 120px -20px rgba(0,0,0,0.8), 0 0 0 1px var(--w-border)",
      }}
    >
      <div
        className="flex h-[38px] items-center justify-between border-b px-3"
        style={{ background: "var(--w-bg-3)", borderColor: "var(--w-border)" }}
      >
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#EF4444", opacity: 0.5 }} />
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#F59E0B", opacity: 0.5 }} />
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#10B981", opacity: 0.5 }} />
        </div>
        <span
          className="hidden rounded-full px-3 py-0.5 text-[11px] sm:inline"
          style={{
            background: "rgba(255,255,255,0.04)",
            color: "var(--w-text-3)",
            fontFamily: "var(--font-mono-display), monospace",
          }}
        >
          {url}
        </span>
        <div className="flex items-center gap-2" style={{ color: "var(--w-text-3)" }}>
          <LayoutGrid className="h-3.5 w-3.5" />
          <Bell className="h-3.5 w-3.5" />
        </div>
      </div>
      {children}
    </div>
  )
}
