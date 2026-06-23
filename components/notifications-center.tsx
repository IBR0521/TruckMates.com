"use client"

import { useState, useEffect, useMemo } from "react"
import { Inbox, X, Check, CheckCheck, HelpCircle, AlertTriangle } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useRealtimeNotifications } from "@/lib/hooks/use-realtime"
import { groupNotificationRows } from "@/lib/notifications/group-for-display"
import { effectiveAiPriority } from "@/lib/notifications/smart-ui"
import { cn } from "@/lib/utils"
import { ProactiveRecommendationActions } from "@/components/ai/proactive-recommendation-actions"

type NotificationItem = {
  id: string
  /** Unified item kind: system notification vs fleet alert. */
  itemType?: "notification" | "alert" | null
  /** DB event type, e.g. load_update or fault_code. */
  event_type?: string | null
  type?: string | null
  title?: string | null
  message?: string | null
  read?: boolean
  created_at?: string | Date | null
  ai_priority?: string | null
  ai_reasoning?: string | null
  ai_cluster_id?: string | null
  ai_suppressed?: boolean | null
  priority?: string | null
  source?: string | null
  status?: string | null
  metadata?: Record<string, unknown> | null
}

const asNotificationItem = (value: unknown): NotificationItem | null => {
  if (!value || typeof value !== "object") return null
  const obj = value as Record<string, unknown>
  if (typeof obj.id !== "string") return null
  return {
    id: obj.id,
    itemType:
      obj.itemType === "notification" || obj.itemType === "alert"
        ? obj.itemType
        : obj.type === "notification" || obj.type === "alert"
          ? obj.type
          : null,
    event_type: typeof obj.event_type === "string" ? obj.event_type : null,
    type: typeof obj.type === "string" ? obj.type : null,
    title: typeof obj.title === "string" ? obj.title : null,
    message: typeof obj.message === "string" ? obj.message : null,
    read: Boolean(obj.read),
    created_at:
      typeof obj.created_at === "string" || obj.created_at instanceof Date ? obj.created_at : null,
    ai_priority: typeof obj.ai_priority === "string" ? obj.ai_priority : null,
    ai_reasoning: typeof obj.ai_reasoning === "string" ? obj.ai_reasoning : null,
    ai_cluster_id: typeof obj.ai_cluster_id === "string" ? obj.ai_cluster_id : null,
    ai_suppressed: typeof obj.ai_suppressed === "boolean" ? obj.ai_suppressed : null,
    priority: typeof obj.priority === "string" ? obj.priority : null,
    source: typeof obj.source === "string" ? obj.source : null,
    status: typeof obj.status === "string" ? obj.status : null,
    metadata: obj.metadata && typeof obj.metadata === "object" && !Array.isArray(obj.metadata) ? (obj.metadata as Record<string, unknown>) : null,
  }
}

function formatNotificationDate(value: string | Date | null | undefined): string {
  if (!value) return "Unknown date"
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return "Invalid date"
  return formatDistanceToNow(d, { addSuffix: true })
}

function displayBand(n: NotificationItem, smartUi: boolean): "critical" | "high" | "medium" | "low" | "normal" {
  if (smartUi) {
    return effectiveAiPriority(n.ai_priority, n.priority)
  }
  const p = (n.priority || "normal").toLowerCase()
  if (p === "critical" || p === "high" || p === "medium" || p === "low") return p
  return "normal"
}

