"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, Save } from "lucide-react"
import Link from "next/link"
import { Separator } from "@/components/ui/separator"

interface FormPageLayoutProps {
  title: string
  subtitle?: string
  backUrl: string
  children: React.ReactNode
  onSubmit?: (e: React.FormEvent) => void
  isSubmitting?: boolean
  submitLabel?: string
  actions?: React.ReactNode
}

export function FormPageLayout({
  title,
  subtitle,
  backUrl,
  children,
  onSubmit,
  isSubmitting = false,
  submitLabel = "Save",
  actions,
}: FormPageLayoutProps) {
  return (
    <div className="w-full bg-background">
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
          {(onSubmit || actions) && (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {actions}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {onSubmit ? (
            <form onSubmit={onSubmit} className="space-y-6">
              {children}
              {/* Submit Button at Bottom - Added padding to avoid feedback button */}
              <div className="flex items-center justify-end gap-3 pt-6 pb-20 sm:pb-6 border-t border-border">
                <Link href={backUrl}>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSubmitting ? "Saving..." : submitLabel}
                </Button>
              </div>
            </form>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  )
}

interface FormSectionProps {
  title: string
  icon?: React.ReactNode
  description?: string
  children: React.ReactNode
  className?: string
}

export function FormSection({
  title,
  icon,
  description,
  children,
  className,
}: FormSectionProps) {
  return (
    <Card className={`border-border ${className || ""}`}>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          {icon && <div className="text-primary">{icon}</div>}
          <div>
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
          </div>
        </div>
        <Separator className="mb-6" />
        <div>{children}</div>
      </div>
    </Card>
  )
}

interface FormGridProps {
  children: React.ReactNode
  cols?: 1 | 2 | 3 | 4
}

export function FormGrid({ children, cols = 2 }: FormGridProps) {
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

