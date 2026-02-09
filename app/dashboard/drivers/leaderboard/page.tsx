"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Trophy,
  Medal,
  Award,
  TrendingUp,
  Clock,
  Truck,
  AlertTriangle,
  CheckCircle2,
  Star,
  Calendar,
} from "lucide-react"
import { getDriverLeaderboard, type DriverPerformanceScore } from "@/app/actions/gamification"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function DriverLeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<DriverPerformanceScore[]>([])
  const [periodType, setPeriodType] = useState<'weekly' | 'monthly' | 'yearly'>('monthly')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadLeaderboard()
  }, [periodType])

  async function loadLeaderboard() {
    setIsLoading(true)
    try {
      const result = await getDriverLeaderboard(periodType, 20)
      if (result.error) {
        toast.error(result.error)
      } else if (result.data) {
        setLeaderboard(result.data)
      }
    } catch (error: any) {
      toast.error("Failed to load leaderboard")
    } finally {
      setIsLoading(false)
    }
  }

  function getRankIcon(rank: number | null) {
    if (rank === null) return null
    if (rank === 1) return <Trophy className="w-6 h-6 text-yellow-500" />
    if (rank === 2) return <Medal className="w-6 h-6 text-gray-400" />
    if (rank === 3) return <Award className="w-6 h-6 text-amber-600" />
    return <span className="text-muted-foreground font-bold">#{rank}</span>
  }

  function getScoreColor(score: number): string {
    if (score >= 90) return "text-green-500"
    if (score >= 80) return "text-blue-500"
    if (score >= 70) return "text-yellow-500"
    return "text-red-500"
  }

  function getTierBadge(score: number) {
    if (score >= 90) {
      return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/50">Gold</Badge>
    }
    if (score >= 80) {
      return <Badge className="bg-gray-400/20 text-gray-400 border-gray-400/50">Silver</Badge>
    }
    if (score >= 70) {
      return <Badge className="bg-amber-600/20 text-amber-600 border-amber-600/50">Bronze</Badge>
    }
    return null
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Driver Leaderboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Top performing drivers ranked by performance scores
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={periodType} onValueChange={(value: any) => setPeriodType(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Top 3 Podium */}
          {leaderboard.length >= 3 && !isLoading && (
            <div className="grid md:grid-cols-3 gap-4 mb-8">
              {/* 2nd Place */}
              <Card className="border-border p-6 text-center">
                <div className="flex justify-center mb-2">
                  <Medal className="w-12 h-12 text-gray-400" />
                </div>
                <h3 className="font-bold text-lg text-foreground mb-1">
                  {(leaderboard[1] as any)?.drivers?.name || "Driver 2"}
                </h3>
                <div className="text-3xl font-bold text-gray-400 mb-2">
                  {leaderboard[1]?.overall_score.toFixed(1)}
                </div>
                <div className="text-sm text-muted-foreground">2nd Place</div>
              </Card>

              {/* 1st Place */}
              <Card className="border-yellow-500/50 border-2 p-6 text-center bg-yellow-500/5">
                <div className="flex justify-center mb-2">
                  <Trophy className="w-16 h-16 text-yellow-500" />
                </div>
                <h3 className="font-bold text-xl text-foreground mb-1">
                  {(leaderboard[0] as any)?.drivers?.name || "Driver 1"}
                </h3>
                <div className="text-4xl font-bold text-yellow-500 mb-2">
                  {leaderboard[0]?.overall_score.toFixed(1)}
                </div>
                <div className="text-sm font-semibold text-yellow-500">🏆 Champion</div>
              </Card>

              {/* 3rd Place */}
              <Card className="border-border p-6 text-center">
                <div className="flex justify-center mb-2">
                  <Award className="w-12 h-12 text-amber-600" />
                </div>
                <h3 className="font-bold text-lg text-foreground mb-1">
                  {(leaderboard[2] as any)?.drivers?.name || "Driver 3"}
                </h3>
                <div className="text-3xl font-bold text-amber-600 mb-2">
                  {leaderboard[2]?.overall_score.toFixed(1)}
                </div>
                <div className="text-sm text-muted-foreground">3rd Place</div>
              </Card>
            </div>
          )}

          {/* Full Leaderboard */}
          <Card className="border-border">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-foreground">Full Rankings</h2>
                <Button variant="outline" size="sm" onClick={loadLeaderboard} disabled={isLoading}>
                  Refresh
                </Button>
              </div>

              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading leaderboard...
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No performance data available yet
                </div>
              ) : (
                <div className="space-y-3">
                  {leaderboard.map((score, index) => {
                    const driver = (score as any)?.drivers
                    return (
                      <Card
                        key={score.id}
                        className={`border-border p-4 ${
                          index < 3 ? "bg-primary/5" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1">
                            {/* Rank */}
                            <div className="w-12 text-center">
                              {getRankIcon(score.rank || index + 1)}
                            </div>

                            {/* Driver Info */}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-foreground">
                                  {driver?.name || "Unknown Driver"}
                                </h3>
                                {getTierBadge(score.overall_score)}
                              </div>
                              <div className="grid grid-cols-3 gap-4 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Truck className="w-3 h-3" />
                                  <span>{score.total_loads} loads</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>{score.on_time_rate.toFixed(1)}% on-time</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <TrendingUp className="w-3 h-3" />
                                  <span>{score.total_miles.toFixed(0)} miles</span>
                                </div>
                              </div>
                            </div>

                            {/* Scores */}
                            <div className="flex items-center gap-6">
                              <div className="text-center">
                                <div className="text-xs text-muted-foreground mb-1">Safety</div>
                                <div className={`text-lg font-bold ${getScoreColor(score.safety_score)}`}>
                                  {score.safety_score.toFixed(0)}
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="text-xs text-muted-foreground mb-1">Compliance</div>
                                <div className={`text-lg font-bold ${getScoreColor(score.compliance_score)}`}>
                                  {score.compliance_score.toFixed(0)}
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="text-xs text-muted-foreground mb-1">Efficiency</div>
                                <div className={`text-lg font-bold ${getScoreColor(score.efficiency_score)}`}>
                                  {score.efficiency_score.toFixed(0)}
                                </div>
                              </div>
                              <div className="text-center border-l border-border pl-6">
                                <div className="text-xs text-muted-foreground mb-1">Overall</div>
                                <div className={`text-2xl font-bold ${getScoreColor(score.overall_score)}`}>
                                  {score.overall_score.toFixed(1)}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Metrics Bar */}
                        <div className="mt-3 pt-3 border-t border-border grid grid-cols-4 gap-4 text-xs">
                          <div>
                            <span className="text-muted-foreground">Violations: </span>
                            <span className={score.violations_count > 0 ? "text-red-500" : "text-green-500"}>
                              {score.violations_count}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">HOS Violations: </span>
                            <span className={score.hos_violations > 0 ? "text-red-500" : "text-green-500"}>
                              {score.hos_violations}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Driving Hours: </span>
                            <span>{score.total_driving_hours.toFixed(1)}h</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Idle Time: </span>
                            <span>{score.idle_time_hours.toFixed(1)}h</span>
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}



