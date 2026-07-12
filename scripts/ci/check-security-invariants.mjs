#!/usr/bin/env node
/**
 * CI security-invariant guard.
 *
 * Encodes the fixes recorded in docs/audit-findings.md so they cannot silently regress. Static
 * checks only (no DB / network). Exits 1 with a list of violations, 0 when all invariants hold.
 * If a change here is intentional, update this file in the same PR.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
const read = (p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "")
const failures = []
const fail = (msg) => failures.push(msg)

// A standalone `"use server"` directive line (not the words appearing inside a comment/string).
const USE_SERVER = /^\s*["']use server["']\s*;?\s*$/m

// Grab a function's body region for coarse checks (enough to see a guard near the top).
function fnRegion(src, name) {
  const i = src.indexOf(`function ${name}`)
  return i === -1 ? "" : src.slice(i, i + 1400)
}

// ── F9: cron/agent worker modules must NOT be "use server" ──────────────────────────────────────
// Their exports take a companyId param and run on the admin client; as server actions they would be
// client-callable endpoints that act on an arbitrary tenant (cross-tenant side effects).
for (const f of [
  "app/actions/invoice-overdue-notify.ts",
  "app/actions/delivery-delay-notify.ts",
  "app/actions/document-expiry-notify.ts",
  "app/actions/permit-expiry-notify.ts",
  "app/actions/dispatch-event-notify.ts",
]) {
  const src = read(f)
  if (!src) fail(`F9: expected worker module is missing: ${f}`)
  else if (USE_SERVER.test(src)) {
    fail(`F9: ${f} must NOT be a "use server" module — its companyId workers would become client-callable actions.`)
  }
}

// ── F9: the companyId worker left in a mixed "use server" file must keep an own-company auth guard ─
for (const [f, fn] of [["app/actions/dispatcher-hos.ts", "getAllDriversHOSStatusByCompany"]]) {
  const body = fnRegion(read(f), fn)
  if (!/getCachedAuthContext/.test(body) || !/ctx\.companyId\s*!==\s*companyId/.test(body)) {
    fail(`F9: ${fn} (${f}) must verify companyId against getCachedAuthContext() (ctx.companyId !== companyId).`)
  }
}

// ── F9: CSA sync workers must stay out of the "use server" action surface (moved to lib/compliance) ─
if (/export\s+async\s+function\s+sync(All)?Compan(ies|y)CSAScores/.test(read("app/actions/csa-scores.ts"))) {
  fail('F9: CSA sync workers must live in lib/compliance/csa-sync.ts, not be exported from the "use server" csa-scores.ts module.')
}

// ── F14: money RPCs must be called via the admin (service-role) client, never `authenticated` ─────
const MONEY_RPCS = ["create_invoice_transactional", "create_settlement_transactional", "assign_load_transactional"]
for (const f of ["app/actions/accounting.ts", "app/actions/dispatches.ts", "app/actions/auto-invoice.ts"]) {
  const src = read(f)
  for (const rpc of MONEY_RPCS) {
    if (new RegExp(String.raw`supabase\.rpc\(\s*["']${rpc}["']`).test(src)) {
      fail(`F14: ${f} calls ${rpc} via the authenticated client — must use the admin (service-role) client.`)
    }
  }
}
const migrations = existsSync(join(root, "supabase/migrations"))
  ? readdirSync(join(root, "supabase/migrations"))
  : []
if (!migrations.some((m) => /lockdown_money_rpcs/.test(m))) {
  fail("F14: the money-RPC service-role lockdown migration is missing from supabase/migrations/.")
}

// ── F11: QuickBooks OAuth tokens must be encrypted at rest ────────────────────────────────────────
const qbCallback = read("app/api/quickbooks/callback/route.ts")
if (!/encryptCredential\(\s*tokens\.access_token/.test(qbCallback) || !/encryptCredential\(\s*tokens\.refresh_token/.test(qbCallback)) {
  fail("F11: quickbooks/callback must write access/refresh tokens through encryptCredential().")
}

// ── F8: Stripe + PayPal webhooks must sync companies.subscription_tier (parity with Paddle) ────────
for (const f of ["app/api/webhooks/stripe/route.ts", "app/api/webhooks/paypal/route.ts"]) {
  const src = read(f)
  if (!/subscription_tier/.test(src) || !/normalizePlanTier/.test(src)) {
    fail(`F8: ${f} must sync companies.subscription_tier via normalizePlanTier (the entitlement source of truth).`)
  }
}

// ── F12: ELD telemetry webhook must compare its secret in constant time ────────────────────────────
const eldWebhook = read("app/api/webhooks/eld-telemetry-insert/route.ts")
if (!/timingSafeEqual/.test(eldWebhook) || /providedSecret\s*!==\s*expectedSecret/.test(eldWebhook)) {
  fail("F12: eld-telemetry-insert must compare the shared secret with crypto.timingSafeEqual, not `!==`.")
}

// ── F13: raw-search endpoints must sanitize input before interpolating into .or() ──────────────────
for (const f of [
  "app/actions/parts.ts",
  "app/actions/bol.ts",
  "app/actions/audit-logs.ts",
  "app/actions/driver-applications.ts",
  "app/actions/vendor-invoices.ts",
]) {
  if (!/sanitizeForOr/.test(read(f))) {
    fail(`F13: ${f} must run search input through sanitizeForOr() before interpolating into a .or() filter.`)
  }
}

if (failures.length) {
  console.error(`\n✖ Security invariants failed (${failures.length}):\n`)
  for (const f of failures) console.error("  • " + f)
  console.error("\nThese guards encode fixes in docs/audit-findings.md. If a change is intentional, update this script.\n")
  process.exit(1)
}
console.log("✓ Security invariants passed: F8 (tier sync), F9 (server-action tenant scoping), F11 (QuickBooks token encryption), F12 (constant-time secret), F13 (search sanitization), F14 (money-RPC lockdown).")
