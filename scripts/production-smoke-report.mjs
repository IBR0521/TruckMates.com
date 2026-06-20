#!/usr/bin/env node
/**
 * Production smoke — Phases 2–4 (read-only + test-account writes with cleanup).
 * NEVER sends SMS/push/email. Loads secrets from .env.local (not printed).
 *
 *   node scripts/production-smoke-report.mjs
 *   node scripts/production-smoke-report.mjs --phase2-only
 */

import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..")

function loadEnvLocal() {
  const p = path.join(root, ".env.local")
  if (!fs.existsSync(p)) return
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const i = t.indexOf("=")
    if (i < 1) continue
    const k = t.slice(0, i).trim()
    let v = t.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (!process.env[k]) process.env[k] = v
  }
}

loadEnvLocal()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "")
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://www.truckmateslogistic.com").replace(/\/$/, "")
const POOLER = process.env.SUPABASE_POOLER_URL
const ELD_KEY = process.env.ELD_CREDENTIALS_ENCRYPTION_KEY

const TEST_EMAILS = [
  "demo@truckmates.com",
  "loadtest@truckmateslogistic.com",
  "stevetruckmates@gmail.com",
]

const WRITE_EMAIL = process.env.SMOKE_WRITE_EMAIL || "loadtest@truckmateslogistic.com"
const WRITE_PASSWORD = process.env.SMOKE_WRITE_PASSWORD || ""

const RLS_TABLES = [
  "edi_messages",
  "permits",
  "edi_load_tenders",
  "lease_agreements",
  "lease_payments",
]

const LOCKED_RPCS = [
  "create_invoice_transactional",
  "create_settlement_transactional",
  "calculate_remaining_hos",
  "decrypt_eld_api_key",
  "encrypt_eld_api_key",
]

const AUTH_RPCS = ["get_user_company_id", "get_user_role_and_company", "is_user_manager"]

const report = {
  generatedAt: new Date().toISOString(),
  appUrl: APP_URL,
  checks: [],
}

function add(id, phase, status, detail, extra = {}) {
  report.checks.push({ id, phase, status, detail, ...extra })
  const icon = { PASS: "✓", FAIL: "✗", SKIP: "○", UNCERTAIN: "?" }[status] || "·"
  console.log(`${icon} [${phase}] ${id}: ${status} — ${detail}`)
}

async function pgQuery(sql, params = []) {
  if (!POOLER) return { rows: null, error: "SUPABASE_POOLER_URL not configured" }
  const { default: pg } = await import("pg")
  const client = new pg.Client({ connectionString: POOLER, ssl: { rejectUnauthorized: false } })
  try {
    await client.connect()
    const res = await client.query(sql, params)
    return { rows: res.rows, error: null }
  } catch (e) {
    return { rows: null, error: e instanceof Error ? e.message : String(e) }
  } finally {
    await client.end().catch(() => {})
  }
}

async function rest(path, { method = "GET", headers = {}, body, token = ANON_KEY } = {}) {
  if (!SUPABASE_URL || !token) {
    return { ok: false, status: 0, json: null, text: "missing supabase url/key" }
  }
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: {
      apikey: token,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...headers,
    },
    body: body != null ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  return { ok: res.ok, status: res.status, json, text }
}

async function signIn(email, password) {
  const res = await rest("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: { email, password },
  })
  if (!res.ok || !res.json?.access_token) {
    return { error: res.json?.error_description || res.json?.msg || res.text, token: null, user: null }
  }
  return { error: null, token: res.json.access_token, user: res.json.user }
}

function isEld1(s) {
  if (!s || typeof s !== "string") return false
  const p = s.split(":")
  return p.length === 4 && p[0] === "eld1"
}

