import * as Sentry from "@sentry/nextjs"
import type { EldDeviceSyncRow } from "@/lib/types/eld-sync"

const ALLOWED_GEOTAB_ORIGINS = new Set([
  "https://my.geotab.com",
  "https://my1.geotab.com",
  "https://my2.geotab.com",
  "https://my3.geotab.com",
  "https://my4.geotab.com",
  "https://my5.geotab.com",
])

export function resolveGeotabApiv1Base(device: EldDeviceSyncRow): string {
  let base = "https://my.geotab.com/apiv1"
  if (device.api_endpoint) {
    try {
      const url = new URL(device.api_endpoint)
      const normalized = `${url.protocol}//${url.host}`
      if (ALLOWED_GEOTAB_ORIGINS.has(normalized)) {
        base = `${normalized}/apiv1`
      } else {
        Sentry.captureMessage(`[Geotab harsh/idle] api_endpoint not allowlisted: ${normalized}`, "warning")
      }
    } catch {
      Sentry.captureMessage(`[Geotab harsh/idle] invalid api_endpoint`, "warning")
    }
  }
  return base
}

export async function geotabAuthenticate(device: EldDeviceSyncRow): Promise<{ sessionId: string } | { error: string }> {
  const baseUrl = resolveGeotabApiv1Base(device)
  if (!device.api_key || !device.api_secret) {
    return { error: "Geotab credentials missing" }
  }
  const res = await fetch(`${baseUrl}/Authenticate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userName: device.api_key,
      password: device.api_secret,
    }),
  })
  const json = (await res.json()) as {
    result?: { credentials?: { sessionId?: string } }
    error?: { message?: string; name?: string }
  }
  const sessionId = json.result?.credentials?.sessionId
  if (!sessionId) {
    const msg = json.error?.message || json.error?.name || "Geotab authentication failed"
    return { error: msg }
  }
  return { sessionId }
}

export async function geotabGet<T>(
  device: EldDeviceSyncRow,
  sessionId: string,
  typeName: string,
  search?: Record<string, unknown>,
): Promise<{ result: T | null; error: string | null; status: number }> {
  const baseUrl = resolveGeotabApiv1Base(device)
  const res = await fetch(`${baseUrl}/Get`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: "Get",
      params: {
        typeName,
        search: search ?? {},
        credentials: { sessionId },
      },
    }),
  })
  const status = res.status
  const json = (await res.json()) as { result?: T; error?: { message?: string; name?: string } }
  if (!res.ok) {
    return { result: null, error: json.error?.message || `Geotab HTTP ${status}`, status }
  }
  if (json.error?.message) {
    return { result: null, error: json.error.message, status }
  }
  return { result: json.result ?? null, error: null, status }
}
