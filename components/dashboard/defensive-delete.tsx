"use client"

import { useState, useEffect } from "react"
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Trash2, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface Dependency {
  type: string
  id: string
  name: string
  link?: string
}

interface DefensiveDeleteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void>
  resourceType: string
  resourceName: string
  resourceId: string
  dependencies?: Dependency[]
  warningMessage?: string
  confirmText?: string
}

export function DefensiveDelete({
  open,
  onOpenChange,
  onConfirm,
  resourceType,
  resourceName,
  resourceId,
  dependencies = [],
  warningMessage,
  confirmText = "Delete",
}: DefensiveDeleteProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [checkedDependencies, setCheckedDependencies] = useState(false)

  // Check dependencies when dialog opens
  useEffect(() => {
    if (open && resourceId) {
      checkDependencies()
    }
  }, [open, resourceId])

  const checkDependencies = async () => {
    try {
      const response = await fetch(`/api/check-dependencies?resource_type=${resourceType}&resource_id=${resourceId}`)
      if (response.ok) {
        const data = await response.json()
        // Dependencies will be passed as prop, but we can also fetch here if needed
      }
    } catch (error) {
      console.error("Failed to check dependencies:", error)
    }
  }

  const hasBlockingDependencies = dependencies.some((dep) => {
    // Active assignments are blocking
    return dep.type === "active_load" || 
           dep.type === "active_route" || 
           dep.type === "assigned_driver" ||
           dep.type === "assigned_truck" ||
           dep.type === "active_status"
  })

  const handleConfirm = async () => {
    // Only block if there are blocking dependencies and user hasn't acknowledged
    if (hasBlockingDependencies && !checkedDependencies) {
      return // Don't allow deletion if blocking dependencies exist and not acknowledged
    }

    setIsDeleting(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch (error) {
      console.error("Delete failed:", error)
    } finally {
      setIsDeleting(false)
      setCheckedDependencies(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-destructive" />
            Delete {resourceType.charAt(0).toUpperCase() + resourceType.slice(1)}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{resourceName}</strong>? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {dependencies.length > 0 && (
          <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Warning: Active Dependencies</AlertTitle>
            <AlertDescription className="mt-2">
              <p className="mb-3">
                This {resourceType} is currently being used in the following:
              </p>
              <div className="space-y-2">
                {dependencies.map((dep, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-destructive/10 rounded border border-destructive/20"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="text-xs">
                        {dep.type.replace(/_/g, " ")}
                      </Badge>
                      <span className="text-sm font-medium">{dep.name}</span>
                    </div>
                    {dep.link && (
                      <Link href={dep.link} target="_blank">
                        <Button variant="ghost" size="sm" className="h-6 px-2">
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </Link>
                    )}
                  </div>
                ))}
              </div>
              {hasBlockingDependencies && (
                <p className="mt-3 text-sm font-semibold">
                  ⚠️ You must reassign or remove these dependencies before deleting.
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

        {warningMessage && (
          <Alert className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{warningMessage}</AlertDescription>
          </Alert>
        )}

        {hasBlockingDependencies && (
          <div className="mt-4 flex items-center gap-2 p-3 bg-destructive/10 rounded border border-destructive/20">
            <input
              type="checkbox"
              id="acknowledge-dependencies"
              checked={checkedDependencies}
              onChange={(e) => setCheckedDependencies(e.target.checked)}
              className="rounded"
            />
            <label
              htmlFor="acknowledge-dependencies"
              className="text-sm text-foreground cursor-pointer flex-1"
            >
              I understand this will break the dependencies listed above
            </label>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isDeleting || (hasBlockingDependencies && !checkedDependencies)}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Deleting..." : confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