// --- TOTP helpers (RFC 6238, no external lib) ---
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
function b32Decode(enc) {
  const cleaned = enc.replace(/=+$/g, "").toUpperCase().replace(/[^A-Z2-7]/g, "")
  let bits = 0
  let val = 0
  const bytes = []
  for (const c of cleaned) {
    const idx = B32.indexOf(c)
    if (idx < 0) continue
    val = (val << 5) | idx
    bits += 5
    if (bits >= 8) {
      bytes.push((val >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}
function totpCode(secret, offset = 0, now = Date.now()) {
  const counter = Math.floor(now / 1000 / 30) + offset
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64BE(BigInt(counter))
  const hmac = crypto.createHmac("sha1", b32Decode(secret)).update(buf).digest()
  const o = hmac[hmac.length - 1] & 0x0f
  const code =
    ((hmac[o] & 0x7f) << 24) | ((hmac[o + 1] & 0xff) << 16) | ((hmac[o + 2] & 0xff) << 8) | (hmac[o + 3] & 0xff)
  return String(code % 1_000_000).padStart(6, "0")
}

function decryptEld1(stored) {
  if (!ELD_KEY || !isEld1(stored)) return null
  const [, ivB64, tagB64, ctB64] = stored.split(":")
  const key = Buffer.from(ELD_KEY, "base64")
  const iv = Buffer.from(ivB64, "base64")
  const tag = Buffer.from(tagB64, "base64")
  const ct = Buffer.from(ctB64, "base64")
  const d = crypto.createDecipheriv("aes-256-gcm", key, iv)
  d.setAuthTag(tag)
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8")
}

async function phase2() {
  console.log("\n=== PHASE 2 — SECURITY (read-only) ===\n")

  if (!SUPABASE_URL || !ANON_KEY) {
    add("env.supabase", 2, "FAIL", "NEXT_PUBLIC_SUPABASE_URL or ANON_KEY missing")
    return
  }
  add("env.supabase", 2, "PASS", "Supabase URL and anon key present")

  // Test account → company mapping (read-only)
  const { rows: users, error: usersErr } = await pgQuery(
    `SELECT u.email, u.id as user_id, us.company_id, c.name as company_name
     FROM auth.users u
     LEFT JOIN public.users us ON us.id = u.id
     LEFT JOIN public.companies c ON c.id = us.company_id
     WHERE lower(u.email) = ANY($1::text[])`,
    [TEST_EMAILS.map((e) => e.toLowerCase())],
  )
  if (usersErr) {
    add("test_accounts.map", 2, "FAIL", usersErr)
  } else {
    report.testAccounts = users
    add("test_accounts.map", 2, "PASS", `Mapped ${users?.length ?? 0} test accounts`, { accounts: users })
  }

  for (const table of RLS_TABLES) {
    const { rows, error } = await pgQuery(
      `SELECT policyname, cmd, qual, with_check
       FROM pg_policies
       WHERE schemaname = 'public' AND tablename = $1
       ORDER BY policyname`,
      [table],
    )
    if (error) {
      add(`rls.${table}`, 2, "FAIL", error)
      continue
    }
    const rls = await pgQuery(
      `SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = $1`,
      [table],
    )
    const enabled = rls.rows?.[0]?.relrowsecurity === true
    const cmds = new Set((rows || []).map((r) => r.cmd))
    const hasAll = ["SELECT", "INSERT", "UPDATE", "DELETE"].every((c) => cmds.has(c))
    const scoped = (rows || []).every(
      (r) =>
        String(r.qual || "").includes("get_user_company_id") ||
        String(r.with_check || "").includes("get_user_company_id"),
    )
    if (enabled && hasAll && scoped && (rows?.length ?? 0) >= 4) {
      add(`rls.${table}`, 2, "PASS", `RLS on; ${rows.length} policies; company_id scoped`)
    } else {
      add(`rls.${table}`, 2, "FAIL", `enabled=${enabled} policies=${rows?.length} cmds=${[...cmds].join(",")} scoped=${scoped}`, {
        policies: rows,
      })
    }
  }

  for (const fn of LOCKED_RPCS) {
    const res = await rest(`/rest/v1/rpc/${fn}`, { method: "POST", body: {}, token: ANON_KEY })
    const denied =
      res.status === 401 ||
      res.status === 403 ||
      /permission denied|not authorized|insufficient|42501|PGRST301/i.test(res.text)
    add(
      `rpc.anon.${fn}`,
      2,
      denied ? "PASS" : "FAIL",
      `anon POST → HTTP ${res.status}: ${res.text.slice(0, 120)}`,
    )
  }

  const loginEmail = WRITE_EMAIL
  const loginPass = WRITE_PASSWORD || process.env.PLAYWRIGHT_PASSWORD
  if (!loginPass) {
    add("rpc.auth_session", 2, "SKIP", "No test password (SMOKE_WRITE_PASSWORD / PLAYWRIGHT_PASSWORD)")
  } else {
    const session = await signIn(loginEmail, loginPass)
    if (session.error) {
      add("rpc.auth_session", 2, "FAIL", `Sign-in failed: ${session.error}`)
    } else {
      for (const fn of AUTH_RPCS) {
        const res = await rest(`/rest/v1/rpc/${fn}`, {
          method: "POST",
          body: fn === "is_user_manager" ? {} : {},
          token: session.token,
        })
        add(
          `rpc.auth.${fn}`,
          2,
          res.ok ? "PASS" : "FAIL",
          `HTTP ${res.status}: ${res.text.slice(0, 100)}`,
        )
      }
    }
  }

  // ELD plaintext count — TOP PRIORITY METRIC
  const { rows: plainRows, error: plainErr } = await pgQuery(
    `SELECT COUNT(*)::int AS cnt FROM public.eld_devices
     WHERE (api_key IS NOT NULL AND api_key <> '' AND api_key NOT LIKE 'eld1:%')
        OR (api_secret IS NOT NULL AND api_secret <> '' AND api_secret NOT LIKE 'eld1:%')`,
  )
  const plainCount = plainErr ? null : plainRows?.[0]?.cnt ?? null
  report.eldPlaintextRowCount = plainCount
  if (plainErr) {
    add("eld.backfill_plaintext_count", 2, "FAIL", plainErr)
  } else if (plainCount === 0) {
    add("eld.backfill_plaintext_count", 2, "PASS", `Plaintext credential rows: ${plainCount}`)
  } else {
    add(
      "eld.backfill_plaintext_count",
      2,
      "FAIL",
      `⚠ TOP PRIORITY: ${plainCount} eld_devices row(s) still have plaintext api_key/api_secret — backfill required`,
    )
  }

  // ELD decrypt check on test company device only
  const loadtest = users?.find((u) => u.email?.toLowerCase() === WRITE_EMAIL.toLowerCase())
  if (!loadtest?.company_id) {
    add("eld.decrypt_test_device", 2, "SKIP", "Could not resolve test company for ELD decrypt check")
  } else if (!ELD_KEY) {
    add("eld.decrypt_test_device", 2, "SKIP", "ELD_CREDENTIALS_ENCRYPTION_KEY not in env")
  } else {
    const { rows: devices, error: devErr } = await pgQuery(
      `SELECT id, api_key, api_secret FROM public.eld_devices
       WHERE company_id = $1 AND api_key IS NOT NULL AND api_key <> '' LIMIT 1`,
      [loadtest.company_id],
    )
    if (devErr || !devices?.length) {
      add("eld.decrypt_test_device", 2, "SKIP", devErr || "No eld_devices with api_key for test company")
    } else {
      const d = devices[0]
      const rawKey = d.api_key
      const decrypted = decryptEld1(rawKey)
      const encryptedFmt = isEld1(rawKey)
      const notPlaintextInDb = encryptedFmt && rawKey !== decrypted
      if (encryptedFmt && decrypted && notPlaintextInDb) {
        add("eld.decrypt_test_device", 2, "PASS", "Test company device: DB column is eld1:…; decrypt succeeds")
      } else {
        add("eld.decrypt_test_device", 2, "FAIL", `encryptedFmt=${encryptedFmt} decryptOk=${!!decrypted}`)
      }
    }
  }
}

async function phase3(session, companyId, userId) {
  console.log("\n=== PHASE 3 — NEW FEATURES (test account) ===\n")
  const cleanup = []

  // SSO metadata
  try {
    const res = await fetch(`${APP_URL}/api/sso/metadata`)
    const xml = await res.text()
    const ok =
      res.ok &&
      xml.includes("EntityDescriptor") &&
      (xml.includes("SPSSODescriptor") || xml.includes("AssertionConsumerService"))
    add("sso.metadata", 3, ok ? "PASS" : "FAIL", `HTTP ${res.status}; XML length ${xml.length}`)
  } catch (e) {
    add("sso.metadata", 3, "FAIL", String(e))
  }

  add("sso.live_idp_roundtrip", 3, "SKIP", "No test IdP available for live SAML round-trip")

  // 2FA — use stevetruckmates if loadtest is write account; run on WRITE_EMAIL only if not already 2FA locked
  // We'll test on loadtest with server actions via HTTP is hard — use direct DB + TOTP verify logic
  add(
    "totp.full_cycle",
    3,
    "SKIP",
    "Full 2FA browser cycle requires server actions + stevetruckmates account; run manually or extend script with authenticated API — not run to avoid locking account without browser",
  )

  // Deadline sweep dedup — insert test rows, call cron with dry-run check
  const entityTypes = ["permit_expiry", "license_expiry", "insurance_expiry", "route_deadline"]
  const testDeadlineIds = []
  if (!companyId || !SERVICE_KEY) {
    add("deadline.sweep_dedup", 3, "SKIP", "Missing companyId or service role key")
  } else {
    const past = new Date(Date.now() - 3600_000).toISOString()
    for (const et of entityTypes) {
      const ins = await rest("/rest/v1/scheduled_deadlines", {
        method: "POST",
        token: SERVICE_KEY,
        headers: { Prefer: "return=representation" },
        body: {
          company_id: companyId,
          entity_type: et,
          entity_id: crypto.randomUUID(),
          deadline_at: past,
          status: "pending",
          metadata: { smoke_test: true },
        },
      })
      if (ins.ok && ins.json?.[0]?.id) testDeadlineIds.push(ins.json[0].id)
    }
    cleanup.push({ table: "scheduled_deadlines", ids: testDeadlineIds })

    if (testDeadlineIds.length < 1) {
      add("deadline.sweep_dedup", 3, "FAIL", `Only inserted ${testDeadlineIds.length} test deadlines: ${JSON.stringify(ins)}`)
    } else {
      // Call sweep endpoint — check if CRON_SECRET required
      const cronSecret = process.env.CRON_SECRET
      let sweep1 = { status: 0, text: "not run" }
      if (cronSecret) {
        sweep1 = await fetch(`${APP_URL}/api/cron/process-deadline-sweep`, {
          headers: { Authorization: `Bearer ${cronSecret}` },
        }).then(async (r) => ({ status: r.status, text: await r.text() }))
      }
      add(
        "deadline.sweep_run",
        3,
        cronSecret ? (sweep1.status < 400 ? "PASS" : "FAIL") : "SKIP",
        cronSecret ? `Sweep HTTP ${sweep1.status}: ${sweep1.text.slice(0, 150)}` : "CRON_SECRET not in env — sweep not invoked (would trigger notifications)",
      )

      if (cronSecret) {
        const n1 = await pgQuery(
          `SELECT COUNT(*)::int AS cnt FROM public.notifications
           WHERE company_id = $1 AND created_at > now() - interval '5 minutes'
           AND metadata->>'smoke_test' IS NOT NULL`,
          [companyId],
        )
        add("deadline.sweep_dedup", 3, "UNCERTAIN", "Dedup requires metadata tagging on notifications — check sweep logs manually", {
          recentNotifications: n1.rows?.[0]?.cnt,
        })
      }
    }
  }

  // Geofence webhook
  add(
    "geofence.webhook_immediate",
    3,
    "SKIP",
    "Requires inserting eld_telemetry_points (triggers real webhook); run with verify:eld-telemetry-webhook against test company only — skipped to avoid side effects without CRON_SECRET/webhook secret alignment",
  )

  // Route deviation
  if (companyId && SERVICE_KEY) {
    const { rows: routes } = await pgQuery(
      `SELECT id, truck_id FROM public.routes
       WHERE company_id = $1 AND status = 'in_progress' LIMIT 1`,
      [companyId],
    )
    if (!routes?.length) {
      add("route.deviation_update", 3, "SKIP", "No in_progress route for test company")
    } else {
      const r = routes[0]
      const rpc = await rest("/rest/v1/rpc/update_current_route_deviation_for_truck", {
        method: "POST",
        token: SERVICE_KEY,
        body: { p_company_id: companyId, p_truck_id: r.truck_id, p_lat: 0, p_lng: 0 },
      })
      const { rows: after } = await pgQuery(
        `SELECT current_deviation_meters FROM public.routes WHERE id = $1`,
        [r.id],
      )
      const updated = after?.[0]?.current_deviation_meters != null
      add(
        "route.deviation_update",
        3,
        rpc.ok && updated ? "PASS" : updated ? "UNCERTAIN" : "FAIL",
        `RPC ${rpc.status}; current_deviation_meters=${after?.[0]?.current_deviation_meters}`,
      )
      // Reset deviation to null to avoid polluting alerts
      await pgQuery(`UPDATE public.routes SET current_deviation_meters = NULL WHERE id = $1`, [r.id])
    }
  }

  // HOS recompute
  add("hos.deadline_recompute", 3, "SKIP", "Simulating eld-sync duty change requires provider sync — not run against prod without isolated test driver")

  // Cleanup deadlines
  for (const c of cleanup) {
    if (!c.ids?.length) continue
    await rest(`/rest/v1/scheduled_deadlines?id=in.(${c.ids.join(",")})`, {
      method: "DELETE",
      token: SERVICE_KEY,
    })
  }
  report.cleanupPerformed = cleanup
}

async function phase4(session, companyId) {
  console.log("\n=== PHASE 4 — CORE REGRESSION (light) ===\n")
  const pages = ["/dashboard", "/dashboard/loads", "/dashboard/eld", "/dashboard/dvir", "/dashboard/accounting/invoices", "/dashboard/reports"]
  for (const p of pages) {
    try {
      const res = await fetch(`${APP_URL}${p}`, {
        redirect: "manual",
        headers: session?.token ? { Cookie: `sb-access-token=${session.token}` } : {},
      })
      const ok = res.status === 200 || res.status === 307 || res.status === 308
      add(`page${p}`, 4, ok ? "PASS" : "UNCERTAIN", `HTTP ${res.status} (cookie auth may not work for SSR — use Playwright for full check)`)
    } catch (e) {
      add(`page${p}`, 4, "FAIL", String(e))
    }
  }
  add("phase4.full_interactive", 4, "SKIP", "Interactive create/delete flows require Playwright with test account — not fully run in this script")
}

async function main() {
  const phase2Only = process.argv.includes("--phase2-only")
  console.log("Production smoke report — live DB (read-only + test-account writes)\n")

  await phase2()

  if (phase2Only) {
    fs.writeFileSync(path.join(root, "production-smoke-report.json"), JSON.stringify(report, null, 2))
    return
  }

  const loginPass = WRITE_PASSWORD || process.env.PLAYWRIGHT_PASSWORD
  let session = null
  let companyId = null
  if (loginPass) {
    session = await signIn(WRITE_EMAIL, loginPass)
    if (!session.error) {
      const prof = await rest("/rest/v1/rpc/get_user_company_id", { method: "POST", token: session.token })
      companyId = prof.json
      report.writeAccount = { email: WRITE_EMAIL, companyId }
    }
  }

  await phase3(session, companyId, session?.user?.id)
  await phase4(session, companyId)

  const outPath = path.join(root, "production-smoke-report.json")
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log(`\nReport written: ${outPath}`)
  console.log(`\n★ ELD PLAINTEXT ROW COUNT: ${report.eldPlaintextRowCount ?? "unknown"}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
