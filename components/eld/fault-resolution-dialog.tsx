"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { resolveFaultCode, type FaultCode } from "@/app/actions/fault-codes"
import { toast } from "sonner"

export function FaultResolutionDialog({
  fault,
  open,
  onOpenChange,
  onResolved,
}: {
  fault: FaultCode | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onResolved: () => void
}) {
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!fault) return
    setSaving(true)
    const r = await resolveFaultCode({ faultCodeId: fault.id, resolutionNotes: notes })
    setSaving(false)
    if (r.error) toast.error(r.error)
    else {
      toast.success("Fault marked resolved")
      setNotes("")
      onOpenChange(false)
      onResolved()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolve fault {fault?.code}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Document what was done (repair, cleared by ECM, false positive, etc.).
        </p>
        <div className="space-y-2">
          <Label htmlFor="resolution-notes">Resolution notes</Label>
          <Textarea
            id="resolution-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="e.g. Replaced DEF dosing module; code cleared after 20 mi test drive."
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving || notes.trim().length < 10}>
            Mark resolved
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
