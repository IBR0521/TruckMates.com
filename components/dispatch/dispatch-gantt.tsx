"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Calendar,
  AlertTriangle,
  Clock,
  MapPin,
  User,
  Truck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { format, addDays, startOfWeek, endOfWeek, isSameDay, isWithinInterval } from "date-fns"
import { getDriverTimelines, type DriverTimeline, type TimelineJob } from "@/app/actions/dispatch-timeline"
import { toast } from "sonner"

interface DispatchGanttProps {
  startDate?: Date
  endDate?: Date
  driverId?: string
  onJobClick?: (job: TimelineJob) => void
}

export function DispatchGantt({
  startDate,
  endDate,
  driverId,
  onJobClick,
}: DispatchGanttProps) {
  const [timelines, setTimelines] = useState<DriverTimeline[]>([])
  const [loading, setLoading] = useState(true)
  const [viewStartDate, setViewStartDate] = useState(startDate || startOfWeek(new Date()))
  const [viewEndDate, setViewEndDate] = useState(endDate || endOfWeek(new Date()))
  const [selectedDriver, setSelectedDriver] = useState<string | null>(driverId || null)

  useEffect(() => {
    loadTimelines()
  }, [viewStartDate, viewEndDate, selectedDriver])

  async function loadTimelines() {
    setLoading(true)
    try {
      const result = await getDriverTimelines({
        driver_id: selectedDriver || undefined,
        start_date: viewStartDate,
        end_date: viewEndDate,
      })

      if (result.error) {
        toast.error(result.error)
      } else if (result.data) {
        setTimelines(result.data)
      }
    } catch (error: any) {
      toast.error("Failed to load timelines")
    } finally {
      setLoading(false)
    }
  }

  function getJobColor(job: TimelineJob): string {
    if (job.hos_violation) return "bg-orange-500" // Changed from red to orange
    if (job.conflicts.length > 0) return "bg-amber-500" // Changed from orange to amber
    if (job.urgency_score >= 70) return "bg-yellow-500"
    if (job.status === "in_transit") return "bg-green-500"
    if (job.status === "scheduled") return "bg-blue-500"
    return "bg-gray-500"
  }

  function getJobWidth(job: TimelineJob, dayWidth: number): number {
    const start = new Date(job.scheduled_start).getTime()
    const end = new Date(job.scheduled_end).getTime()
    const duration = end - start
    const totalDuration = viewEndDate.getTime() - viewStartDate.getTime()
    return Math.max((duration / totalDuration) * (dayWidth * 7), 60) // Minimum 60px width
  }

  function getJobLeft(job: TimelineJob, dayWidth: number): number {
    const jobStart = new Date(job.scheduled_start).getTime()
    const viewStart = viewStartDate.getTime()
    const totalDuration = viewEndDate.getTime() - viewStartDate.getTime()
    return ((jobStart - viewStart) / totalDuration) * (dayWidth * 7)
  }

  function navigateWeek(direction: "prev" | "next") {
    const days = direction === "next" ? 7 : -7
    setViewStartDate(addDays(viewStartDate, days))
    setViewEndDate(addDays(viewEndDate, days))
  }

  if (loading) {
    return (
      <Card className="border-border p-8">
        <div className="text-center text-muted-foreground">Loading timeline...</div>
      </Card>
    )
  }

  if (timelines.length === 0) {
    return (
      <Card className="border-border p-8">
        <div className="text-center">
          <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No scheduled jobs</h3>
          <p className="text-muted-foreground">No loads or routes scheduled for this period.</p>
        </div>
      </Card>
    )
  }

  const dayWidth = 120 // Width of each day column in pixels
  const days = []
  for (let i = 0; i < 7; i++) {
    days.push(addDays(viewStartDate, i))
  }

  return (
    <Card className="border-border p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Timeline View</h2>
          <p className="text-sm text-muted-foreground">
            {format(viewStartDate, "MMM dd")} - {format(viewEndDate, "MMM dd, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigateWeek("prev")}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigateWeek("next")}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={loadTimelines}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Driver Filter */}
      {!driverId && (
        <div className="mb-4 flex gap-2 flex-wrap">
          <Button
            variant={selectedDriver === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedDriver(null)}
          >
            All Drivers
          </Button>
          {timelines.map((timeline) => (
            <Button
              key={timeline.driver_id}
              variant={selectedDriver === timeline.driver_id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedDriver(timeline.driver_id)}
            >
              {timeline.driver_name}
              {timeline.conflicts > 0 && (
                <AlertTriangle className="w-3 h-3 ml-1 text-orange-500" />
              )}
              {timeline.hos_violations > 0 && (
                <AlertTriangle className="w-3 h-3 ml-1 text-orange-500" />
              )}
            </Button>
          ))}
        </div>
      )}

      {/* Timeline Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-full">
          {/* Day Headers */}
          <div className="flex border-b border-border mb-2">
            <div className="w-48 flex-shrink-0 p-2 font-semibold text-sm text-muted-foreground">
              Driver
            </div>
            {days.map((day, index) => (
              <div
                key={index}
                className="flex-1 min-w-[120px] p-2 text-center border-l border-border"
              >
                <div className="text-xs text-muted-foreground">{format(day, "EEE")}</div>
                <div className="text-sm font-semibold text-foreground">{format(day, "MMM dd")}</div>
              </div>
            ))}
          </div>

          {/* Driver Rows */}
          {timelines.map((timeline) => (
            <div key={timeline.driver_id} className="flex border-b border-border min-h-[80px]">
              {/* Driver Info */}
              <div className="w-48 flex-shrink-0 p-3 border-r border-border">
                <div className="flex items-center gap-2 mb-1">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold text-foreground">{timeline.driver_name}</span>
                </div>
                {timeline.truck_number && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Truck className="w-3 h-3" />
                    <span>{timeline.truck_number}</span>
                  </div>
                )}
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span className="text-muted-foreground">
                      {Math.round(timeline.total_drive_time_minutes / 60)}h drive
                    </span>
                  </div>
                  {timeline.conflicts > 0 && (
                    <div className="flex items-center gap-1 text-orange-500">
                      <AlertTriangle className="w-3 h-3" />
                      <span>{timeline.conflicts} conflict(s)</span>
                    </div>
                  )}
                  {timeline.hos_violations > 0 && (
                    <div className="flex items-center gap-1 text-orange-500">
                      <AlertTriangle className="w-3 h-3" />
                      <span>HOS violation</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Timeline Bar */}
              <div className="flex-1 relative p-2">
                {timeline.jobs.map((job) => {
                  const jobStart = new Date(job.scheduled_start)
                  const jobEnd = new Date(job.scheduled_end)
                  const isVisible = isWithinInterval(jobStart, {
                    start: viewStartDate,
                    end: viewEndDate,
                  })

                  if (!isVisible) return null

                  const left = getJobLeft(job, dayWidth)
                  const width = getJobWidth(job, dayWidth)
                  const color = getJobColor(job)

                  return (
                    <div
                      key={job.id}
                      className={`absolute top-2 bottom-2 rounded-md ${color} text-white p-2 cursor-pointer hover:opacity-90 transition-opacity shadow-sm`}
                      style={{
                        left: `${left}px`,
                        width: `${width}px`,
                        minWidth: "60px",
                      }}
                      onClick={() => onJobClick?.(job)}
                      title={`${job.type === "load" ? job.shipment_number : job.route_name}\n${job.origin} → ${job.destination}\n${format(jobStart, "MMM dd HH:mm")} - ${format(jobEnd, "MMM dd HH:mm")}`}
                    >
                      <div className="text-xs font-semibold truncate">
                        {job.type === "load" ? job.shipment_number : job.route_name}
                      </div>
                      <div className="text-xs opacity-90 truncate">
                        {job.origin} → {job.destination}
                      </div>
                      <div className="text-xs opacity-75 mt-1">
                        {format(jobStart, "HH:mm")} - {format(jobEnd, "HH:mm")}
                      </div>
                      {job.conflicts.length > 0 && (
                        <div className="absolute top-1 right-1">
                          <AlertTriangle className="w-3 h-3 text-white" />
                        </div>
                      )}
                      {job.hos_violation && (
                        <div className="absolute bottom-1 right-1">
                          <Badge variant="destructive" className="text-xs px-1 py-0">
                            HOS
                          </Badge>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-border">
        <div className="flex items-center gap-4 flex-wrap text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-500"></div>
            <span className="text-muted-foreground">Scheduled</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500"></div>
            <span className="text-muted-foreground">In Transit</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-yellow-500"></div>
            <span className="text-muted-foreground">Urgent</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-orange-500"></div>
            <span className="text-muted-foreground">Conflict</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-orange-500"></div>
            <span className="text-muted-foreground">HOS Violation</span>
          </div>
        </div>
      </div>
    </Card>
  )
}

