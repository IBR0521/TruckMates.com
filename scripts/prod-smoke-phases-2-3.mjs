#!/usr/bin/env node
/**
 * Production smoke Phases 2–3 (read-only + demo/loadtest writes with cleanup).
 * Usage: SMOKE_WRITE_PASSWORD='...' node scripts/prod-smoke-phases-2-3.mjs
 */
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { fileURLToPath } from "node:url"

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const report = { checks: [], cleanup: [], testAccounts: {} }

function loadEnv() {
  const p = path.join(root, ".env.local")
  if (!fs.existsSync(p)) return
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const i = t.indexOf("=")
    if (i < 1) continue
    let v = t.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!process.env[t.slice(0, i).trim()]) process.env[t.slice(0, i).trim()] = v
  }
}
loadEnv()

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "")
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY
const POOLER = process.env.SUPABASE_POOLER_URL
const APP = (process.env.NEXT_PUBLIC_APP_URL || "https://www.truckmateslogistic.com").replace(/\/$/, "")
const ELD_KEY = process.env.ELD_CREDENTIALS_ENCRYPTION_KEY
const DEMO_CO = "10000000-0000-4000-a000-000000000001"
const LOADTEST_CO = "148fbef0-8a89-4fa5-a02f-a621a3a5e226"
const WRITE_CO = LOADTEST_CO
const WRITE_EMAIL = "loadtest@truckmateslogistic.com"
const WRITE_PASS = process.env.SMOKE_WRITE_PASSWORD || process.env.PLAYWRIGHT_PASSWORD

function add(id, phase, status, detail, extra = {}) {
  report.checks.push({ id, phase, status, detail, ...extra })
  console.log(`[${status}] P${phase} ${id}: ${detail}`)
}

async function pg(sql, params = []) {
  if (!POOLER) return { rows: null, error: "SUPABASE_POOLER_URL missing" }
  const { default: pgMod } = await import("pg")
  const c = new pgMod.Client({ connectionString: POOLER, ssl: { rejectUnauthorized: false } })
  try {
    await c.connect()
    const r = await c.query(sql, params)
    return { rows: r.rows, error: null }
  } catch (e) {
    return { rows: null, error: e instanceof Error ? e.message : String(e) }
  } finally {
    await c.end().catch(() => {})
  }
}

