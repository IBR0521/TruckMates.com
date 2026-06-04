import type { ReactNode } from "react"
import {
  BarChart3,
  Bell,
  Bot,
  DollarSign,
  FileText,
  LayoutGrid,
  Package,
  Radio,
  Search,
  Settings,
  Shield,
  Truck,
  Users,
  Wrench,
} from "lucide-react"
import { Logo } from "@/components/logo"
import { Input } from "@/components/ui/input"
import { PreviewTheme } from "./preview-theme"
import { cn } from "@/lib/utils"

const NAV: Array<{
  icon: typeof BarChart3
  label: string
  active?: boolean
}> = [
  { icon: BarChart3, label: "Dashboard", active: true },
  { icon: Package, label: "Loads" },
  { icon: Radio, label: "Dispatch" },
  { icon: Users, label: "Drivers" },
  { icon: Truck, label: "Trucks" },
  { icon: FileText, label: "IFTA" },
  { icon: Shield, label: "ELD" },
  { icon: Wrench, label: "Maintenance" },
  { icon: DollarSign, label: "Invoices" },
  { icon: Bot, label: "AI Assistant" },
  { icon: BarChart3, label: "Reports" },
  { icon: Settings, label: "Settings" },
]

export function AppShell({
  children,
  className,
  url = "app.truckmates.com/dashboard",
  pageTitle = "Dashboard",
}: {
  children: ReactNode
  className?: string
  url?: string
  pageTitle?: string
}) {
  return (
    <PreviewTheme>
      <div
        className={cn("overflow-hidden rounded-[14px] border border-border/60 bg-background shadow-2xl", className)}
      >
        <div className="flex items-center gap-1.5 border-b border-border/60 bg-muted/30 px-3 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/50" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500/50" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/50" />
          <span className="mx-auto hidden rounded-full bg-muted/50 px-3 py-0.5 font-mono text-[11px] text-muted-foreground sm:inline">
            {url}
          </span>
          <LayoutGrid className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
        </div>

        <div className="flex min-h-0 bg-background">
          <aside className="hidden w-44 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex xl:w-52">
            <div className="border-b border-sidebar-border p-4">
              <Logo size="sm" />
            </div>
            <nav className="flex-1 space-y-0.5 p-3">
              {NAV.map((item) => {
                const Icon = item.icon
                return (
                  <div
                    key={item.label}
                    className={cn(
                      "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                      item.active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/60",
                    )}
                  >
                    {item.active ? (
                      <span className="absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-r bg-primary" />
                    ) : null}
                    <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                    <span className="truncate">{item.label}</span>
                  </div>
                )
              })}
            </nav>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card/80 px-4 py-3 backdrop-blur-sm md:px-6">
              <h2 className="text-base font-semibold text-foreground">{pageTitle}</h2>
              <div className="flex flex-1 items-center justify-end gap-2 md:max-w-md">
                <div className="relative hidden flex-1 sm:block">
                  <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    readOnly
                    placeholder="Search fleet…"
                    className="h-9 border-border/60 bg-background/60 pl-9 text-sm"
                    tabIndex={-1}
                  />
                </div>
                <button
                  type="button"
                  className="relative rounded-lg p-2 text-muted-foreground hover:bg-muted"
                  tabIndex={-1}
                  aria-hidden
                >
                  <Bell className="h-4 w-4" />
                  <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-rose-500" />
                </button>
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary"
                  aria-hidden
                >
                  TM
                </div>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-hidden bg-gradient-to-b from-background via-background to-muted/[0.08]">
              <div className="p-4 md:p-6">{children}</div>
            </div>
          </div>
        </div>
      </div>
    </PreviewTheme>
  )
}
