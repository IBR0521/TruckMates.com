import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCachedAuthContext } from "@/lib/auth/server"
import { executeAgentAction } from "@/lib/ai/agent/executor"
import { resolveApproval } from "@/lib/ai/agent/settings"
import { extractPreferenceEntityId, recordActionPreference } from "@/lib/ai/context"
import type { AgentAction } from "@/lib/ai/types"
import { rateLimitRedis, retryAfterFromReset } from "@/lib/rate-limit-redis"

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function buildActionFromApproval(args: {
  companyId: string
  trigger: string
  confidence: number
  reasoning: string
  actionPayload: Record<string, unknown>
  userId: string
}): AgentAction {
  const nestedAction = toRecord(args.actionPayload.action)
  if (nestedAction.type && nestedAction.payload) {
    return {
      type: String(nestedAction.type),
      companyId: String(nestedAction.companyId || args.companyId),
      triggeredBy: String(nestedAction.triggeredBy || `approval:${args.userId}`),
      payload: toRecord(nestedAction.payload),
      confidence: Number(nestedAction.confidence || args.confidence || 0),
      reasoning: String(nestedAction.reasoning || args.reasoning),
      automationLevel: "approval",
      reversible: Boolean(nestedAction.reversible ?? true),
    }
  }

  return {
    type: String(args.actionPayload.suggestedAction || args.trigger),
    companyId: args.companyId,
    triggeredBy: `approval:${args.userId}`,
    payload: toRecord(args.actionPayload.payload || args.actionPayload),
    confidence: args.confidence,
    reasoning: args.reasoning,
    automationLevel: "approval",
    reversible: Boolean(args.actionPayload.reversible ?? true),
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.userId || !ctx.companyId) {
      return NextResponse.json({ success: false, error: ctx.error || "Not authenticated" }, { status: 401 })
    }

    const approveRl = await rateLimitRedis(`ai_approve:${ctx.companyId}`, { limit: 30, window: 60 })
    if (!approveRl.success) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": retryAfterFromReset(approveRl.reset) } },
      )
    }

    const body = (await request.json().catch(() => ({}))) as { approvalId?: string; approved?: boolean }
    const approvalId = String(body.approvalId || "").trim()
    const approved = Boolean(body.approved)

    if (!approvalId) {
      return NextResponse.json({ success: false, error: "approvalId is required" }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: approval, error: approvalError } = await admin
      .from("ai_pending_approvals")
      .select("id, company_id, automation_type, confidence, reasoning, action_payload, expires_at, resolved_at")
      .eq("id", approvalId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (approvalError || !approval) {
      return NextResponse.json({ success: false, error: approvalError?.message || "Approval not found" }, { status: 404 })
    }

    if ((approval as Record<string, unknown>).resolved_at) {
      return NextResponse.json({ success: false, error: "Approval already resolved" }, { status: 409 })
    }

    const expiresAt = new Date(String((approval as Record<string, unknown>).expires_at || ""))
    if (Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
      await resolveApproval(approvalId, false)
      return NextResponse.json({ success: false, error: "Approval has expired" }, { status: 410 })
    }

    const resolveResult = await resolveApproval(approvalId, approved)
    if (resolveResult.error) {
      return NextResponse.json({ success: false, error: resolveResult.error }, { status: 500 })
    }

    // Accumulate the company's approve/reject preference for this automation (+ entity), best-effort.
    {
      const prefPayload = toRecord((approval as Record<string, unknown>).action_payload)
      const prefAction = toRecord(prefPayload.action)
      const prefEntity =
        extractPreferenceEntityId(toRecord(prefAction.payload)) ||
        extractPreferenceEntityId(toRecord(prefPayload.triggerData)) ||
        extractPreferenceEntityId(prefPayload)
      void recordActionPreference({
        companyId: ctx.companyId,
        toolName: String((approval as Record<string, unknown>).automation_type || ""),
        entityId: prefEntity,
        outcome: approved ? "approved" : "rejected",
      })
    }

    if (!approved) {
      return NextResponse.json({ success: true })
    }

    const actionPayload = toRecord((approval as Record<string, unknown>).action_payload)
    const action = buildActionFromApproval({
      companyId: String((approval as Record<string, unknown>).company_id),
      trigger: String((approval as Record<string, unknown>).automation_type),
      confidence: Number((approval as Record<string, unknown>).confidence || 0),
      reasoning: String((approval as Record<string, unknown>).reasoning || ""),
      actionPayload,
      userId: ctx.userId,
    })

    const execution = await executeAgentAction(action)
    if (!execution.success) {
      return NextResponse.json(
        { success: false, error: execution.error || "Failed to execute approved action" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}
