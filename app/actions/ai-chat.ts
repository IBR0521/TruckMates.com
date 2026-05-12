"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getCachedAuthContext } from "@/lib/auth/server"
import { checkFeatureAccess } from "@/lib/plan-enforcement"
import { safeDbError } from "@/lib/utils/error"
import type { AiMessage } from "@/lib/ai/types"
import { handleChatMessage } from "@/lib/ai/chat"
import { callClaude } from "@/lib/ai/client"

type ChatRole = "user" | "assistant"

function isChatRole(value: string): value is ChatRole {
  return value === "user" || value === "assistant"
}

async function assertAiChatAllowed(companyId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await checkFeatureAccess({ companyId, feature: "ai_chat" })
  if (!gate.allowed) {
    return { ok: false, error: "AI assistant is not available on your current plan." }
  }
  return { ok: true }
}

async function assertConversationOwner(params: {
  conversationId: string
  companyId: string
  userId: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("ai_conversations")
    .select("id, company_id, user_id, archived")
    .eq("id", params.conversationId)
    .maybeSingle()

  if (error) {
    return { ok: false, error: safeDbError(error) }
  }
  const row = data as { id?: string; company_id?: string; user_id?: string; archived?: boolean } | null
  if (!row?.id) {
    return { ok: false, error: "Conversation not found." }
  }
  if (row.company_id !== params.companyId || row.user_id !== params.userId) {
    return { ok: false, error: "You do not have access to this conversation." }
  }
  if (row.archived) {
    return { ok: false, error: "This conversation is archived." }
  }
  return { ok: true }
}

export async function getConversations(): Promise<{
  data: Array<{
    id: string
    title: string
    lastMessageAt: string
    messageCount: number
  }> | null
  error: string | null
}> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }
  const gate = await assertAiChatAllowed(ctx.companyId)
  if (!gate.ok) return { data: null, error: gate.error }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("ai_conversations")
    .select("id, title, last_message_at")
    .eq("company_id", ctx.companyId)
    .eq("user_id", ctx.userId)
    .eq("archived", false)
    .order("last_message_at", { ascending: false })
    .limit(20)

  if (error) {
    return { data: null, error: safeDbError(error) }
  }

  const rows = (data || []) as Array<{ id: string; title: string; last_message_at: string }>
  const ids = rows.map((r) => r.id).filter(Boolean)
  const counts = new Map<string, number>()
  if (ids.length > 0) {
    const { data: countRows, error: countError } = await admin
      .from("ai_chat_messages")
      .select("conversation_id")
      .in("conversation_id", ids)

    if (countError) {
      return { data: null, error: safeDbError(countError) }
    }
    for (const r of (countRows || []) as Array<{ conversation_id: string }>) {
      const id = String(r.conversation_id || "")
      if (!id) continue
      counts.set(id, (counts.get(id) || 0) + 1)
    }
  }

  return {
    error: null,
    data: rows.map((r) => ({
      id: r.id,
      title: r.title,
      lastMessageAt: r.last_message_at,
      messageCount: counts.get(r.id) || 0,
    })),
  }
}

export async function getConversation(conversationId: string): Promise<{
  data: {
    id: string
    title: string
    messages: Array<{
      id: string
      role: ChatRole
      content: string
      createdAt: string
    }>
  } | null
  error: string | null
}> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }
  const gate = await assertAiChatAllowed(ctx.companyId)
  if (!gate.ok) return { data: null, error: gate.error }

  const access = await assertConversationOwner({
    conversationId,
    companyId: ctx.companyId,
    userId: ctx.userId,
  })
  if (!access.ok) return { data: null, error: access.error }

  const admin = createAdminClient()
  const { data: conv, error: convError } = await admin
    .from("ai_conversations")
    .select("id, title")
    .eq("id", conversationId)
    .maybeSingle()

  if (convError) {
    return { data: null, error: safeDbError(convError) }
  }
  const convRow = conv as { id?: string; title?: string } | null
  if (!convRow?.id) {
    return { data: null, error: "Conversation not found." }
  }

  const { data: msgs, error: msgError } = await admin
    .from("ai_chat_messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .eq("company_id", ctx.companyId)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: true })

  if (msgError) {
    return { data: null, error: safeDbError(msgError) }
  }

  const messages = ((msgs || []) as Array<{ id: string; role: string; content: string; created_at: string }>)
    .filter((m) => isChatRole(m.role))
    .map((m) => ({
      id: m.id,
      role: m.role as ChatRole,
      content: m.content,
      createdAt: m.created_at,
    }))

  return {
    error: null,
    data: {
      id: convRow.id,
      title: String(convRow.title || "New conversation"),
      messages,
    },
  }
}

export async function createConversation(): Promise<{
  data: { id: string } | null
  error: string | null
}> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }
  const gate = await assertAiChatAllowed(ctx.companyId)
  if (!gate.ok) return { data: null, error: gate.error }

  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { data, error } = await admin
    .from("ai_conversations")
    .insert({
      company_id: ctx.companyId,
      user_id: ctx.userId,
      title: "New conversation",
      last_message_at: now,
      updated_at: now,
    })
    .select("id")
    .single()

  if (error || !data) {
    return { data: null, error: safeDbError(error) }
  }
  return { data: { id: String((data as { id: string }).id) }, error: null }
}

