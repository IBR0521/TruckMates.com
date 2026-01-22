"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { getAlerts, acknowledgeAlert, resolveAlert } from "@/app/actions/alerts"
import { Bell, AlertTriangle, CheckCircle2, XCircle, Info, Clock } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState("active") // active, acknowledged, resolved, all
  const [priorityFilter, setPriorityFilter] = useState("all") // all, low, normal, high, critical

  useEffect(() => {
    loadAlerts()
  }, [filter, priorityFilter])

  async function loadAlerts() {
    setIsLoading(true)
    try {
      const result = await getAlerts({
        status: filter === "all" ? undefined : filter,
        priority: priorityFilter === "all" ? undefined : priorityFilter,
        limit: 100,
      })

      if (result.data) {
        setAlerts(result.data)
      } else if (result.error) {
        toast.error(result.error)
      }
    } catch (error: any) {
      toast.error("Failed to load alerts")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleAcknowledge(id: string) {
    try {
      const result = await acknowledgeAlert(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Alert acknowledged")
        loadAlerts()
      }
    } catch (error: any) {
      toast.error("Failed to acknowledge alert")
    }
  }

  async function handleResolve(id: string) {
    try {
      const result = await resolveAlert(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Alert resolved")
        loadAlerts()
      }
    } catch (error: any) {
      toast.error("Failed to resolve alert")
    }
  }

  function getPriorityBadge(priority: string) {
    switch (priority) {
      case "critical":
        return <Badge variant="destructive" className="bg-red-600">Critical</Badge>
      case "high":
        return <Badge variant="destructive">High</Badge>
      case "normal":
        return <Badge variant="secondary">Normal</Badge>
      case "low":
        return <Badge variant="outline">Low</Badge>
      default:
        return <Badge variant="secondary">{priority}</Badge>
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "active":
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Active</Badge>
      case "acknowledged":
        return <Badge variant="secondary"><Info className="w-3 h-3 mr-1" />Acknowledged</Badge>
      case "resolved":
        return <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20"><CheckCircle2 className="w-3 h-3 mr-1" />Resolved</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  function getEventTypeLabel(type: string) {
    return type.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")
  }

  const activeAlerts = alerts.filter(a => a.status === "active")
  const criticalAlerts = alerts.filter(a => a.priority === "critical" && a.status === "active")

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Alerts</h1>
          <p className="text-sm text-muted-foreground mt-1">Monitor and manage system alerts</p>
        </div>
        <Link href="/dashboard/settings/alerts">
          <Button variant="outline">Manage Alert Rules</Button>
        </Link>
      </div>

      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Summary Cards */}
          <div className="grid md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Alerts</p>
                  <p className="text-2xl font-bold">{activeAlerts.length}</p>
                </div>
                <Bell className="w-8 h-8 text-primary" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Critical</p>
                  <p className="text-2xl font-bold text-red-600">{criticalAlerts.length}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Acknowledged</p>
                  <p className="text-2xl font-bold">
                    {alerts.filter(a => a.status === "acknowledged").length}
                  </p>
                </div>
                <Info className="w-8 h-8 text-blue-500" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Resolved</p>
                  <p className="text-2xl font-bold">
                    {alerts.filter(a => a.status === "resolved").length}
                  </p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
            </Card>
          </div>

          {/* Filters */}
          <Card className="p-4">
            <div className="flex items-center gap-4">
              <div>
                <label className="text-sm text-muted-foreground mr-2">Status:</label>
                <Select value={filter} onValueChange={setFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="acknowledged">Acknowledged</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mr-2">Priority:</label>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {/* Alerts List */}
          {isLoading ? (
            <div className="text-center py-8">Loading alerts...</div>
          ) : alerts.length === 0 ? (
            <Card className="p-8 text-center">
              <Bell className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No alerts found</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {alerts.map((alert) => (
                <Card key={alert.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getPriorityBadge(alert.priority)}
                        {getStatusBadge(alert.status)}
                        <Badge variant="outline">{getEventTypeLabel(alert.event_type)}</Badge>
                      </div>
                      <h3 className="font-semibold text-lg mb-1">{alert.title}</h3>
                      <p className="text-muted-foreground mb-3">{alert.message}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {format(new Date(alert.created_at), "MMM d, yyyy h:mm a")}
                        </span>
                        {alert.load_id && typeof alert.load_id === 'string' && alert.load_id.trim() !== '' ? (
                          <Link href={`/dashboard/loads/${alert.load_id}`} className="text-primary hover:underline">
                            View Load
                          </Link>
                        ) : null}
                        {alert.driver_id && typeof alert.driver_id === 'string' && alert.driver_id.trim() !== '' ? (
                          <Link href={`/dashboard/drivers/${alert.driver_id}`} className="text-primary hover:underline">
                            View Driver
                          </Link>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {alert.status === "active" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAcknowledge(alert.id)}
                          >
                            Acknowledge
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResolve(alert.id)}
                          >
                            Resolve
                          </Button>
                        </>
                      )}
                      {alert.status === "acknowledged" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResolve(alert.id)}
                        >
                          Resolve
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}








