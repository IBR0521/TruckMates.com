#!/usr/bin/env node
/**
 * Static hard test for Compliance & Finance sections.
 * Run: node scripts/compliance-finance-hard-test.mjs
 */

import fs from "node:fs"
import path from "node:path"

const ROOT = path.resolve(import.meta.dirname, "..")

const COMPLIANCE_ROUTES = [
  "app/dashboard/compliance/page.tsx",
  "app/dashboard/dvir/page.tsx",
  "app/dashboard/ifta/page.tsx",
  "app/dashboard/permits/page.tsx",
  "app/dashboard/hazmat/page.tsx",
  "app/dashboard/edi/page.tsx",
]

const FINANCE_ROUTES = [
  "app/dashboard/accounting/invoices/page.tsx",
  "app/dashboard/accounting/settlements/page.tsx",
  "app/dashboard/accounting/tax-fuel/page.tsx",
  "app/dashboard/payables/vendor-invoices/page.tsx",
  "app/dashboard/payables/reconcile/page.tsx",
  "app/dashboard/billing/detention-candidates/page.tsx",
  "app/dashboard/settings/invoice/page.tsx",
  "app/dashboard/settings/compliance/page.tsx",
  "app/dashboard/settings/factoring/page.tsx",
  "app/dashboard/settings/pay-rules/page.tsx",
  "app/dashboard/settings/year-end/page.tsx",
]

const REQUIRED_ACTIONS = [
  "app/actions/compliance-registrations.ts",
  "app/actions/dvir.ts",
  "app/actions/ifta.ts",
  "app/actions/permits.ts",
  "app/actions/accounting.ts",
  "app/actions/auto-invoice.ts",
  "app/actions/factoring-email.ts",
  "app/actions/factoring-api.ts",
  "app/actions/vendor-invoices.ts",
  "app/actions/bank-reconciliation.ts",
  "app/actions/document-expiry.ts",
  "app/actions/invoice-verification.ts",
  "app/actions/number-formats.ts",
]

const REQUIRED_LIBS = [
  "lib/compliance-readiness.ts",
  "lib/compliance-notify-settings.ts",
  "lib/finance-settings.ts",
  "lib/finance-notify-settings.ts",
  "lib/plan-feature-guard.ts",
]

const REQUIRED_CRONS = [
  "app/api/cron/scan-document-expiry/route.ts",
  "app/api/cron/scan-permit-expiry/route.ts",
  "app/api/cron/scan-invoice-overdue/route.ts",
]

const INVOICE_SETTINGS_FIELDS = [
  "auto_invoice_on_delivery",
  "tax_enabled",
  "default_tax_rate",
  "tax_inclusive",
  "tax_name",
  "late_fee_enabled",
  "invoice_email_subject",
  "invoice_email_body",
  "auto_attach_documents",
  "include_bol_in_invoice",
]

const COMPLIANCE_SETTINGS_FIELDS = [
  "notify_on_document_expiry",
  "notify_on_permit_expiry",
  "compliance_expiry_lead_days",
  "compliance_notification_channels",
]

const FINANCE_NOTIFY_FIELDS = [
  "notify_on_invoice_overdue",
  "notify_on_factoring_status",
  "finance_notification_channels",
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

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8")
}

function exists(file) {
  return fs.existsSync(path.join(ROOT, file))
}

function allSqlText() {
  const chunks = []
  for (const dir of ["supabase/migrations", "supabase"]) {
    const full = path.join(ROOT, dir)
    if (!fs.existsSync(full)) continue
    for (const name of fs.readdirSync(full)) {
      if (name.endsWith(".sql")) chunks.push(read(path.join(dir, name)))
    }
  }
  return chunks.join("\n")
}

console.log("\n=== Compliance & Finance Hard Test ===\n")

console.log("1. Dashboard routes")
for (const route of [...COMPLIANCE_ROUTES, ...FINANCE_ROUTES]) {
  if (!exists(route)) fail(`Missing route: ${route}`)
  else pass(route)
}

