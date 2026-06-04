import type { LucideIcon } from "lucide-react"
import { Card } from "@/components/ui/card"

export const TONE_STYLES = {
  good: "text-emerald-400 border-emerald-500/35 bg-emerald-500/8",
  warning: "text-amber-400 border-amber-500/35 bg-amber-500/8",
  danger: "text-rose-400 border-rose-500/35 bg-rose-500/8",
  neutral: "text-foreground border-border/60 bg-background/50",
} as const

export type PreviewMetricTone = keyof typeof TONE_STYLES

export function PreviewMetricCard({
  title,
  icon: Icon,
  tone,
  primary,
  secondary = [],
}: {
  title: string
  icon: LucideIcon
  tone: PreviewMetricTone
  primary: string
  secondary?: Array<{ label: string; value: string | number; tone?: PreviewMetricTone }>
}) {
  return (
    <Card className="min-w-0 overflow-hidden border-border/60 bg-card/70 p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/90">{title}</p>
          <p className={`mt-2 truncate text-xl font-bold leading-none sm:text-2xl ${TONE_STYLES[tone].split(" ")[0]}`}>
            {primary}
          </p>
        </div>
        <div className={`shrink-0 rounded-lg border p-1.5 ${TONE_STYLES[tone]}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      {secondary.length > 0 ? (
        <ul className="space-y-1.5 border-t border-border/40 pt-3">
          {secondary.map((item) => (
            <li key={item.label} className="flex min-w-0 items-baseline justify-between gap-2">
              <span className="shrink-0 text-[11px] text-muted-foreground">{item.label}</span>
              <span
                className={`truncate text-right text-xs font-semibold tabular-nums ${
                  item.tone === "danger"
                    ? "text-rose-400"
                    : item.tone === "warning"
                      ? "text-amber-400"
                      : item.tone === "good"
                        ? "text-emerald-400"
                        : "text-foreground"
                }`}
              >
                {item.value}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  )
}
