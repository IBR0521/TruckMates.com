#!/usr/bin/env node
/**
 * Cross-check supabase.rpc() call sites against function grant lockdown lists.
 * Run: node scripts/verify-function-grant-rpc-safety.mjs
 */

import fs from "node:fs"
import path from "node:path"

const ROOT = path.resolve(import.meta.dirname, "..")

const FULL_REVOKE = [
  "trigger_auto_complete_maintenance_reminders",
  "trigger_auto_enable_integrations",
  "trigger_auto_generate_invoice_on_pod",
  "trigger_crm_document_expiration_alert",
  "trigger_insurance_expiration_alert",
  "trigger_send_pod_alerts",
  "check_hos_exceptions",
  "create_hos_exception_notifications",
  "notify_eld_telemetry_geofence_webhook",
  "handle_new_user",
  "apply_expired_trial_downgrades",
]

const ANON_ONLY_REVOKE = [
  "assign_load_transactional",
  "auto_enable_platform_integrations",
  "auto_create_maintenance_reminders_from_schedule",
  "bump_ai_context_version",
  "calculate_remaining_hos",
  "create_invoice_transactional",
  "create_settlement_transactional",
  "get_conversation_history",
  "get_dvir_stats",
  "get_ifta_tax_rate",
  "get_ifta_tax_rates_for_quarter",
  "increment_ai_action_preference",
  "mark_all_notifications_read",
  "mark_notification_read",
  "populate_demo_data_for_company",
  "process_geofence_point",
  "send_pod_alert_notifications",
  "update_company_for_setup",
  "update_company_setup_complete",
  "upsert_ai_company_memory",
]

const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "truckmates-eld-mobile/ios", ".git"])

const SCAN_ROOTS = ["app", "lib", "supabase/functions", "scripts"].map((d) => path.join(ROOT, d))

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(ent.name) || ent.name === "node_modules") continue
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(full, out)
    else if (/\.(ts|tsx|js|mjs)$/.test(ent.name)) out.push(full)
  }
  return out
}

const rpcPattern = /\.rpc\(\s*['"`]([a-z0-9_]+)['"`]/g
const hits = new Map()

for (const root of SCAN_ROOTS) {
  for (const file of walk(root)) {
    if (file.includes(`${path.sep}scripts${path.sep}verify-function-grant`)) continue
    const text = fs.readFileSync(file, "utf8")
    let m
    while ((m = rpcPattern.exec(text)) !== null) {
      const fn = m[1]
      const rel = path.relative(ROOT, file)
      const window = text.slice(Math.max(0, m.index - 600), m.index + 300)
      const isAdmin =
        /createAdminClient|adminClient|\.rpc\(|SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE/i.test(window) &&
        /admin(Client)?\.rpc|createAdminClient|SUPABASE_SERVICE_ROLE/i.test(window)
      const list = hits.get(fn) || []
      list.push({ file: rel, adminHint: isAdmin })
      hits.set(fn, list)
    }
  }
}

let failed = 0

console.log("=== RPC calls hitting FULL revoke list (must be empty) ===\n")
for (const fn of FULL_REVOKE) {
  const callSites = hits.get(fn)
  const nonAdmin = callSites?.filter((c) => !c.adminHint) ?? []
  if (nonAdmin.length) {
    failed += 1
    console.log(`✗ ${fn}`)
    for (const c of nonAdmin) console.log(`    ${c.file}`)
  }
  if (callSites?.length && !nonAdmin.length) {
    console.log(`✓ ${fn} — rpc only via service_role/admin (${callSites.map((c) => c.file).join(", ")})`)
  }
}
if (!FULL_REVOKE.some((fn) => (hits.get(fn) || []).some((c) => !c.adminHint))) {
  if (!FULL_REVOKE.some((fn) => hits.get(fn)?.length)) {
    console.log("✓ No app RPC calls to fully-revoked functions")
  }
}

console.log("\n=== Authenticated RPC calls in anon-only revoke list (should work after migration) ===\n")
for (const fn of ANON_ONLY_REVOKE) {
  const callSites = hits.get(fn)
  if (!callSites?.length) continue
  console.log(`• ${fn}`)
  for (const c of callSites) {
    const tag = c.adminHint ? "service_role/admin" : "authenticated/user client"
    console.log(`    ${c.file} — ${tag}`)
  }
}

console.log("\n=== FLAGGED: user list said full revoke but app uses authenticated RPC ===\n")
const flagged = ["auto_create_maintenance_reminders_from_schedule"]
for (const fn of flagged) {
  const callSites = hits.get(fn) || []
  const userFacing = callSites.filter((c) => !c.adminHint)
  if (userFacing.length) {
    console.log(`⚠ ${fn}: moved to anon-only revoke (NOT full revoke)`)
    for (const c of userFacing) console.log(`    ${c.file}`)
  }
}

console.log(`\n${failed ? "FAILED" : "PASSED"}: ${failed} fully-revoked function(s) still called via rpc()`)
process.exit(failed > 0 ? 1 : 0)
