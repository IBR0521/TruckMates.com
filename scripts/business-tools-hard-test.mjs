#!/usr/bin/env node
/**
 * Static hard test for Business & Tools sections.
 * Run: node scripts/business-tools-hard-test.mjs
 */

import fs from "node:fs"
import path from "node:path"

const ROOT = path.resolve(import.meta.dirname, "..")

const BUSINESS_ROUTES = [
  "app/dashboard/crm/page.tsx",
  "app/dashboard/customers/page.tsx",
  "app/dashboard/vendors/page.tsx",
  "app/dashboard/address-book/page.tsx",
  "app/dashboard/reports/page.tsx",
  "app/dashboard/reports/detention/page.tsx",
  "app/dashboard/documents/page.tsx",
  "app/dashboard/notifications/page.tsx",
  "app/dashboard/bols/page.tsx",
  "app/dashboard/bols/templates/page.tsx",
  "app/dashboard/settings/business/page.tsx",
  "app/dashboard/settings/alerts/page.tsx",
  "app/dashboard/settings/reminder/page.tsx",
]

const REQUIRED_ACTIONS = [
  "app/actions/customers.ts",
  "app/actions/vendors.ts",
  "app/actions/enhanced-address-book.ts",
  "app/actions/reports.ts",
  "app/actions/documents.ts",
  "app/actions/alerts.ts",
  "app/actions/reminders.ts",
  "app/actions/bol.ts",
  "app/actions/auto-bol.ts",
  "app/actions/number-formats.ts",
]

const REQUIRED_CRONS = [
  "app/api/cron/alert-escalations/route.ts",
  "app/api/cron/process-smart-notifications/route.ts",
  "app/api/cron/scan-document-expiry/route.ts",
  "app/api/cron/morning-digest/route.ts",
]

const BUSINESS_SETTINGS_FIELDS = [
  "bol_template",
  "bol_auto_generate",
  "company_logo_url",
  "company_name_display",
  "company_tagline",
  "company_website",
  "company_primary_color",
  "company_secondary_color",
  "number_format",
  "tax_id",
  "license_number",
  "mc_number",
  "business_phone",
  "business_email",
  "business_address",
  "business_city",
  "business_state",
  "business_zip",
  "business_country",
  "invoice_email_template",
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

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8")
}
function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel))
}

console.log("\n=== Business & Tools Hard Test ===\n")

console.log("1. Routes")
for (const route of BUSINESS_ROUTES) {
  if (exists(route)) pass(route)
  else fail(`Missing route: ${route}`)
}

console.log("\n2. Server actions")
for (const action of REQUIRED_ACTIONS) {
  if (exists(action)) pass(action)
  else fail(`Missing action: ${action}`)
}

console.log("\n3. Crons")
for (const cron of REQUIRED_CRONS) {
  if (exists(cron)) pass(cron)
  else fail(`Missing cron: ${cron}`)
}

const numberFormats = read("app/actions/number-formats.ts")
const migration242 = exists("supabase/migrations/242_20260616000000_business_tools_settings.sql")
  ? read("supabase/migrations/242_20260616000000_business_tools_settings.sql")
  : ""

console.log("\n4. Business settings field wiring")
for (const field of BUSINESS_SETTINGS_FIELDS) {
  const inSelect = numberFormats.includes(field)
  const inAllowed = numberFormats.includes(`'${field}'`)
  const inSql = migration242.includes(field) || read("supabase/migrations/156_20260411120000_ensure_company_settings_table.sql").includes(field)
  if (inSelect && inAllowed) pass(`settings round-trip: ${field}`)
  else if (!inSelect) fail(`COMPANY_SETTINGS_SELECT missing: ${field}`)
  else fail(`allowedFields missing: ${field}`)
  if (!inSql && field !== "invoice_email_template") warn(`SQL migration may be missing column: ${field}`)
}

console.log("\n5. Auto BOL wiring")
const loads = read("app/actions/loads.ts")
const autoBol = read("app/actions/auto-bol.ts")
if (loads.includes("maybeAutoCreateBOLForLoad")) pass("loads.ts calls maybeAutoCreateBOLForLoad")
else fail("loads.ts missing auto BOL hook")
if (autoBol.includes("bol_auto_generate")) pass("auto-bol.ts checks bol_auto_generate")
else fail("auto-bol.ts missing setting check")

console.log("\n6. Plan / feature gates")
const middleware = read("middleware.ts")
if (middleware.includes("detention_report")) pass("middleware detention plan gate")
else fail("middleware missing detention_report gate")
const featurePerms = read("lib/feature-permissions.ts")
if (featurePerms.includes('"fuel_analytics"')) pass("fuel_analytics in role permissions")
else fail("fuel_analytics missing from role permissions")

console.log("\n7. Alerts notify users UI")
const alertsPage = read("app/dashboard/settings/alerts/page.tsx")
if (alertsPage.includes("getCompanyUsers") && alertsPage.includes("notify_users")) pass("alerts settings user targeting")
else fail("alerts settings missing notify_users UI")

console.log(`\n=== Summary: ${failures} failures, ${warnings} warnings ===\n`)
if (failures) process.exit(1)
