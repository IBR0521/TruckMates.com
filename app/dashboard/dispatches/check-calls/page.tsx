"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { getCheckCalls, updateCheckCall, getOverdueCheckCalls } from "@/app/actions/check-calls"
import { getDrivers } from "@/app/actions/drivers"
import { getLoads } from "@/app/actions/loads"
import { Radio, Clock, MapPin, AlertTriangle, CheckCircle2, XCircle } from "lucide-react"
import { format } from "date-fns"

export default function CheckCallsPage() {
  const [checkCalls, setCheckCalls] = useState<any[]>([])
  const [overdueCalls, setOverdueCalls] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState("all") // all, pending, completed, missed, overdue
  const [drivers, setDrivers] = useState<any[]>([])
  const [loads, setLoads] = useState<any[]>([])

  useEffect(() => {
    loadData()
  }, [filter])

  async function loadData() {
    setIsLoading(true)
    try {
      const [callsResult, overdueResult, driversResult, loadsResult] = await Promise.all([
        getCheckCalls({ status: filter === "all" ? undefined : filter }),
        getOverdueCheckCalls(),
        getDrivers(),
        getLoads(),
      ])

      if (callsResult.data) {
        setCheckCalls(callsResult.data)
      }
      if (overdueResult.data) {
        setOverdueCalls(overdueResult.data)
      }
      if (driversResult.data) {
        setDrivers(driversResult.data)
      }
      if (loadsResult.data) {
        setLoads(loadsResult.data)
      }
    } catch (error: any) {
      toast.error("Failed to load check calls")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleUpdateStatus(id: string, status: string) {
    try {
      const result = await updateCheckCall(id, { status })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Check call updated")
        loadData()
      }
    } catch (error: any) {
      toast.error("Failed to update check call")
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "completed":
        return <Badge variant="success"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>
      case "missed":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Missed</Badge>
      case "overdue":
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Overdue</Badge>
      default:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>
    }
  }

  function getCallTypeLabel(type: string) {
    switch (type) {
      case "pickup":
        return "Pickup"
      case "delivery":
        return "Delivery"
      case "scheduled":
        return "Scheduled"
      case "milestone":
        return "Milestone"
      case "border_crossing":
        return "Border Crossing"
      case "emergency":
        return "Emergency"
      default:
        return type
    }
  }

  const displayCalls = filter === "overdue" ? overdueCalls : checkCalls
  const driverMap = new Map(drivers.map(d => [d.id, d]))
  const loadMap = new Map(loads.map(l => [l.id, l]))

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Check Calls</h1>
          <p className="text-sm text-muted-foreground mt-1">Track driver check-ins and communication</p>
        </div>
      </div>

      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Filters */}
          <Card className="p-4">
            <div className="flex items-center gap-4">
              <Label>Filter:</Label>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Check Calls</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="missed">Missed</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
              {overdueCalls.length > 0 && (
                <Badge variant="destructive" className="ml-auto">
                  {overdueCalls.length} Overdue
                </Badge>
              )}
            </div>
          </Card>

          {/* Check Calls List */}
          {isLoading ? (
            <div className="text-center py-8">Loading check calls...</div>
          ) : displayCalls.length === 0 ? (
            <Card className="p-8 text-center">
              <Radio className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No check calls found</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {displayCalls.map((call) => {
                const driver = driverMap.get(call.driver_id)
                const load = call.load_id ? loadMap.get(call.load_id) : null

                return (
                  <Card key={call.id} className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {getStatusBadge(call.status)}
                          <Badge variant="outline">{getCallTypeLabel(call.call_type)}</Badge>
                        </div>
                        <div className="space-y-1">
                          <p className="font-medium">
                            {driver?.name || "Unknown Driver"}
                            {load && ` - Load ${load.shipment_number}`}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              Scheduled: {call.scheduled_time ? format(new Date(call.scheduled_time), "MMM d, yyyy h:mm a") : "N/A"}
                            </span>
                            {call.actual_time && (
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="w-4 h-4" />
                                Actual: {format(new Date(call.actual_time), "MMM d, yyyy h:mm a")}
                              </span>
                            )}
                          </div>
                          {call.location && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <MapPin className="w-4 h-4" />
                              {call.location}
                            </div>
                          )}
                          {call.notes && (
                            <p className="text-sm text-muted-foreground mt-2">{call.notes}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {call.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUpdateStatus(call.id, "completed")}
                            >
                              Mark Complete
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUpdateStatus(call.id, "missed")}
                            >
                              Mark Missed
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}








