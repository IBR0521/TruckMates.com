import { Bot, Send } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { MarketingPreviewFrame } from "./marketing-preview-frame"

const MESSAGES = [
  { role: "user" as const, content: "Can J. Park take the Phoenix load tomorrow?" },
  {
    role: "assistant" as const,
    content:
      "Not without an HOS violation — he'll have 4h 30m left. R. Okafor or D. Boone can cover it.",
  },
  { role: "user" as const, content: "Assign D. Boone and send the rate con." },
  {
    role: "assistant" as const,
    content: "Done. Load #TM-4855 assigned. Flagged a $180 rate-con discrepancy — dispute it?",
  },
]

export function AIAssistantPreview({ className }: { className?: string }) {
  return (
    <MarketingPreviewFrame className={className} url="app.truckmates.com/ai-assistant">
      <Card className="flex flex-col overflow-hidden border-border/60 bg-card/70 shadow-sm">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <Bot className="h-4 w-4 text-primary" aria-hidden />
          <span className="text-sm font-semibold text-foreground">TruckMates AI</span>
          <span className="text-[10px] text-emerald-400">● online</span>
        </div>

        <div className="space-y-2.5 px-3 py-3">
          {MESSAGES.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "ml-6 rounded-lg bg-muted px-2.5 py-2 text-xs text-foreground"
                  : "mr-4 rounded-lg border border-border bg-card px-2.5 py-2 text-xs text-foreground"
              }
            >
              <p className="leading-relaxed">{m.content}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-2 border-t border-border px-3 py-2.5">
          <Input
            readOnly
            placeholder="Ask anything about your fleet…"
            className="h-8 flex-1 border-border/60 bg-background/60 text-xs"
            tabIndex={-1}
          />
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Send className="h-3.5 w-3.5" />
          </span>
        </div>
      </Card>
    </MarketingPreviewFrame>
  )
}
