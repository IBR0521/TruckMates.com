"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { FeatureLock } from "@/components/billing/feature-lock"
import { listGeofences, deleteGeofence, type GeofenceListItem } from "@/app/actions/geofences"
import { GeofenceFormDialog } from "@/components/eld/geofence-form-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Plus, Trash2, Pencil } from "lucide-react"

export function GeofencesEldConsole() {
  const [rows, setRows] = useState<GeofenceListItem[]>([])
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [activeFilter, setActiveFilter] = useState<string>("all")
  const [q, setQ] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<GeofenceListItem | null>(null)

  const load = async () => {
    const r = await listGeofences({
      type: typeFilter === "all" ? undefined : typeFilter,
      activeOnly: activeFilter === "active" ? true : activeFilter === "inactive" ? false : undefined,
    })
    if (r.error) toast.error(r.error)
    else setRows(r.data ?? [])
  }

  useEffect(() => {
    void load()
  }, [typeFilter, activeFilter])

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return rows
    return rows.filter((r) => r.name.toLowerCase().includes(t))
  }, [rows, q])

  return (
    <FeatureLock
      featureKey="geofencing_automation"
      title="Geofences"
      description="Zones, telemetry enter/exit, and dwell signals are available from Starter; automatic load status updates require Professional+."
    >
      <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Geofences</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Telemetry detection runs every ~5 minutes for companies with active ELD devices.{" "}
              <Link href="/dashboard/eld/geofences/events" className="text-primary hover:underline">
                View events
              </Link>
            </p>
          </div>
          <Button
            onClick={() => {
              setEditing(null)
              setDialogOpen(true)
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            New geofence
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-4 border-border/70 space-y-3">
            <div className="flex flex-wrap gap-2">
              <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {["customer", "pickup", "delivery", "yard", "fuel_stop", "rest_area", "other"].map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={activeFilter} onValueChange={setActiveFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ul className="divide-y divide-border/50 max-h-[480px] overflow-y-auto text-sm">
              {filtered.map((g) => (
                <li key={g.id} className="py-2 flex justify-between gap-2 items-start">
                  <div>
                    <p className="font-medium">{g.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {g.geofence_type} · {g.zone_type} · {g.is_active ? "active" : "inactive"}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => {
                        setEditing(g)
                        setDialogOpen(true)
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={async () => {
                        if (!confirm("Delete this geofence?")) return
                        const r = await deleteGeofence(g.id)
                        if (r.error) toast.error(r.error)
                        else {
                          toast.success("Deleted")
                          void load()
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-4 border-border/70 min-h-[320px] flex items-center justify-center text-muted-foreground text-sm text-center">
            Map overlay preview is available on the main{" "}
            <Link href="/dashboard/geofencing" className="text-primary hover:underline px-1">
              Geofencing
            </Link>{" "}
            page. This ELD console focuses on zone configuration for automation.
          </Card>
        </div>

        <GeofenceFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          editing={editing}
          onSaved={() => void load()}
        />
      </div>
    </FeatureLock>
  )
}
