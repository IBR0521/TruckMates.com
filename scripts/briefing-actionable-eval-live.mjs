#!/usr/bin/env node
/**
 * Pure-JS live eval (no tsx). Loads .env.local, runs briefing prompt for up to N companies.
 * Usage: node scripts/briefing-actionable-eval-live.mjs [limit]
 */
import { readFileSync, existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

function loadEnvFile(file) {
  const full = path.join(ROOT, file)
  if (!existsSync(full)) return
  for (const line of readFileSync(full, "utf8").split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    if (process.env[key]) continue
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

loadEnvFile(".env.local")
loadEnvFile(".env")
process.env.AI_BRIEFING_ACTIONABLE_RECOMMENDATIONS = "true"

const TOOL_CATALOG = `Available AI tools for suggested_tool (use exact tool_name; null when no clean match):
- assign_driver_to_load: Assign a driver to a load. Required fields: load_id, driver_id
- update_load_status: Change a load's status. Required fields: load_id, new_status
- copy_load: Duplicate an existing load. Required fields: source_load_id
- send_invoice: Email invoice to customer. Required fields: (none)
- mark_invoice_paid: Mark invoice paid. Required fields: invoice_id
- send_driver_message: SMS a driver. Required fields: driver_id, message_text
- update_driver_status: Set driver status. Required fields: driver_id, status
- create_maintenance_record: Schedule maintenance. Required fields: truck_id, service_type, scheduled_date
- mark_maintenance_complete: Complete maintenance. Required fields: maintenance_id
- create_load: Create load. Required fields: pickup_location, delivery_location

suggested_tool rules:
- Only populate when a listed tool cleanly matches and every required input is grounded in Entity references or location text.
- If no clean match, set suggested_tool to null.
- Use exact UUIDs from Entity references; never invent ids.`

function buildSystemPrompt(briefingDate) {
  return `You are TruckMates AI generating a morning briefing. Date: ${briefingDate}.
Output ONLY valid JSON with keys: summary, critical_alerts, today_outlook, financial_highlights, compliance_warnings, recommendations.
Each recommendations[] and critical_alerts[] entry may include optional "suggested_tool": { "tool_name", "tool_input" } | null.

${TOOL_CATALOG}`
}

async function gatherEntityRefs(admin, companyId) {
  const [loads, drivers, trucks, invoices, maintenance] = await Promise.all([
    admin.from("loads").select("id, origin, destination, shipment_number").eq("company_id", companyId).in("status", ["pending", "confirmed", "scheduled", "in_transit"]).limit(40),
    admin.from("drivers").select("id, name").eq("company_id", companyId).limit(40),
    admin.from("trucks").select("id, truck_number").eq("company_id", companyId).limit(40),
    admin.from("invoices").select("id, invoice_number").eq("company_id", companyId).in("status", ["pending", "sent", "overdue"]).limit(30),
    admin.from("maintenance").select("id, service_type").eq("company_id", companyId).not("status", "in", '("completed","cancelled")').limit(30),
  ])
  const lines = ["Entity references:"]
  for (const r of loads.data || []) lines.push(`- load_id=${r.id} origin=${r.origin || ""} dest=${r.destination || ""}`)
  for (const r of drivers.data || []) lines.push(`- driver_id=${r.id} name=${r.name || ""}`)
  for (const r of trucks.data || []) lines.push(`- truck_id=${r.id}`)
  for (const r of invoices.data || []) lines.push(`- invoice_id=${r.id}`)
  for (const r of maintenance.data || []) lines.push(`- maintenance_id=${r.id}`)
  return lines.join("\n")
}

async function callAnthropic(apiKey, system, user) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 120_000)
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        system,
        max_tokens: 4096,
        temperature: 0,
        messages: [{ role: "user", content: user }],
      }),
    })
    const payload = await res.json()
    if (!res.ok) throw new Error(payload?.error?.message || res.statusText)
    const text = (payload.content || []).filter((b) => b.type === "text").map((b) => b.text).join("")
    return JSON.parse(text)
  } finally {
    clearTimeout(timer)
  }
}

function countSuggested(briefing) {
  const slots = [...(briefing.recommendations || []), ...(briefing.critical_alerts || [])]
  const rawNonNull = slots.filter((s) => s.suggested_tool != null).length
  return { totalSlots: slots.length, rawNonNull, explicitNull: slots.length - rawNonNull }
}

async function main() {
  const limit = Number(process.argv[2] || 3)
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!url || !key) throw new Error("Missing Supabase creds")
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY")

  const admin = createClient(url, key)
  const { data: companies } = await admin.from("companies").select("id, name").in("subscription_status", ["active", "trial"]).neq("subscription_tier", "owner_operator").limit(50)

  const picked = []
  for (const c of companies || []) {
    const { count } = await admin.from("loads").select("id", { count: "exact", head: true }).eq("company_id", c.id)
    if ((count || 0) > 0) picked.push(c)
    if (picked.length >= limit) break
  }
  if (picked.length === 0) {
    console.log(JSON.stringify({ error: "no companies with loads" }))
    return
  }

  const briefingDate = new Date().toISOString().slice(0, 10)
  const perCompany = []
  let totalRaw = 0
  let totalSlots = 0

  for (const c of picked) {
    console.error(`Generating for ${c.name}...`)
    const entityBlock = await gatherEntityRefs(admin, c.id)
    const user = `Company briefing date: ${briefingDate}\n\n${entityBlock}\n\nOperational context: company has active freight operations. Produce 3-5 recommendations with suggested_tool when cleanly actionable.`
    try {
      const briefing = await callAnthropic(apiKey, buildSystemPrompt(briefingDate), user)
      const counts = countSuggested(briefing)
      totalRaw += counts.rawNonNull
      totalSlots += counts.totalSlots
      perCompany.push({
        name: c.name,
        companyId: c.id,
        ...counts,
        recommendations: (briefing.recommendations || []).map((r) => ({ title: r.title, suggested_tool: r.suggested_tool ?? null })),
        critical_alerts: (briefing.critical_alerts || []).map((a) => ({ title: a.title, suggested_tool: a.suggested_tool ?? null })),
      })
    } catch (e) {
      perCompany.push({ name: c.name, companyId: c.id, error: String(e) })
    }
  }

  console.log(JSON.stringify({ companiesEvaluated: perCompany.length, totalSlots, totalRawNonNull: totalRaw, perCompany }, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
