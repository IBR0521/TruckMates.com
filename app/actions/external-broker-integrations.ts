"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { revalidatePath } from "next/cache"
import * as Sentry from "@sentry/nextjs"
import { sanitizeError } from "@/lib/error-message"


function safeDbError(error: unknown, fallback = "Database operation failed"): string {
  Sentry.captureException(error)
  return sanitizeError(error, { fallback })
}


export type ExternalBrokerProvider = "dat" | "truckstop" | "123loadboard"

type IntegrationRow = {
  id: string
  company_id: string
  provider: ExternalBrokerProvider
  dat_enabled?: boolean | null
  dat_api_key?: string | null
  dat_api_secret?: string | null
  dat_username?: string | null
  dat_password?: string | null
  dat_sync_enabled?: boolean | null
  truckstop_enabled?: boolean | null
  truckstop_api_key?: string | null
  truckstop_api_secret?: string | null
  truckstop_username?: string | null
  truckstop_password?: string | null
  truckstop_sync_enabled?: boolean | null
  loadboard123_enabled?: boolean | null
  loadboard123_api_key?: string | null
  loadboard123_username?: string | null
  loadboard123_password?: string | null
  loadboard123_sync_enabled?: boolean | null
  sync_filters?: any
  max_loads_per_sync?: number | null
  last_sync_status?: string | null
  last_sync_error?: string | null
  dat_last_sync_at?: string | null
  truckstop_last_sync_at?: string | null
  loadboard123_last_sync_at?: string | null
}

async function requireManagerRole() {
  const { getUserRole } = await import("@/lib/server-permissions")
  const role = await getUserRole()
  const MANAGER_ROLES = ["super_admin", "operations_manager"]
  if (!role || !MANAGER_ROLES.includes(role)) {
    return { ok: false as const, error: "Only managers can manage broker integrations" }
  }
  return { ok: true as const, error: null }
}

export async function getExternalBrokerIntegrations(): Promise<{
  data: IntegrationRow[] | null
  error: string | null
}> {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) return { data: null, error: ctx.error || "Not authenticated" }

  const { data, error } = await supabase
    .from("external_broker_integrations")
    .select(
      `
      id,
      company_id,
      provider,
      dat_enabled,
      dat_api_key,
      dat_api_secret,
      dat_username,
      dat_sync_enabled,
      dat_last_sync_at,
      truckstop_enabled,
      truckstop_api_key,
      truckstop_api_secret,
      truckstop_username,
      truckstop_sync_enabled,
      truckstop_last_sync_at,
      loadboard123_enabled,
      loadboard123_api_key,
      loadboard123_username,
      loadboard123_sync_enabled,
      loadboard123_last_sync_at,
      sync_filters,
      max_loads_per_sync,
      last_sync_status,
      last_sync_error
    `,
    )
    .eq("company_id", ctx.companyId)

  if (error) return { data: null, error: safeDbError(error) }
  return { data: (data || []) as IntegrationRow[], error: null }
}

