"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  CheckCheck,
  Filter,
  Search,
} from "lucide-react"
import { getUnifiedNotifications, markNotificationAsRead, markAllNotificationsAsRead } from "@/app/actions/unified-notifications"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import Link from "next/link"

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filters, setFilters] = useState({
    type: "all" as "all" | "notifications" | "alerts",
    read: undefined as boolean | undefined,
    priority: "all",
    search: "",
  })

  useEffect(() => {
    loadNotifications()
  }, [filters.type, filters.read, filters.priority])

  async function loadNotifications() {
    setIsLoading(true)
    try {
      const result = await getUnifiedNotifications({
        type: filters.type,
        read: filters.read,
        priority: filters.priority === "all" ? undefined : filters.priority,
        limit: 100,
      })

      if (result.error) {
        toast.error(result.error)
        setNotifications([])
      } else {
        setNotifications(result.data || [])
      }
    } catch (error: any) {
      toast.error("Failed to load notifications")
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleMarkAsRead(id: string, type: "notification" | "alert") {
    try {
      const result = await markNotificationAsRead(id, type)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Marked as read")
        loadNotifications()
      }
    } catch (error: any) {
      toast.error("Failed to mark as read")
    }
  }

  async function handleMarkAllAsRead() {
    try {
      const result = await markAllNotificationsAsRead()
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("All notifications marked as read")
        loadNotifications()
      }
    } catch (error: any) {
      toast.error("Failed to mark all as read")
    }
  }

  function getNotificationIcon(type: string, source: string) {
    if (source === "alerts") {
      return <AlertTriangle className="w-5 h-5" />
    }
    switch (type) {
      case "route_update":
        return "🛣️"
      case "load_update":
        return "📦"
      case "maintenance_alert":
        return "🔧"
      case "payment_reminder":
        return "💰"
      default:
        return <Bell className="w-5 h-5" />
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

  function getNotificationLink(notification: any) {
    if (notification.metadata?.load_id) {
      return `/dashboard/loads/${notification.metadata.load_id}`
    }
    if (notification.metadata?.route_id) {
      return `/dashboard/routes/${notification.metadata.route_id}`
    }
    if (notification.metadata?.driver_id) {
      return `/dashboard/drivers/${notification.metadata.driver_id}`
    }
    if (notification.metadata?.truck_id) {
      return `/dashboard/trucks/${notification.metadata.truck_id}`
    }
    return null
  }

  // Filter by search term
  const filteredNotifications = notifications.filter((n) => {
    if (!filters.search) return true
    const searchLower = filters.search.toLowerCase()
    return (
      n.title?.toLowerCase().includes(searchLower) ||
      n.message?.toLowerCase().includes(searchLower)
    )
  })

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="w-full bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Notifications</h1>
            <p className="text-muted-foreground mt-2">
              All your alerts and system notifications in one place
            </p>
          </div>
          {unreadCount > 0 && (
            <Button onClick={handleMarkAllAsRead} variant="outline">
              <CheckCheck className="w-4 h-4 mr-2" />
              Mark All Read ({unreadCount})
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Filters */}
          <Card className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Type</label>
                <Select
                  value={filters.type}
                  onValueChange={(value: any) => setFilters({ ...filters, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="notifications">System Notifications</SelectItem>
                    <SelectItem value="alerts">Alerts</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select
                  value={filters.read === undefined ? "all" : filters.read ? "read" : "unread"}
                  onValueChange={(value) =>
                    setFilters({
                      ...filters,
                      read: value === "all" ? undefined : value === "read",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="unread">Unread</SelectItem>
                    <SelectItem value="read">Read</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Priority</label>
                <Select
                  value={filters.priority}
                  onValueChange={(value) => setFilters({ ...filters, priority: value })}
                >
                  <SelectTrigger>
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

              <div>
                <label className="text-sm font-medium mb-2 block">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search notifications..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Notifications List */}
          <Card className="p-6">
            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading notifications...</p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground">No notifications found</p>
                <p className="text-sm text-muted-foreground mt-2">
                  {filters.type !== "all" || filters.read !== undefined || filters.priority !== "all"
                    ? "Try adjusting your filters"
                    : "You're all caught up!"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredNotifications.map((notification) => {
                  const link = getNotificationLink(notification)
                  const NotificationContent = (
                    <div
                      className={`p-4 rounded-lg border transition-colors ${
                        !notification.read
                          ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800"
                          : "bg-card border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 mt-1">
                          {typeof getNotificationIcon(notification.type, notification.source) === "string" ? (
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg">
                              {getNotificationIcon(notification.type, notification.source)}
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              {getNotificationIcon(notification.type, notification.source)}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-foreground">{notification.title}</h3>
                                {getPriorityBadge(notification.priority)}
                                {notification.source === "alerts" && (
                                  <Badge variant="outline" className="text-xs">
                                    Alert
                                  </Badge>
                                )}
                              </div>
                              {notification.message && (
                                <p className="text-sm text-muted-foreground mb-2">
                                  {notification.message}
                                </p>
                              )}
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span>
                                  {formatDistanceToNow(new Date(notification.created_at), {
                                    addSuffix: true,
                                  })}
                                </span>
                                {notification.status && (
                                  <Badge variant="outline" className="text-xs">
                                    {notification.status}
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {!notification.read && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleMarkAsRead(notification.id, notification.source as "notification" | "alert")
                                }
                                className="shrink-0"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )

                  if (link) {
                    return (
                      <Link key={notification.id} href={link}>
                        {NotificationContent}
                      </Link>
                    )
                  }

                  return <div key={notification.id}>{NotificationContent}</div>
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

