"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { X, Trash2, Edit, Download, MoreVertical } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface BulkActionsBarProps {
  selectedCount: number
  onClearSelection: () => void
  onBulkDelete?: () => void
  onBulkEdit?: () => void
  onBulkExport?: () => void
  onBulkStatusChange?: (status: string) => void
  availableStatuses?: string[]
  customActions?: Array<{
    label: string
    icon?: React.ReactNode
    onClick: () => void
    variant?: "default" | "destructive"
  }>
}

export function BulkActionsBar({
  selectedCount,
  onClearSelection,
  onBulkDelete,
  onBulkEdit,
  onBulkExport,
  onBulkStatusChange,
  availableStatuses = [],
  customActions = [],
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4">
      <div className="bg-card border border-border rounded-lg shadow-lg px-4 py-3 flex items-center gap-4">
        <Badge variant="secondary" className="text-sm font-medium">
          {selectedCount} selected
        </Badge>

        <div className="flex items-center gap-2">
          {onBulkEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={onBulkEdit}
              className="h-8"
            >
              <Edit className="h-3 w-3 mr-1" />
              Edit
            </Button>
          )}

          {onBulkStatusChange && availableStatuses.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                  Change Status
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {availableStatuses.map((status) => (
                  <DropdownMenuItem
                    key={status}
                    onClick={() => onBulkStatusChange(status)}
                  >
                    {status}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {onBulkExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={onBulkExport}
              className="h-8"
            >
              <Download className="h-3 w-3 mr-1" />
              Export
            </Button>
          )}

          {customActions.map((action, index) => (
            <Button
              key={index}
              variant={action.variant || "outline"}
              size="sm"
              onClick={action.onClick}
              className="h-8"
            >
              {action.icon}
              {action.label}
            </Button>
          ))}

          {onBulkDelete && (
            <>
              <DropdownMenuSeparator className="mx-2" />
              <Button
                variant="destructive"
                size="sm"
                onClick={onBulkDelete}
                className="h-8"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Delete
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            className="h-8"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}

