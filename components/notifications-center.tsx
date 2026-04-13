"use client"

import { useState, useEffect } from "react"
import { Inbox, X, Check, CheckCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useRealtimeNotifications } from "@/lib/hooks/use-realtime"

function formatNotificationDate(value: string | Date | null | undefined): string {
  if (!value) return "Unknown date"
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return "Invalid date"
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function NotificationsCenter() {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { notifications, unreadCount, markAsRead, markAllAsRead } =
    useRealtimeNotifications()

  // Defer Radix Popover until after mount to avoid hydration mismatch (aria-controls/data-state differ between server and client)
  useEffect(() => {
    setMounted(true)
  }, [])
  // FIXED: Removed unused supabase client

  // Note: Notifications are managed by the useRealtimeNotifications hook
  // This component just displays them

  const getNotificationIcon = (type: string) => {
    switch (type) {
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

  const getNotificationColor = (type: string) => {
    switch (type) {
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

  // Render placeholder until mounted to avoid Radix hydration mismatch (server/client aria-controls and data-state differ)
  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
        <Inbox className="h-5 w-5" />
      </Button>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Inbox className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Notifications</h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="h-8 text-xs"
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No notifications</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification: any) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-muted/50 transition-colors ${
                    !notification.read ? "bg-muted/30" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${getNotificationColor(
                        notification.type
                      )}`}
                    >
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium line-clamp-2">
                          {notification.title || "Notification"}
                        </p>
                        {!notification.read && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={() => markAsRead(notification.id)}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      {notification.message && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {notification.message}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatNotificationDate(notification.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        {notifications.length > 0 && (
          <div className="p-2 border-t">
            <Button
              variant="ghost"
              className="w-full text-xs"
              onClick={() => {
                // FIXED: Navigate to correct notifications page
                window.location.href = "/dashboard/notifications"
              }}
            >
              View all notifications
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

