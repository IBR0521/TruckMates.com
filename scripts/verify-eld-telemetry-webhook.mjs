#!/usr/bin/env node
/**
 * Verify migration 249 + eld telemetry geofence webhook wiring.
 *
 *   node scripts/verify-eld-telemetry-webhook.mjs
 *   node scripts/verify-eld-telemetry-webhook.mjs --ping --company-id <uuid>
 *   node scripts/verify-eld-telemetry-webhook.mjs --configure
 *
 * Reads .env.local when present. Requires SUPABASE_POOLER_URL for DB checks.
 * For --ping: ELD_TELEMETRY_WEBHOOK_SECRET and NEXT_PUBLIC_APP_URL (or --url).
 * For --configure: same + upserts platform_http_targets via pooler.
 */

import { readFileSync, existsSync } from "node:fs"
import path from "node:path"
import { Pool } from "pg"
import crypto from "node:crypto"

const ROOT = path.resolve(import.meta.dirname, "..")

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return
  const raw = readFileSync(filePath, "utf8")
  for (const line of raw.split("\n")) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const i = t.indexOf("=")
    if (i === -1) continue
    const k = t.slice(0, i).trim()
    let v = t.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (!process.env[k]) process.env[k] = v
  }
}

loadEnvFile(path.join(ROOT, ".env.local"))
loadEnvFile(path.join(ROOT, ".env"))

const args = process.argv.slice(2)
const doPing = args.includes("--ping")
const doConfigure = args.includes("--configure")
const companyIdIdx = args.indexOf("--company-id")
const companyId = companyIdIdx >= 0 ? args[companyIdIdx + 1] : process.env.VERIFY_COMPANY_ID
const urlIdx = args.indexOf("--url")
const webhookBase = (
  urlIdx >= 0 ? args[urlIdx + 1] : process.env.WEBHOOK_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || ""
).replace(/\/$/, "")

const results = []
let failed = 0

function pass(label, detail) {
  results.push({ ok: true, label, detail })
  console.log(`✓ ${label}${detail ? ` — ${detail}` : ""}`)
}

function fail(label, detail) {
  failed += 1
  results.push({ ok: false, label, detail })
  console.error(`✗ ${label}${detail ? ` — ${detail}` : ""}`)
}

async function withPool(fn) {
  const connectionString = process.env.SUPABASE_POOLER_URL
  if (!connectionString) {
    fail("SUPABASE_POOLER_URL", "not set — skip DB checks")
    return null
  }
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15_000,
  })
  try {
    return await fn(pool)
  } catch (err) {
    fail("database connection", err instanceof Error ? err.message : String(err))
    return null
  } finally {
    await pool.end().catch(() => {})
  }
}

async function checkMigration(pool) {
  const ext = await pool.query("SELECT 1 FROM pg_extension WHERE extname = 'pg_net'")
  if (ext.rowCount > 0) pass("pg_net extension")
  else fail("pg_net extension", "missing — re-run migration 249")

  const tbl = await pool.query("SELECT to_regclass('public.platform_http_targets') AS r")
  if (tbl.rows[0]?.r) pass("platform_http_targets table")
  else fail("platform_http_targets table", "missing")

  const trg = await pool.query(`
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'eld_telemetry_points'
      AND t.tgname = 'eld_telemetry_points_geofence_webhook'
      AND NOT t.tgisinternal
  `)
  if (trg.rowCount > 0) pass("eld_telemetry_points_geofence_webhook trigger")
  else fail("eld_telemetry_points_geofence_webhook trigger", "missing")

  const fn = await pool.query(`
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'notify_eld_telemetry_geofence_webhook'
  `)
  if (fn.rowCount > 0) pass("notify_eld_telemetry_geofence_webhook function")
  else fail("notify_eld_telemetry_geofence_webhook function", "missing")
}

async function checkTargetConfig(pool) {
  const { rows } = await pool.query(`
    SELECT target_key, enabled,
      CASE WHEN url IS NOT NULL AND btrim(url) <> '' THEN true ELSE false END AS has_url,
      CASE WHEN secret IS NOT NULL AND secret <> '' THEN true ELSE false END AS has_secret,
      secret_header
    FROM public.platform_http_targets
    WHERE target_key = 'eld_telemetry_geofence'
  `)

  if (rows.length === 0) {
    fail("platform_http_targets row", "no row for eld_telemetry_geofence — run with --configure or insert manually")
    return
  }

  const row = rows[0]
  if (row.enabled && row.has_url && row.has_secret) {
    pass("platform_http_targets row", `enabled, header=${row.secret_header || "X-Eld-Telemetry-Webhook-Secret"}`)
  } else {
    fail("platform_http_targets row", JSON.stringify(row))
  }

  const envSecret = String(process.env.ELD_TELEMETRY_WEBHOOK_SECRET || "")
  if (!envSecret) {
    fail("ELD_TELEMETRY_WEBHOOK_SECRET env", "not set on app host")
    return
  }

  const { rows: secretRows } = await pool.query(
    `SELECT secret = $1 AS matches FROM public.platform_http_targets WHERE target_key = 'eld_telemetry_geofence'`,
    [envSecret],
  )
  if (secretRows[0]?.matches) pass("secret matches platform_http_targets")
  else fail("secret matches platform_http_targets", "DB secret differs from ELD_TELEMETRY_WEBHOOK_SECRET")
}