function PriorityBadge({ n, smartUi }: { n: NotificationItem; smartUi: boolean }) {
  const band = displayBand(n, smartUi)
  const label = band === "normal" ? "Normal" : band.charAt(0).toUpperCase() + band.slice(1)
  const reasoning = (n.ai_reasoning || "").trim()
  const showHint = smartUi && reasoning.length > 0

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] uppercase tracking-wide shrink-0",
        band === "critical" && "border-red-600 text-red-700 bg-red-50 dark:bg-red-950/40 animate-pulse",
        band === "high" && "border-orange-500 text-orange-800 bg-orange-50 dark:bg-orange-950/30",
        band === "medium" && "border-amber-400 text-amber-900 bg-amber-50 dark:bg-amber-950/20",
        band === "low" && "border-muted-foreground/40 text-muted-foreground",
        band === "normal" && "border-muted-foreground/30 text-muted-foreground bg-muted/40",
      )}
    >
      {label}
    </Badge>
  )

  if (!showHint) return badge

  return (
    <div className="flex items-center gap-0.5 shrink-0">
      {badge}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
            aria-label="Why this priority"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs text-left font-normal normal-case">
          {reasoning}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

function NotificationRowView({
  n,
  smartUi,
  markAsRead,
}: {
  n: NotificationItem
  smartUi: boolean
  markAsRead: (id: string, itemType: "notification" | "alert") => void
}) {
  const isAlert = n.itemType === "alert" || n.source === "alerts"

  const meta = n.metadata && typeof n.metadata === "object" && !Array.isArray(n.metadata) ? n.metadata : {}
  const recommendedAuditId = typeof meta.recommended_action_audit_id === "string" ? meta.recommended_action_audit_id : null
  const recommendedStatus = typeof meta.recommended_action_status === "string" ? meta.recommended_action_status : null
  const recommendedSummary = typeof meta.recommended_action_summary === "string" ? meta.recommended_action_summary : null
  const hasRecommendation = Boolean(recommendedAuditId)

  const getNotificationIcon = () => {
    if (isAlert) {
      return <AlertTriangle className="h-4 w-4" />
    }
    switch (n.event_type) {
      case "route_update":
        return "🛣️"
      case "load_update":
        return "📦"
      case "maintenance_alert":
        return "🔧"
      case "payment_reminder":
        return "💰"
      case "morning_digest":
        return "📰"
      default:
        return "•"
    }
  }

  const getNotificationColor = () => {
    if (isAlert) {
      return "bg-orange-500/10 text-orange-600"
    }
    switch (n.event_type) {
      case "route_update":
        return "bg-blue-500/10 text-blue-500"
      case "load_update":
        return "bg-green-500/10 text-green-500"
      case "maintenance_alert":
        return "bg-yellow-500/10 text-yellow-500"
      case "payment_reminder":
        return "bg-red-500/10 text-red-500"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  return (
    <div
      className={cn(
        "p-4 hover:bg-muted/50 transition-colors",
        !n.read ? "bg-muted/30" : "",
        smartUi && n.ai_suppressed ? "opacity-60" : "",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            getNotificationColor(),
          )}
        >
          {getNotificationIcon()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p className="line-clamp-2 text-sm font-medium">{n.title || "Notification"}</p>
              <PriorityBadge n={n} smartUi={smartUi} />
              {isAlert && (
                <Badge variant="outline" className="text-[10px] font-normal">
                  Alert
                </Badge>
              )}
              {n.source === "ai_proactive" && (
                <Badge variant="secondary" className="text-[10px] font-normal">
                  AI insight
                </Badge>
              )}
            </div>
            {!n.read && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => markAsRead(n.id, isAlert ? "alert" : "notification")}
              >
                <Check className="h-3 w-3" />
              </Button>
            )}
          </div>
          {n.message && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{n.message}</p>}

          {hasRecommendation && recommendedStatus === "pending_confirmation" ? (
            <div className="mt-2">
              <ProactiveRecommendationActions
                notificationId={n.id}
                mode="pending_confirmation"
                summary={recommendedSummary}
                onDone={() => markAsRead(n.id, isAlert ? "alert" : "notification")}
              />
            </div>
          ) : hasRecommendation && recommendedStatus === "auto_executed" ? (
            <div className="mt-2">
              <ProactiveRecommendationActions notificationId={n.id} mode="auto_executed" summary={recommendedSummary} />
            </div>
          ) : hasRecommendation && (recommendedStatus === "failed" || recommendedStatus === "blocked") ? (
            <div className="mt-2">
              <ProactiveRecommendationActions notificationId={n.id} mode="action_failed" summary={recommendedSummary} />
            </div>
          ) : null}

          <p className="mt-1 text-xs text-muted-foreground">{formatNotificationDate(n.created_at)}</p>
        </div>
      </div>
    </div>
  )
}

export function NotificationsCenter() {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { notifications, unreadCount, unreadCountDegraded, loadDegraded, loadError, markAsRead, markAllAsRead, refreshNotifications, smartUi } =
    useRealtimeNotifications()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (open) {
      void refreshNotifications()
    }
  }, [open, refreshNotifications])

  const parsed = useMemo(() => {
    return (notifications as unknown[])
      .map(asNotificationItem)
      .filter((n): n is NotificationItem => !!n)
  }, [notifications])

  const grouped = useMemo(() => {
    const rows = parsed.map((n) => ({
      ...n,
      type: n.itemType ?? "notification",
      ai_cluster_id: n.ai_cluster_id ?? null,
    }))
    return groupNotificationRows(rows, smartUi)
  }, [parsed, smartUi])

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
        <Inbox className="h-5 w-5" />
      </Button>
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
            <Inbox className="h-5 w-5" />
            {unreadCountDegraded ? (
              <Badge
                variant="outline"
                className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center p-0 text-xs"
                title="Unread count unavailable"
              >
                —
              </Badge>
            ) : unreadCount > 0 ? (
              <Badge
                variant="destructive"
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center p-0 text-xs"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </Badge>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <div className="flex items-center justify-between border-b p-4">
            <h3 className="font-semibold">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-8 text-xs">
                  <CheckCheck className="mr-1 h-3 w-3" />
                  Mark all read
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <ScrollArea className="h-[400px]">
            {loadDegraded ? (
              <div className="p-8 text-center text-sm">
                <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-destructive opacity-80" />
                <p className="font-medium text-foreground">Couldn&apos;t load notifications</p>
                {loadError ? (
                  <p className="mt-2 text-xs text-muted-foreground">{loadError}</p>
                ) : null}
                <Button variant="outline" size="sm" className="mt-4" onClick={() => void refreshNotifications()}>
                  Retry
                </Button>
              </div>
            ) : parsed.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <Inbox className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p>No notifications</p>
              </div>
            ) : (
              <div className="divide-y">
                {grouped.map((row, idx) => {
                  if (row.kind === "single") {
                    return (
                      <NotificationRowView key={row.notification.id} n={row.notification} smartUi={smartUi} markAsRead={markAsRead} />
                    )
                  }
                  return (
                    <Collapsible key={`cluster-${row.clusterId}-${idx}`} className="border-b last:border-0">
                      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 p-3 text-left text-sm hover:bg-muted/50">
                        <span className="text-muted-foreground">
                          {row.notifications.length} related notifications
                        </span>
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          Cluster
                        </Badge>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border-t bg-muted/20 pl-3">
                          {row.notifications.map((n) => (
                            <div key={n.id} className="border-l-2 border-primary/30 pl-2">
                              <NotificationRowView n={n} smartUi={smartUi} markAsRead={markAsRead} />
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )
                })}
              </div>
            )}
          </ScrollArea>
          {parsed.length > 0 && (
            <div className="border-t p-2">
              <Button
                variant="ghost"
                className="w-full text-xs"
                onClick={() => {
                  window.location.href = "/dashboard/notifications"
                }}
              >
                View all notifications
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  )
}
