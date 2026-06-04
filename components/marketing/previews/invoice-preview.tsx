import { Card } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { MarketingPreviewFrame } from "./marketing-preview-frame"

const LINE_ITEMS = [
  { label: "Linehaul", amount: "$2,800.00" },
  { label: "Fuel surcharge", amount: "$320.00" },
  { label: "Detention", amount: "$120.00" },
] as const

export function InvoicePreview({ className }: { className?: string }) {
  return (
    <MarketingPreviewFrame className={className} url="app.truckmates.com/invoices">
      <Alert className="mb-3 border-amber-500/50 bg-amber-500/10 py-2">
        <AlertDescription className="text-xs text-amber-100/90">
          Rate con shows <strong>$3,420</strong> — <strong className="text-amber-400">$180 short</strong>
        </AlertDescription>
      </Alert>

      <Card className="border-border/60 bg-card/70 p-4 shadow-sm">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Invoice</p>
        <h3 className="mt-0.5 font-mono text-lg font-bold text-foreground">#INV-2048</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Bill to <span className="text-foreground">Cardinal Freight LLC</span>
        </p>

        <div className="mt-4 space-y-1.5 border-t border-border/40 pt-3">
          {LINE_ITEMS.map((item) => (
            <div key={item.label} className="flex justify-between text-xs">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-mono text-foreground">{item.amount}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-3">
          <span className="text-sm font-semibold text-foreground">Total</span>
          <span className="font-mono text-xl font-bold text-emerald-400">$3,240.00</span>
        </div>
      </Card>
    </MarketingPreviewFrame>
  )
}