async function rest(path, { method = "GET", body, token = ANON, apikey = ANON } = {}) {
  const res = await fetch(`${URL}${path}`, {
    method,
    headers: {
      apikey: apikey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(body != null ? { Prefer: "return=representation" } : {}),
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
  return { status: res.status, text, json }
}

async function signIn(email, password) {
  const r = await rest("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: { email, password },
  })
  return r.json?.access_token || null
}

function isEld1(s) {
  return typeof s === "string" && s.split(":").length === 4 && s.startsWith("eld1:")
}

function decryptEld1(stored) {
  if (!ELD_KEY || !isEld1(stored)) return null
  const [, ivB64, tagB64, ctB64] = stored.split(":")
  const key = Buffer.from(ELD_KEY, "base64")
  const d = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"))
  d.setAuthTag(Buffer.from(tagB64, "base64"))
  return Buffer.concat([d.update(Buffer.from(ctB64, "base64")), d.final()]).toString("utf8")
}

const RLS_TABLES = ["edi_messages", "permits", "edi_load_tenders", "lease_agreements", "lease_payments"]
const LOCKED = [
  ["calculate_remaining_hos", { p_driver_id: "00000000-0000-0000-0000-000000000001" }],
  [
    "create_invoice_transactional",
    {
      p_company_id: "00000000-0000-0000-0000-000000000001",
      p_load_id: "00000000-0000-0000-0000-000000000001",
      p_invoice_number: "SMOKE",
      p_invoice_date: "2026-01-01",
      p_due_date: "2026-01-02",
      p_subtotal: 0,
      p_fuel_surcharge: 0,
      p_accessorials: 0,
      p_tax_amount: 0,
      p_total_amount: 0,
      p_status: "draft",
      p_line_items: [],
      p_customer_name: "x",
      p_payment_terms: "net30",
      p_description: "",
      p_tax_rate: 0,
    },
  ],
  [
    "create_settlement_transactional",
    {
      p_company_id: "00000000-0000-0000-0000-000000000001",
      p_driver_id: "00000000-0000-0000-0000-000000000001",
      p_period_start: "2026-01-01",
      p_period_end: "2026-01-07",
      p_gross_pay: 0,
      p_fuel_deduction: 0,
      p_advance_deduction: 0,
      p_other_deductions: 0,
      p_total_deductions: 0,
      p_per_diem_eligible_nights: 0,
      p_per_diem_rate_used: 0,
      p_per_diem_amount: 0,
      p_lease_deduction: 0,
      p_net_pay: 0,
      p_status: "draft",
      p_payment_method: "ach",
      p_gl_code: null,
      p_loads: [],
      p_pay_rule_id: null,
      p_calculation_details: {},
      p_lease_agreement_id: null,
      p_lease_remaining_after: null,
    },
  ],
  ["encrypt_eld_api_key", { plaintext_key: "smoke" }],
  ["decrypt_eld_api_key", { encrypted_key: "\\x00" }],
]

async function phase2() {
  report.testAccounts = {
    demo: { email: "demo@truckmates.com", company_id: DEMO_CO },
    loadtest: { email: WRITE_EMAIL, company_id: LOADTEST_CO },
  }

  for (const table of RLS_TABLES) {
    const rls = await pg(
      `SELECT c.relrowsecurity AS rls_enabled FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = $1`,
      [table],
    )
    const pol = await pg(
      `SELECT policyname, cmd, qual, with_check FROM pg_policies
       WHERE schemaname = 'public' AND tablename = $1 ORDER BY cmd`,
      [table],
    )
    if (pol.error || rls.error) {
      add(`rls.${table}`, 2, pol.error ? "FAIL" : "FAIL", pol.error || rls.error)
      continue
    }
    const enabled = rls.rows?.[0]?.rls_enabled === true
    const cmds = new Set((pol.rows || []).map((r) => r.cmd))
    const need = ["SELECT", "INSERT", "UPDATE", "DELETE"]
    const scoped = (pol.rows || []).every(
      (r) =>
        String(r.qual || "").includes("get_user_company_id") ||
        String(r.with_check || "").includes("get_user_company_id"),
    )
    const ok = enabled && need.every((c) => cmds.has(c)) && scoped && (pol.rows?.length ?? 0) >= 4
    add(
      `rls.${table}`,
      2,
      ok ? "PASS" : "FAIL",
      `rls=${enabled} policies=${pol.rows?.length} cmds=[${[...cmds].join(",")}] scoped=${scoped}`,
      { policies: pol.rows },
    )
  }

  for (const [fn, body] of LOCKED) {
    const r = await rest(`/rest/v1/rpc/${fn}`, { method: "POST", body })
    const denied =
      r.status === 401 ||
      r.status === 403 ||
      /permission denied|42501|not authorized|PGRST301/i.test(r.text)
    const executed = r.status === 200 || (r.status === 400 && r.text.includes("failed"))
    add(
      `rpc.anon.${fn}`,
      2,
      denied ? "PASS" : executed ? "FAIL" : "UNCERTAIN",
      `HTTP ${r.status}: ${r.text.slice(0, 200)}`,
    )
  }

  if (!WRITE_PASS) {
    add("rpc.auth_helpers", 2, "SKIP", "SMOKE_WRITE_PASSWORD not set")
  } else {
    const tok = await signIn(WRITE_EMAIL, WRITE_PASS)
    if (!tok) {
      add("rpc.auth_helpers", 2, "FAIL", "Could not sign in loadtest account")
    } else {
      for (const fn of ["get_user_company_id", "get_user_role_and_company", "is_user_manager"]) {
        const r = await rest(`/rest/v1/rpc/${fn}`, { method: "POST", body: {}, token: tok })
        add(`rpc.auth.${fn}`, 2, r.status === 200 ? "PASS" : "FAIL", `HTTP ${r.status}: ${r.text.slice(0, 120)}`)
      }
    }
  }

  let plain = 0
  let total = 0
  if (SVC) {
    const { createClient } = await import("@supabase/supabase-js")
    const admin = createClient(URL, SVC, { auth: { persistSession: false } })
    let from = 0
    while (true) {
      const { data, error } = await admin.from("eld_devices").select("api_key,api_secret").range(from, from + 999)
      if (error) {
        add("eld.plaintext_count", 2, "FAIL", error.message)
        break
      }
      if (!data?.length) break
      for (const d of data) {
        total++
        if (
          (d.api_key && d.api_key !== "" && !isEld1(d.api_key)) ||
          (d.api_secret && d.api_secret !== "" && !isEld1(d.api_secret))
        )
          plain++
      }
      if (data.length < 1000) break
      from += 1000
    }
    if (total >= 0 && !report.checks.find((c) => c.id === "eld.plaintext_count")) {
      report.eldPlaintextRowCount = plain
      add("eld.plaintext_count", 2, plain === 0 ? "PASS" : "FAIL", `plaintext_rows=${plain} total_devices=${total}`)
    }

    for (const co of [DEMO_CO, LOADTEST_CO]) {
      const { data: devs } = await admin
        .from("eld_devices")
        .select("id,api_key,company_id")
        .eq("company_id", co)
        .not("api_key", "is", null)
        .neq("api_key", "")
        .limit(1)
      if (devs?.[0]) {
        const d = devs[0]
        const dec = decryptEld1(d.api_key)
        add(
          `eld.decrypt.company_${co.slice(0, 8)}`,
          2,
          isEld1(d.api_key) && dec ? "PASS" : "FAIL",
          `device=${d.id} encrypted=${isEld1(d.api_key)} decrypt_ok=${!!dec}`,
        )
        break
      }
    }
    if (!report.checks.some((c) => c.id.startsWith("eld.decrypt"))) {
      add("eld.decrypt_test_device", 2, "SKIP", "No eld_devices with api_key on demo or loadtest companies")
    }
  }

  const meta = await fetch(`https://www.truckmateslogistic.com/api/sso/metadata`)
  const xml = await meta.text()
  add(
    "sso.metadata",
    2,
    meta.ok && xml.includes("EntityDescriptor") ? "PASS" : "FAIL",
    `HTTP ${meta.status} len=${xml.length}`,
  )
}

async function phase3() {
  if (!SVC || !WRITE_PASS) {
    add("phase3", 3, "SKIP", "Missing service role or test password")
    return
  }
  const { createClient } = await import("@supabase/supabase-js")
  const admin = createClient(URL, SVC, { auth: { persistSession: false } })
  const created = { deadlineIds: [], routeId: null, telemetryIds: [], geofenceEventIds: [], notificationIds: [] }

  // Deadline sweep — fake entity IDs (won't match real drivers/loads → no alert fire)
  const types = [
    "driver_hos",
    "load_detention",
    "load_delivery",
    "check_call_missed",
    "driver_late",
    "emergency_escalation",
  ]
  const past = new Date(Date.now() - 3600_000).toISOString()
  for (const et of types) {
    const eid = crypto.randomUUID()
    const { data, error } = await admin
      .from("scheduled_deadlines")
      .insert({
        entity_type: et,
        entity_id: eid,
        deadline_at: past,
        deadline_reason: "smoke_test",
        status: "pending",
      })
      .select("id")
      .single()
    if (!error && data?.id) created.deadlineIds.push(data.id)
  }
  add("deadline.insert", 3, created.deadlineIds.length === types.length ? "PASS" : "FAIL", `inserted ${created.deadlineIds.length}/${types.length}`)

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    add("deadline.sweep", 3, "SKIP", "CRON_SECRET not in env — not run (would process deadlines; may create in-app notifications)")
  } else {
    const nBefore = await admin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("company_id", WRITE_CO)
    const s1 = await fetch(`${APP}/api/cron/process-deadline-sweep`, { headers: { Authorization: `Bearer ${cronSecret}` } })
    const s2 = await fetch(`${APP}/api/cron/process-deadline-sweep`, { headers: { Authorization: `Bearer ${cronSecret}` } })
    const t1 = await s1.text()
    const t2 = await s2.text()
    const nAfter = await admin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("company_id", WRITE_CO)
    const delta = (nAfter.count ?? 0) - (nBefore.count ?? 0)
    add("deadline.sweep_twice", 3, s1.status < 400 && s2.status < 400 ? "PASS" : "FAIL", `s1=${s1.status} s2=${s2.status} notification_delta=${delta}`)
    add("deadline.dedup", 3, delta === 0 ? "PASS" : "UNCERTAIN", `new notifications for loadtest company: ${delta}`)
  }

  // Route deviation — find or skip
  const { data: routes } = await admin
    .from("routes")
    .select("id,truck_id,status")
    .eq("company_id", WRITE_CO)
    .eq("status", "in_progress")
    .limit(1)
  if (routes?.[0]?.truck_id) {
    const r = routes[0]
    await admin.rpc("update_current_route_deviation_for_truck", {
      p_company_id: WRITE_CO,
      p_truck_id: r.truck_id,
      p_lat: 0,
      p_lng: 0,
    })
    const { data: after } = await admin.from("routes").select("current_deviation_meters").eq("id", r.id).single()
    add("route.deviation", 3, after?.current_deviation_meters != null ? "PASS" : "FAIL", `meters=${after?.current_deviation_meters}`)
    await admin.from("routes").update({ current_deviation_meters: null }).eq("id", r.id)
    report.cleanup.push(`routes.current_deviation_meters cleared on ${r.id}`)
  } else {
    add("route.deviation", 3, "SKIP", "No in_progress route on loadtest company")
  }

  // Geofence webhook — need truck + geofence on loadtest
  const { data: trucks } = await admin.from("trucks").select("id").eq("company_id", WRITE_CO).limit(1)
  const { data: geos } = await admin.from("geofences").select("id,center_lat,center_lng,radius_meters").eq("company_id", WRITE_CO).limit(1)
  if (trucks?.[0] && geos?.[0]) {
    add("geofence.webhook", 3, "SKIP", "Not run — eld_telemetry_points insert triggers real webhook pipeline; would risk alert side effects")
  } else {
    add("geofence.webhook", 3, "SKIP", "No truck/geofence on loadtest company for safe test point")
  }

  add("hos.recompute", 3, "SKIP", "eld-sync duty change simulation not run — would require provider sync against prod driver")
  add("totp.full_cycle", 3, "SKIP", "Deferred to Playwright phase4 script (server actions)")
  add("sso.live_idp", 3, "SKIP", "No test IdP available")

  // Cleanup deadlines
  if (created.deadlineIds.length) {
    await admin.from("scheduled_deadlines").delete().in("id", created.deadlineIds)
    report.cleanup.push(`scheduled_deadlines: deleted ${created.deadlineIds.length} smoke rows`)
  }
}

async function main() {
  console.log("=== PHASE 2 ===")
  await phase2()
  console.log("\n=== PHASE 3 ===")
  await phase3()
  const out = path.join(root, "production-smoke-report.json")
  fs.writeFileSync(out, JSON.stringify(report, null, 2))
  console.log(`\n★ ELD plaintext rows: ${report.eldPlaintextRowCount ?? "n/a"}`)
  console.log(`Cleanup: ${report.cleanup.join("; ") || "none"}`)
  console.log(`Report: ${out}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
