"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { getAlerts, getAlertCounts, acknowledgeAlert, resolveAlert } from "@/app/actions/alerts"
import { Bell, AlertTriangle, CheckCircle2, XCircle, Info, Clock } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([])
  const [alertCounts, setAlertCounts] = useState({ active: 0, critical: 0, acknowledged: 0, resolved: 0 }) // FIXED: Use efficient counts instead of fetching all records
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState("active") // active, acknowledged, resolved, all
  const [priorityFilter, setPriorityFilter] = useState("all") // all, low, normal, high, critical
  // FIXED: Add confirmation dialog state
  const [acknowledgeDialogOpen, setAcknowledgeDialogOpen] = useState(false)
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false)
  const [selectedAlert, setSelectedAlert] = useState<any>(null)

  useEffect(() => {
    loadAlerts()
  }, [filter, priorityFilter])

  async function loadAlerts() {
    setIsLoading(true)
    try {
      // FIXED: Use efficient COUNT queries for summary cards instead of fetching all records
      const [countsResult, filteredResult] = await Promise.all([
        getAlertCounts(),
        getAlerts({
          status: filter === "all" ? undefined : filter,
          priority: priorityFilter === "all" ? undefined : priorityFilter,
          limit: 100,
        })
      ])

      if (countsResult.data) {
        setAlertCounts(countsResult.data) // Store counts for summary cards
      }
      
      if (filteredResult.data) {
        setAlerts(filteredResult.data) // Store for list view
      } else if (filteredResult.error) {
        // Only show error if it's not "No company found" (user might be setting up)
        if (filteredResult.error !== "No company found") {
          toast.error(filteredResult.error)
        }
      }
    } catch (error: any) {
      toast.error("Failed to load alerts")
    } finally {
      setIsLoading(false)
    }
  }

  // FIXED: Add confirmation dialogs before actions
  function handleAcknowledgeClick(alert: any) {
    setSelectedAlert(alert)
    setAcknowledgeDialogOpen(true)
  }

  function handleResolveClick(alert: any) {
    setSelectedAlert(alert)
    setResolveDialogOpen(true)
  }

  async function handleAcknowledge() {
    if (!selectedAlert) return
    try {
      const result = await acknowledgeAlert(selectedAlert.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Alert acknowledged")
        setAcknowledgeDialogOpen(false)
        setSelectedAlert(null)
        loadAlerts()
      }
    } catch (error: any) {
      toast.error("Failed to acknowledge alert")
    }
  }

  async function handleResolve() {
    if (!selectedAlert) return
    try {
      const result = await resolveAlert(selectedAlert.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Alert resolved")
        setResolveDialogOpen(false)
        setSelectedAlert(null)
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

  // FIXED: Use efficient counts from COUNT queries instead of filtering arrays
  const activeAlertsCount = alertCounts.active
  const criticalAlertsCount = alertCounts.critical
  const acknowledgedAlertsCount = alertCounts.acknowledged
  const resolvedAlertsCount = alertCounts.resolved

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
                  <p className="text-2xl font-bold">{activeAlertsCount}</p>
                </div>
                <Bell className="w-8 h-8 text-primary" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Critical</p>
                  <p className="text-2xl font-bold text-red-600">{criticalAlertsCount}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Acknowledged</p>
                  <p className="text-2xl font-bold">
                    {acknowledgedAlertsCount}
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
                    {resolvedAlertsCount}
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
                            onClick={() => handleAcknowledgeClick(alert)}
                          >
                            Acknowledge
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResolveClick(alert)}
                          >
                            Resolve
                          </Button>
                        </>
                      )}
                      {alert.status === "acknowledged" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResolveClick(alert)}
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

      {/* FIXED: Confirmation dialogs */}
      <AlertDialog open={acknowledgeDialogOpen} onOpenChange={setAcknowledgeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Acknowledge Alert</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to acknowledge "{selectedAlert?.title}"?
              {selectedAlert?.priority === "critical" || selectedAlert?.priority === "high" ? (
                <span className="block mt-2 text-red-600 font-semibold">
                  This is a {selectedAlert?.priority} priority alert. This action cannot be undone.
                </span>
              ) : (
                <span className="block mt-2 text-muted-foreground">This action cannot be undone.</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAcknowledge}>Acknowledge</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resolve Alert</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to resolve "{selectedAlert?.title}"?
              {selectedAlert?.priority === "critical" || selectedAlert?.priority === "high" ? (
                <span className="block mt-2 text-red-600 font-semibold">
                  This is a {selectedAlert?.priority} priority alert. This action cannot be undone.
                </span>
              ) : (
                <span className="block mt-2 text-muted-foreground">This action cannot be undone.</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResolve}>Resolve</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}








