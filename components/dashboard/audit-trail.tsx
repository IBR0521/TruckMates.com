"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { History, User, Clock, ArrowRight } from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"

interface AuditLogEntry {
  id: string
  user_id: string
  user_name?: string
  action: string
  resource_type: string
  resource_id: string
  details: {
    field?: string
    old_value?: any
    new_value?: any
    reason?: string
    [key: string]: any
  }
  created_at: string
  ip_address?: string
  user_agent?: string
}

interface AuditTrailProps {
  resourceType: string
  resourceId: string
  trigger?: React.ReactNode
  className?: string
}

export function AuditTrail({ resourceType, resourceId, trigger, className }: AuditTrailProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isOpen && resourceId) {
      loadAuditLogs()
    }
  }, [isOpen, resourceId, resourceType])

  const loadAuditLogs = async () => {
    setIsLoading(true)
    try {
      console.log("[AuditTrail] Loading logs for:", { resourceType, resourceId })
      const response = await fetch(
        `/api/audit-logs?resource_type=${resourceType}&resource_id=${resourceId}`
      )
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error("[AuditTrail] API error:", response.status, errorData)
        return
      }
      
      const data = await response.json()
      console.log("[AuditTrail] Received logs:", data.logs?.length || 0, "entries")
      setLogs(data.logs || [])
      
      if (!data.logs || data.logs.length === 0) {
        console.warn("[AuditTrail] No logs found. Check:")
        console.warn("1. Are audit logs being created? (Check browser console for '[AUDIT LOG] ✅')")
        console.warn("2. Does the audit_logs table exist?")
        console.warn("3. Are there any RLS policy issues?")
      }
    } catch (error) {
      console.error("[AuditTrail] Failed to load audit logs:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const formatFieldChange = (entry: AuditLogEntry) => {
    if (entry.details.field) {
      const field = entry.details.field
      const oldVal = entry.details.old_value
      const newVal = entry.details.new_value

      // Format based on field type
      const formatValue = (val: any) => {
        if (val === null || val === undefined) return "—"
        if (typeof val === "boolean") return val ? "Yes" : "No"
        if (typeof val === "number" && field.toLowerCase().includes("rate") || field.toLowerCase().includes("price")) {
          return `$${Number(val).toFixed(2)}`
        }
        if (field.toLowerCase().includes("date")) {
          try {
            return format(new Date(val), "MMM dd, yyyy")
          } catch {
            return String(val)
          }
        }
        return String(val)
      }

      return (
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-muted-foreground">{field}:</span>
          <span className="text-red-600 line-through">{formatValue(oldVal)}</span>
          <ArrowRight className="w-3 h-3 text-muted-foreground" />
          <span className="text-green-600 font-medium">{formatValue(newVal)}</span>
        </div>
      )
    }

    // Generic change
    if (entry.details.old_value !== undefined && entry.details.new_value !== undefined) {
      return (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-red-600 line-through">{String(entry.details.old_value)}</span>
          <ArrowRight className="w-3 h-3 text-muted-foreground" />
          <span className="text-green-600 font-medium">{String(entry.details.new_value)}</span>
        </div>
      )
    }

    return null
  }

  const getActionLabel = (action: string) => {
    const actionMap: Record<string, string> = {
      "data.created": "Created",
      "data.updated": "Updated",
      "data.deleted": "Deleted",
      "status_updated": "Status Changed",
      "rate_updated": "Rate Changed",
      "assigned": "Assigned",
      "unassigned": "Unassigned",
    }
    return actionMap[action] || action.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
  }

  const getActionColor = (action: string) => {
    if (action.includes("created")) return "bg-green-500/20 text-green-400 border-green-500/50"
    if (action.includes("deleted")) return "bg-red-500/20 text-red-400 border-red-500/50"
    if (action.includes("updated")) return "bg-blue-500/20 text-blue-400 border-blue-500/50"
    return "bg-gray-500/20 text-gray-400 border-gray-500/50"
  }

  const defaultTrigger = (
    <Button variant="ghost" size="sm" className={className}>
      <History className="w-4 h-4 mr-2" />
      History
    </Button>
  )

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Change History</DialogTitle>
          <DialogDescription>
            Complete audit trail of all changes made to this {resourceType}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[500px] pr-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading history...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No change history available
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((entry) => (
                <Card key={entry.id} className="p-4 border-border/50">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge className={getActionColor(entry.action)}>
                        {getActionLabel(entry.action)}
                      </Badge>
                      {entry.user_name && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <User className="w-3 h-3" />
                          <span>{entry.user_name}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span title={format(new Date(entry.created_at), "PPpp")}>
                        {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  
                  {formatFieldChange(entry)}
                  
                  {entry.details.reason && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      <span className="font-medium">Reason:</span> {entry.details.reason}
                    </div>
                  )}
                  
                  <div className="mt-2 text-xs text-muted-foreground">
                    {format(new Date(entry.created_at), "MMM dd, yyyy 'at' h:mm a")}
                    {entry.ip_address && ` • IP: ${entry.ip_address}`}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

