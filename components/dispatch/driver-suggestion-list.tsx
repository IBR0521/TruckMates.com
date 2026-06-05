"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Loader2, AlertTriangle, User, Truck, MapPin, Clock } from "lucide-react"
import {
  getOptimalDriverSuggestions,
  type DriverSuggestion,
} from "@/app/actions/dispatch-assist"
import { cn } from "@/lib/utils"

function getScoreBadgeClass(score: number): string {
  if (score >= 80) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
  if (score >= 60) return "bg-amber-500/20 text-amber-400 border-amber-500/30"
  return "bg-muted text-muted-foreground border-border"
}

interface DriverSuggestionListProps {
  loadId: string
  onSelect: (suggestion: DriverSuggestion) => void
  /** When false, suggestions are not fetched (e.g. closed dialog). Defaults to true. */
  enabled?: boolean
  className?: string
}

export function DriverSuggestionList({
  loadId,
  onSelect,
  enabled = true,
  className,
}: DriverSuggestionListProps) {
  const [suggestions, setSuggestions] = useState<DriverSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emptyReason, setEmptyReason] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !loadId) return

    let cancelled = false
    setLoading(true)
    setError(null)
    setEmptyReason(null)

    void getOptimalDriverSuggestions(loadId, {
      max_suggestions: 5,
      min_drive_hours: 4,
      max_distance_miles: 100,
      consider_performance: true,
    })
      .then((result) => {
        if (cancelled) return
        if (result.error) {
          setError(result.error)
          setSuggestions([])
          return
        }
        if (result.data && result.data.length > 0) {
          setSuggestions(result.data)
        } else {
          setSuggestions([])
          setEmptyReason("No drivers can legally complete this load right now")
        }
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load driver suggestions")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [loadId, enabled])

  if (!enabled) return null

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2 py-2 text-xs text-muted-foreground", className)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Ranking drivers…</span>
      </div>
    )
  }

  if (error) {
    return (
      <p className={cn("text-xs text-rose-400 py-1", className)}>{error}</p>
    )
  }

  if (suggestions.length === 0) {
    return (
      <p className={cn("text-xs text-muted-foreground py-1", className)}>
        {emptyReason || "No drivers can legally complete this load right now"}
      </p>
    )
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
        Recommended drivers
      </p>
      {suggestions.map((suggestion) => {
        const blocked =
          !suggestion.can_complete ||
          suggestion.hos_violations.length > 0 ||
          suggestion.conflicts.length > 0
        const topReasons = suggestion.reasons.slice(0, 2)

        return (
          <button
            key={suggestion.driver_id}
            type="button"
            disabled={blocked}
            onClick={() => onSelect(suggestion)}
            className={cn(
              "w-full rounded-md border p-2.5 text-left transition-colors",
              blocked
                ? "border-rose-500/40 bg-rose-500/5 cursor-not-allowed opacity-80"
                : "border-border hover:border-primary/50 hover:bg-muted/50 cursor-pointer",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-medium text-foreground flex items-center gap-1">
                    <User className="h-3 w-3 shrink-0 text-muted-foreground" />
                    {suggestion.driver_name}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Truck className="h-3 w-3" />
                    {suggestion.truck_number}
                  </span>
                  <Badge className={cn("text-[10px] px-1.5 py-0", getScoreBadgeClass(suggestion.score))}>
                    {suggestion.score.toFixed(0)}
                  </Badge>
                  {blocked && (
                    <Badge className="text-[10px] px-1.5 py-0 bg-rose-500/20 text-rose-400 border-rose-500/30">
                      <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                      Cannot complete
                    </Badge>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-2.5 w-2.5" />
                    {suggestion.distance_miles.toFixed(1)} mi
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    {suggestion.remaining_drive_hours.toFixed(1)}h drive left
                  </span>
                </div>
                {topReasons.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {topReasons.map((reason, i) => (
                      <p
                        key={i}
                        className={cn(
                          "text-[10px] leading-tight",
                          reason.includes("⚠️") ? "text-rose-400" : "text-muted-foreground",
                        )}
                      >
                        {reason}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
