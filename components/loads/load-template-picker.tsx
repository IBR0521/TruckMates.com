"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { BookOpen, Trash2 } from "lucide-react"
import {
  listLoadTemplates,
  deleteLoadTemplate,
  renameLoadTemplate,
  type LoadTemplateRow,
} from "@/app/actions/load-templates"
import { templateDataToAddFormState } from "@/lib/load-template-data"
import { toast } from "sonner"

export function LoadTemplatePicker({
  onApplyTemplate,
}: {
  onApplyTemplate: (formPatch: Record<string, unknown>, deliveryPoints?: LoadTemplateRow["template_data"]["deliveryPoints"]) => void
}) {
  const [templates, setTemplates] = useState<LoadTemplateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [manageOpen, setManageOpen] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")

  async function refresh() {
    setLoading(true)
    const result = await listLoadTemplates()
    if (result.error) {
      toast.error(result.error)
      setTemplates([])
    } else {
      setTemplates(result.data ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    void refresh()
  }, [])

  function handleSelect(templateId: string) {
    const template = templates.find((t) => t.id === templateId)
    if (!template) return
    const patch = templateDataToAddFormState(template.template_data)
    onApplyTemplate(patch, template.template_data.deliveryPoints)
    toast.success(`Loaded template "${template.name}" — edit dates before saving`)
  }

  async function handleDelete(id: string, name: string) {
    const result = await deleteLoadTemplate(id)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success(`Deleted template "${name}"`)
    await refresh()
  }

  async function handleRename(id: string) {
    if (!renameValue.trim()) return
    const result = await renameLoadTemplate(id, renameValue.trim())
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success("Template renamed")
    setRenamingId(null)
    setRenameValue("")
    await refresh()
  }

  if (loading) {
    return (
      <p className="text-xs text-muted-foreground">Loading templates…</p>
    )
  }

  if (templates.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No saved templates yet. Save a load as a template to reuse repeat lanes.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-sm text-muted-foreground">Start from template:</span>
      <Select onValueChange={handleSelect}>
        <SelectTrigger className="w-[220px] h-9">
          <SelectValue placeholder="Choose template" />
        </SelectTrigger>
        <SelectContent>
          {templates.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="button" variant="ghost" size="sm" onClick={() => setManageOpen(true)}>
        Manage
      </Button>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Load templates</DialogTitle>
            <DialogDescription>Rename or delete saved lane templates for your company.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {templates.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border p-3"
              >
                <div className="min-w-0 flex-1">
                  {renamingId === t.id ? (
                    <div className="flex gap-2">
                      <Input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="h-8"
                      />
                      <Button size="sm" onClick={() => void handleRename(t.id)}>
                        Save
                      </Button>
                    </div>
                  ) : (
                    <>
                      <p className="font-medium text-sm truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {(t.template_data.origin || "?")} → {(t.template_data.destination || "?")}
                      </p>
                    </>
                  )}
                </div>
                {renamingId !== t.id && (
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setRenamingId(t.id)
                        setRenameValue(t.name)
                      }}
                    >
                      Rename
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-rose-400 hover:text-rose-300"
                      onClick={() => void handleDelete(t.id, t.name)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
