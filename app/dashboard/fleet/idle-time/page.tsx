"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Fuel,
  Clock,
  TrendingUp,
  AlertTriangle,
  Truck,
  User,
  Calendar,
  DollarSign,
} from "lucide-react"
import { getIdleTimeSessions, getIdleTimeStats, type IdleTimeSession } from "@/app/actions/idle-time-tracking"
import { toast } from "sonner"
import { format } from "date-fns"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function IdleTimeDashboardPage() {
  const [sessions, setSessions] = useState<IdleTimeSession[]>([])
  const [stats, setStats] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [filters, setFilters] = useState({
    start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    min_duration: 10, // Minimum 10 minutes
  })

  useEffect(() => {
    loadData()
  }, [filters])

  async function loadData() {
    setIsLoading(true)
    try {
      const [sessionsResult, statsResult] = await Promise.all([
        getIdleTimeSessions({
          start_date: filters.start_date,
          end_date: filters.end_date,
          min_duration_minutes: filters.min_duration,
          limit: 100
        }),
        getIdleTimeStats({
          start_date: filters.start_date,
          end_date: filters.end_date
        })
      ])

      if (sessionsResult.error) {
        toast.error(sessionsResult.error)
      } else if (sessionsResult.data) {
        setSessions(sessionsResult.data)
      }

      if (statsResult.error) {
        console.error("Failed to load stats:", statsResult.error)
      } else if (statsResult.data) {
        setStats(statsResult.data)
      }
    } catch (error: any) {
      toast.error("Failed to load idle time data")
    } finally {
      setIsLoading(false)
    }
  }

  function getStatusBadge(duration: number | null) {
    if (!duration) return <Badge variant="outline">Active</Badge>
    if (duration >= 60) return <Badge className="bg-red-500/20 text-red-500 border-red-500/50">Excessive</Badge>
    if (duration >= 30) return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/50">High</Badge>
    return <Badge className="bg-green-500/20 text-green-500 border-green-500/50">Normal</Badge>
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Idle Time Monitoring</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track fuel waste from excessive idling and coach drivers on fuel savings
          </p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={isLoading}>
          Refresh
        </Button>
      </div>

      {/* Content */}
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Filters */}
          <Card className="border-border p-4">
            <div className="grid md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={filters.start_date}
                  onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={filters.end_date}
                  onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="min_duration">Min Duration (minutes)</Label>
                <Input
                  id="min_duration"
                  type="number"
                  value={filters.min_duration}
                  onChange={(e) => setFilters({ ...filters, min_duration: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={loadData} className="w-full" disabled={isLoading}>
                  Apply Filters
                </Button>
              </div>
            </div>
          </Card>

          {/* Statistics Cards */}
          {stats && (
            <div className="grid md:grid-cols-4 gap-4">
              <Card className="border-border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Total Idle Time</p>
                    <p className="text-3xl font-bold text-foreground">
                      {stats.total_hours.toFixed(1)}h
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stats.total_minutes.toFixed(0)} minutes
                    </p>
                  </div>
                  <Clock className="w-10 h-10 text-primary opacity-50" />
                </div>
              </Card>

              <Card className="border-border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Total Fuel Cost</p>
                    <p className="text-3xl font-bold text-foreground">
                      ${stats.total_fuel_cost.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Estimated waste
                    </p>
                  </div>
                  <DollarSign className="w-10 h-10 text-primary opacity-50" />
                </div>
              </Card>

              <Card className="border-border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Total Sessions</p>
                    <p className="text-3xl font-bold text-foreground">
                      {stats.total_sessions}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Avg {stats.avg_duration_minutes.toFixed(0)} min
                    </p>
                  </div>
                  <TrendingUp className="w-10 h-10 text-primary opacity-50" />
                </div>
              </Card>

              <Card className="border-border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Top Offender</p>
                    <p className="text-lg font-bold text-foreground">
                      {Object.keys(stats.by_driver || {}).length > 0
                        ? "See Details"
                        : "N/A"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Driver with most idle time
                    </p>
                  </div>
                  <AlertTriangle className="w-10 h-10 text-primary opacity-50" />
                </div>
              </Card>
            </div>
          )}

          {/* Idle Time Sessions */}
          <Card className="border-border">
            <div className="p-6">
              <h2 className="text-xl font-bold text-foreground mb-4">Recent Idle Sessions</h2>

              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading idle time data...
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No idle time sessions found for the selected period
                </div>
              ) : (
                <div className="space-y-3">
                  {sessions.map((session) => {
                    const truck = (session as any)?.trucks
                    const driver = (session as any)?.drivers
                    return (
                      <Card key={session.id} className="border-border p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Truck className="w-4 h-4 text-muted-foreground" />
                              <h3 className="font-semibold text-foreground">
                                {truck?.truck_number || "Unknown Truck"}
                              </h3>
                              {driver && (
                                <>
                                  <User className="w-4 h-4 text-muted-foreground ml-2" />
                                  <span className="text-sm text-muted-foreground">
                                    {driver.name}
                                  </span>
                                </>
                              )}
                              {getStatusBadge(session.duration_minutes)}
                            </div>

                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Duration: </span>
                                <span className="font-semibold">
                                  {session.duration_minutes
                                    ? `${Math.floor(session.duration_minutes / 60)}h ${session.duration_minutes % 60}m`
                                    : "Active"}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Start: </span>
                                <span>
                                  {format(new Date(session.start_time), "MMM d, h:mm a")}
                                </span>
                              </div>
                              {session.end_time && (
                                <div>
                                  <span className="text-muted-foreground">End: </span>
                                  <span>
                                    {format(new Date(session.end_time), "MMM d, h:mm a")}
                                  </span>
                                </div>
                              )}
                            </div>

                            {session.estimated_fuel_cost && (
                              <div className="mt-2 pt-2 border-t border-border">
                                <div className="flex items-center gap-4 text-sm">
                                  <div className="flex items-center gap-1">
                                    <Fuel className="w-3 h-3 text-muted-foreground" />
                                    <span className="text-muted-foreground">Fuel: </span>
                                    <span className="font-semibold">
                                      {session.estimated_fuel_gallons?.toFixed(2) || "0.00"} gal
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <DollarSign className="w-3 h-3 text-muted-foreground" />
                                    <span className="text-muted-foreground">Cost: </span>
                                    <span className="font-semibold text-red-500">
                                      ${session.estimated_fuel_cost.toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
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