console.log("\n2. Server actions & shared libs")
for (const file of [...REQUIRED_ACTIONS, ...REQUIRED_LIBS]) {
  if (!exists(file)) fail(`Missing file: ${file}`)
  else pass(file)
}

console.log("\n3. Cron routes")
const vercelJson = exists("vercel.json") ? read("vercel.json") : ""
for (const cron of REQUIRED_CRONS) {
  if (!exists(cron)) fail(`Missing cron: ${cron}`)
  else {
    pass(cron)
    const routePath = cron.replace("app", "").replace("/route.ts", "")
    if (!vercelJson.includes(routePath)) warn(`${routePath} not in vercel.json crons`)
  }
}

console.log("\n4. Migration 239 compliance/finance settings columns")
const sql = allSqlText()
for (const col of [...INVOICE_SETTINGS_FIELDS, ...COMPLIANCE_SETTINGS_FIELDS, ...FINANCE_NOTIFY_FIELDS]) {
  if (!sql.includes(col)) warn(`Column "${col}" not found in SQL migrations`)
  else pass(`sql column ${col}`)
}

console.log("\n5. Invoice settings UI ↔ number-formats wiring")
const invoiceUi = read("app/dashboard/settings/invoice/page.tsx")
const numberFormats = read("app/actions/number-formats.ts")

if (invoiceUi.includes("auto_generate_on_delivery")) {
  fail('invoice settings still uses legacy field name "auto_generate_on_delivery"')
} else {
  pass("auto_invoice_on_delivery field name in UI")
}

for (const field of INVOICE_SETTINGS_FIELDS) {
  if (!invoiceUi.includes(field) && field !== "tax_name") continue
  const inAllowed = numberFormats.includes(`'${field}'`)
  const inSelect = numberFormats.includes(field)
  if (!inAllowed) fail(`Invoice field "${field}" not in updateCompanySettings allowedFields`)
  else pass(`invoice field ${field} allowed`)
  if (!inSelect) warn(`Invoice field "${field}" not in COMPANY_SETTINGS_SELECT`)
}

console.log("\n6. Finance wiring checks")
const accounting = read("app/actions/accounting.ts")
if (!accounting.includes("maybeAutoSubmitFactoringOnInvoiceCreated")) {
  fail("accounting.ts does not call maybeAutoSubmitFactoringOnInvoiceCreated")
} else pass("factoring email on invoice create")

if (!accounting.includes('triggerWebhook') || !accounting.includes('"invoice.paid"')) {
  fail("accounting.ts missing invoice.paid webhook")
} else pass("invoice.paid webhook")

const loads = read("app/actions/loads.ts")
if (!loads.includes("calculateFuelSurcharge")) {
  fail("loads.ts does not use calculateFuelSurcharge")
} else pass("FSC method in loads.ts")

const dispatchAssist = read("app/actions/dispatch-assist.ts")
if (dispatchAssist.includes("hos_violations: []") && dispatchAssist.includes("Still call HOS")) {
  fail("dispatch-assist.ts still stubs HOS violations")
} else pass("dispatch-assist HOS not stubbed")

const dispatchValidation = read("lib/load-dispatch-validation.ts")
if (!dispatchValidation.includes("getHosReadinessError") || !dispatchValidation.includes("getHazmatReadinessError")) {
  fail("load-dispatch-validation.ts missing compliance readiness checks")
} else pass("compliance readiness in dispatch validation")

console.log("\n7. Plan feature guard usage")
const vendorInvoices = read("app/actions/vendor-invoices.ts")
if (!vendorInvoices.includes("requirePlanFeature")) warn("vendor-invoices.ts missing requirePlanFeature")
else pass("vendor-invoices plan guard")

console.log(`\n=== Summary: ${failures} failures, ${warnings} warnings ===\n`)
if (failures > 0) process.exit(1)
