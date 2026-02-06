"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Bell, CheckCircle2, Clock, AlertTriangle, X } from "lucide-react"
import Link from "next/link"
import { getReminders, getOverdueReminders, completeReminder } from "@/app/actions/reminders"
import { toast } from "sonner"
import { format, isPast, isToday, differenceInDays } from "date-fns"

interface Reminder {
  id: string
  title: string
  description?: string
  reminder_type: string
  due_date: string
  due_time?: string
  status: string
  truck_id?: string
  driver_id?: string
  load_id?: string
}

export function RemindersWidget() {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [completingId, setCompletingId] = useState<string | null>(null)

  useEffect(() => {
    loadReminders()
  }, [])

  const loadReminders = async () => {
    setIsLoading(true)
    try {
      // Get overdue and upcoming reminders
      const today = new Date().toISOString().split("T")[0]
      const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
      
      const [overdueResult, upcomingResult] = await Promise.all([
        getOverdueReminders(),
        getReminders({
          status: "pending",
          due_date_start: today,
          due_date_end: sevenDaysFromNow,
        }),
      ])

      const overdue = overdueResult.data || []
      const upcoming = upcomingResult.data || []

      // Combine and sort: overdue first, then by due date
      const allReminders = [
        ...overdue.map((r: Reminder) => ({ ...r, isOverdue: true })),
        ...upcoming
          .filter((r: Reminder) => !overdue.some((o: Reminder) => o.id === r.id))
          .map((r: Reminder) => ({ ...r, isOverdue: false })),
      ].sort((a, b) => {
        if (a.isOverdue && !b.isOverdue) return -1
        if (!a.isOverdue && b.isOverdue) return 1
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      })

      setReminders(allReminders.slice(0, 5)) // Show top 5
    } catch (error: any) {
      console.error("Error loading reminders:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleComplete = async (id: string) => {
    setCompletingId(id)
    try {
      const result = await completeReminder(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Reminder completed")
        loadReminders()
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to complete reminder")
    } finally {
      setCompletingId(null)
    }
  }

  const getReminderTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      maintenance: "bg-blue-500/20 text-blue-400",
      license_renewal: "bg-yellow-500/20 text-yellow-400",
      insurance_renewal: "bg-red-500/20 text-red-400",
      invoice_due: "bg-green-500/20 text-green-400",
      load_delivery: "bg-purple-500/20 text-purple-400",
      check_call: "bg-orange-500/20 text-orange-400",
      custom: "bg-gray-500/20 text-gray-400",
    }
    return colors[type] || colors.custom
  }

  const getReminderTypeIcon = (type: string) => {
    if (type.includes("maintenance") || type.includes("service")) {
      return "🔧"
    }
    if (type.includes("license") || type.includes("insurance")) {
      return "📄"
    }
    if (type.includes("invoice")) {
      return "💰"
    }
    if (type.includes("load") || type.includes("delivery")) {
      return "📦"
    }
    return "🔔"
  }

  const formatDueDate = (dueDate: string, dueTime?: string) => {
    const date = new Date(dueDate)
    const isOverdue = isPast(date) && !isToday(date)
    const isTodayDate = isToday(date)
    const daysUntil = differenceInDays(date, new Date())

    if (isOverdue) {
      return `${Math.abs(daysUntil)} day${Math.abs(daysUntil) !== 1 ? "s" : ""} overdue`
    }
    if (isTodayDate) {
      return `Today${dueTime ? ` at ${dueTime}` : ""}`
    }
    if (daysUntil === 1) {
      return `Tomorrow${dueTime ? ` at ${dueTime}` : ""}`
    }
    return format(date, "MMM d, yyyy")
  }

  if (isLoading) {
    return (
      <Card className="border border-border/50 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Bell className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">Reminders</h3>
        </div>
        <div className="text-sm text-muted-foreground">Loading reminders...</div>
      </Card>
    )
  }

  if (reminders.length === 0) {
    return (
      <Card className="border border-border/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground">Reminders</h3>
          </div>
          <Link href="/dashboard/reminders">
            <Button variant="ghost" size="sm">
              View All
            </Button>
          </Link>
        </div>
        <div className="text-sm text-muted-foreground text-center py-4">
          No pending reminders
        </div>
      </Card>
    )
  }

  return (
    <Card className="border border-border/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Bell className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">Reminders</h3>
          {reminders.filter((r: any) => r.isOverdue).length > 0 && (
            <Badge variant="destructive" className="ml-2">
              {reminders.filter((r: any) => r.isOverdue).length} Overdue
            </Badge>
          )}
        </div>
        <Link href="/dashboard/reminders">
          <Button variant="ghost" size="sm">
            View All
          </Button>
        </Link>
      </div>

      <div className="space-y-3">
        {reminders.map((reminder: any) => {
          const isOverdue = reminder.isOverdue || isPast(new Date(reminder.due_date))
          const isUrgent = isOverdue || differenceInDays(new Date(reminder.due_date), new Date()) <= 1

          return (
            <div
              key={reminder.id}
              className={`p-3 rounded-lg border ${
                isOverdue
                  ? "bg-red-500/10 border-red-500/30"
                  : isUrgent
                  ? "bg-yellow-500/10 border-yellow-500/30"
                  : "bg-secondary/50 border-border/50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{getReminderTypeIcon(reminder.reminder_type)}</span>
                    <h4 className="text-sm font-semibold text-foreground truncate">
                      {reminder.title}
                    </h4>
                    <Badge
                      variant="outline"
                      className={`text-xs ${getReminderTypeColor(reminder.reminder_type)}`}
                    >
                      {reminder.reminder_type.replace("_", " ")}
                    </Badge>
                  </div>
                  {reminder.description && (
                    <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                      {reminder.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {isOverdue ? (
                      <AlertTriangle className="w-3 h-3 text-red-500" />
                    ) : (
                      <Clock className="w-3 h-3" />
                    )}
                    <span className={isOverdue ? "text-red-500 font-semibold" : ""}>
                      {formatDueDate(reminder.due_date, reminder.due_time)}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleComplete(reminder.id)}
                  disabled={completingId === reminder.id}
                  className="shrink-0"
                >
                  {completingId === reminder.id ? (
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  )}
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

