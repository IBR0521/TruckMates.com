import { Card } from "@/components/ui/card"
import { StatusBadge } from "@/components/dashboard/detail-page-layout"
import { MarketingPreviewFrame } from "./marketing-preview-frame"

type LoadRow = {
  id: string
  route: string
  driver: string
  initials: string
  status: string
  variant: "success" | "warning" | "danger" | "info" | "default"
  rate: string
  eta: string
  etaVariant?: "danger"
}

const LOADS: LoadRow[] = [
  { id: "#TM-4821", route: "Dallas → Memphis", driver: "M. Delgado", initials: "MD", status: "In Transit", variant: "info", rate: "$2,450", eta: "Tue 3:40 PM" },
  { id: "#TM-4830", route: "Houston → Atlanta", driver: "R. Okafor", initials: "RO", status: "Loading", variant: "warning", rate: "$3,120", eta: "Wed 9:15 AM" },
  { id: "#TM-4844", route: "Phoenix → Denver", driver: "T. Vasquez", initials: "TV", status: "Delayed", variant: "danger", rate: "$2,890", eta: "Delayed 1h", etaVariant: "danger" },
  { id: "#TM-4848", route: "Newark → Columbus", driver: "J. Park", initials: "JP", status: "In Transit", variant: "info", rate: "$1,980", eta: "Tue 6:20 PM" },
]

export function DispatchPreview({ className }: { className?: string }) {
  return (
    <MarketingPreviewFrame className={className} url="app.truckmates.com/dispatches">
      <Card className="overflow-hidden border-border/60 bg-card/70 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/20">
                {["Load", "Route", "Driver", "Status", "Rate"].map((col) => (
                  <th
                    key={col}
                    className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/90"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LOADS.map((row, i) => (
                <tr key={row.id} className={i % 2 === 1 ? "bg-muted/10" : undefined}>
                  <td className="px-3 py-2.5 font-mono text-xs font-medium text-foreground">{row.id}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{row.route}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[9px] font-semibold text-primary">
                        {row.initials}
                      </span>
                      <span className="text-xs text-foreground">{row.driver}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={row.status} variant={row.variant} />
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs font-medium text-emerald-400">{row.rate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </MarketingPreviewFrame>
  )
}
