"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { createGeofence, updateGeofence, type GeofenceListItem } from "@/app/actions/geofences"
import { toast } from "sonner"
import { errorMessage } from "@/lib/error-message"

const TYPES = ["customer", "pickup", "delivery", "yard", "fuel_stop", "rest_area", "other"] as const

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: GeofenceListItem | null
  onSaved: () => void
}

export function GeofenceFormDialog({ open, onOpenChange, editing, onSaved }: Props) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [geofenceType, setGeofenceType] = useState<string>("yard")
  const [lat, setLat] = useState("39.0")
  const [lng, setLng] = useState("-98.0")
  const [radius, setRadius] = useState(200)
  const [autoStatus, setAutoStatus] = useState(true)
  const [notifyIn, setNotifyIn] = useState(true)
  const [notifyOut, setNotifyOut] = useState(false)
  const [trackDwell, setTrackDwell] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setName(editing.name)
      setDescription("")
      setGeofenceType(editing.geofence_type || "yard")
      setLat(String(editing.center_latitude ?? 39))
      setLng(String(editing.center_longitude ?? -98))
      setRadius(Math.min(2000, Math.max(50, editing.radius_meters ?? 200)))
      setAutoStatus(true)
      setNotifyIn(true)
      setNotifyOut(false)
      setTrackDwell(true)
    } else {
      setName("")
      setDescription("")
      setGeofenceType("yard")
      setLat("39.0")
      setLng("-98.0")
      setRadius(200)
      setAutoStatus(true)
      setNotifyIn(true)
      setNotifyOut(false)
      setTrackDwell(true)
    }
  }, [open, editing])

  const onSubmit = async () => {
    setSaving(true)
    try {
      const latN = Number(lat)
      const lngN = Number(lng)
      if (!name.trim()) {
        toast.error("Name is required")
        return
      }
      if (!Number.isFinite(latN) || !Number.isFinite(lngN)) {
        toast.error("Valid latitude and longitude are required")
        return
      }
      if (editing) {
        const r = await updateGeofence({
          id: editing.id,
          patches: {
            name: name.trim(),
            description: description.trim() || undefined,
            center_latitude: latN,
            center_longitude: lngN,
            radius_meters: radius,
            auto_update_load_status: autoStatus,
            notify_on_arrival: notifyIn,
            notify_on_departure: notifyOut,
            track_dwell_time: trackDwell,
            geofence_type: geofenceType,
          },
        })
        if (r.error) toast.error(r.error)
        else {
          toast.success("Geofence updated")
          onSaved()
          onOpenChange(false)
        }
      } else {
        const r = await createGeofence({
          name: name.trim(),
          description: description.trim() || undefined,
          geofence_type: geofenceType,
          center_lat: latN,
          center_lng: lngN,
          radius_meters: radius,
          auto_update_load_status: autoStatus,
          notify_on_arrival: notifyIn,
          notify_on_departure: notifyOut,
          track_dwell_time: trackDwell,
        })
        if (r.error) toast.error(r.error)
        else {
          toast.success("Geofence created")
          onSaved()
          onOpenChange(false)
        }
      }
    } catch (e: unknown) {
      toast.error(errorMessage(e, "Save failed"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit geofence" : "New geofence"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label htmlFor="gf-name">Name</Label>
            <Input id="gf-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer yard" />
          </div>
          <div>
            <Label htmlFor="gf-desc">Description</Label>
            <Input id="gf-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={geofenceType} onValueChange={setGeofenceType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Latitude</Label>
              <Input value={lat} onChange={(e) => setLat(e.target.value)} />
            </div>
            <div>
              <Label>Longitude</Label>
              <Input value={lng} onChange={(e) => setLng(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Radius: {radius} m</Label>
            <Slider min={50} max={2000} step={10} value={[radius]} onValueChange={(v) => setRadius(v[0] ?? 200)} />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={autoStatus} onCheckedChange={(c) => setAutoStatus(c === true)} />
              Auto-update load status (Professional+ only applies changes)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={notifyIn} onCheckedChange={(c) => setNotifyIn(c === true)} />
              Notify on arrival
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={notifyOut} onCheckedChange={(c) => setNotifyOut(c === true)} />
              Notify on departure
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={trackDwell} onCheckedChange={(c) => setTrackDwell(c === true)} />
              Track dwell / detention signals
            </label>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Map pick is manual coordinates for v1 — use Google Maps or your ELD map to copy lat/lng.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void onSubmit()} disabled={saving}>
            {saving ? "Saving…" : editing ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
