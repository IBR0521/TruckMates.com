"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Plus, Pencil, Trash2, Building2 } from "lucide-react"
import {
  createTerminal,
  deleteTerminal,
  getTerminals,
  updateTerminal,
} from "@/app/actions/terminals"
import { errorMessage } from "@/lib/error-message"

type Terminal = {
  id: string
  name: string
  address: string | null
  timezone: string
  created_at?: string
}

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "UTC",
]

export function MultiTerminalClientPage() {
  const [terminals, setTerminals] = useState<Terminal[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Terminal | null>(null)
  const [form, setForm] = useState({ name: "", address: "", timezone: "America/Chicago" })
  const [saving, setSaving] = useState(false)

  const loadTerminals = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getTerminals()
      if (result.error) {
        toast.error(result.error)
      } else {
        setTerminals((result.data || []) as Terminal[])
      }
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Failed to load terminals"))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTerminals()
  }, [loadTerminals])

  function openCreate() {
    setEditing(null)
    setForm({ name: "", address: "", timezone: "America/Chicago" })
    setDialogOpen(true)
  }

  function openEdit(terminal: Terminal) {
    setEditing(terminal)
    setForm({
      name: terminal.name,
      address: terminal.address || "",
      timezone: terminal.timezone || "America/Chicago",
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Terminal name is required")
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        address: form.address.trim() || undefined,
        timezone: form.timezone,
      }
      const result = editing
        ? await updateTerminal(editing.id, payload)
        : await createTerminal(payload)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(editing ? "Terminal updated" : "Terminal created")
        setDialogOpen(false)
        await loadTerminals()
      }
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Failed to save terminal"))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      const result = await deleteTerminal(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Terminal deleted")
        await loadTerminals()
      }
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Failed to delete terminal"))
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Multi-terminal</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Add yards or divisions, assign assets, and filter loads and reports by terminal.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Add terminal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit terminal" : "New terminal"}</DialogTitle>
              <DialogDescription>
                Terminal defaults apply to new loads and reporting filters.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="terminal-name">Name</Label>
                <Input
                  id="terminal-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Dallas yard"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="terminal-address">Address (optional)</Label>
                <Input
                  id="terminal-address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="123 Industrial Blvd"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="terminal-timezone">Timezone</Label>
                <select
                  id="terminal-timezone"
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground"
                  value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : editing ? "Save changes" : "Create terminal"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <Card className="p-6 border-border">
          <p className="text-sm text-muted-foreground">Loading terminals…</p>
        </Card>
      ) : terminals.length === 0 ? (
        <Card className="p-8 border-border text-center">
          <Building2 className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground text-sm">
            No terminals yet. Add your first yard or division to start filtering by location.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {terminals.map((terminal) => (
            <Card key={terminal.id} className="p-4 border-border flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-foreground">{terminal.name}</p>
                {terminal.address ? (
                  <p className="text-sm text-muted-foreground mt-1">{terminal.address}</p>
                ) : null}
                <p className="text-xs text-muted-foreground mt-1">Timezone: {terminal.timezone}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => openEdit(terminal)} aria-label="Edit terminal">
                  <Pencil className="w-4 h-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Delete terminal">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {terminal.name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Trucks, drivers, and loads linked to this terminal will be unassigned. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => void handleDelete(terminal.id)}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
