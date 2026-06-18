"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCachedAuthContext } from "@/lib/auth/server"
import { safeDbError } from "@/lib/utils/error"
import { checkResourceLimit } from "@/lib/plan-enforcement"
import {
  testSamsaraConnection,
  testMotiveConnection,
  testGeotabConnection,
} from "@/lib/eld/connection-tests"
import {
  discoverSamsaraVehicles,
  discoverMotiveVehicles,
  discoverGeotabVehicles,
  discoverVehiclesForDevice,
  type DiscoveredVehicle,
} from "@/lib/eld/vehicle-discovery"
import { autoMatchVehicles } from "@/lib/eld/vehicle-auto-match"
import { geotabNotesWithDatabase } from "@/lib/eld/geotab-url"
import {
  createEldDeviceWithCredentials,
  eldDeviceRowToSyncRow,
  getEldDeviceWithCredentials,
  updateEldDeviceCredentials,
} from "@/lib/eld/device-credentials"

export type EldWizardProvider = "samsara" | "motive" | "geotab"

export type DiscoveredVehicleWithSuggestion = DiscoveredVehicle & {
  suggested_truck_id: string | null
  confidence: string
  match_reason: string
}

async function ensureWizardAccess(): Promise<{ companyId: string } | { error: string }> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated" }
  const { checkCreatePermission } = await import("@/lib/server-permissions")
  const perm = await checkCreatePermission("eld")
  if (!perm.allowed) return { error: perm.error || "You don't have permission to manage ELD connections." }
  return { companyId: ctx.companyId }
}

function normalizeProvider(p: string): EldWizardProvider | null {
  const k = p.toLowerCase()
  if (k === "samsara") return "samsara"
  if (k === "motive" || k === "keeptruckin") return "motive"
  if (k === "geotab") return "geotab"
  return null
}

export async function testELDConnection(params: {
  provider: EldWizardProvider
  credentials: Record<string, string>
}): Promise<{
  data: { success: boolean; details?: Record<string, unknown> } | null
  error: string | null
}> {
  const gate = await ensureWizardAccess()
  if ("error" in gate) return { data: null, error: gate.error }

  const provider = normalizeProvider(params.provider)
  if (!provider) return { data: null, error: "Unsupported provider." }

  let result
  if (provider === "samsara") {
    result = await testSamsaraConnection({ apiKey: params.credentials.apiKey || "" })
  } else if (provider === "motive") {
    result = await testMotiveConnection({
      apiKey: params.credentials.apiKey || "",
      apiSecret: params.credentials.apiSecret,
    })
  } else {
    result = await testGeotabConnection({
      username: params.credentials.username || "",
      password: params.credentials.password || "",
      database: params.credentials.database || "",
      serverUrl: params.credentials.serverUrl,
    })
  }

  return {
    data: { success: result.success, details: result.details },
    error: result.success ? null : result.error || "Connection failed",
  }
}

export async function createELDDeviceFromWizard(params: {
  provider: EldWizardProvider
  credentials: Record<string, string>
  deviceLabel: string
}): Promise<{ data: { eld_device_id: string } | null; error: string | null }> {
  const gate = await ensureWizardAccess()
  if ("error" in gate) return { data: null, error: gate.error }

  const limit = await checkResourceLimit({ companyId: gate.companyId, resourceType: "eld_devices" })
  if (!limit.allowed) {
    return {
      data: null,
      error: `You've reached your ELD device limit (${limit.current}/${limit.limit}). Upgrade to add more, or remove an existing connection.`,
    }
  }

  const provider = normalizeProvider(params.provider)
  if (!provider) return { data: null, error: "Unsupported provider." }

  const test = await testELDConnection({ provider, credentials: params.credentials })
  if (test.error || !test.data?.success) {
    return { data: null, error: test.error || "Connection test failed." }
  }

  const supabase = await createClient()
  const serial = `wizard-${provider}-${Date.now()}`
  const label = params.deviceLabel.trim() || `${provider} fleet connection`

  const insert: Record<string, unknown> = {
    company_id: gate.companyId,
    device_name: label,
    device_serial_number: serial,
    provider: provider === "motive" ? "keeptruckin" : provider,
    provider_device_id: provider === "geotab" ? params.credentials.database?.trim() || "fleet" : "fleet",
    status: "active",
    health_status: "healthy",
    health_message: "Connection verified",
    last_health_check_at: new Date().toISOString(),
  }

  if (provider === "samsara") {
    insert.api_key = params.credentials.apiKey?.trim()
  } else if (provider === "motive") {
    insert.api_key = params.credentials.apiKey?.trim()
    if (params.credentials.apiSecret?.trim()) insert.api_secret = params.credentials.apiSecret.trim()
  } else {
    insert.api_key = params.credentials.username?.trim()
    insert.api_secret = params.credentials.password
    insert.api_endpoint = params.credentials.serverUrl?.trim() || "https://my.geotab.com"
    insert.notes = geotabNotesWithDatabase(params.credentials.database || "")
  }

  const created = await createEldDeviceWithCredentials(insert, { client: supabase })
  if (created.error) return { data: null, error: safeDbError({ message: created.error } as { message: string }) }

  const id = String((created.data as { id: string }).id)
  revalidatePath("/dashboard/eld/devices")
  return { data: { eld_device_id: id }, error: null }
}

