"use client"

import { useState, useEffect, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  CheckCheck,
  Search,
  HelpCircle,
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
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useRouter, useSearchParams } from "next/navigation"
import AlertsPage from "../alerts/page"
import RemindersPage from "../reminders/page"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { groupNotificationRows } from "@/lib/notifications/group-for-display"
import { cn } from "@/lib/utils"

type UnifiedNotification = NonNullable<Awaited<ReturnType<typeof getUnifiedNotifications>>["data"]>[number]

function NotificationsTabContent() {
  const [notifications, setNotifications] = useState<UnifiedNotification[]>([])
  const [listMeta, setListMeta] = useState<{
    smartUi: boolean
    planAllowsSmart: boolean
    userSmart: boolean
    suppressedCount: number
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [includeSuppressed, setIncludeSuppressed] = useState(false)
  const [filters, setFilters] = useState({
    type: "all" as "all" | "notifications" | "alerts",
    read: undefined as boolean | undefined,
    priority: "all",
    search: "",
  })

  useEffect(() => {
    loadNotifications()
  }, [filters.type, filters.read, filters.priority, filters.search, includeSuppressed])

  async function loadNotifications() {
    setIsLoading(true)
    try {
      const result = await getUnifiedNotifications({
        type: filters.type,
        read: filters.read,
        priority: filters.priority === "all" ? undefined : filters.priority,
        limit: 100,
        search: filters.search || undefined,
        includeSuppressed: includeSuppressed || undefined,
      })

      if (result.error) {
        toast.error(result.error)
        setNotifications([])
        setListMeta(null)
      } else {
        setNotifications(result.data || [])
        if (result.meta) {
          setListMeta({
            smartUi: result.meta.smartUi,
            planAllowsSmart: result.meta.planAllowsSmart,
            userSmart: result.meta.userSmart,
            suppressedCount: result.meta.suppressedCount ?? 0,
          })
        } else {
          setListMeta(null)
        }
      }
    } catch (error: unknown) {
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
    } catch (error: unknown) {
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
    } catch (error: unknown) {
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

  function getPriorityBadge(n: UnifiedNotification, smartUi: boolean) {
    const p = n.priority
    const reasoning = (n.ai_reasoning || "").trim()
    const badge = (() => {
      switch (p) {
        case "critical":
          return (
            <Badge variant="destructive" className={cn("bg-red-600", smartUi && "animate-pulse")}>
              Critical
            </Badge>
          )
        case "high":
          return (
            <Badge variant="destructive" className="bg-orange-600 hover:bg-orange-600/90">
              High
            </Badge>
          )
        case "medium":
          return (
            <Badge variant="secondary" className="border border-amber-400/60 bg-amber-50 text-amber-950 dark:bg-amber-950/30">
              Medium
            </Badge>
          )
        case "normal":
          return <Badge variant="secondary">Normal</Badge>
        case "low":
          return (
            <Badge variant="outline" className="text-muted-foreground">
              Low
            </Badge>
          )
        default:
          return <Badge variant="secondary">{p}</Badge>
      }
    })()

    if (!smartUi || !reasoning || n.type !== "notification") {
      return badge
    }

    return (
      <div className="flex items-center gap-1">
        {badge}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              aria-label="Why this priority"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-sm font-normal">
            {reasoning}
          </TooltipContent>
        </Tooltip>
      </div>
    )
  }

  function getNotificationLink(notification: UnifiedNotification) {
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

  const filteredNotifications = notifications

  const smartUi = listMeta?.smartUi ?? false

  const displayRows = useMemo(() => {
    const mode = filters.type
    if (mode === "alerts") {
      return notifications.filter((x) => x.type === "alert").map((n) => ({ kind: "alert" as const, n }))
    }
    const notifs = notifications
      .filter((x) => x.type === "notification")
      .map((n) => ({ ...n, type: "notification" as const }))
    const grouped = groupNotificationRows(notifs, smartUi)
    type Row =
      | { kind: "alert"; n: UnifiedNotification }
      | { kind: "single"; n: UnifiedNotification }
      | { kind: "cluster"; clusterId: string; items: UnifiedNotification[] }

    if (mode === "notifications") {
      return grouped.map((g) =>
        g.kind === "single"
          ? ({ kind: "single" as const, n: g.notification as UnifiedNotification })
          : ({ kind: "cluster" as const, clusterId: g.clusterId, items: g.notifications as UnifiedNotification[] }),
      )
    }

    const rows: Row[] = []
    for (const g of grouped) {
      if (g.kind === "single") rows.push({ kind: "single", n: g.notification as UnifiedNotification })
      else rows.push({ kind: "cluster", clusterId: g.clusterId, items: g.notifications as UnifiedNotification[] })
    }
    for (const a of notifications.filter((x) => x.type === "alert")) {
      rows.push({ kind: "alert", n: a })
    }
    return rows.sort((a, b) => {
      const ta =
        a.kind === "cluster"
          ? Math.max(...a.items.map((i) => new Date(i.created_at).getTime()))
          : new Date(a.n.created_at).getTime()
      const tb =
        b.kind === "cluster"
          ? Math.max(...b.items.map((i) => new Date(i.created_at).getTime()))
          : new Date(b.n.created_at).getTime()
      return tb - ta
    })
  }, [notifications, smartUi, filters.type])

  const unreadCount = notifications.filter((n) => !n.read).length

  function renderNotificationBody(notification: UnifiedNotification) {
    const link = getNotificationLink(notification)
    const NotificationContent = (
      <div
        className={`rounded-lg border p-4 transition-colors ${
          !notification.read
            ? "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20"
            : "border-border bg-card hover:bg-muted/50"
        }`}
      >
        <div className="flex items-start gap-4">
          <div className="mt-1 flex-shrink-0">
            {typeof getNotificationIcon(notification.type, notification.source) === "string" ? (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-lg">
                {getNotificationIcon(notification.type, notification.source)}
              </div>
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                {getNotificationIcon(notification.type, notification.source)}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-foreground">{notification.title}</h3>
                  {getPriorityBadge(notification, smartUi)}
                  {notification.source === "alerts" && (
                    <Badge variant="outline" className="text-xs">
                      Alert
                    </Badge>
                  )}
                  {notification.event_source === "ai_proactive" && (
                    <Badge variant="secondary" className="text-xs font-normal">
                      AI insight
                    </Badge>
                  )}
                </div>
                {notification.message && <p className="mb-2 text-sm text-muted-foreground">{notification.message}</p>}
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
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleMarkAsRead(notification.id, notification.source === "system" ? "notification" : "alert")
                  }}
                  className="shrink-0"
                >
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    )

    if (link) {
      return (
        <Link href={link} className="block">
          {NotificationContent}
        </Link>
      )
    }

    return NotificationContent
  }

  return (
    <TooltipProvider delayDuration={200}>
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
                  onValueChange={(value: "all" | "notifications" | "alerts") =>
                    setFilters({ ...filters, type: value })
                  }
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
                    {listMeta?.smartUi && <SelectItem value="medium">Medium</SelectItem>}
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
            ) : displayRows.length === 0 ? (
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
                {displayRows.map((row, rowIdx) => {
                  if (row.kind === "alert" || row.kind === "single") {
                    return <div key={row.n.id}>{renderNotificationBody(row.n)}</div>
                  }
                  return (
                    <Collapsible key={`cluster-${row.clusterId}-${rowIdx}`} className="rounded-lg border border-border">
                      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-t-lg bg-muted/40 p-4 text-left text-sm font-medium hover:bg-muted/60">
                        <span>{row.items.length} related notifications</span>
                        <Badge variant="outline" className="text-xs">
                          Cluster
                        </Badge>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="space-y-2 border-t bg-muted/10 p-3 pl-6">
                          {row.items.map((n) => (
                            <div key={n.id} className="border-l-2 border-primary/40 pl-3">
                              {renderNotificationBody(n)}
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )
                })}
                {listMeta?.smartUi && listMeta.suppressedCount > 0 && !includeSuppressed && (
                  <div className="pt-2 text-center">
                    <Button variant="link" size="sm" onClick={() => setIncludeSuppressed(true)} className="text-xs">
                      Show {listMeta.suppressedCount} suppressed
                    </Button>
                  </div>
                )}
                {listMeta?.smartUi && includeSuppressed && (
                  <div className="pt-2 text-center">
                    <Button variant="link" size="sm" onClick={() => setIncludeSuppressed(false)} className="text-xs">
                      Hide suppressed
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
    </TooltipProvider>
  )
}

export default function NotificationsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const tabParam = (searchParams.get("tab") || "notifications").toLowerCase()
  const activeTab = ["notifications", "alerts", "reminders"].includes(tabParam) ? tabParam : "notifications"

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) =>
        router.push(`/dashboard/notifications?tab=${encodeURIComponent(value)}`)
      }
      className="w-full"
    >
      <TabsList className="mx-4 md:mx-8 mt-4 grid w-fit grid-cols-3">
        <TabsTrigger value="notifications">Notifications</TabsTrigger>
        <TabsTrigger value="alerts">Alerts</TabsTrigger>
        <TabsTrigger value="reminders">Reminders</TabsTrigger>
      </TabsList>

      <TabsContent value="notifications">
        <NotificationsTabContent />
      </TabsContent>
      <TabsContent value="alerts">
        <AlertsPage />
      </TabsContent>
      <TabsContent value="reminders">
        <RemindersPage />
      </TabsContent>
    </Tabs>
  )
}

