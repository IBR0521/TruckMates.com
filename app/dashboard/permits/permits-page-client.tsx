"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { FeatureLock } from "@/components/billing/feature-lock"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { createPermit, getPermits, updatePermit } from "@/app/actions/permits"
import { toast } from "sonner"

type PermitRow = {
  id: string
  permit_number?: string | null
  issuing_state?: string | null
  permit_type?: string | null
  issued_date?: string | null
  expiry_date?: string | null
  load_id?: string | null
  truck_id?: string | null
  route_restriction?: string | null
}

const EMPTY_FORM = {
  permit_number: "",
  issuing_state: "",
  permit_type: "oversize",
  issued_date: "",
  expiry_date: "",
  load_id: "",
  route_restriction: "",
}

export default function PermitsPageClient() {
  const [permits, setPermits] = useState<PermitRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  const loadPermits = useCallback(async () => {
    setLoading(true)
    const result = await getPermits()
    if (result.error) {
      toast.error(result.error)
      setPermits([])
    } else {
      setPermits((result.data as PermitRow[]) || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadPermits()
  }, [loadPermits])

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(permit: PermitRow) {
    setEditingId(permit.id)
    setForm({
      permit_number: permit.permit_number || "",
      issuing_state: permit.issuing_state || "",
      permit_type: permit.permit_type || "oversize",
      issued_date: permit.issued_date || "",
      expiry_date: permit.expiry_date || "",
      load_id: permit.load_id || "",
      route_restriction: permit.route_restriction || "",
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.permit_number.trim() || !form.issuing_state.trim()) {
      toast.error("Permit number and issuing state are required")
      return
    }
    setSaving(true)
    const payload = {
      permit_number: form.permit_number.trim(),
      issuing_state: form.issuing_state.trim().toUpperCase(),
      permit_type: form.permit_type.trim() || "oversize",
      issued_date: form.issued_date || undefined,
      expiry_date: form.expiry_date || undefined,
      load_id: form.load_id.trim() || undefined,
      route_restriction: form.route_restriction.trim() || undefined,
    }
    const result = editingId
      ? await updatePermit(editingId, payload)
      : await createPermit(payload)
    setSaving(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success(editingId ? "Permit updated" : "Permit created")
    setDialogOpen(false)
    await loadPermits()
  }

  return (
    <FeatureLock
      featureKey="permit_management"
      title="Permit management"
      description="Centralize oversized and trip permits with renewals, attachments, and load linkage so roadside exposure drops."
    >
      <div className="p-8 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Permits</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Company permits across loads and trucks. Attach documents from each load&apos;s detail page.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={openCreate}>Add permit</Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/loads">Go to loads</Link>
            </Button>
          </div>
        </div>

        <Card className="border-border overflow-hidden">
          {loading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading permits…</p>
          ) : permits.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No permits yet. Add a permit here or create one from a load detail page when a shipment
              requires oversize/overweight authority.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left">
                    <th className="p-3 font-medium">Permit #</th>
                    <th className="p-3 font-medium">State</th>
                    <th className="p-3 font-medium">Type</th>
                    <th className="p-3 font-medium">Expires</th>
                    <th className="p-3 font-medium">Load</th>
                    <th className="p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {permits.map((permit) => (
                    <tr key={permit.id} className="border-b border-border/60">
                      <td className="p-3">{permit.permit_number || "—"}</td>
                      <td className="p-3">{permit.issuing_state || "—"}</td>
                      <td className="p-3 capitalize">{permit.permit_type || "—"}</td>
                      <td className="p-3">
                        {permit.expiry_date
                          ? new Date(permit.expiry_date).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="p-3">
                        {permit.load_id ? (
                          <Link
                            href={`/dashboard/loads/${permit.load_id}`}
                            className="text-primary hover:underline"
                          >
                            View load
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-3">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(permit)}>
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit permit" : "Add permit"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1">
              <Label htmlFor="permit_number">Permit number</Label>
              <Input
                id="permit_number"
                value={form.permit_number}
                onChange={(e) => setForm((f) => ({ ...f, permit_number: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label htmlFor="issuing_state">State</Label>
                <Input
                  id="issuing_state"
                  maxLength={2}
                  placeholder="TX"
                  value={form.issuing_state}
                  onChange={(e) => setForm((f) => ({ ...f, issuing_state: e.target.value }))}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="permit_type">Type</Label>
                <Input
                  id="permit_type"
                  value={form.permit_type}
                  onChange={(e) => setForm((f) => ({ ...f, permit_type: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label htmlFor="issued_date">Issued</Label>
                <Input
                  id="issued_date"
                  type="date"
                  value={form.issued_date}
                  onChange={(e) => setForm((f) => ({ ...f, issued_date: e.target.value }))}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="expiry_date">Expires</Label>
                <Input
                  id="expiry_date"
                  type="date"
                  value={form.expiry_date}
                  onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="load_id">Load ID (optional)</Label>
              <Input
                id="load_id"
                value={form.load_id}
                onChange={(e) => setForm((f) => ({ ...f, load_id: e.target.value }))}
                placeholder="UUID from load detail"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="route_restriction">Route restriction</Label>
              <Input
                id="route_restriction"
                value={form.route_restriction}
                onChange={(e) => setForm((f) => ({ ...f, route_restriction: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FeatureLock>
  )
}
