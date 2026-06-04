import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MarketingPreviewFrame } from "./marketing-preview-frame"

const HOS = [
  { name: "M. Delgado", pct: 70, label: "6h 12m", bar: "bg-emerald-500" },
  { name: "T. Vasquez", pct: 22, label: "1h 48m", bar: "bg-amber-500" },
  { name: "J. Park", pct: 12, label: "48m", bar: "bg-rose-500" },
] as const

const DOCS = [
  { item: "Unit 312 — Registration", status: "18 days", variant: "warning" as const },
  { item: "Unit 089 — Insurance", status: "4 days", variant: "destructive" as const },
]

export function CompliancePreview({ className }: { className?: string }) {
  return (
    <MarketingPreviewFrame className={className} url="app.truckmates.com/eld">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">Compliance monitor</h3>
          <Badge variant="outline" className="border-rose-500/40 bg-rose-500/10 text-rose-400 text-[10px]">
            1 alert
          </Badge>
        </div>

        <Card className="border-border/60 bg-card/70 p-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/90">HOS</p>
          <div className="mt-2 space-y-2">
            {HOS.map((row) => (
              <div key={row.name}>
                <div className="mb-0.5 flex justify-between text-xs">
                  <span className="text-foreground">{row.name}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{row.label}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted/40">
                  <div className={`h-full rounded-full ${row.bar}`} style={{ width: `${row.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="border-border/60 bg-card/70 p-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/90">
            Document expiry
          </p>
          <ul className="mt-2 space-y-1.5">
            {DOCS.map((d) => (
              <li key={d.item} className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate text-foreground">{d.item}</span>
                <Badge
                  variant="outline"
                  className={
                    d.variant === "warning"
                      ? "shrink-0 border-amber-500/35 bg-amber-500/8 text-amber-400 text-[10px]"
                      : "shrink-0 border-rose-500/35 bg-rose-500/8 text-rose-400 text-[10px]"
                  }
                >
                  {d.status}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </MarketingPreviewFrame>
  )
}
