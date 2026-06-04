import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Forces app dark-theme CSS variables so shadcn previews match the real dashboard. */
export function PreviewTheme({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("dark text-foreground", className)} style={{ colorScheme: "dark" }}>
      {children}
    </div>
  )
}
