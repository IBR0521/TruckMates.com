"use server"

import * as Sentry from "@sentry/nextjs"
import { createClient } from "@/lib/supabase/server"
import { errorMessage, sanitizeError } from "@/lib/error-message"
import { getCachedAuthContext } from "@/lib/auth/server"
import { checkCreatePermission, checkDeletePermission, checkEditPermission, checkViewPermission } from "@/lib/server-permissions"
import { revalidatePath } from "next/cache"
import { sanitizeString } from "@/lib/validation"

function safeDbError(error: unknown, fallback = "Database operation failed"): string {
  Sentry.captureException(error)
  return sanitizeError(error, { fallback })
}

export async function getTerminals() {
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

    const { data, error } = await supabase
      .from("terminals")
      .select("id, name, address, timezone, created_at")
      .eq("company_id", ctx.companyId)
      .order("name", { ascending: true })

    if (error) return { error: safeDbError(error), data: null }
    return { data: data || [], error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to load terminals"), data: null }
  }
}

export async function createTerminal(input: { name: string; address?: string; timezone?: string }) {
  const permission = await checkCreatePermission("settings")
  if (!permission.allowed) return { error: permission.error || "You don't have permission to create terminals", data: null }
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

    const payload = {
      company_id: ctx.companyId,
      name: sanitizeString(input.name, 120).trim(),
      address: sanitizeString(input.address || "", 500) || null,
      timezone: sanitizeString(input.timezone || "UTC", 120) || "UTC",
    }
    if (!payload.name) return { error: "Terminal name is required", data: null }

    const { data, error } = await supabase
      .from("terminals")
      .insert(payload)
      .select("id, name, address, timezone")
      .single()

    if (error) return { error: safeDbError(error), data: null }
    revalidatePath("/dashboard")
    revalidatePath("/dashboard/reports")
    return { data, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to create terminal"), data: null }
  }
}

export async function updateTerminal(id: string, input: { name?: string; address?: string; timezone?: string }) {
  const permission = await checkEditPermission("settings")
  if (!permission.allowed) return { error: permission.error || "You don't have permission to update terminals", data: null }
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

    const payload: Record<string, string | null> = {}
    if (input.name !== undefined) payload.name = sanitizeString(input.name, 120).trim() || null
    if (input.address !== undefined) payload.address = sanitizeString(input.address, 500) || null
    if (input.timezone !== undefined) payload.timezone = sanitizeString(input.timezone, 120) || "UTC"
    if (Object.keys(payload).length === 0) return { data: { success: true }, error: null }

    const { data, error } = await supabase
      .from("terminals")
      .update(payload)
      .eq("id", id)
      .eq("company_id", ctx.companyId)
      .select("id, name, address, timezone")
      .single()
    if (error) return { error: safeDbError(error), data: null }
    revalidatePath("/dashboard")
    revalidatePath("/dashboard/reports")
    return { data, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to update terminal"), data: null }
  }
}

export async function deleteTerminal(id: string) {
  const permission = await checkDeletePermission("settings")
  if (!permission.allowed) return { error: permission.error || "You don't have permission to delete terminals", data: null }
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

    // detach references first
    await Promise.all([
      supabase.from("trucks").update({ terminal_id: null }).eq("company_id", ctx.companyId).eq("terminal_id", id),
      supabase.from("drivers").update({ terminal_id: null }).eq("company_id", ctx.companyId).eq("terminal_id", id),
      supabase.from("loads").update({ terminal_id: null }).eq("company_id", ctx.companyId).eq("terminal_id", id),
    ])

    const { error } = await supabase
      .from("terminals")
      .delete()
      .eq("id", id)
      .eq("company_id", ctx.companyId)
    if (error) return { error: safeDbError(error), data: null }
    revalidatePath("/dashboard")
    revalidatePath("/dashboard/reports")
    return { data: { success: true }, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to delete terminal"), data: null }
  }
}

export async function getTerminalMetrics() {
  const permission = await checkViewPermission("reports")
  if (!permission.allowed) return { error: permission.error || "You don't have permission to view terminal metrics", data: null }
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

    const { data: terminals, error } = await supabase
      .from("terminals")
      .select("id, name, timezone")
      .eq("company_id", ctx.companyId)
      .order("name", { ascending: true })
    if (error) return { error: safeDbError(error), data: null }

    const out: Array<any> = []
    for (const t of terminals || []) {
      const [trucks, drivers, loads, inTransit] = await Promise.all([
        supabase.from("trucks").select("id", { count: "exact", head: true }).eq("company_id", ctx.companyId).eq("terminal_id", t.id),
        supabase.from("drivers").select("id", { count: "exact", head: true }).eq("company_id", ctx.companyId).eq("terminal_id", t.id),
        supabase.from("loads").select("id", { count: "exact", head: true }).eq("company_id", ctx.companyId).eq("terminal_id", t.id),
        supabase.from("loads").select("id", { count: "exact", head: true }).eq("company_id", ctx.companyId).eq("terminal_id", t.id).eq("status", "in_transit"),
      ])
      out.push({
        id: t.id,
        name: t.name,
        timezone: t.timezone,
        trucks: trucks.count || 0,
        drivers: drivers.count || 0,
        loads: loads.count || 0,
        in_transit: inTransit.count || 0,
      })
    }

    const totals = out.reduce(
      (acc, t) => {
        acc.trucks += t.trucks
        acc.drivers += t.drivers
        acc.loads += t.loads
        acc.in_transit += t.in_transit
        return acc
      },
      { trucks: 0, drivers: 0, loads: 0, in_transit: 0 },
    )

    return { data: { terminals: out, totals }, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to load terminal metrics"), data: null }
  }
}
