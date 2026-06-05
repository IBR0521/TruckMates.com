"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CheckCircle2, AlertTriangle, SkipForward } from "lucide-react"
import type { BulkLoadSummary } from "@/app/actions/loads"

export function BulkLoadResultDialog({
  open,
  onOpenChange,
  title,
  summary,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  summary: BulkLoadSummary | null
}) {
  if (!summary) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {summary.succeeded} updated, {summary.skipped} skipped, {summary.failed} failed
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-64 overflow-y-auto space-y-2 text-sm">
          {summary.results.map((r) => (
            <div
              key={r.load_id}
              className="flex items-start gap-2 rounded-md border border-border p-2"
            >
              {r.skipped ? (
                <SkipForward className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              ) : r.ok ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0">
                <p className="font-medium">{r.shipment_number || r.load_id.slice(0, 8)}</p>
                {r.skip_reason && (
                  <p className="text-xs text-amber-400">{r.skip_reason}</p>
                )}
                {r.error && <p className="text-xs text-rose-400">{r.error}</p>}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
