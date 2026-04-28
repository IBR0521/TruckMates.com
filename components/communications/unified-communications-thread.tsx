"use client"

import { useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { format } from "date-fns"
import { Mail, MessageSquare, Smartphone, RefreshCcw, ShieldAlert } from "lucide-react"
import {
  getUnifiedCommunicationTimeline,
  type UnifiedCommunicationEvent,
} from "@/app/actions/communication-threads"

type Props = {
  driverId?: string
  customerId?: string
  title?: string
}

function channelIcon(channel: UnifiedCommunicationEvent["channel"]) {
  if (channel === "email") return <Mail className="h-4 w-4" />
  if (channel === "sms") return <Smartphone className="h-4 w-4" />
  return <MessageSquare className="h-4 w-4" />
}

function channelBadge(channel: UnifiedCommunicationEvent["channel"]) {
  switch (channel) {
    case "email":
      return "bg-blue-500/15 text-blue-300 border border-blue-500/25"
    case "sms":
      return "bg-purple-500/15 text-purple-300 border border-purple-500/25"
    case "system":
      return "bg-amber-500/15 text-amber-200 border border-amber-500/25"
    default:
      return "bg-muted text-muted-foreground border border-border/60"
  }
}

export function UnifiedCommunicationsThread({ driverId, customerId, title }: Props) {
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<UnifiedCommunicationEvent[]>([])

  const target = useMemo(() => {
    if (driverId) return { driver_id: driverId, customer_id: undefined }
    if (customerId) return { driver_id: undefined, customer_id: customerId }
    return { driver_id: undefined, customer_id: undefined }
  }, [driverId, customerId])

  async function load() {
    if (!target.driver_id && !target.customer_id) return
    setLoading(true)
    try {
      const res = await getUnifiedCommunicationTimeline({
        driver_id: target.driver_id,
        customer_id: target.customer_id,
        limit: 200,
      })
      if (res.error) {
        toast.error(res.error)
        setEvents([])
      } else {
        setEvents(res.data || [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.driver_id, target.customer_id])

  if (!target.driver_id && !target.customer_id) {
    return (
      <Card className="p-6">
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <ShieldAlert className="h-4 w-4 mt-0.5" />
          Select a driver or customer to view communications.
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{title || "Unified Communications"}</h3>
          <p className="text-sm text-muted-foreground">
            Chat + SMS + Email in one timeline (chronological)
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCcw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {loading ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Loading communications…</p>
        </Card>
      ) : events.length === 0 ? (
        <Card className="p-8 text-center">
          <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No communications found</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {events.map((ev) => (
            <Card key={ev.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className={`rounded-md px-2 py-2 ${channelBadge(ev.channel)}`}>
                  {channelIcon(ev.channel)}
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge className={channelBadge(ev.channel)}>{ev.channel.toUpperCase()}</Badge>
                    <Badge variant="outline">
                      {ev.direction === "inbound" ? "Inbound" : "Outbound"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(ev.occurred_at), "MMM d, yyyy h:mm a")}
                    </span>
                  </div>
                  {ev.subject ? <p className="text-sm font-semibold">{ev.subject}</p> : null}
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {ev.message || "—"}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

