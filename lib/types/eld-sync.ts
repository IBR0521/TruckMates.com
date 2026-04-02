import type { PostgrestError } from "@supabase/supabase-js"

/**
 * `eld_devices` fields used by third-party sync (Motive, Samsara, Geotab).
 * Prefer this over `any` so credential / provider changes are localized.
 */
export interface EldDeviceSyncRow {
  id: string
  company_id: string
  truck_id?: string | null
  /** Optional: some providers scope API calls by assigned driver */
  driver_id?: string | null
  api_key?: string | null
  api_secret?: string | null
  /** Geotab / custom installs: allowlisted base URL */
  api_endpoint?: string | null
  provider_device_id: string
  provider?: string | null
  status?: string | null
  device_name?: string | null
  last_sync_at?: string | null
  /** Some code paths use camelCase from providers */
  lastSyncAt?: string | null
}

/** JSON blobs from external ELD HTTP APIs — unknown shape per vendor/version */
export type ProviderApiJson = Record<string, unknown>

export type { PostgrestError }