export async function discoverVehiclesForDeviceAction(params: {
  eldDeviceId: string
}): Promise<{ data: DiscoveredVehicleWithSuggestion[] | null; error: string | null }> {
  const gate = await ensureWizardAccess()
  if ("error" in gate) return { data: null, error: gate.error }

  const supabase = await createClient()
  const deviceResult = await getEldDeviceWithCredentials(params.eldDeviceId, {
    companyId: gate.companyId,
    client: supabase,
    select:
      "id, company_id, provider, api_key, api_secret, api_endpoint, notes, provider_device_id, truck_id, status",
  })

  if (deviceResult.error || !deviceResult.data) {
    return { data: null, error: deviceResult.error || "Device not found" }
  }

  const device = deviceResult.data
  const syncDevice = eldDeviceRowToSyncRow(device)

  const discovered = await discoverVehiclesForDevice({
    ...syncDevice,
    notes: device.notes != null ? String(device.notes) : undefined,
  })
  if (discovered.error || !discovered.data) {
    return { data: null, error: discovered.error || "Discovery failed" }
  }

  const { matches } = await autoMatchVehicles({
    companyId: gate.companyId,
    discoveredVehicles: discovered.data,
  })

  await supabase
    .from("eld_devices")
    .update({
      auto_discovered_vehicle_count: discovered.data.length,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.eldDeviceId)

  const rows: DiscoveredVehicleWithSuggestion[] = matches.map((m) => ({
    ...m.discovered,
    suggested_truck_id: m.truck_id,
    confidence: m.confidence,
    match_reason: m.match_reason,
  }))

  return { data: rows, error: null }
}

export async function saveVehicleMappings(params: {
  eldDeviceId: string
  mappings: Array<{
    provider_vehicle_id: string
    provider_vehicle_name?: string
    provider_vin?: string | null
    provider_license_plate?: string | null
    truck_id: string | null
    auto_matched: boolean
    match_confidence: string
  }>
}): Promise<{ data: { saved: number } | null; error: string | null }> {
  const gate = await ensureWizardAccess()
  if ("error" in gate) return { data: null, error: gate.error }

  const supabase = await createClient()
  const parentResult = await getEldDeviceWithCredentials(params.eldDeviceId, {
    companyId: gate.companyId,
    client: supabase,
    select: "*",
  })

  if (parentResult.error || !parentResult.data) {
    return { data: null, error: parentResult.error || "Device not found" }
  }

  const parentRow = parentResult.data
  let saved = 0
  let mappedCount = 0

  for (const m of params.mappings) {
    const isMapped = Boolean(m.truck_id)
    if (isMapped) mappedCount += 1

    const { error: mapErr } = await supabase.from("eld_vehicle_mappings").upsert(
      {
        company_id: gate.companyId,
        eld_device_id: params.eldDeviceId,
        truck_id: m.truck_id,
        provider_vehicle_id: m.provider_vehicle_id,
        provider_vehicle_name: m.provider_vehicle_name ?? null,
        provider_vin: m.provider_vin ?? null,
        provider_license_plate: m.provider_license_plate ?? null,
        is_mapped: isMapped,
        auto_matched: m.auto_matched,
        match_confidence: m.match_confidence === "none" ? null : m.match_confidence,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "eld_device_id,provider_vehicle_id" },
    )
    if (mapErr) return { data: null, error: safeDbError(mapErr) }

    if (m.truck_id) {
      const childSerial = `map-${params.eldDeviceId.slice(0, 8)}-${m.provider_vehicle_id}`.slice(0, 120)
      const { data: existing } = await supabase
        .from("eld_devices")
        .select("id")
        .eq("company_id", gate.companyId)
        .eq("truck_id", m.truck_id)
        .eq("provider", String(parentRow.provider))
        .maybeSingle()

      const devicePayload = {
        company_id: gate.companyId,
        truck_id: m.truck_id,
        device_name: `${String(parentRow.device_name)} — ${m.provider_vehicle_name || m.provider_vehicle_id}`,
        device_serial_number: childSerial,
        provider: parentRow.provider,
        provider_device_id: m.provider_vehicle_id,
        api_endpoint: parentRow.api_endpoint,
        notes: parentRow.notes,
        status: "active",
        health_status: "healthy",
        updated_at: new Date().toISOString(),
      }

      if (existing?.id) {
        await supabase.from("eld_devices").update(devicePayload).eq("id", existing.id)
        await updateEldDeviceCredentials(
          existing.id,
          {
            apiKey: (parentRow.api_key as string | null | undefined) ?? null,
            apiSecret: (parentRow.api_secret as string | null | undefined) ?? null,
          },
          { companyId: gate.companyId, client: supabase },
        )
      } else {
        const lim = await checkResourceLimit({ companyId: gate.companyId, resourceType: "eld_devices" })
        if (lim.allowed) {
          await createEldDeviceWithCredentials(
            {
              ...devicePayload,
              api_key: parentRow.api_key,
              api_secret: parentRow.api_secret,
            },
            { client: supabase },
          )
        }
      }
    }
    saved += 1
  }

  await supabase
    .from("eld_devices")
    .update({
      mapped_vehicle_count: mappedCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.eldDeviceId)

  revalidatePath("/dashboard/eld/devices")
  return { data: { saved }, error: null }
}

export async function completeELDSetup(params: {
  eldDeviceId: string
}): Promise<{ data: { completed: boolean } | null; error: string | null }> {
  const gate = await ensureWizardAccess()
  if ("error" in gate) return { data: null, error: gate.error }

  const supabase = await createClient()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from("eld_devices")
    .update({
      setup_completed_at: now,
      health_status: "healthy",
      health_message: "Setup complete",
      last_health_check_at: now,
      updated_at: now,
    })
    .eq("id", params.eldDeviceId)
    .eq("company_id", gate.companyId)

  if (error) return { data: null, error: safeDbError(error) }

  try {
    const { syncELDDevice } = await import("@/app/actions/eld-sync")
    const admin = createAdminClient()
    const { data: children } = await admin
      .from("eld_devices")
      .select("id")
      .eq("company_id", gate.companyId)
      .eq("status", "active")

    const ids = new Set<string>([params.eldDeviceId])
    for (const row of children ?? []) {
      const id = (row as { id?: string }).id
      if (id) ids.add(id)
    }
    for (const id of ids) {
      void syncELDDevice(id).catch(() => {
        /* initial sync best-effort */
      })
    }
  } catch {
    // non-blocking
  }

  revalidatePath("/dashboard/eld")
  revalidatePath("/dashboard/eld/devices")
  revalidatePath("/dashboard")
  return { data: { completed: true }, error: null }
}

export async function getEldConnectionCount(): Promise<{
  data: { count: number; limit: number; tier: string } | null
  error: string | null
}> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) return { data: null, error: ctx.error || "Not authenticated" }

  const limit = await checkResourceLimit({ companyId: ctx.companyId, resourceType: "eld_devices" })
  return {
    data: {
      count: limit.current,
      limit: limit.limit,
      tier: limit.tier,
    },
    error: null,
  }
}