export async function sendChatMessage(params: {
  conversationId: string
  message: string
}): Promise<{
  data: {
    userMessageId: string
    assistantMessageId: string
    assistantContent: string
    contextUsed: string[]
  } | null
  error: string | null
  quotaWarning?: boolean
}> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }
  const gate = await assertAiChatAllowed(ctx.companyId)
  if (!gate.ok) return { data: null, error: gate.error }

  const text = String(params.message || "").trim()
  if (!text) {
    return { data: null, error: "Message is empty." }
  }

  const access = await assertConversationOwner({
    conversationId: params.conversationId,
    companyId: ctx.companyId,
    userId: ctx.userId,
  })
  if (!access.ok) return { data: null, error: access.error }

  const admin = createAdminClient()

  const { data: priorRows, error: priorError } = await admin
    .from("ai_chat_messages")
    .select("role, content")
    .eq("conversation_id", params.conversationId)
    .eq("company_id", ctx.companyId)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: false })
    .limit(10)

  if (priorError) {
    return { data: null, error: safeDbError(priorError) }
  }

  const priorChronological = ((priorRows || []) as Array<{ role: string; content: string }>)
    .filter((r) => isChatRole(r.role))
    .reverse()
    .map((r) => ({ role: r.role as ChatRole, content: r.content }))

  const { data: userInsert, error: userErr } = await admin
    .from("ai_chat_messages")
    .insert({
      conversation_id: params.conversationId,
      company_id: ctx.companyId,
      role: "user",
      content: text,
      context_used: [],
      tokens_used: 0,
      cost_usd: 0,
    })
    .select("id")
    .single()

  if (userErr || !userInsert) {
    return { data: null, error: safeDbError(userErr) }
  }
  const userMessageId = String((userInsert as { id: string }).id)

  const priorForModel: AiMessage[] = priorChronological

  const ai = await handleChatMessage({
    companyId: ctx.companyId,
    userId: ctx.userId,
    conversationId: params.conversationId,
    userMessage: text,
    previousMessages: priorForModel,
  })

  if (ai.error || !ai.data) {
    return { data: null, error: ai.error || "AI failed to respond.", quotaWarning: ai.quotaWarning }
  }

  const tokensUsed = typeof ai.tokensUsed === "number" ? ai.tokensUsed : 0
  const model = typeof ai.model === "string" ? ai.model : null

  const { data: asstInsert, error: asstErr } = await admin
    .from("ai_chat_messages")
    .insert({
      conversation_id: params.conversationId,
      company_id: ctx.companyId,
      role: "assistant",
      content: ai.data.responseText,
      context_used: ai.data.contextUsed,
      tokens_used: tokensUsed,
      cost_usd: 0,
      model,
    })
    .select("id")
    .single()

  if (asstErr || !asstInsert) {
    return { data: null, error: safeDbError(asstErr), quotaWarning: ai.quotaWarning }
  }

  const now = new Date().toISOString()
  const { error: convErr } = await admin
    .from("ai_conversations")
    .update({ last_message_at: now, updated_at: now })
    .eq("id", params.conversationId)
    .eq("company_id", ctx.companyId)
    .eq("user_id", ctx.userId)

  if (convErr) {
    return { data: null, error: safeDbError(convErr), quotaWarning: ai.quotaWarning }
  }

  if (priorChronological.length === 0) {
    await generateConversationTitle({ conversationId: params.conversationId })
  }

  return {
    error: null,
    quotaWarning: ai.quotaWarning,
    data: {
      userMessageId,
      assistantMessageId: String((asstInsert as { id: string }).id),
      assistantContent: ai.data.responseText,
      contextUsed: ai.data.contextUsed,
    },
  }
}

export async function archiveConversation(conversationId: string): Promise<{
  data: { archived: boolean } | null
  error: string | null
}> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }

  const access = await assertConversationOwner({
    conversationId,
    companyId: ctx.companyId,
    userId: ctx.userId,
  })
  if (!access.ok) return { data: null, error: access.error }

  const admin = createAdminClient()
  const { error } = await admin
    .from("ai_conversations")
    .update({ archived: true, updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("company_id", ctx.companyId)
    .eq("user_id", ctx.userId)

  if (error) {
    return { data: null, error: safeDbError(error) }
  }
  return { data: { archived: true }, error: null }
}

export async function generateConversationTitle(params: {
  conversationId: string
}): Promise<{ data: { title: string } | null; error: string | null }> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }

  const access = await assertConversationOwner({
    conversationId: params.conversationId,
    companyId: ctx.companyId,
    userId: ctx.userId,
  })
  if (!access.ok) return { data: null, error: access.error }

  const admin = createAdminClient()
  const { data: firstUser, error: firstErr } = await admin
    .from("ai_chat_messages")
    .select("content")
    .eq("conversation_id", params.conversationId)
    .eq("company_id", ctx.companyId)
    .eq("role", "user")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (firstErr) {
    return { data: null, error: safeDbError(firstErr) }
  }
  const first = String((firstUser as { content?: string } | null)?.content || "").trim()
  if (!first) {
    return { data: null, error: "No user message to summarize." }
  }

  const system = `Return ONLY a short conversation title (3 to 6 words). No quotes. No punctuation at the end. Title case.`
  const res = await callClaude(system, `User first message:\n${first}`, {
    model: "haiku",
    maxTokens: 32,
    feature: "ai_chat_title",
    companyId: ctx.companyId,
    cacheSystemPrompt: true,
  })

  if (res.error || res.data === null || res.data === undefined) {
    return { data: null, error: res.error || "Title generation failed." }
  }

  let title = String(res.data).replace(/\s+/g, " ").trim()
  title = title.replace(/^["']|["']$/g, "")
  if (title.length > 80) title = `${title.slice(0, 77).trimEnd()}...`

  const { error: upErr } = await admin
    .from("ai_conversations")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", params.conversationId)
    .eq("company_id", ctx.companyId)
    .eq("user_id", ctx.userId)

  if (upErr) {
    return { data: null, error: safeDbError(upErr) }
  }

  return { data: { title }, error: null }
}
