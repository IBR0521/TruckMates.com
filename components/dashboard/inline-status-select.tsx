"use client"

import { useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface InlineStatusSelectProps {
  currentStatus: string
  availableStatuses: string[]
  onStatusChange: (newStatus: string) => Promise<void>
  className?: string
  size?: "sm" | "md" | "lg"
}

export function InlineStatusSelect({
  currentStatus,
  availableStatuses,
  onStatusChange,
  className,
  size = "sm",
}: InlineStatusSelectProps) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [localStatus, setLocalStatus] = useState(currentStatus)

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === localStatus) return

    setIsUpdating(true)
    setLocalStatus(newStatus) // Optimistic update

    try {
      await onStatusChange(newStatus)
    } catch (error: any) {
      setLocalStatus(currentStatus) // Revert on error
      toast.error(error.message || "Failed to update status")
    } finally {
      setIsUpdating(false)
    }
  }

  const getStatusBadgeColor = (status: string) => {
    const normalizedStatus = status.toLowerCase()
    if (normalizedStatus.includes("delivered") || normalizedStatus.includes("completed") || normalizedStatus.includes("paid")) {
      return "bg-green-500/20 text-green-400 border-green-500/50"
    }
    if (normalizedStatus.includes("in_transit") || normalizedStatus.includes("active") || normalizedStatus.includes("sent")) {
      return "bg-blue-500/20 text-blue-400 border-blue-500/50"
    }
    if (normalizedStatus.includes("pending") || normalizedStatus.includes("scheduled") || normalizedStatus.includes("draft")) {
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/50"
    }
    if (normalizedStatus.includes("cancelled") || normalizedStatus.includes("overdue") || normalizedStatus.includes("failed")) {
      return "bg-red-500/20 text-red-400 border-red-500/50"
    }
    return "bg-gray-500/20 text-gray-400 border-gray-500/50"
  }

  const formatStatus = (status: string) => {
    return status
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {isUpdating && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
      <Select
        value={localStatus}
        onValueChange={handleStatusChange}
        disabled={isUpdating}
      >
        <SelectTrigger
          className={cn(
            "h-auto p-0 border-0 bg-transparent hover:bg-transparent focus:ring-0 focus:ring-offset-0",
            size === "sm" && "h-6",
            size === "md" && "h-7",
            size === "lg" && "h-8"
          )}
        >
          <SelectValue>
            <Badge className={cn(getStatusBadgeColor(localStatus), "cursor-pointer")}>
              {formatStatus(localStatus)}
            </Badge>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {availableStatuses.map((status) => (
            <SelectItem key={status} value={status}>
              {formatStatus(status)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

