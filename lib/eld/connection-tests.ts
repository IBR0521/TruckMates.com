/**
 * Pre-save ELD provider credential verification (10s timeout, no credential logging).
 */

import { fetchWithTimeout } from "@/lib/eld/fetch-with-timeout"
import { validateGeotabServerUrl } from "@/lib/eld/geotab-url"

export type ConnectionTestResult = {
  success: boolean
  error?: string
  details?: Record<string, unknown>
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

export async function testSamsaraConnection(params: {
  apiKey: string
}): Promise<ConnectionTestResult> {
  const apiKey = params.apiKey.trim()
  if (!apiKey) return { success: false, error: "API token is required." }

  try {
    const meRes = await fetchWithTimeout("https://api.samsara.com/me", {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    })
    const meText = await meRes.text()
    if (meRes.status === 401) {
      return { success: false, error: "Invalid API key. Check your Samsara API token." }
    }
    if (meRes.status === 403) {
      return {
        success: false,
        error:
          "API key valid but lacks fleet permissions. In Samsara: Settings → API Tokens → enable Read Vehicles and Read Statistics.",
      }
    }
    if (!meRes.ok) {
      return { success: false, error: `Samsara returned HTTP ${meRes.status}. Try again or contact support.` }
    }

    let orgName: string | undefined
    try {
      const meJson = JSON.parse(meText) as unknown
      const d = asRecord(asRecord(meJson).data)
      orgName = typeof d.name === "string" ? d.name : undefined
    } catch {
      // optional parse
    }

    let vehicleCount = 0
    const vRes = await fetchWithTimeout("https://api.samsara.com/fleet/vehicles?limit=1", {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    })
    if (vRes.ok) {
      const vJson = (await vRes.json()) as unknown
      const pagination = asRecord(asRecord(vJson).pagination)
      vehicleCount = Number(pagination.totalCount ?? pagination.total_count ?? 0) || 0
    }

    return {
      success: true,
      details: {
        organization_name: orgName,
        vehicle_count: vehicleCount,
        api_version: "v1",
      },
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Cannot reach Samsara servers. Check internet."
    return { success: false, error: msg }
  }
}

export async function testMotiveConnection(params: {
  apiKey: string
  apiSecret?: string
}): Promise<ConnectionTestResult> {
  const apiKey = params.apiKey.trim()
  const apiSecret = (params.apiSecret || "").trim()
  if (!apiKey) return { success: false, error: "API key is required." }

  const headers: Record<string, string> = {
    "X-Api-Key": apiKey,
    Accept: "application/json",
  }
  if (apiSecret) headers["X-Api-Secret"] = apiSecret

  const paths = [
    "https://api.gomotive.com/v1/users/me",
    "https://api.keeptruckin.com/v1/users/me",
  ]

  try {
    let lastStatus = 0
    let lastText = ""
    for (const url of paths) {
      const res = await fetchWithTimeout(url, { headers })
      lastStatus = res.status
      lastText = await res.text()
      if (res.ok) break
      if (res.status !== 404) break
    }

    if (lastStatus === 401) {
      return { success: false, error: "Invalid API key. Check your Motive API credentials." }
    }
    if (lastStatus === 403) {
      return {
        success: false,
        error:
          "API key valid but lacks permissions. In Motive Admin → API Manager, enable Vehicles Read and diagnostic scopes.",
      }
    }
    if (lastStatus < 200 || lastStatus >= 300) {
      return { success: false, error: `Motive returned HTTP ${lastStatus}. Verify your API key.` }
    }

    return {
      success: true,
      details: { api_version: "v1" },
    }
  } catch (e: unknown) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Cannot reach Motive servers. Check internet.",
    }
  }
}

export async function testGeotabConnection(params: {
  username: string
  password: string
  database: string
  serverUrl?: string
}): Promise<ConnectionTestResult> {
  const username = params.username.trim()
  const password = params.password
  const database = params.database.trim()
  if (!username || !password) return { success: false, error: "Username and password are required." }
  if (!database) return { success: false, error: "Database name is required (from your MyGeotab URL)." }

  const urlCheck = validateGeotabServerUrl(params.serverUrl)
  if (!urlCheck.ok || !urlCheck.apiv1Base) {
    return { success: false, error: urlCheck.error || "Invalid Geotab server URL." }
  }

  try {
    const res = await fetchWithTimeout(`${urlCheck.apiv1Base}/Authenticate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "Authenticate",
        params: { userName: username, password, database },
      }),
    })
    const json = (await res.json()) as {
      result?: { credentials?: { sessionId?: string; database?: string } }
      error?: { message?: string; name?: string }
    }

    const errName = json.error?.name || ""
    const errMsg = json.error?.message || ""
    if (errName.includes("InvalidUser") || errMsg.toLowerCase().includes("invalid user")) {
      return { success: false, error: "Invalid username or password for this Geotab database." }
    }
    if (errName.includes("InvalidDatabase") || errMsg.toLowerCase().includes("database")) {
      return { success: false, error: "Invalid database name. Check the name in your MyGeotab URL." }
    }

    const sessionId = json.result?.credentials?.sessionId
    if (!sessionId) {
      return { success: false, error: errMsg || "Geotab authentication failed." }
    }

    let vehicleCount = 0
    const devRes = await fetchWithTimeout(`${urlCheck.apiv1Base}/Get`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "Get",
        params: {
          typeName: "Device",
          credentials: { sessionId },
        },
      }),
    })
    const devJson = (await devRes.json()) as { result?: unknown[] }
    if (Array.isArray(devJson.result)) {
      vehicleCount = devJson.result.length
    }

    return {
      success: true,
      details: {
        database: json.result?.credentials?.database || database,
        vehicle_count: vehicleCount,
      },
    }
  } catch (e: unknown) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Cannot reach Geotab servers. Check internet.",
    }
  }
}
