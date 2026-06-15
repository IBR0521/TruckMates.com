#!/usr/bin/env node
/**
 * Static hard test for Administration section.
 * Run: node scripts/administration-hard-test.mjs
 */

import fs from "node:fs"
import path from "node:path"

const ROOT = path.resolve(import.meta.dirname, "..")

const ADMIN_ROUTES = [
  "app/dashboard/settings/users/page.tsx",
  "app/dashboard/settings/ai-automation/page.tsx",
  "app/dashboard/settings/ai-automation/pending-approvals/page.tsx",
  "app/dashboard/settings/api-keys/page.tsx",
  "app/dashboard/settings/webhooks/page.tsx",
  "app/dashboard/settings/multi-terminal/page.tsx",
  "app/dashboard/settings/multi-terminal/ui-client.tsx",
  "app/dashboard/settings/billing/page.tsx",
  "app/dashboard/settings/portal/page.tsx",
  "app/dashboard/settings/audit-logs/page.tsx",
  "app/dashboard/settings/page.tsx",
]

const REQUIRED_ACTIONS = [
  "app/actions/settings-users.ts",
  "app/actions/enterprise-api-keys.ts",
  "app/actions/webhooks.ts",
  "app/actions/terminals.ts",
  "lib/ai/agent/settings.ts",
  "app/api/ai/approve/route.ts",
]

let failures = 0
let warnings = 0

function fail(msg) {
  console.error(`  ✗ ${msg}`)
  failures += 1
}
function warn(msg) {
  console.warn(`  ⚠ ${msg}`)
  warnings += 1
}
function pass(msg) {
  console.log(`  ✓ ${msg}`)
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel))
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8")
}

console.log("=== Administration hard test ===\n")

console.log("1. Routes")
for (const route of ADMIN_ROUTES) {
  if (exists(route)) pass(route)
  else fail(`Missing route: ${route}`)
}

console.log("\n2. Server actions & API")
for (const action of REQUIRED_ACTIONS) {
  if (exists(action)) pass(action)
  else fail(`Missing: ${action}`)
}

const middleware = read("middleware.ts")
const featurePerms = read("lib/feature-permissions.ts")
const apiKeys = read("app/actions/enterprise-api-keys.ts")
const aiApprove = read("app/api/ai/approve/route.ts")
const webhooks = read("app/actions/webhooks.ts")
const terminals = read("app/actions/terminals.ts")
const agentSettings = read("lib/ai/agent/settings.ts")
const settingsUsers = read("app/actions/settings-users.ts")
const multiTerminal = read("app/dashboard/settings/multi-terminal/ui-client.tsx")
const pendingApprovals = read("app/dashboard/settings/ai-automation/pending-approvals/page.tsx")
const generalSettings = read("app/dashboard/settings/page.tsx")

console.log("\n3. Middleware & role access")
if (middleware.includes("ai-automation") && middleware.includes("feature: 'dashboard'")) {
  pass("ai-automation uses dashboard feature (ops_manager)")
} else {
  fail("middleware missing ai-automation dashboard route")
}
if (middleware.includes("hasFeatureAccess(companyTier, 'public_api')")) {
  pass("API keys middleware uses public_api + subscription_tier")
} else {
  fail("middleware missing public_api tier gate for API keys")
}
if (featurePerms.includes('"employees"') && featurePerms.includes("operations_manager")) {
  pass("operations_manager has employees permission")
} else {
  fail("operations_manager missing employees in feature-permissions")
}

console.log("\n4. Plan gates (server)")
if (apiKeys.includes("requirePlanFeature") && apiKeys.includes('"public_api"')) {
  pass("enterprise-api-keys uses public_api plan gate")
} else {
  fail("enterprise-api-keys missing public_api gate")
}
if (aiApprove.includes("ai_autonomous_agent") && aiApprove.includes("operations_manager")) {
  pass("/api/ai/approve manager + plan gate")
} else {
  fail("/api/ai/approve missing manager or plan gate")
}
if (agentSettings.includes("requirePlanFeature") && agentSettings.includes("ai_autonomous_agent")) {
  pass("updateAutomationConfig plan gate")
} else {
  fail("updateAutomationConfig missing plan gate")
}
if (terminals.includes("requirePlanFeature") && terminals.includes("multi_terminal")) {
  pass("terminals CRUD plan gate")
} else {
  fail("terminals missing multi_terminal plan gate")
}

console.log("\n5. Webhooks & invitations")
if (webhooks.includes("requireWebhookAdmin")) pass("webhooks admin role checks")
else fail("webhooks missing admin role checks")
if (settingsUsers.includes("invited_role")) pass("invitation role persisted")
else fail("settings-users missing invited_role")
if (exists("supabase/migrations/243_20260617000000_invitation_invited_role.sql")) {
  const m243 = read("supabase/migrations/243_20260617000000_invitation_invited_role.sql")
  if (m243.includes("invitation_codes_invited_role_check") && m243.includes("SET NOT NULL")) {
    pass("migration 243 invited_role constraint + backfill")
  } else {
    fail("migration 243 incomplete (missing CHECK or NOT NULL)")
  }
} else {
  fail("missing migration 243")
}
const authTs = read("app/actions/auth.ts")
if (authTs.includes("invited_role") && authTs.includes("storedRole")) {
  pass("registerEmployee uses invited_role from DB")
} else {
  fail("auth.ts missing invited_role enforcement")
}

console.log("\n6. Multi-terminal UI")
if (multiTerminal.includes("createTerminal") && multiTerminal.includes("deleteTerminal")) {
  pass("multi-terminal CRUD wired")
} else {
  fail("multi-terminal UI not wired to terminals actions")
}

console.log("\n7. Pending approvals & general settings")
if (pendingApprovals.includes("FeatureLock") && pendingApprovals.includes("ai_autonomous_agent")) {
  pass("pending-approvals FeatureLock")
} else {
  fail("pending-approvals missing FeatureLock")
}
if (!generalSettings.includes('toast.success("Security settings saved")')) {
  pass("general settings security stub removed")
} else {
  fail("general settings still has fake security save")
}

console.log(`\n=== Summary: ${failures} failures, ${warnings} warnings ===\n`)
if (failures) process.exit(1)
