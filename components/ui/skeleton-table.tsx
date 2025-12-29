import { Card } from "@/components/ui/card"

interface SkeletonTableProps {
  rows?: number
  cols?: number
}

export function SkeletonTable({ rows = 5, cols = 4 }: SkeletonTableProps) {
  return (
    <Card className="border-border bg-card/50">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="h-6 bg-muted rounded w-32 animate-pulse" />
          <div className="h-9 bg-muted rounded w-24 animate-pulse" />
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-4 gap-4 pb-2 border-b border-border">
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="h-4 bg-muted rounded w-full animate-pulse" />
          ))}
        </div>

        {/* Table Rows */}
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div key={rowIndex} className="grid grid-cols-4 gap-4 py-2">
              {Array.from({ length: cols }).map((_, colIndex) => (
                <div
                  key={colIndex}
                  className="h-4 bg-muted rounded w-full animate-pulse"
                  style={{ animationDelay: `${rowIndex * 50}ms` }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

