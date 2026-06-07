"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import type { PersistedToolCall, PersistedToolResult } from "@/lib/ai/chat"
import { confirmToolExecution } from "@/app/actions/ai-chat"

export type PendingConfirmationRow = {
  auditId: string
  toolName: string
  toolUseId: string
  summary: string
  affected: Array<{ type: string; id: string; label: string }>
}

export function humanizeToolName(snake: string): string {
  return snake.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export function derivePendingFromMessages(
  messages: Array<{
    role: string
    toolCalls?: PersistedToolCall[] | null
    toolResults?: PersistedToolResult[] | null
  }>,
): PendingConfirmationRow[] {
  for (let mi = messages.length - 1; mi >= 0; mi--) {
    const m = messages[mi]
    if (m.role !== "assistant" || !m.toolResults?.length) continue
    const calls = m.toolCalls || []
    const pendingRows: PendingConfirmationRow[] = []
    for (let j = 0; j < m.toolResults.length; j++) {
      const tr = m.toolResults[j]
      try {
        const parsed = JSON.parse(tr.content) as Record<string, unknown>
        if (parsed.pending_user_confirmation === true && parsed.audit_id) {
          const affectedRaw = parsed.affected
          const affected: PendingConfirmationRow["affected"] = []
          if (Array.isArray(affectedRaw)) {
            for (const row of affectedRaw) {
              if (!row || typeof row !== "object") continue
              const r = row as Record<string, unknown>
              if (typeof r.type === "string" && typeof r.id === "string" && typeof r.label === "string") {
                affected.push({ type: r.type, id: r.id, label: r.label })
              }
            }
          }
          pendingRows.push({
            auditId: String(parsed.audit_id),
            toolName: typeof calls[j]?.name === "string" ? calls[j].name : "unknown_tool",
            toolUseId: tr.tool_use_id,
            summary: String(parsed.summary || "Awaiting confirmation."),
            affected,
          })
        }
      } catch {
        /* ignore parse errors */
      }
    }
    if (pendingRows.length > 0) return pendingRows
  }
  return []
}

export function ToolCallsBadges({ calls }: { calls: PersistedToolCall[] }) {
  if (!calls.length) return null
  return (
    <div className="mt-2 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">AI tools</p>
      <ul className="space-y-2">
        {calls.map((c) => (
          <li key={c.id} className="rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs">
            <p className="font-medium">{humanizeToolName(c.name)}</p>
            <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-all text-[10px] text-muted-foreground">
              {JSON.stringify(c.input, null, 2)}
            </pre>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ToolResultsPreview({ results }: { results: PersistedToolResult[] }) {
  const visible = results.filter((r) => {
    try {
      const p = JSON.parse(r.content) as Record<string, unknown>
      return p.pending_user_confirmation !== true
    } catch {
      return true
    }
  })
  if (!visible.length) return null

  return (
    <div className="mt-2 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Tool results</p>
      <ul className="space-y-2">
        {visible.map((r) => {
          let parsed: unknown = null
          try {
            parsed = JSON.parse(r.content)
          } catch {
            parsed = r.content
          }
          const data =
            parsed &&
            typeof parsed === "object" &&
            parsed !== null &&
            "data" in parsed &&
            Array.isArray((parsed as { data: unknown }).data)
              ? (parsed as { data: unknown }).data
              : null
          const tableRows =
            Array.isArray(data) &&
            data.length > 0 &&
            data.every((row) => Boolean(row) && typeof row === "object" && !Array.isArray(row))

          return (
            <li
              key={r.tool_use_id}
              className={
                r.is_error
                  ? "rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1.5 text-xs"
                  : "rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              }
            >
              {tableRows ? (
                <ToolResultTable rows={data as Record<string, unknown>[]} />
              ) : (
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all text-[11px]">
                  {typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2)}
                </pre>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ToolResultTable({ rows }: { rows: Record<string, unknown>[] }) {
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))))
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="border-b border-border">
            {keys.map((k) => (
              <th key={k} className="text-left font-medium px-1 py-1">
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/60">
              {keys.map((k) => (
                <td key={k} className="px-1 py-1 align-top whitespace-pre-wrap max-w-[140px]">
                  {formatCell(row[k])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "—"
  if (typeof v === "object") return JSON.stringify(v)
  return String(v)
}

export function PendingConfirmationsPanel(props: {
  conversationId: string | null
  pending: PendingConfirmationRow[]
  disabled?: boolean
  onResolved: () => void | Promise<void>
}) {
  const [busyId, setBusyId] = useState<string | null>(null)

  if (!props.conversationId || props.pending.length === 0) return null

  const run = async (auditId: string, approve: boolean) => {
    setBusyId(auditId)
    try {
      const res = await confirmToolExecution({
        conversationId: props.conversationId as string,
        auditId,
        approve,
        rejectReason: approve ? undefined : "Cancelled by user.",
      })
      if (res.error || !res.data) {
        if (res.error && !res.error.includes("already cancelled") && !res.error.includes("failed previously")) {
          toast.error(res.error || "Could not update action.")
        } else if (res.error) {
          toast.message(res.error)
        }
        await props.onResolved()
        return
      }
      if (res.quotaWarning) toast.message("You are approaching your monthly AI usage limit.")
      toast.success(approve ? "Action executed." : "Action cancelled.")
      await props.onResolved()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
      <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">Confirmation required</p>
      {props.pending.map((p) => (
        <div key={p.auditId} className="rounded-md border border-border bg-card p-3 space-y-2 text-xs">
          <p className="font-medium">{humanizeToolName(p.toolName)}</p>
          <p className="text-muted-foreground">{p.summary}</p>
          {p.affected.length > 0 ? (
            <div>
              <p className="font-medium text-foreground mb-1">Affected</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {p.affected.map((a) => (
                  <li key={`${a.type}-${a.id}`}>
                    <span className="font-medium">{a.type}</span>: {a.label}{" "}
                    <span className="text-muted-foreground">({a.id})</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" size="sm" disabled={props.disabled || busyId !== null} onClick={() => void run(p.auditId, true)}>
              {busyId === p.auditId ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Approve & execute"}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={props.disabled || busyId !== null} onClick={() => void run(p.auditId, false)}>
              Cancel
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
