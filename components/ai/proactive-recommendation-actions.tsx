"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { dismissProactiveRecommendation, handleProactiveRecommendation } from "@/app/actions/ai-chat"

export function ProactiveRecommendationActions(props: {
  notificationId: string
  mode: "pending_confirmation" | "auto_executed" | "action_failed" | "acknowledge_only"
  summary?: string | null
  onDone?: () => void
}) {
  const [busy, setBusy] = useState<"handle" | "dismiss" | "acknowledge" | null>(null)

  if (props.mode === "acknowledge_only") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          disabled={busy !== null}
          onClick={async () => {
            setBusy("acknowledge")
            try {
              const { markNotificationAsRead } = await import("@/app/actions/unified-notifications")
              const res = await markNotificationAsRead(props.notificationId, "notification")
              if (!res.error) props.onDone?.()
            } finally {
              setBusy(null)
            }
          }}
        >
          I see it
        </Button>
      </div>
    )
  }

  if (props.mode === "action_failed") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-[10px] font-normal border-destructive/50 text-destructive">
          AI attempted action — did not complete
        </Badge>
        {props.summary ? <span className="text-[11px] text-muted-foreground">{props.summary}</span> : null}
      </div>
    )
  }

  if (props.mode === "auto_executed") {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-[10px] font-normal">
          Done automatically
        </Badge>
        {props.summary ? <span className="text-[11px] text-muted-foreground">{props.summary}</span> : null}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        className="h-7 px-2 text-xs"
        disabled={busy !== null}
        onClick={async () => {
          setBusy("handle")
          try {
            const res = await handleProactiveRecommendation(props.notificationId)
            if (!res.error) props.onDone?.()
          } finally {
            setBusy(null)
          }
        }}
      >
        Handle it
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-7 px-2 text-xs"
        disabled={busy !== null}
        onClick={async () => {
          setBusy("dismiss")
          try {
            const res = await dismissProactiveRecommendation(props.notificationId)
            if (!res.error) props.onDone?.()
          } finally {
            setBusy(null)
          }
        }}
      >
        I&apos;ve got it
      </Button>
      {props.summary ? <span className="text-[11px] text-muted-foreground">{props.summary}</span> : null}
    </div>
  )
}

