"use server"

import * as Sentry from "@sentry/nextjs"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { checkViewPermission } from "@/lib/server-permissions"
import { errorMessage } from "@/lib/error-message"

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

export type AuditLogRow = {
  id: string
  created_at: string
  action: string
  resource_type: string
  resource_id: string | null
  user_id: string | null
  user_name: string
  ip_address: string | null
  user_agent: string | null
  details: Record<string, unknown>
}

export async function getAuditLogs(filters?: {
  search?: string
  action?: string
  resource_type?: string
  user_id?: string
  date_from?: string
  date_to?: string
  limit?: number
  offset?: number
}): Promise<{
  data: AuditLogRow[] | null
  count: number
  error: string | null
}> {
  try {
    const permission = await checkViewPermission("settings")
    if (!permission.allowed) {
      return { data: null, count: 0, error: permission.error || "You don't have permission to view audit logs" }
    }

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { data: null, count: 0, error: ctx.error || "Not authenticated" }
    }

    const supabase = await createClient()
    const limit = Math.min(Math.max(Number(filters?.limit || 50), 1), 200)
    const offset = Math.max(Number(filters?.offset || 0), 0)

    let query = supabase
      .from("audit_logs")
      .select("id, created_at, action, resource_type, resource_id, user_id, ip_address, user_agent, details", { count: "exact" })
      .eq("company_id", ctx.companyId)
      .order("created_at", { ascending: false })

    if (filters?.action) query = query.eq("action", filters.action)
    if (filters?.resource_type) query = query.eq("resource_type", filters.resource_type)
    if (filters?.user_id) query = query.eq("user_id", filters.user_id)
    if (filters?.date_from) query = query.gte("created_at", `${filters.date_from}T00:00:00`)
    if (filters?.date_to) query = query.lte("created_at", `${filters.date_to}T23:59:59.999`)
    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim()
      query = query.or(`action.ilike.%${q}%,resource_type.ilike.%${q}%,resource_id.ilike.%${q}%`)
    }

    const { data, count, error } = await query.range(offset, offset + limit - 1)
    if (error) {
      return { data: null, count: 0, error: "Failed to load audit logs" }
    }

    const userIds = [...new Set((data || []).map((row: any) => row.user_id).filter(Boolean))]
    let userMap: Record<string, string> = {}
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("id, name, full_name, email")
        .in("id", userIds)
      userMap = (users || []).reduce((acc: Record<string, string>, user: any) => {
        acc[user.id] = user.name || user.full_name || user.email || "Unknown user"
        return acc
      }, {})
    }

    const rows: AuditLogRow[] = (data || []).map((row: any) => ({
      id: row.id,
      created_at: row.created_at,
      action: row.action,
      resource_type: row.resource_type,
      resource_id: row.resource_id,
      user_id: row.user_id,
      user_name: row.user_id ? userMap[row.user_id] || "Unknown user" : "System",
      ip_address: row.ip_address || null,
      user_agent: row.user_agent || null,
      details: (row.details && typeof row.details === "object") ? row.details : {},
    }))

    return { data: rows, count: count || 0, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { data: null, count: 0, error: errorMessage(error, "Failed to load audit logs") }
  }
}

export async function getAuditLogFilterOptions(): Promise<{
  data: { actions: string[]; resourceTypes: string[]; users: Array<{ id: string; label: string }> } | null
  error: string | null
}> {
  try {
    const permission = await checkViewPermission("settings")
    if (!permission.allowed) {
      return { data: null, error: permission.error || "You don't have permission to view audit logs" }
    }

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { data: null, error: ctx.error || "Not authenticated" }

    const supabase = await createClient()

    const [{ data: logs }, { data: users }] = await Promise.all([
      supabase
        .from("audit_logs")
        .select("action, resource_type")
        .eq("company_id", ctx.companyId)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("users")
        .select("id, name, full_name, email")
        .eq("company_id", ctx.companyId)
        .limit(200),
    ])

    const actions = [...new Set((logs || []).map((l: any) => l.action).filter(isNonEmptyString))].sort()
    const resourceTypes = [...new Set((logs || []).map((l: any) => l.resource_type).filter(isNonEmptyString))].sort()
    const userRows: Array<{ id: string; label: string }> = (users || [])
      .map((u: any) => {
        const id = isNonEmptyString(u?.id) ? u.id : ""
        const labelCandidate = u?.name ?? u?.full_name ?? u?.email ?? id
        const label = isNonEmptyString(labelCandidate) ? labelCandidate : id
        return { id, label }
      })
      .filter((u) => isNonEmptyString(u.id))

    return { data: { actions, resourceTypes, users: userRows }, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { data: null, error: errorMessage(error, "Failed to load audit filter options") }
  }
}

