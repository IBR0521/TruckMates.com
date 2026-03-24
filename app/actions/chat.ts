"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { revalidatePath } from "next/cache"
import { handleDbError } from "@/lib/db-helpers"
import * as Sentry from "@sentry/nextjs"

/** Matches `public.chat_threads` in supabase/trucklogics_features_schema.sql */
const CHAT_THREAD_SELECT = `
  id, company_id, load_id, route_id, driver_id, thread_type, title,
  participants, last_message_at, last_message_by, unread_count,
  created_at, updated_at
`

/** Matches `public.chat_messages` in supabase/trucklogics_features_schema.sql */
const CHAT_MESSAGE_SELECT = `
  id, thread_id, company_id, sender_id, message, message_type, attachments,
  is_read, read_by, is_edited, edited_at, is_deleted, deleted_at,
  created_at, updated_at
`

/**
 * Get chat threads for user
 */
export async function getChatThreads(filters?: {
  load_id?: string
  route_id?: string
  driver_id?: string
  thread_type?: string
}) {
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId || !ctx.userId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    let query = supabase
      .from("chat_threads")
      .select(CHAT_THREAD_SELECT)
      .eq("company_id", ctx.companyId)
      // SECURITY: Only threads where the current user is a participant
      .contains("participants", [ctx.userId])
      .order("last_message_at", { ascending: false })

    if (filters?.load_id) {
      query = query.eq("load_id", filters.load_id)
    }
    if (filters?.route_id) {
      query = query.eq("route_id", filters.route_id)
    }
    if (filters?.driver_id) {
      query = query.eq("driver_id", filters.driver_id)
    }
    if (filters?.thread_type) {
      query = query.eq("thread_type", filters.thread_type)
    }

    // Add a reasonable upper bound to avoid unbounded result sets
    query = query.limit(200)

    const { data: threads, error } = await query

    if (error) {
      const result = handleDbError(error, [])
      if (result.error) return result
      return { data: result.data, error: null }
    }

    return { data: threads || [], error: null }
  } catch (error: any) {
    Sentry.captureException(error)
    return { error: error?.message || "Failed to load chat threads", data: null }
  }
}

/**
 * Get or create chat thread
 */
export async function getOrCreateThread(formData: {
  load_id?: string
  route_id?: string
  driver_id?: string
  thread_type: string
  title?: string
  participant_ids: string[]
}) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // Check if thread already exists
  let query = supabase
    .from("chat_threads")
    .select(CHAT_THREAD_SELECT)
    .eq("company_id", ctx.companyId)
    .eq("thread_type", formData.thread_type)

  if (formData.load_id) {
    query = query.eq("load_id", formData.load_id)
  }
  if (formData.route_id) {
    query = query.eq("route_id", formData.route_id)
  }
  if (formData.driver_id) {
    query = query.eq("driver_id", formData.driver_id)
  }

  const { data: existingThreads } = await query

  if (existingThreads && existingThreads.length > 0) {
    return { data: existingThreads[0], error: null }
  }

  // Create new thread
  const participants = [...new Set([ctx.userId, ...formData.participant_ids])]

  const { data, error } = await supabase
    .from("chat_threads")
    .insert({
      company_id: ctx.companyId,
      load_id: formData.load_id || null,
      route_id: formData.route_id || null,
      driver_id: formData.driver_id || null,
      thread_type: formData.thread_type,
      title: formData.title || null,
      participants: participants,
    })
    .select()
    .single()

  if (error) {
    const result = handleDbError(error, null)
    if (result.error) return result
    return { error: "Table not available. Please run the SQL schema.", data: null }
  }

  return { data, error: null }
}

/**
 * Get messages for a thread
 */
export async function getChatMessages(threadId: string, limit: number = 50) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // Verify user has access to thread
  const { data: thread, error: threadError } = await supabase
    .from("chat_threads")
    .select(CHAT_THREAD_SELECT)
    .eq("id", threadId)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (threadError) {
    const result = handleDbError(threadError, null)
    if (result.error) return result
    return { error: "Table not available. Please run the SQL schema.", data: null }
  }

  if (!thread) {
    return { error: "Thread not found", data: null }
  }

  const participants = thread.participants || []
  if (!participants.includes(ctx.userId)) {
    return { error: "Access denied", data: null }
  }

  // Get messages
  const { data, error } = await supabase
    .from("chat_messages")
    .select(CHAT_MESSAGE_SELECT)
    .eq("thread_id", threadId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    const result = handleDbError(error, [])
    if (result.error) return result
    return { data: result.data, error: null }
  }

  // Mark messages as read
  await supabase
    .from("chat_messages")
    .update({
      is_read: true,
      read_by: supabase.raw(`array_append(COALESCE(read_by, '[]'::jsonb), '${ctx.userId}'::text)`)
    })
    .eq("thread_id", threadId)
    .neq("sender_id", ctx.userId)
    .eq("is_read", false)

  return { data: (data || []).reverse(), error: null }
}

/**
 * Send chat message
 */
export async function sendChatMessage(formData: {
  thread_id: string
  message: string
  message_type?: string
  attachments?: any[]
}) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // Verify user has access to thread
  const { data: thread, error: threadError } = await supabase
    .from("chat_threads")
    .select(CHAT_THREAD_SELECT)
    .eq("id", formData.thread_id)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (threadError) {
    const result = handleDbError(threadError, null)
    if (result.error) return result
    return { error: "Table not available. Please run the SQL schema.", data: null }
  }

  if (!thread) {
    return { error: "Thread not found", data: null }
  }

  const participants = thread.participants || []
  if (!participants.includes(ctx.userId)) {
    return { error: "Access denied", data: null }
  }

  // Create message
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      thread_id: formData.thread_id,
      company_id: ctx.companyId,
      sender_id: ctx.userId,
      message: formData.message,
      message_type: formData.message_type || 'text',
      attachments: formData.attachments || [],
      is_read: false,
      read_by: [],
    })
    .select()
    .single()

  if (error) {
    const result = handleDbError(error, null)
    if (result.error) return result
    return { error: "Table not available. Please run the SQL schema.", data: null }
  }

  revalidatePath(`/dashboard/chat/${formData.thread_id}`)
  return { data, error: null }
}

/**
 * Mark thread as read
 */
export async function markThreadAsRead(threadId: string) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // Mark all messages in thread as read
  await supabase
    .from("chat_messages")
    .update({
      is_read: true,
      read_by: supabase.raw(`array_append(COALESCE(read_by, '[]'::jsonb), '${ctx.userId}'::text)`)
    })
    .eq("thread_id", threadId)
    .neq("sender_id", ctx.userId)
    .eq("is_read", false)

  // Update thread unread count
  const { data: thread, error: threadError } = await supabase
    .from("chat_threads")
    .select("unread_count")
    .eq("id", threadId)
    .maybeSingle()

  if (threadError) {
    const result = handleDbError(threadError, null)
    if (result.error) return result
    return { error: "Table not available. Please run the SQL schema.", data: null }
  }

  if (thread) {
    const unreadCount = thread.unread_count || {}
    unreadCount[ctx.userId] = 0

    await supabase
      .from("chat_threads")
      .update({ unread_count: unreadCount })
      .eq("id", threadId)
  }

  return { data: { success: true }, error: null }
}

