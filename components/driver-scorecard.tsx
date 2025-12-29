"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Trophy, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react"
import { getDriverScorecard } from "@/app/actions/eld-advanced"
import { getDrivers } from "@/app/actions/drivers"
import { toast } from "sonner"

export function DriverScorecard() {
  const [driverId, setDriverId] = useState("")
  const [drivers, setDrivers] = useState<any[]>([])
  const [scorecard, setScorecard] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  )
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    loadDrivers()
  }, [])

  useEffect(() => {
    if (driverId) {
      loadScorecard()
    }
  }, [driverId, startDate, endDate])

  async function loadDrivers() {
    const result = await getDrivers()
    if (result.data) {
      setDrivers(result.data)
    }
  }

  async function loadScorecard() {
    if (!driverId) return

    setIsLoading(true)
    try {
      const result = await getDriverScorecard(driverId, startDate, endDate)
      if (result.error) {
        toast.error(result.error)
      } else if (result.data) {
        setScorecard(result.data)
      }
    } catch (error) {
      toast.error("Failed to load scorecard")
    } finally {
      setIsLoading(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-500"
    if (score >= 70) return "text-blue-500"
    if (score >= 50) return "text-yellow-500"
    return "text-red-500"
  }

  const getScoreBadge = (score: number) => {
    if (score >= 90) return "Excellent"
    if (score >= 70) return "Good"
    if (score >= 50) return "Fair"
    return "Needs Improvement"
  }

  return (
    <Card className="p-6 border-border">
      <div className="flex items-center gap-2 mb-6">
        <Trophy className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Driver Scorecard</h2>
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <Label htmlFor="driver">Driver</Label>
          <Select value={driverId} onValueChange={setDriverId}>
            <SelectTrigger>
              <SelectValue placeholder="Select driver" />
            </SelectTrigger>
            <SelectContent>
              {drivers.map((driver) => (
                <SelectItem key={driver.id} value={driver.id}>
                  {driver.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="endDate">End Date</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {scorecard && (
        <div className="space-y-6">
          {/* Overall Score */}
          <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">Overall Score</p>
              <p className={`text-6xl font-bold ${getScoreColor(scorecard.scores.overall)}`}>
                {scorecard.scores.overall.toFixed(0)}
              </p>
              <p className="text-lg font-semibold text-foreground mt-2">
                {getScoreBadge(scorecard.scores.overall)}
              </p>
            </div>
          </Card>

          {/* Score Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4 bg-card/50 border-border">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Safety Score</p>
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              </div>
              <p className={`text-3xl font-bold ${getScoreColor(scorecard.scores.safety)}`}>
                {scorecard.scores.safety.toFixed(0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Based on violations
              </p>
            </Card>

            <Card className="p-4 bg-card/50 border-border">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Compliance Score</p>
                <Trophy className="w-4 h-4 text-blue-500" />
              </div>
              <p className={`text-3xl font-bold ${getScoreColor(scorecard.scores.compliance)}`}>
                {scorecard.scores.compliance.toFixed(0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                HOS compliance
              </p>
            </Card>

            <Card className="p-4 bg-card/50 border-border">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Efficiency Score</p>
                <TrendingUp className="w-4 h-4 text-yellow-500" />
              </div>
              <p className={`text-3xl font-bold ${getScoreColor(scorecard.scores.efficiency)}`}>
                {scorecard.scores.efficiency.toFixed(0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Miles driven
              </p>
            </Card>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 bg-card/50 border-border">
              <p className="text-xs text-muted-foreground mb-1">Driving Hours</p>
              <p className="text-xl font-bold text-foreground">
                {scorecard.metrics.totalDrivingHours.toFixed(0)}h
              </p>
            </Card>

            <Card className="p-4 bg-card/50 border-border">
              <p className="text-xs text-muted-foreground mb-1">Total Miles</p>
              <p className="text-xl font-bold text-foreground">
                {scorecard.metrics.totalMiles.toFixed(0)}
              </p>
            </Card>

            <Card className="p-4 bg-card/50 border-border">
              <p className="text-xs text-muted-foreground mb-1">HOS Violations</p>
              <p className={`text-xl font-bold ${
                scorecard.metrics.hosViolations > 0 ? "text-red-500" : "text-green-500"
              }`}>
                {scorecard.metrics.hosViolations}
              </p>
            </Card>

            <Card className="p-4 bg-card/50 border-border">
              <p className="text-xs text-muted-foreground mb-1">Total Violations</p>
              <p className={`text-xl font-bold ${
                scorecard.metrics.totalViolations > 0 ? "text-red-500" : "text-green-500"
              }`}>
                {scorecard.metrics.totalViolations}
              </p>
            </Card>
          </div>

          {/* Violation Breakdown */}
          {scorecard.metrics.totalViolations > 0 && (
            <Card className="p-4 bg-red-500/10 border-red-500/20">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h3 className="font-semibold text-foreground">Violation Breakdown</h3>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">HOS Violations</p>
                  <p className="font-semibold text-foreground">
                    {scorecard.metrics.hosViolations}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Speeding Events</p>
                  <p className="font-semibold text-foreground">
                    {scorecard.metrics.speedingEvents}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Hard Braking</p>
                  <p className="font-semibold text-foreground">
                    {scorecard.metrics.hardBraking}
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {!driverId && (
        <div className="text-center py-8 text-muted-foreground">
          Select a driver to view scorecard
        </div>
      )}
    </Card>
  )
}