export async function upsertExternalBrokerIntegration(
  provider: ExternalBrokerProvider,
  updates: Partial<IntegrationRow> & {
    enabled?: boolean
  },
): Promise<{ data: IntegrationRow | null; error: string | null }> {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) return { data: null, error: ctx.error || "Not authenticated" }

  const roleCheck = await requireManagerRole()
  if (!roleCheck.ok) return { data: null, error: roleCheck.error }

  const updateData: Record<string, any> = {
    company_id: ctx.companyId,
    provider,
    sync_filters: updates.sync_filters ?? {},
    max_loads_per_sync: updates.max_loads_per_sync ?? 100,
  }

  if (provider === "truckstop") {
    if (updates.enabled !== undefined) updateData.truckstop_enabled = !!updates.enabled
    if (updates.truckstop_api_key !== undefined) updateData.truckstop_api_key = updates.truckstop_api_key || null
    if (updates.truckstop_api_secret !== undefined) updateData.truckstop_api_secret = updates.truckstop_api_secret || null
    if (updates.truckstop_username !== undefined) updateData.truckstop_username = updates.truckstop_username || null
    if (updates.truckstop_password !== undefined) updateData.truckstop_password = updates.truckstop_password || null
    if (updates.truckstop_sync_enabled !== undefined) updateData.truckstop_sync_enabled = !!updates.truckstop_sync_enabled
  } else if (provider === "dat") {
    if (updates.enabled !== undefined) updateData.dat_enabled = !!updates.enabled
    if (updates.dat_api_key !== undefined) updateData.dat_api_key = updates.dat_api_key || null
    if (updates.dat_api_secret !== undefined) updateData.dat_api_secret = updates.dat_api_secret || null
    if (updates.dat_username !== undefined) updateData.dat_username = updates.dat_username || null
    if (updates.dat_password !== undefined) updateData.dat_password = updates.dat_password || null
    if (updates.dat_sync_enabled !== undefined) updateData.dat_sync_enabled = !!updates.dat_sync_enabled
  } else if (provider === "123loadboard") {
    if (updates.enabled !== undefined) updateData.loadboard123_enabled = !!updates.enabled
    if (updates.loadboard123_api_key !== undefined) updateData.loadboard123_api_key = updates.loadboard123_api_key || null
    if (updates.loadboard123_username !== undefined) updateData.loadboard123_username = updates.loadboard123_username || null
    if (updates.loadboard123_password !== undefined) updateData.loadboard123_password = updates.loadboard123_password || null
    if (updates.loadboard123_sync_enabled !== undefined) updateData.loadboard123_sync_enabled = !!updates.loadboard123_sync_enabled
  }

  const { data, error } = await supabase
    .from("external_broker_integrations")
    .upsert(updateData, { onConflict: "company_id,provider" })
    .select()
    .single()

  if (error) return { data: null, error: safeDbError(error) }

  revalidatePath("/dashboard/settings/loadboards")
  revalidatePath("/dashboard/settings/integration")
  return { data: data as IntegrationRow, error: null }
}

export async function testTruckstopConnection(opts?: { environment?: "prod" | "int" }): Promise<{
  ok: boolean
  error: string | null
  details?: { claims?: unknown; expires_in?: number }
}> {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) return { ok: false, error: ctx.error || "Not authenticated" }

  const roleCheck = await requireManagerRole()
  if (!roleCheck.ok) return { ok: false, error: roleCheck.error }

  const { data: integration, error } = await supabase
    .from("external_broker_integrations")
    .select("truckstop_api_key, truckstop_api_secret, truckstop_username, truckstop_password, truckstop_enabled")
    .eq("company_id", ctx.companyId)
    .eq("provider", "truckstop")
    .maybeSingle()

  if (error) return { ok: false, error: safeDbError(error) }

  if (!integration?.truckstop_api_key || !integration?.truckstop_api_secret || !integration?.truckstop_username || !integration?.truckstop_password) {
    return { ok: false, error: "Missing Truckstop credentials (client id/secret + username/password)" }
  }

  const baseUrl = opts?.environment === "prod" ? "https://api.truckstop.com" : "https://api-int.truckstop.com"
  const authHeader = Buffer.from(`${integration.truckstop_api_key}:${integration.truckstop_api_secret}`).toString("base64")

  const body = new URLSearchParams()
  // NOTE: Truckstop docs spell it `grant_Type` (capital T) in their OpenAPI
  body.set("grant_Type", "password")
  body.set("username", integration.truckstop_username)
  body.set("password", integration.truckstop_password)

  const res = await fetch(`${baseUrl}/auth/token?scope=truckstop`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${authHeader}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
    cache: "no-store",
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    return { ok: false, error: `Truckstop auth failed (${res.status}). ${text || "Check credentials"}` }
  }

  const json = (await res.json().catch(() => ({}))) as any
  return {
    ok: true,
    error: null,
    details: { claims: json?.claims, expires_in: json?.expires_in },
  }
}

