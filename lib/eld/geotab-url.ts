/**
 * SSRF-safe Geotab server URL validation (allowlist + block private IPs).
 */

const ALLOWED_GEOTAB_ORIGINS = new Set([
  "https://my.geotab.com",
  "https://my1.geotab.com",
  "https://my2.geotab.com",
  "https://my3.geotab.com",
  "https://my4.geotab.com",
  "https://my5.geotab.com",
])

function isPrivateOrLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  if (h === "localhost" || h.endsWith(".local")) return true
  if (h === "127.0.0.1" || h === "::1" || h === "0.0.0.0") return true

  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!ipv4) return false
  const a = Number(ipv4[1])
  const b = Number(ipv4[2])
  if (a === 10) return true
  if (a === 127) return true
  if (a === 192 && b === 168) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 169 && b === 254) return true
  return false
}

export function validateGeotabServerUrl(raw: string | undefined): {
  ok: boolean
  origin?: string
  apiv1Base?: string
  error?: string
} {
  const input = (raw || "https://my.geotab.com").trim()
  let url: URL
  try {
    url = new URL(input.startsWith("http") ? input : `https://${input}`)
  } catch {
    return { ok: false, error: "Invalid server URL format." }
  }

  if (url.protocol !== "https:") {
    return { ok: false, error: "Geotab server URL must use HTTPS." }
  }

  if (isPrivateOrLocalHost(url.hostname)) {
    return { ok: false, error: "Server URL must be a public Geotab host, not a private network address." }
  }

  const origin = `${url.protocol}//${url.host}`
  if (!ALLOWED_GEOTAB_ORIGINS.has(origin)) {
    return {
      ok: false,
      error:
        "Server URL must be an official Geotab host (my.geotab.com or my1–my5.geotab.com).",
    }
  }

  return { ok: true, origin, apiv1Base: `${origin}/apiv1` }
}

export function geotabDatabaseFromNotes(notes: string | null | undefined): string | null {
  if (!notes) return null
  const t = notes.trim()
  if (t.startsWith("{")) {
    try {
      const o = JSON.parse(t) as { geotab_database?: string }
      if (o.geotab_database) return String(o.geotab_database)
    } catch {
      // ignore
    }
  }
  const m = t.match(/geotab_database[=:]\s*(\S+)/i)
  return m ? m[1] : null
}

export function geotabNotesWithDatabase(database: string): string {
  return JSON.stringify({ geotab_database: database.trim(), wizard: true })
}
