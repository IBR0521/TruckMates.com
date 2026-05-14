"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { createCoachingSession, type DriverCoachingSession } from "@/app/actions/safety-scorecards"
import type { HarshEvent } from "@/app/actions/eld-events"

const SESSION_TYPES: DriverCoachingSession["session_type"][] = [
  "verbal",
  "written",
  "formal_review",
  "recognition",
  "follow_up",
]

const TOPIC_OPTIONS = [
  "harsh_braking",
  "speeding",
  "hos",
  "attendance",
  "customer_feedback",
  "other",
] as const

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  driverId: string
  recentEvents: HarshEvent[]
  onSaved?: () => void
}

export function CoachingSessionDialog({ open, onOpenChange, driverId, recentEvents, onSaved }: Props) {
  const [sessionDate, setSessionDate] = useState("")
  const [sessionType, setSessionType] = useState<DriverCoachingSession["session_type"]>("verbal")
  const [topics, setTopics] = useState<Set<string>>(new Set())
  const [notes, setNotes] = useState("")
  const [actionItems, setActionItems] = useState<string[]>([""])
  const [followUpDate, setFollowUpDate] = useState("")
  const [relatedIds, setRelatedIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const t = new Date().toISOString().slice(0, 10)
    setSessionDate(t)
    setSessionType("verbal")
    setTopics(new Set())
    setNotes("")
    setActionItems([""])
    setFollowUpDate("")
    setRelatedIds(new Set())
  }, [open])

  function toggleTopic(id: string) {
    setTopics((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  function toggleEvent(id: string) {
    setRelatedIds((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  async function onSubmit() {
    const trimmedNotes = notes.trim()
    if (!trimmedNotes) {
      toast.error("Notes are required.")
      return
    }
    const items = actionItems.map((s) => s.trim()).filter(Boolean)
    if (items.length === 0) {
      toast.error("Add at least one action item.")
      return
    }
    setSaving(true)
    const res = await createCoachingSession({
      driverId,
      sessionDate,
      sessionType,
      topicsDiscussed: Array.from(topics),
      notes: trimmedNotes,
      actionItems: items,
      followUpDate: followUpDate.trim() || undefined,
      relatedEventIds: Array.from(relatedIds),
    })
    setSaving(false)
    if (res.error) return toast.error(res.error)
    toast.success("Coaching session recorded.")
    onOpenChange(false)
    onSaved?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record coaching session</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="coaching-session-date">Session date</Label>
            <Input
              id="coaching-session-date"
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="mb-2 block">Session type</Label>
            <RadioGroup
              value={sessionType}
              onValueChange={(v) => setSessionType(v as DriverCoachingSession["session_type"])}
              className="grid gap-2"
            >
              {SESSION_TYPES.map((t) => (
                <label key={t} className="flex cursor-pointer items-center gap-2 text-sm">
                  <RadioGroupItem value={t} id={`stype-${t}`} />
                  <span className="capitalize">{t.replace(/_/g, " ")}</span>
                </label>
              ))}
            </RadioGroup>
          </div>
          <div>
            <Label className="mb-2 block">Topics discussed</Label>
            <div className="grid gap-2">
              {TOPIC_OPTIONS.map((t) => (
                <label key={t} className="flex cursor-pointer items-center gap-2 text-sm capitalize">
                  <Checkbox checked={topics.has(t)} onCheckedChange={() => toggleTopic(t)} />
                  {t.replace(/_/g, " ")}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="coaching-notes">Notes</Label>
            <Textarea
              id="coaching-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="mt-1"
              placeholder="What was covered and context for HR records…"
            />
          </div>
          <div>
            <Label>Action items</Label>
            <div className="mt-2 space-y-2">
              {actionItems.map((line, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    value={line}
                    onChange={(e) =>
                      setActionItems((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))
                    }
                    placeholder={`Action ${idx + 1}`}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={() => setActionItems((prev) => prev.filter((_, i) => i !== idx))}
                    disabled={actionItems.length <= 1}
                    aria-label="Remove action item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-1"
                onClick={() => setActionItems((prev) => [...prev, ""])}
              >
                <Plus className="h-4 w-4" />
                Add item
              </Button>
            </div>
          </div>
          <div>
            <Label htmlFor="follow-up-date">Follow-up date (optional)</Label>
            <Input
              id="follow-up-date"
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              className="mt-1"
            />
          </div>
          {recentEvents.length > 0 ? (
            <div>
              <Label className="mb-2 block">Related safety events (optional)</Label>
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-border/60 p-2">
                {recentEvents.slice(0, 25).map((ev) => (
                  <label key={ev.id} className="flex cursor-pointer items-start gap-2 text-xs">
                    <Checkbox checked={relatedIds.has(ev.id)} onCheckedChange={() => toggleEvent(ev.id)} />
                    <span>
                      <span className="font-medium text-foreground">{ev.event_type.replace(/_/g, " ")}</span>
                      <span className="text-muted-foreground"> · {new Date(ev.occurred_at).toLocaleString()}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void onSubmit()} disabled={saving}>
            {saving ? "Saving…" : "Save session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
