"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, ChevronUp, Sparkles, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { ProactiveRecommendationActions } from "@/components/ai/proactive-recommendation-actions"
import {
  COLLAPSE_UNTIL_KEY,
  DEFAULT_COLLAPSE_MS,
  clearPanelHideInStorage,
  shouldClearHideForCriticalNotification,
} from "@/lib/ai/proactive-panel-hide"
import { useNotificationsRealtimeSubscription } from "@/lib/hooks/notifications-realtime-subscription"
import { isAmbientPanelNotifyEvent, isUrgentPriority } from "@/lib/notifications/ambient-panel-events"

type ProactiveRecommendationRow = {
  id: string
  title: string | null
  message: string | null
  ai_priority: string | null
  priority: string | null
  created_at: string | null
  metadata: Record<string, unknown> | null
}

function priorityRank(p: string | null | undefined): number {
  const v = String(p || "").toLowerCase()
  if (v === "critical") return 0
  if (v === "high") return 1
  if (v === "medium") return 2
  return 3
}

function effectivePriority(row: ProactiveRecommendationRow): string {
  return row.ai_priority || row.priority || "normal"
}

function isAmbientUrgentRow(row: ProactiveRecommendationRow): boolean {
  const meta = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? row.metadata : {}
  const event = meta.event
  if (!isAmbientPanelNotifyEvent(event)) return false
  return isUrgentPriority(row.priority) || isUrgentPriority(row.ai_priority)
}

function isStagedPendingRow(row: ProactiveRecommendationRow): boolean {
  const meta = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? row.metadata : {}
  return meta.recommended_action_status === "pending_confirmation"
}

export function ProactiveRecommendationsPanel() {
  const supabase = useMemo(() => createClient(), [])
  const [userId, setUserId] = useState<string | null>(null)
  const [rows, setRows] = useState<ProactiveRecommendationRow[]>([])
  const [collapsed, setCollapsed] = useState(false)
  const [hiddenUntil, setHiddenUntil] = useState<number>(0)
  const hiddenUntilRef = useRef(hiddenUntil)

  useEffect(() => {
    hiddenUntilRef.current = hiddenUntil
  }, [hiddenUntil])

  useEffect(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem(COLLAPSE_UNTIL_KEY) : null
    const until = raw ? Number(raw) : 0
    if (Number.isFinite(until) && until > Date.now()) {
      setHiddenUntil(until)
    }
  }, [])

  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser()
      if (data.user?.id) setUserId(data.user.id)
    }
    void loadUser()
  }, [supabase])

  const refresh = useCallback(async () => {
    if (!userId) return

    const [stagedQ, urgentQ] = await Promise.all([
      supabase
        .from("notifications")
        .select("id, title, message, ai_priority, priority, created_at, metadata")
        .eq("user_id", userId)
        .eq("source", "ai_proactive")
        .eq("read", false)
        .filter("metadata->>recommended_action_status", "eq", "pending_confirmation")
        .limit(20),
      supabase
        .from("notifications")
        .select("id, title, message, ai_priority, priority, created_at, metadata")
        .eq("user_id", userId)
        .eq("read", false)
        .in("priority", ["high", "critical"])
        .limit(40),
    ])

    if (stagedQ.error) {
      console.error("[ai_proactive] Failed to load proactive recommendations:", stagedQ.error.message)
      setRows([])
      return
    }
    if (urgentQ.error) {
      console.error("[ai_proactive] Failed to load urgent ambient notifications:", urgentQ.error.message)
    }

    const byId = new Map<string, ProactiveRecommendationRow>()
    for (const row of (stagedQ.data || []) as ProactiveRecommendationRow[]) {
      if (isStagedPendingRow(row)) byId.set(row.id, row)
    }
    for (const row of (urgentQ.data || []) as ProactiveRecommendationRow[]) {
      if (isAmbientUrgentRow(row) && !byId.has(row.id)) byId.set(row.id, row)
    }

    const list = Array.from(byId.values())
    list.sort((a, b) => {
      const pa = priorityRank(effectivePriority(a))
      const pb = priorityRank(effectivePriority(b))
      if (pa !== pb) return pa - pb
      return String(b.created_at || "").localeCompare(String(a.created_at || ""))
    })
    setRows(list)
  }, [supabase, userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useNotificationsRealtimeSubscription(userId, (payload) => {
    if (shouldClearHideForCriticalNotification(payload, hiddenUntilRef.current)) {
      clearPanelHideInStorage()
      setHiddenUntil(0)
    }
    void refresh()
  })

  const now = Date.now()
  const isHidden = hiddenUntil > now
  const pending = rows
  if (pending.length === 0 || isHidden) return null

  const visible = pending.slice(0, 3)
  const more = Math.max(0, pending.length - visible.length)

  return (
    <div
      className={cn(
        "fixed right-4 top-[84px] z-40 w-[360px] max-w-[calc(100vw-2rem)]",
        "hidden md:block",
      )}
      aria-label="AI recommendations"
    >
      <div className="rounded-xl border bg-card/95 backdrop-blur shadow-lg">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold truncate">AI recommends</p>
                <Badge variant="secondary" className="text-[10px] font-normal shrink-0">
                  {pending.length}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">Needs attention</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label={collapsed ? "Expand panel" : "Collapse panel"}
              onClick={() => setCollapsed((v) => !v)}
            >
              {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Hide recommendations for now"
              onClick={() => {
                const until = Date.now() + DEFAULT_COLLAPSE_MS
                localStorage.setItem(COLLAPSE_UNTIL_KEY, String(until))
                setHiddenUntil(until)
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {!collapsed ? (
          <div className="p-3 space-y-3">
            {visible.map((n) => {
              const meta = n.metadata && typeof n.metadata === "object" && !Array.isArray(n.metadata) ? n.metadata : {}
              const summary =
                typeof meta.recommended_action_summary === "string" ? meta.recommended_action_summary : null
              const auditId =
                typeof meta.recommended_action_audit_id === "string" ? meta.recommended_action_audit_id : null
              const isStaged = Boolean(auditId && meta.recommended_action_status === "pending_confirmation")
              const isAmbient = !isStaged && isAmbientUrgentRow(n)

              if (!isStaged && !isAmbient) return null

              const bodyText = summary || n.message

              return (
                <div key={n.id} className="rounded-lg border bg-background/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium line-clamp-2">{n.title || "Notification"}</p>
                      {bodyText ? <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{bodyText}</p> : null}
                    </div>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wide shrink-0">
                      {effectivePriority(n)}
                    </Badge>
                  </div>

                  <div className="mt-2">
                    {isStaged ? (
                      <ProactiveRecommendationActions
                        notificationId={n.id}
                        mode="pending_confirmation"
                        summary={summary}
                        onDone={() => void refresh()}
                      />
                    ) : (
                      <ProactiveRecommendationActions
                        notificationId={n.id}
                        mode="acknowledge_only"
                        onDone={() => void refresh()}
                      />
                    )}
                  </div>
                </div>
              )
            })}

            {more > 0 ? (
              <p className="text-[11px] text-muted-foreground">
                +{more} more pending
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
