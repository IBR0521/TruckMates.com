import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/admin"

export async function markEldDeviceProviderAuthFailed(deviceId: string, message: string): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin
    .from("eld_devices")
    .update({
      provider_auth_error: message.slice(0, 2000),
      provider_auth_error_at: new Date().toISOString(),
    })
    .eq("id", deviceId)
  if (error) {
    Sentry.captureMessage(`markEldDeviceProviderAuthFailed: ${error.message}`, { level: "warning", extra: { deviceId } })
  }
}

export async function clearEldDeviceProviderAuthError(deviceId: string): Promise<void> {
  const admin = createAdminClient()
  await admin
    .from("eld_devices")
    .update({
      provider_auth_error: null,
      provider_auth_error_at: null,
    })
    .eq("id", deviceId)
}
