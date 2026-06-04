import { AppFrame } from "./AppFrame"

const LINE_ITEMS = [
  { label: "Linehaul", amount: "$2,800.00" },
  { label: "Fuel Surcharge", amount: "$320.00" },
  { label: "Detention (2.5 hrs)", amount: "$120.00" },
] as const

export function InvoicePanel({ className = "" }: { className?: string }) {
  return (
    <AppFrame className={`relative ${className}`} url="app.truckmates.com/invoices">
      <div className="relative p-5 sm:p-6">
        <div
          className="absolute top-4 right-4 z-10 max-w-[200px] rounded-lg border px-3 py-2 text-[12px] leading-snug sm:top-3 sm:right-3"
          style={{
            background: "var(--w-amber-bg)",
            borderColor: "rgba(245,158,11,0.35)",
            color: "var(--w-amber)",
            fontFamily: "var(--font-jakarta), sans-serif",
          }}
        >
          ⚠ Rate con shows $3,420 — $180 short
        </div>

        <p
          className="text-[11px] uppercase tracking-wide"
          style={{ color: "var(--w-text-3)", fontFamily: "var(--font-jakarta), sans-serif" }}
        >
          Invoice
        </p>
        <h3
          className="mt-1 text-lg font-bold text-[var(--w-text)]"
          style={{ fontFamily: "var(--font-mono-display), monospace" }}
        >
          #INV-2048
        </h3>
        <p
          className="mt-2 text-[13px]"
          style={{ color: "var(--w-text-2)", fontFamily: "var(--font-jakarta), sans-serif" }}
        >
          Bill To: <span className="text-[var(--w-text)]">Cardinal Freight LLC</span>
        </p>

        <div className="mt-6 space-y-2 border-t pt-4" style={{ borderColor: "var(--w-border)" }}>
          {LINE_ITEMS.map((item) => (
            <div
              key={item.label}
              className="flex justify-between text-[13px]"
              style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
            >
              <span style={{ color: "var(--w-text-2)" }}>{item.label}</span>
              <span
                style={{ color: "var(--w-text)", fontFamily: "var(--font-mono-display), monospace", fontSize: 12 }}
              >
                {item.amount}
              </span>
            </div>
          ))}
        </div>

        <div
          className="mt-4 flex items-center justify-between border-t pt-4"
          style={{ borderColor: "var(--w-border)" }}
        >
          <span
            className="text-sm font-semibold text-[var(--w-text)]"
            style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
          >
            Total
          </span>
          <span
            className="text-xl font-medium"
            style={{ color: "var(--w-green)", fontFamily: "var(--font-mono-display), monospace" }}
          >
            $3,240.00
          </span>
        </div>
      </div>
    </AppFrame>
  )
}
