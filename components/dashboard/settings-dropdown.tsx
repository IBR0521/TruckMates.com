"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Settings,
  FileText,
  Plug,
  Package,
  Truck,
  Bell,
  Link as LinkIcon,
  Building2,
  CreditCard,
  Users,
  User,
  ChevronRight,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function SettingsDropdown() {
  const [open, setOpen] = useState(false)

  const settingsItems = [
    {
      icon: Settings,
      label: "General",
      href: "/dashboard/settings/general",
      description: "General application settings",
    },
    {
      icon: FileText,
      label: "Invoice",
      href: "/dashboard/settings/invoice",
      description: "Invoice settings and templates",
    },
    {
      icon: Plug,
      label: "Integration",
      href: "/dashboard/settings/integration",
      description: "Third-party integrations",
    },
    {
      icon: Package,
      label: "Load",
      href: "/dashboard/settings/load",
      description: "Load management settings",
    },
    {
      icon: Truck,
      label: "Dispatch",
      href: "/dashboard/settings/dispatch",
      description: "Dispatch and routing settings",
    },
    {
      icon: Bell,
      label: "Reminder",
      href: "/dashboard/settings/reminder",
      description: "Notification and reminder settings",
    },
    {
      icon: LinkIcon,
      label: "Portal URL",
      href: "/dashboard/settings/portal",
      description: "Customer portal configuration",
    },
    {
      icon: Building2,
      label: "Business",
      href: "/dashboard/settings/business",
      description: "Business information and details",
    },
    {
      icon: CreditCard,
      label: "Billing",
      href: "/dashboard/settings/billing",
      description: "Billing settings",
    },
    {
      icon: Users,
      label: "Manage Users",
      href: "/dashboard/settings/users",
      description: "User management and permissions",
    },
    {
      icon: User,
      label: "My Account",
      href: "/dashboard/settings/account",
      description: "Personal account settings",
    },
  ]

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-secondary"
            >
              <Settings className="h-5 w-5" />
              <span className="sr-only">Settings</span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>Settings</p>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-semibold">Settings</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {settingsItems.map((item, index) => {
          const Icon = item.icon
          return (
            <DropdownMenuItem key={item.href} asChild>
              <Link
                href={item.href}
                className="flex items-center gap-3 cursor-pointer py-2.5 px-3"
                onClick={() => setOpen(false)}
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <div className="font-medium text-sm text-foreground">{item.label}</div>
                  <div className="text-xs text-muted-foreground">{item.description}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}







