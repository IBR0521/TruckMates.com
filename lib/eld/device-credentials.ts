import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  decryptCredential,
  encryptCredentialIfNeeded,
  isEncryptedCredentialFormat,
} from "@/lib/crypto/eld-credentials"
import type { EldDeviceSyncRow } from "@/lib/types/eld-sync"

export const ELD_DEVICE_SYNC_SELECT =
  "id, company_id, truck_id, driver_id, device_name, provider, status, last_sync_at, provider_device_id, api_key, api_secret, api_endpoint, notes"

type EldDeviceRow = Record<string, unknown>

export function decryptEldDeviceCredentialFields<T extends EldDeviceRow>(row: T): T {
  const out = { ...row }
  if (out.api_key != null && out.api_key !== "") {
    out.api_key = decryptCredential(String(out.api_key))
  }
  if (out.api_secret != null && out.api_secret !== "") {
    out.api_secret = decryptCredential(String(out.api_secret))
  }
  return out as T
}

function encryptCredentialFieldsInPatch(patch: EldDeviceRow): EldDeviceRow {
  const out = { ...patch }
  if ("api_key" in out && out.api_key != null && out.api_key !== "") {
    out.api_key = encryptCredentialIfNeeded(String(out.api_key))
  }
  if ("api_secret" in out && out.api_secret != null && out.api_secret !== "") {
    out.api_secret = encryptCredentialIfNeeded(String(out.api_secret))
  }
  return out
}

export function eldDeviceRowToSyncRow(row: EldDeviceRow): EldDeviceSyncRow {
  const decrypted = decryptEldDeviceCredentialFields(row)
  return {
    id: String(decrypted.id ?? ""),
    company_id: String(decrypted.company_id ?? ""),
    truck_id: (decrypted.truck_id as string | null | undefined) ?? null,
    driver_id: (decrypted.driver_id as string | null | undefined) ?? undefined,
    api_key: (decrypted.api_key as string | null | undefined) ?? undefined,
    api_secret: (decrypted.api_secret as string | null | undefined) ?? undefined,
    api_endpoint: (decrypted.api_endpoint as string | null | undefined) ?? undefined,
    provider_device_id: String(decrypted.provider_device_id ?? "").trim(),
    provider: (decrypted.provider as string | null | undefined) ?? null,
    status: (decrypted.status as string | null | undefined) ?? null,
    device_name: (decrypted.device_name as string | null | undefined) ?? null,
    last_sync_at: (decrypted.last_sync_at as string | null | undefined) ?? null,
    lastSyncAt: (decrypted.lastSyncAt as string | null | undefined) ?? undefined,
  }
}

export async function getEldDeviceWithCredentials(
  deviceId: string,
  options?: {
    companyId?: string
    select?: string
    client?: SupabaseClient
  },
): Promise<{ data: EldDeviceRow | null; error: string | null }> {
  const client = options?.client ?? createAdminClient()
  const select = options?.select ?? "*"

  let query = client.from("eld_devices").select(select).eq("id", deviceId)
  if (options?.companyId) {
    query = query.eq("company_id", options.companyId)
  }

  const { data, error } = await query.maybeSingle()
  if (error) return { data: null, error: error.message }
  if (!data) return { data: null, error: null }
  return { data: decryptEldDeviceCredentialFields(data as EldDeviceRow), error: null }
}

type EldDevicesSelectQuery = ReturnType<ReturnType<SupabaseClient["from"]>["select"]>

export async function listEldDevicesWithCredentials(params: {
  client: SupabaseClient
  companyId?: string
  select?: string
  status?: string
  applyQuery?: (q: EldDevicesSelectQuery) => EldDevicesSelectQuery
}): Promise<{ data: EldDeviceRow[]; error: string | null }> {
  const select = params.select ?? "*"
  let query = params.client.from("eld_devices").select(select)
  if (params.companyId) query = query.eq("company_id", params.companyId)
  if (params.status) query = query.eq("status", params.status)
  if (params.applyQuery) query = params.applyQuery(query) as typeof query

  const { data, error } = await query
  if (error) return { data: [], error: error.message }
  const rows = (data ?? []).map((row) => decryptEldDeviceCredentialFields(row as EldDeviceRow))
  return { data: rows, error: null }
}

export async function fetchActiveEldDevicesForSync(options?: {
  companyId?: string
  client?: SupabaseClient
}): Promise<{ data: EldDeviceSyncRow[]; error: string | null }> {
  const client = options?.client ?? createAdminClient()
  let query = client
    .from("eld_devices")
    .select(ELD_DEVICE_SYNC_SELECT)
    .eq("status", "active")
  if (options?.companyId) query = query.eq("company_id", options.companyId)

  const { data, error } = await query
  if (error) return { data: [], error: error.message }
  return {
    data: (data ?? []).map((row) => eldDeviceRowToSyncRow(row as EldDeviceRow)),
    error: null,
  }
}

export async function createEldDeviceWithCredentials(
  deviceData: EldDeviceRow,
  options?: { client?: SupabaseClient },
): Promise<{ data: EldDeviceRow | null; error: string | null }> {
  const client = options?.client ?? createAdminClient()
  const payload = encryptCredentialFieldsInPatch(deviceData)

  const { data, error } = await client.from("eld_devices").insert(payload).select().single()
  if (error) return { data: null, error: error.message }
  return { data: decryptEldDeviceCredentialFields((data ?? {}) as EldDeviceRow), error: null }
}

export async function updateEldDeviceCredentials(
  deviceId: string,
  credentials: { apiKey?: string | null; apiSecret?: string | null },
  options?: { companyId?: string; client?: SupabaseClient },
): Promise<{ error: string | null }> {
  const client = options?.client ?? createAdminClient()
  const patch: EldDeviceRow = {}

  if (credentials.apiKey !== undefined) {
    patch.api_key =
      credentials.apiKey == null || credentials.apiKey === ""
        ? null
        : encryptCredentialIfNeeded(credentials.apiKey)
  }
  if (credentials.apiSecret !== undefined) {
    patch.api_secret =
      credentials.apiSecret == null || credentials.apiSecret === ""
        ? null
        : encryptCredentialIfNeeded(credentials.apiSecret)
  }

  if (Object.keys(patch).length === 0) return { error: null }

  let query = client.from("eld_devices").update(patch).eq("id", deviceId)
  if (options?.companyId) query = query.eq("company_id", options.companyId)
  const { error } = await query
  return { error: error?.message ?? null }
}

/** For backfill script — true when either credential column is non-null plaintext. */
export function eldDeviceNeedsCredentialEncryption(row: {
  api_key?: string | null
  api_secret?: string | null
}): boolean {
  const key = row.api_key
  const secret = row.api_secret
  const keyNeeds = key != null && key !== "" && !isEncryptedCredentialFormat(String(key))
  const secretNeeds = secret != null && secret !== "" && !isEncryptedCredentialFormat(String(secret))
  return keyNeeds || secretNeeds
}
