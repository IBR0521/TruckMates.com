import { Card } from "@/components/ui/card"

interface SkeletonCardProps {
  lines?: number
  showHeader?: boolean
  showFooter?: boolean
}

export function SkeletonCard({ lines = 3, showHeader = true, showFooter = false }: SkeletonCardProps) {
  return (
    <Card className="border-border bg-card/50 p-6">
      {showHeader && (
        <div className="mb-4">
          <div className="h-6 bg-muted rounded w-3/4 animate-pulse mb-2" />
          <div className="h-4 bg-muted rounded w-1/2 animate-pulse" />
        </div>
      )}

      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-4 bg-muted rounded w-full animate-pulse"
            style={{ animationDelay: `${i * 100}ms` }}
          />
        ))}
      </div>

      {showFooter && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="h-4 bg-muted rounded w-1/3 animate-pulse" />
        </div>
      )}
    </Card>
  )
}