async function configureTarget(pool) {
  let secret = String(process.env.ELD_TELEMETRY_WEBHOOK_SECRET || "").trim()
  if (!secret) {
    secret = crypto.randomBytes(32).toString("hex")
    console.log(`Generated ELD_TELEMETRY_WEBHOOK_SECRET (add to .env.local + Vercel):\n  ${secret}\n`)
  }

  if (!webhookBase) {
    fail("--configure", "set NEXT_PUBLIC_APP_URL or pass --url https://your-host")
    return
  }

  const url = `${webhookBase}/api/webhooks/eld-telemetry-insert`
  await pool.query(
    `
    INSERT INTO public.platform_http_targets (target_key, url, secret, secret_header, enabled)
    VALUES ('eld_telemetry_geofence', $1, $2, 'X-Eld-Telemetry-Webhook-Secret', true)
    ON CONFLICT (target_key) DO UPDATE SET
      url = EXCLUDED.url,
      secret = EXCLUDED.secret,
      secret_header = EXCLUDED.secret_header,
      enabled = true,
      updated_at = now()
    `,
    [url, secret],
  )
  pass("--configure", `upserted target → ${url}`)
  if (!process.env.ELD_TELEMETRY_WEBHOOK_SECRET) {
    console.log("Remember to set ELD_TELEMETRY_WEBHOOK_SECRET in .env.local and Vercel to the value above.")
  }
}

async function checkRecentPgNet(pool) {
  const reg = await pool.query(`SELECT to_regclass('net._http_response') AS r`)
  if (!reg.rows[0]?.r) {
    fail("net._http_response", "not visible — pg_net may not be fully enabled")
    return
  }

  const { rows } = await pool.query(`
    SELECT id, status_code, error_msg, created
    FROM net._http_response
    ORDER BY created DESC
    LIMIT 5
  `)

  if (rows.length === 0) {
    fail("recent pg_net responses", "none yet — insert a telemetry point to fire the trigger")
    return
  }

  const latest = rows[0]
  const summary = rows.map((r) => `${r.status_code ?? "?"}@${r.created}`).join(", ")
  if (latest.status_code >= 200 && latest.status_code < 300) {
    pass("recent pg_net responses", `latest ${latest.status_code}; recent: ${summary}`)
  } else {
    fail("recent pg_net responses", `latest ${latest.status_code ?? "null"} err=${latest.error_msg || "none"}; recent: ${summary}`)
  }
}

async function pingEndpoint() {
  const secret = process.env.ELD_TELEMETRY_WEBHOOK_SECRET
  if (!secret) {
    fail("--ping", "ELD_TELEMETRY_WEBHOOK_SECRET not set")
    return
  }
  if (!webhookBase) {
    fail("--ping", "set NEXT_PUBLIC_APP_URL or pass --url")
    return
  }
  if (!companyId) {
    fail("--ping", "pass --company-id <uuid>")
    return
  }

  const url = `${webhookBase}/api/webhooks/eld-telemetry-insert`
  const body = {
    type: "INSERT",
    table: "eld_telemetry_points",
    schema: "public",
    record: { company_id: companyId },
  }

  let response
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-eld-telemetry-webhook-secret": secret,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    })
  } catch (err) {
    fail("--ping", err instanceof Error ? err.message : String(err))
    return
  }

  const text = await response.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = { raw: text.slice(0, 200) }
  }

  if (response.status === 401) {
    fail("--ping", `401 Unauthorized — secret mismatch between app and caller`)
    return
  }

  if (response.ok) {
    pass("--ping", `${response.status} ${JSON.stringify(json)}`)
  } else {
    fail("--ping", `${response.status} ${JSON.stringify(json)}`)
  }
}

async function main() {
  console.log("ELD telemetry geofence webhook verification\n")

  await withPool(async (pool) => {
    if (!pool) return
    await checkMigration(pool)
    if (doConfigure) await configureTarget(pool)
    await checkTargetConfig(pool)
    await checkRecentPgNet(pool)
  })

  if (doPing) await pingEndpoint()

  console.log(`\n${results.filter((r) => r.ok).length} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
