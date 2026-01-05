"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, Edit2, MoreVertical } from "lucide-react"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"

interface DetailPageLayoutProps {
  title: string
  subtitle?: string
  backUrl: string
  editUrl?: string
  actions?: React.ReactNode
  children: React.ReactNode
  headerActions?: React.ReactNode
}

export function DetailPageLayout({
  title,
  subtitle,
  backUrl,
  editUrl,
  actions,
  children,
  headerActions,
}: DetailPageLayoutProps) {
  return (
    <div className="w-full min-h-screen bg-background">
      {/* Professional Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="px-4 md:px-8 py-4 md:py-6">
          <div className="flex items-center gap-3 mb-4">
            <Link href={backUrl}>
              <Button variant="ghost" size="sm" className="h-9">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground truncate">{title}</h1>
              {subtitle && (
                <p className="text-sm text-muted-foreground mt-1 truncate">{subtitle}</p>
              )}
            </div>
          </div>
          
          {/* Action Bar */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {editUrl && (
                <Link href={editUrl}>
                  <Button variant="outline" size="sm" className="h-9">
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                </Link>
              )}
              {actions}
            </div>
            {headerActions && (
              <div className="flex items-center gap-2">
                {headerActions}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </div>
    </div>
  )
}

interface DetailSectionProps {
  title: string
  icon?: React.ReactNode
  description?: string
  children: React.ReactNode
  className?: string
  action?: React.ReactNode
}

export function DetailSection({
  title,
  icon,
  description,
  children,
  className,
  action,
}: DetailSectionProps) {
  return (
    <Card className={`border-border ${className || ""}`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {icon && <div className="text-primary">{icon}</div>}
            <div>
              <h2 className="text-lg font-semibold text-foreground">{title}</h2>
              {description && (
                <p className="text-sm text-muted-foreground mt-1">{description}</p>
              )}
            </div>
          </div>
          {action && <div>{action}</div>}
        </div>
        <Separator className="mb-6" />
        <div>{children}</div>
      </div>
    </Card>
  )
}

interface InfoGridProps {
  children: React.ReactNode
  cols?: 1 | 2 | 3 | 4
}

export function InfoGrid({ children, cols = 2 }: InfoGridProps) {
  const gridCols = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
  }

  return (
    <div className={`grid ${gridCols[cols]} gap-6`}>
      {children}
    </div>
  )
}

interface InfoFieldProps {
  label: string
  value: React.ReactNode
  icon?: React.ReactNode
  className?: string
}

export function InfoField({ label, value, icon, className }: InfoFieldProps) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-2">
        {icon && <div className="text-muted-foreground">{icon}</div>}
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </p>
      </div>
      <div className="text-base text-foreground font-medium">
        {value || <span className="text-muted-foreground">—</span>}
      </div>
    </div>
  )
}

interface StatusBadgeProps {
  status: string
  variant?: "default" | "success" | "warning" | "danger" | "info"
}

export function StatusBadge({ status, variant = "default" }: StatusBadgeProps) {
  const variants = {
    default: "bg-gray-500/20 text-gray-400 border-gray-500/50",
    success: "bg-green-500/20 text-green-400 border-green-500/50",
    warning: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
    danger: "bg-red-500/20 text-red-400 border-red-500/50",
    info: "bg-blue-500/20 text-blue-400 border-blue-500/50",
  }

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${variants[variant]}`}>
      {status}
    </span>
  )
}

