"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { loadPendingAiApprovals } from "../actions"
import type { PendingApproval } from "@/lib/ai/agent/types"

function getConfidenceClass(score: number): string {
  if (score >= 80) return "text-emerald-700"
  if (score >= 70) return "text-yellow-700"
  return "text-orange-700"
}

function getConfidenceBadge(score: number): "default" | "secondary" | "outline" {
  if (score >= 80) return "default"
  if (score >= 70) return "secondary"
  return "outline"
}

function expiresInMinutes(expiresAt: string, now: number): number {
  const diffMs = new Date(expiresAt).getTime() - now
  return Math.max(0, Math.ceil(diffMs / 60000))
}

export function PendingApprovalsClientPage({ companyId }: { companyId: string }) {
  const [approvals, setApprovals] = useState<PendingApproval[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)
  const [nowMs, setNowMs] = useState(Date.now())

  const loadApprovals = useCallback(async () => {
    const result = await loadPendingAiApprovals(companyId)
    if (result.error) {
      toast.error(result.error)
      return
    }
    setApprovals(result.data)
  }, [companyId])

  useEffect(() => {
    let mounted = true
    const init = async () => {
      setLoading(true)
      await loadApprovals()
      if (mounted) setLoading(false)
    }
    void init()

    const refreshTimer = window.setInterval(() => {
      void loadApprovals()
    }, 60000)

    const clockTimer = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => {
      mounted = false
      window.clearInterval(refreshTimer)
      window.clearInterval(clockTimer)
    }
  }, [loadApprovals])

  const handleDecision = useCallback(
    async (approvalId: string, approved: boolean) => {
      setActingId(approvalId)
      const previous = approvals
      setApprovals((current) => current.filter((item) => item.id !== approvalId))

      try {
        const response = await fetch("/api/ai/approve", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ approvalId, approved }),
        })

        const payload = (await response.json().catch(() => ({}))) as { success?: boolean; error?: string }
        if (!response.ok || payload.success === false) {
          setApprovals(previous)
          toast.error(payload.error || "Failed to process approval")
          return
        }

        toast.success(approved ? "AI action approved" : "AI action rejected")
      } catch {
        setApprovals(previous)
        toast.error("Failed to process approval")
      } finally {
        setActingId(null)
      }
    },
    [approvals],
  )

  const sortedApprovals = useMemo(
    () =>
      [...approvals].sort((a, b) => {
        return new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime()
      }),
    [approvals],
  )

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4">
        <h1 className="text-2xl font-bold text-foreground">Pending AI Approvals</h1>
        <p className="text-sm text-muted-foreground mt-1">Actions waiting for human confirmation before execution.</p>
      </div>

      <div className="p-4 md:p-8">
        {loading ? (
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Loading pending approvals...</p>
          </Card>
        ) : sortedApprovals.length === 0 ? (
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">No pending AI approvals.</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {sortedApprovals.map((approval) => {
              const minutesRemaining = expiresInMinutes(approval.expiresAt, nowMs)
              const confidence = Number(approval.confidence || 0)
              return (
                <Card key={approval.id} className="p-4 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="font-semibold text-foreground">{approval.description}</h3>
                      <p className="text-sm text-muted-foreground">Automation: {approval.automationType}</p>
                    </div>
                    <Badge variant={getConfidenceBadge(confidence)} className={getConfidenceClass(confidence)}>
                      Confidence {confidence}%
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Reasoning</p>
                    <p className="text-sm text-foreground">{approval.reasoning}</p>
                  </div>

                  <p className="text-sm text-muted-foreground">Expires in {minutesRemaining} minute{minutesRemaining === 1 ? "" : "s"}</p>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => void handleDecision(approval.id, true)}
                      disabled={actingId === approval.id}
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => void handleDecision(approval.id, false)}
                      disabled={actingId === approval.id}
                    >
                      Reject
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
