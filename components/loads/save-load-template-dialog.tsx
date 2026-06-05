"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { createLoadTemplate } from "@/app/actions/load-templates"
import { toast } from "sonner"

export function SaveLoadTemplateDialog({
  loadId,
  open,
  onOpenChange,
  onSaved,
}: {
  loadId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}) {
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Enter a template name")
      return
    }
    setSaving(true)
    try {
      const result = await createLoadTemplate({ name: name.trim(), fromLoadId: loadId })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(`Template "${name.trim()}" saved`)
      setName("")
      onOpenChange(false)
      onSaved?.()
    } catch {
      toast.error("Failed to save template")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save as template</DialogTitle>
          <DialogDescription>
            Save reusable lane details (origin, destination, customer, rates, equipment). Dates and
            driver assignment are not saved.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="template-name">Template name</Label>
          <Input
            id="template-name"
            placeholder="e.g. Dallas → Houston — Cardinal Freight"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving..." : "Save template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
