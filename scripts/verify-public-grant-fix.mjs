#!/usr/bin/env node
/** Verify migration 255: anon denied, authenticated still works for PART 1b RPCs. */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const envPath = path.join(root, ".env.local")
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const i = t.indexOf("=")
    if (i < 1) continue
    let v = t.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!process.env[t.slice(0, i).trim()]) process.env[t.slice(0, i).trim()] = v
  }
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "")
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const EMAIL = process.env.SMOKE_WRITE_EMAIL || "loadtest@truckmateslogistic.com"
const PASS = process.env.SMOKE_WRITE_PASSWORD || process.env.PLAYWRIGHT_PASSWORD
const FAKE = "00000000-0000-0000-0000-000000000001"

async function rpc(token, fn, body) {
  const res = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return { status: res.status, text: await res.text() }
}

function denied(status, text) {
  return (
    status === 401 ||
    status === 403 ||
    /permission denied|42501|not authorized|PGRST301/i.test(text)
  )
}

let failed = 0

console.log("=== Anon must be denied ===\n")
for (const [fn, body] of [
  ["calculate_remaining_hos", { p_driver_id: FAKE }],
  [
    "create_invoice_transactional",
    {
      p_company_id: FAKE,
      p_load_id: FAKE,
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
      p_company_id: FAKE,
      p_driver_id: FAKE,
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
]) {
  const r = await rpc(ANON, fn, body)
  const ok = denied(r.status, r.text)
  console.log(`${ok ? "PASS" : "FAIL"} anon ${fn}: HTTP ${r.status} ${r.text.slice(0, 120)}`)
  if (!ok) failed++
}

if (!PASS) {
  console.error("\nSet SMOKE_WRITE_PASSWORD for authenticated checks")
  process.exit(failed ? 1 : 0)
}

const authRes = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASS }),
})
const { access_token: tok } = await authRes.json()
if (!tok) {
  console.error("FAIL sign-in")
  process.exit(1)
}

console.log("\n=== Authenticated must still work ===\n")
const helpers = [
  ["get_user_company_id", {}],
  ["calculate_remaining_hos", { p_driver_id: FAKE }],
]
for (const [fn, body] of helpers) {
  const r = await rpc(tok, fn, body)
  const ok = r.status === 200
  console.log(`${ok ? "PASS" : "FAIL"} auth ${fn}: HTTP ${r.status} ${r.text.slice(0, 120)}`)
  if (!ok) failed++
}

process.exit(failed ? 1 : 0)
