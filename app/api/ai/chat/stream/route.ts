import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCachedAuthContext } from "@/lib/auth/server"
import { mapLegacyRole } from "@/lib/roles"
import type { AppRole } from "@/lib/ai/tools/types"
import { buildChatRequest, chatToolsEligible } from "@/lib/ai/chat"
import { callClaudeMessagesStream } from "@/lib/ai/client-messages"
import { chooseModel } from "@/lib/ai/model-router"
import { assertAiChatAllowed, generateConversationTitle, loadConversationHistory } from "@/app/actions/ai-chat"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const encoder = new TextEncoder()

function sse(event: Record<string, unknown>): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
}

function sseHeaders(): Record<string, string> {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    // Disable proxy buffering so deltas flush immediately.
    "X-Accel-Buffering": "no",
  }
}

/**
 * SSE streaming endpoint for the final AI chat answer.
 *
 * Reuses (does NOT fork) the existing chat pipeline:
 *  - role gating + plan tier checks via `assertAiChatAllowed`
 *  - context assembly + system prompt via `buildChatRequest`
 *  - tool-eligibility via `chatToolsEligible`
 *
 * Tool-use turns are NOT streamed: when tools are eligible we return `{ fallback: true }` so the
 * client uses the existing non-streaming `sendChatMessage` server action. AI usage is logged inside
 * `callClaudeMessagesStream` once the stream completes. Persistence happens only after a successful
 * stream, so a stream error leaves nothing saved and the client can safely fall back.
 */
export async function POST(request: NextRequest) {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId || !ctx.user) {
    return NextResponse.json({ error: ctx.error || "Not authenticated" }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    conversationId?: string
    message?: string
    voiceMode?: boolean
  }
  const conversationId = String(body.conversationId || "").trim()
  const message = String(body.message || "").trim()
  const voiceMode = Boolean(body.voiceMode)
  if (!conversationId || !message) {
    return NextResponse.json({ error: "conversationId and message are required" }, { status: 400 })
  }

  const gate = await assertAiChatAllowed(ctx.companyId)
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: 403 })
  }

  const companyId = ctx.companyId
  const userId = ctx.userId
  const userRole = mapLegacyRole(ctx.user.role) as AppRole

  const admin = createAdminClient()
  const { data: conv, error: convErr } = await admin
    .from("ai_conversations")
    .select("id, company_id, user_id, archived")
    .eq("id", conversationId)
    .maybeSingle()

  if (convErr) {
    return NextResponse.json({ error: "Conversation lookup failed." }, { status: 500 })
  }
  const convRow = conv as { id?: string; company_id?: string; user_id?: string; archived?: boolean } | null
  if (!convRow?.id || convRow.company_id !== companyId || convRow.user_id !== userId) {
    return NextResponse.json({ error: "You do not have access to this conversation." }, { status: 403 })
  }
  if (convRow.archived) {
    return NextResponse.json({ error: "This conversation is archived." }, { status: 403 })
  }

  // Tool-use turns must not stream — let the client use the existing non-streaming pipeline.
  if (chatToolsEligible({ enableTools: gate.enableTools, companyTier: gate.companyTier, userRole })) {
    return NextResponse.json({ fallback: true }, { status: 200 })
  }

  // Prior history (excludes the message currently being sent), then build the exact same request
  // the non-streaming path would have built.
  const conversationHistory = await loadConversationHistory(conversationId, companyId)
  const isFirstTurn = conversationHistory.filter((r) => r.role === "user").length === 0

  const built = await buildChatRequest({
    companyId,
    userId,
    userRole,
    companyTier: gate.companyTier,
    conversationId,
    userMessage: message,
    conversationHistory,
    enableTools: gate.enableTools,
    remainingAiCalls: gate.remainingAiCalls,
    voiceMode,
  })

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = ""
      try {
        for await (const delta of callClaudeMessagesStream({
          systemBlocks: built.systemBlocks,
          messages: built.loopMessages,
          maxTokens: 2048,
          model: chooseModel("chat"),
          companyId,
          feature: "ai_chat",
        })) {
          full += delta
          controller.enqueue(sse({ type: "delta", text: delta }))
        }
      } catch (e: unknown) {
        controller.enqueue(sse({ type: "error", error: e instanceof Error ? e.message : "AI stream failed" }))
        controller.close()
        return
      }

      // Persist only after a successful stream so a mid-stream failure leaves nothing saved and the
      // client can fall back to sendChatMessage without creating duplicate rows. The user + assistant
      // inserts are the only failures that may emit `error` (with rollback); once both rows are
      // committed we always emit `done`, since non-critical follow-ups (conversation timestamp,
      // title) must never trigger a client fallback that would duplicate the persisted turn.
      const { data: userRow, error: userErr } = await admin
        .from("ai_chat_messages")
        .insert({
          conversation_id: conversationId,
          company_id: companyId,
          role: "user",
          content: message,
          context_used: [],
          tokens_used: 0,
          cost_usd: 0,
        })
        .select("id")
        .single()

      if (userErr || !userRow) {
        controller.enqueue(sse({ type: "error", error: userErr?.message || "Failed to save message" }))
        controller.close()
        return
      }
      const userMessageId = String((userRow as { id: string }).id)

      const { data: asst, error: asstErr } = await admin
        .from("ai_chat_messages")
        .insert({
          conversation_id: conversationId,
          company_id: companyId,
          role: "assistant",
          content: full,
          context_used: built.contextUsed,
          tokens_used: 0,
          cost_usd: 0,
          model: null,
          tool_calls: [],
          tool_results: [],
          pending_tool_use_id: null,
        })
        .select("id")
        .single()

      if (asstErr || !asst) {
        // Roll back the user row so a client fallback does not create a duplicate user message.
        await admin.from("ai_chat_messages").delete().eq("id", userMessageId)
        controller.enqueue(sse({ type: "error", error: asstErr?.message || "Failed to persist reply" }))
        controller.close()
        return
      }

      // Best-effort, non-fatal follow-ups.
      try {
        const now = new Date().toISOString()
        await admin
          .from("ai_conversations")
          .update({ last_message_at: now, updated_at: now })
          .eq("id", conversationId)
          .eq("company_id", companyId)
          .eq("user_id", userId)
        if (isFirstTurn) {
          await generateConversationTitle({ conversationId })
        }
      } catch {
        /* timestamp/title are non-critical; the turn is already saved */
      }

      controller.enqueue(
        sse({
          type: "done",
          content: full,
          messageId: String((asst as { id: string }).id),
          contextUsed: built.contextUsed,
          quotaWarning: false,
        })
      )
      controller.close()
    },
  })

  return new Response(stream, { headers: sseHeaders() })
}
