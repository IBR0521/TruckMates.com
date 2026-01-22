"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Lightbulb,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Info,
  Target,
  Users,
} from "lucide-react"
import { generateELDInsights, getDriverRecommendations, getDriverBehaviorScore, getAllDriverBehaviorScores } from "@/app/actions/eld-insights"
import { getDrivers } from "@/app/actions/drivers"
import { toast } from "sonner"
import Link from "next/link"
import { Progress } from "@/components/ui/progress"

export default function ELDInsightsPage() {
  const [insights, setInsights] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [driverId, setDriverId] = useState<string>("")
  const [drivers, setDrivers] = useState<any[]>([])
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [days, setDays] = useState(7)
  const [isLoading, setIsLoading] = useState(true)
  const [driverScore, setDriverScore] = useState<any>(null)
  const [allDriverScores, setAllDriverScores] = useState<any>(null)

  useEffect(() => {
    loadDrivers()
    loadInsights()
  }, [driverId, days])

  async function loadDrivers() {
    const result = await getDrivers()
    if (result.data) {
      setDrivers(result.data)
    }
  }

  async function loadInsights() {
    setIsLoading(true)
    try {
      const result = await generateELDInsights(driverId || undefined, days)
      if (result.error) {
        toast.error(result.error)
      } else if (result.data) {
        setInsights(result.data.insights)
        setSummary(result.data.summary)
      }

      if (driverId) {
        const [recResult, scoreResult] = await Promise.all([
          getDriverRecommendations(driverId),
          getDriverBehaviorScore(driverId, days),
        ])
        if (recResult.data) {
          setRecommendations(recResult.data.recommendations)
        }
        if (scoreResult.data) {
          setDriverScore(scoreResult.data)
        }
      } else {
        setRecommendations([])
        setDriverScore(null)
        // Load all driver scores
        const allScoresResult = await getAllDriverBehaviorScores(days)
        if (allScoresResult.data) {
          setAllDriverScores(allScoresResult.data)
        }
      }
    } catch (error) {
      toast.error("Failed to load insights")
    } finally {
      setIsLoading(false)
    }
  }

  const getInsightIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle2 className="w-5 h-5 text-green-500" />
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />
      case "critical":
        return <AlertTriangle className="w-5 h-5 text-red-500" />
      default:
        return <Info className="w-5 h-5 text-blue-500" />
    }
  }

  const getInsightColor = (type: string) => {
    switch (type) {
      case "success":
        return "bg-green-500/10 border-green-500/20"
      case "warning":
        return "bg-yellow-500/10 border-yellow-500/20"
      case "critical":
        return "bg-red-500/10 border-red-500/20"
      default:
        return "bg-blue-500/10 border-blue-500/20"
    }
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI-Powered Insights</h1>
          <p className="text-sm text-muted-foreground mt-1">Intelligent analysis of your fleet data</p>
        </div>
        <Link href="/dashboard/eld">
          <Button variant="outline">Back to ELD</Button>
        </Link>
      </div>

      {/* Content */}
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Filters */}
          <Card className="p-4 border-border">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Driver</label>
                <Select value={driverId || "all"} onValueChange={(value) => setDriverId(value === "all" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Drivers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Drivers</SelectItem>
                    {drivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        {driver.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Time Period</label>
                <Select value={days.toString()} onValueChange={(value) => setDays(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="14">Last 14 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="90">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={loadInsights} disabled={isLoading} className="w-full">
                  Refresh Insights
                </Button>
              </div>
            </div>
          </Card>

          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-4 border-border">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  <p className="text-sm text-muted-foreground">Total Violations</p>
                </div>
                <p className="text-2xl font-bold text-foreground">{summary.totalViolations}</p>
              </Card>
              <Card className="p-4 border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  <p className="text-sm text-muted-foreground">Active Drivers</p>
                </div>
                <p className="text-2xl font-bold text-foreground">{summary.totalDrivers}</p>
              </Card>
              <Card className="p-4 border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-5 h-5 text-yellow-500" />
                  <p className="text-sm text-muted-foreground">Avg Violations/Driver</p>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {summary.avgViolationsPerDriver.toFixed(1)}
                </p>
              </Card>
              <Card className="p-4 border-border">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  <p className="text-sm text-muted-foreground">Total Miles</p>
                </div>
                <p className="text-2xl font-bold text-foreground">{summary.totalMiles}</p>
              </Card>
            </div>
          )}

          {/* Insights */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Insights & Recommendations</h2>
            </div>
            {isLoading ? (
              <p className="text-muted-foreground text-center py-8">Loading insights...</p>
            ) : insights.length === 0 ? (
              <Card className="p-8 text-center border-border">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <p className="text-muted-foreground">No insights available for this period</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {insights.map((insight, index) => (
                  <Card
                    key={index}
                    className={`p-6 border ${getInsightColor(insight.type)}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="mt-1">{getInsightIcon(insight.type)}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-foreground">{insight.title}</h3>
                          <Badge
                            className={
                              insight.severity === "critical"
                                ? "bg-red-500/20 text-red-500 border-red-500/50"
                                : insight.severity === "warning"
                                ? "bg-yellow-500/20 text-yellow-500 border-yellow-500/50"
                                : "bg-blue-500/20 text-blue-500 border-blue-500/50"
                            }
                          >
                            {insight.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{insight.description}</p>
                        {insight.action && (
                          <div className="p-3 bg-background/50 rounded border border-border/50">
                            <p className="text-xs font-medium text-foreground mb-1">Recommended Action:</p>
                            <p className="text-sm text-muted-foreground">{insight.action}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Driver Behavior Score */}
          {driverId && driverScore && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Driver Behavior Score</h2>
              </div>
              <Card className="p-6 border-border">
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground">Overall Score</span>
                      <div className="flex items-center gap-2">
                        <span className="text-3xl font-bold text-foreground">{driverScore.score}/100</span>
                        <Badge
                          className={
                            driverScore.score >= 90
                              ? "bg-green-500/20 text-green-500 border-green-500/50"
                              : driverScore.score >= 75
                              ? "bg-blue-500/20 text-blue-500 border-blue-500/50"
                              : driverScore.score >= 60
                              ? "bg-yellow-500/20 text-yellow-500 border-yellow-500/50"
                              : "bg-red-500/20 text-red-500 border-red-500/50"
                          }
                        >
                          {driverScore.grade}
                        </Badge>
                      </div>
                    </div>
                    <Progress value={driverScore.score} className="h-3" />
                  </div>
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Violation Score</p>
                      <p className="text-lg font-semibold text-foreground">{driverScore.breakdown.violation_score}/50</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Compliance Score</p>
                      <p className="text-lg font-semibold text-foreground">{driverScore.breakdown.compliance_score}/30</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Safety Score</p>
                      <p className="text-lg font-semibold text-foreground">{driverScore.breakdown.safety_score}/20</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Violations per 100 Hours</p>
                      <p className="text-lg font-semibold text-foreground">{driverScore.metrics.violations_per_100_hours}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Trend</p>
                      <div className="flex items-center gap-2">
                        {driverScore.trend > 0 ? (
                          <TrendingDown className="w-4 h-4 text-green-500" />
                        ) : driverScore.trend < 0 ? (
                          <TrendingUp className="w-4 h-4 text-red-500" />
                        ) : (
                          <Info className="w-4 h-4 text-muted-foreground" />
                        )}
                        <p className="text-lg font-semibold text-foreground">
                          {driverScore.trend > 0 ? `${Math.abs(driverScore.trend).toFixed(1)}%` : driverScore.trend < 0 ? `+${Math.abs(driverScore.trend).toFixed(1)}%` : "No change"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* All Drivers Behavior Scores */}
          {!driverId && allDriverScores && allDriverScores.scores.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Fleet Behavior Scores</h2>
                <Badge className="ml-auto">
                  Avg: {allDriverScores.average_score}/100
                </Badge>
              </div>
              <Card className="border border-border/50 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Driver</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Score</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Grade</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Violations</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allDriverScores.scores.map((score: any) => (
                        <tr key={score.driver_id} className="border-b border-border hover:bg-secondary/20 transition">
                          <td className="px-6 py-4 font-medium text-foreground">{score.driver_name}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Progress value={score.score} className="h-2 w-24" />
                              <span className="text-foreground font-semibold">{score.score}/100</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <Badge
                              className={
                                score.score >= 90
                                  ? "bg-green-500/20 text-green-500 border-green-500/50"
                                  : score.score >= 75
                                  ? "bg-blue-500/20 text-blue-500 border-blue-500/50"
                                  : score.score >= 60
                                  ? "bg-yellow-500/20 text-yellow-500 border-yellow-500/50"
                                  : "bg-red-500/20 text-red-500 border-red-500/50"
                              }
                            >
                              {score.grade}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-foreground">{score.metrics.total_violations}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1">
                              {score.trend > 0 ? (
                                <>
                                  <TrendingDown className="w-4 h-4 text-green-500" />
                                  <span className="text-green-500 text-sm">{Math.abs(score.trend).toFixed(1)}%</span>
                                </>
                              ) : score.trend < 0 ? (
                                <>
                                  <TrendingUp className="w-4 h-4 text-red-500" />
                                  <span className="text-red-500 text-sm">+{Math.abs(score.trend).toFixed(1)}%</span>
                                </>
                              ) : (
                                <span className="text-muted-foreground text-sm">No change</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* Driver-Specific Recommendations */}
          {driverId && recommendations.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Driver Recommendations</h2>
              </div>
              <div className="space-y-4">
                {recommendations.map((rec, index) => (
                  <Card key={index} className="p-6 border-border">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Target className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-foreground">{rec.title}</h3>
                          <Badge
                            className={
                              rec.priority === "high"
                                ? "bg-red-500/20 text-red-500 border-red-500/50"
                                : rec.priority === "medium"
                                ? "bg-yellow-500/20 text-yellow-500 border-yellow-500/50"
                                : "bg-blue-500/20 text-blue-500 border-blue-500/50"
                            }
                          >
                            {rec.priority} priority
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{rec.description}</p>
                        <div className="p-3 bg-primary/5 rounded border border-primary/20">
                          <p className="text-sm font-medium text-foreground">{rec.action}</p>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
