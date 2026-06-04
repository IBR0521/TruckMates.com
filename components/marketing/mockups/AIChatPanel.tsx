import { Send } from "lucide-react"
import { AppFrame } from "./AppFrame"

export function AIChatPanel({ className = "" }: { className?: string }) {
  return (
    <AppFrame className={className} url="app.truckmates.com/ai">
      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: "var(--w-border)" }}>
          <span
            className="text-sm font-semibold text-[var(--w-text)]"
            style={{ fontFamily: "var(--font-bricolage), sans-serif" }}
          >
            TruckMates AI
          </span>
          <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--w-green)" }}>
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--w-green)] w-online-blink" />
            online
          </span>
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex justify-end">
            <p
              className="max-w-[85%] rounded-lg px-3 py-2 text-[12px] leading-relaxed text-[var(--w-text)]"
              style={{
                background: "var(--w-blue-dim)",
                fontFamily: "var(--font-jakarta), sans-serif",
              }}
            >
              Can J. Park take the Phoenix load tomorrow?
            </p>
          </div>
          <div className="flex justify-start">
            <p
              className="max-w-[92%] rounded-lg border-l-2 px-3 py-2 text-[12px] leading-relaxed text-[var(--w-text)]"
              style={{
                background: "var(--w-card-2)",
                borderLeftColor: "var(--w-blue)",
                fontFamily: "var(--font-jakarta), sans-serif",
              }}
            >
              Not without an HOS violation. He&apos;ll have{" "}
              <span style={{ fontFamily: "var(--font-mono-display), monospace" }}>4h 30m</span> left after his
              current run. The Phoenix → Denver leg needs ~9h driving. R. Okafor or D. Boone can cover it.
            </p>
          </div>
          <div className="flex justify-end">
            <p
              className="max-w-[85%] rounded-lg px-3 py-2 text-[12px] leading-relaxed text-[var(--w-text)]"
              style={{
                background: "var(--w-blue-dim)",
                fontFamily: "var(--font-jakarta), sans-serif",
              }}
            >
              Assign D. Boone and send the rate con.
            </p>
          </div>
          <div className="flex justify-start">
            <p
              className="max-w-[92%] rounded-lg border-l-2 px-3 py-2 text-[12px] leading-relaxed text-[var(--w-text)]"
              style={{
                background: "var(--w-card-2)",
                borderLeftColor: "var(--w-blue)",
                fontFamily: "var(--font-jakarta), sans-serif",
              }}
            >
              Done. Load{" "}
              <span style={{ fontFamily: "var(--font-mono-display), monospace" }}>#TM-4855</span> assigned to D.
              Boone. Rate confirmation sent to broker. I also flagged a{" "}
              <span style={{ fontFamily: "var(--font-mono-display), monospace", color: "var(--w-green)" }}>
                $180
              </span>{" "}
              discrepancy vs the original quote — want me to dispute it?
            </p>
          </div>
        </div>

        <div
          className="mt-5 flex items-center gap-2 rounded-full border px-4 py-2.5"
          style={{ borderColor: "var(--w-border-md)", background: "var(--w-bg-3)" }}
        >
          <span
            className="flex-1 text-[12px]"
            style={{ color: "var(--w-text-3)", fontFamily: "var(--font-jakarta), sans-serif" }}
          >
            Ask anything about your fleet…
          </span>
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full"
            style={{ background: "var(--w-blue-dim)" }}
          >
            <Send className="h-3.5 w-3.5 text-[var(--w-blue)]" />
          </span>
        </div>
      </div>
    </AppFrame>
  )
}
