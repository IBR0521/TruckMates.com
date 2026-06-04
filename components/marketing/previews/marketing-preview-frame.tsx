import type { ReactNode } from "react"
import { PreviewTheme } from "./preview-theme"
import { cn } from "@/lib/utils"

/** Lightweight product frame for marketing sections — no sidebar, readable width. */
export function MarketingPreviewFrame({
  children,
  className,
  url,
}: {
  children: ReactNode
  className?: string
  url?: string
}) {
  return (
    <PreviewTheme>
      <div
        className={cn(
          "w-full overflow-hidden rounded-xl border border-border/60 bg-background shadow-[0_24px_80px_-24px_rgba(0,0,0,0.65)]",
          className,
        )}
      >
        {url ? (
          <div className="flex items-center gap-1.5 border-b border-border/60 bg-muted/30 px-3 py-2">
            <span className="h-2 w-2 rounded-full bg-red-500/45" />
            <span className="h-2 w-2 rounded-full bg-amber-500/45" />
            <span className="h-2 w-2 rounded-full bg-emerald-500/45" />
            <span className="mx-auto truncate font-mono text-[10px] text-muted-foreground">{url}</span>
          </div>
        ) : null}
        <div className="p-3 sm:p-4">{children}</div>
      </div>
    </PreviewTheme>
  )
}