export async function runEldHealthCheck(deviceId: string): Promise<{
  data: { status: string; message: string } | null
  error: string | null
}> {
  const gate = await ensureWizardAccess()
  if ("error" in gate) return { data: null, error: gate.error }

  const supabase = await createClient()
  const deviceResult = await getEldDeviceWithCredentials(deviceId, {
    companyId: gate.companyId,
    client: supabase,
    select: "id, provider, api_key, api_secret, api_endpoint, notes",
  })

  if (deviceResult.error || !deviceResult.data) return { data: null, error: "Device not found" }

  const provider = normalizeProvider(String((deviceResult.data as { provider?: string }).provider || ""))
  if (!provider) return { data: null, error: "Unknown provider" }

  const d = deviceResult.data as {
    api_key?: string | null
    api_secret?: string | null
    api_endpoint?: string | null
    notes?: string | null
  }

  let test
  if (provider === "samsara") {
    test = await testSamsaraConnection({ apiKey: d.api_key || "" })
  } else if (provider === "motive") {
    test = await testMotiveConnection({ apiKey: d.api_key || "", apiSecret: d.api_secret || undefined })
  } else {
    const { geotabDatabaseFromNotes } = await import("@/lib/eld/geotab-url")
    test = await testGeotabConnection({
      username: d.api_key || "",
      password: d.api_secret || "",
      database: geotabDatabaseFromNotes(d.notes) || "",
      serverUrl: d.api_endpoint || undefined,
    })
  }

  const status = test.success ? "healthy" : "auth_failed"
  const message = test.success ? "Credentials verified" : test.error || "Authentication failed"

  await supabase
    .from("eld_devices")
    .update({
      health_status: status,
      health_message: message,
      last_health_check_at: new Date().toISOString(),
    })
    .eq("id", deviceId)

  return { data: { status, message }, error: null }
}
