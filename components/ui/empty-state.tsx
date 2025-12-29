import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LucideIcon } from "lucide-react"
import Link from "next/link"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
  actionOnClick?: () => void
  secondaryActionLabel?: string
  secondaryActionHref?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  actionOnClick,
  secondaryActionLabel,
  secondaryActionHref,
}: EmptyStateProps) {
  return (
    <Card className="border-border bg-card/50 p-12">
      <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto">
        <div className="p-4 bg-muted/50 rounded-full mb-4">
          <Icon className="w-12 h-12 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">{title}</h3>
        <p className="text-muted-foreground mb-6">{description}</p>
        
        {(actionLabel || secondaryActionLabel) && (
          <div className="flex gap-3 flex-wrap justify-center">
            {actionLabel && (
              actionHref ? (
                <Link href={actionHref}>
                  <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    {actionLabel}
                  </Button>
                </Link>
              ) : actionOnClick ? (
                <Button 
                  onClick={actionOnClick}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {actionLabel}
                </Button>
              ) : null
            )}
            {secondaryActionLabel && secondaryActionHref && (
              <Link href={secondaryActionHref}>
                <Button variant="outline">
                  {secondaryActionLabel}
                </Button>
              </Link>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

