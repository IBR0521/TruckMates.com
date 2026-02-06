"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Sparkles,
  User,
  Truck,
  MapPin,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  TrendingUp,
} from "lucide-react"
import {
  getOptimalDriverSuggestions,
  type DriverSuggestion,
} from "@/app/actions/dispatch-assist"
import { quickAssignLoad } from "@/app/actions/dispatches"
import { toast } from "sonner"

interface DispatchAssistProps {
  loadId: string
  onAssigned?: () => void
  onClose?: () => void
}

export function DispatchAssist({ loadId, onAssigned, onClose }: DispatchAssistProps) {
  const [suggestions, setSuggestions] = useState<DriverSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [assigning, setAssigning] = useState<string | null>(null)

  async function loadSuggestions() {
    setLoading(true)
    try {
      const result = await getOptimalDriverSuggestions(loadId, {
        max_suggestions: 5,
        min_drive_hours: 4,
        max_distance_miles: 100,
        consider_performance: true,
      })

      if (result.error) {
        toast.error(result.error)
      } else if (result.data) {
        setSuggestions(result.data)
        if (result.data.length === 0) {
          toast.info("No suitable drivers found. Try adjusting search criteria.")
        }
      }
    } catch (error: any) {
      toast.error("Failed to load suggestions")
    } finally {
      setLoading(false)
    }
  }

  async function handleAssign(suggestion: DriverSuggestion) {
    setAssigning(suggestion.driver_id)
    try {
      const result = await quickAssignLoad(loadId, suggestion.driver_id, suggestion.truck_id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Assigned to ${suggestion.driver_name}`)
        onAssigned?.()
      }
    } catch (error: any) {
      toast.error("Failed to assign load")
    } finally {
      setAssigning(null)
    }
  }

  function getScoreColor(score: number): string {
    if (score >= 80) return "text-green-500"
    if (score >= 60) return "text-yellow-500"
    return "text-orange-500"
  }

  function getScoreBadge(score: number): string {
    if (score >= 80) return "bg-green-500/20 text-green-400 border-green-500/30"
    if (score >= 60) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
    return "bg-orange-500/20 text-orange-400 border-orange-500/30"
  }

  return (
    <Card className="border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-bold text-foreground">Dispatch Assist</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadSuggestions} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Find Best Match
              </>
            )}
          </Button>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>

      {loading && suggestions.length === 0 ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Analyzing drivers and calculating optimal matches...</p>
        </div>
      ) : suggestions.length === 0 ? (
        <div className="text-center py-12">
          <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h4 className="text-lg font-semibold text-foreground mb-2">No suggestions yet</h4>
          <p className="text-muted-foreground mb-4">
            Click "Find Best Match" to get AI-powered driver suggestions
          </p>
          <Button onClick={loadSuggestions} variant="outline">
            <Sparkles className="w-4 h-4 mr-2" />
            Get Suggestions
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground mb-4">
            Top {suggestions.length} driver suggestion{suggestions.length !== 1 ? "s" : ""} ranked by
            location, HOS availability, and performance
          </div>

          {suggestions.map((suggestion, index) => (
            <Card
              key={suggestion.driver_id}
              className={`border-border p-4 ${
                index === 0 && suggestion.score >= 80
                  ? "ring-2 ring-primary/50 bg-primary/5"
                  : ""
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {index === 0 && suggestion.score >= 80 && (
                      <Badge variant="default" className="bg-primary">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        Best Match
                      </Badge>
                    )}
                    <h4 className="font-semibold text-foreground flex items-center gap-2">
                      <User className="w-4 h-4" />
                      {suggestion.driver_name}
                    </h4>
                    <Badge className={getScoreBadge(suggestion.score)}>
                      Score: {suggestion.score.toFixed(0)}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Truck className="w-3 h-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Truck:</span>
                      <span className="font-semibold text-foreground">{suggestion.truck_number}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="w-3 h-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Distance:</span>
                      <span className="font-semibold text-foreground">
                        {suggestion.distance_miles.toFixed(1)} mi
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Drive Hours:</span>
                      <span
                        className={`font-semibold ${
                          suggestion.remaining_drive_hours >= 4
                            ? "text-green-500"
                            : suggestion.remaining_drive_hours >= 2
                            ? "text-yellow-500"
                            : "text-orange-500"
                        }`}
                      >
                        {suggestion.remaining_drive_hours.toFixed(1)}h
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-muted-foreground">On-Duty Hours:</span>
                      <span
                        className={`font-semibold ${
                          suggestion.remaining_on_duty_hours >= 6
                            ? "text-green-500"
                            : suggestion.remaining_on_duty_hours >= 3
                            ? "text-yellow-500"
                            : "text-orange-500"
                        }`}
                      >
                        {suggestion.remaining_on_duty_hours.toFixed(1)}h
                      </span>
                    </div>
                  </div>

                  {/* Reasons */}
                  <div className="space-y-1">
                    {suggestion.reasons.map((reason, reasonIndex) => (
                      <div
                        key={reasonIndex}
                        className={`text-xs flex items-center gap-1 ${
                          reason.includes("⚠️")
                            ? "text-orange-500"
                            : "text-muted-foreground"
                        }`}
                      >
                        {reason.includes("⚠️") ? (
                          <AlertTriangle className="w-3 h-3" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>

                  {/* Warnings */}
                  {suggestion.conflicts.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <div className="flex items-center gap-1 text-xs text-orange-500">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Conflicts: {suggestion.conflicts.join(", ")}</span>
                      </div>
                    </div>
                  )}

                  {suggestion.hos_violations.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <div className="flex items-center gap-1 text-xs text-orange-500">
                        <AlertTriangle className="w-3 h-3" />
                        <span>HOS Violations: {suggestion.hos_violations.join(", ")}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-border">
                <Button
                  className="flex-1"
                  onClick={() => handleAssign(suggestion)}
                  disabled={assigning === suggestion.driver_id || !suggestion.can_complete}
                  variant={index === 0 && suggestion.score >= 80 ? "default" : "outline"}
                >
                  {assigning === suggestion.driver_id ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Assigning...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Assign This Driver
                    </>
                  )}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Card>
  )
}

