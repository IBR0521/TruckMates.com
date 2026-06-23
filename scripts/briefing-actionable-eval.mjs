/**
 * Evaluates morning-briefing suggested_tool yield for companies with operational data.
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
 * Enable: AI_BRIEFING_ACTIONABLE_RECOMMENDATIONS=true
 *
 * Usage: npx tsx scripts/briefing-actionable-eval.mjs [limit]
 */
import { createClient } from "@supabase/supabase-js"

process.env.AI_BRIEFING_ACTIONABLE_RECOMMENDATIONS = "true"

const limit = Number(process.argv[2] || 3)

async function main() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY")
    process.exit(1)
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Missing ANTHROPIC_API_KEY — cannot run live model eval")
    process.exit(1)
  }

  const { generateBriefingForCompany } = await import("../lib/ai/briefing.ts")
  const { gatherBriefingEntityContext } = await import("../lib/ai/briefing-actionable.ts")

  const admin = createClient(url, key)
  const { data: companies, error } = await admin
    .from("companies")
    .select("id, name")
    .in("subscription_status", ["active", "trial"])
    .neq("subscription_tier", "owner_operator")
    .limit(50)

  if (error) {
    console.error(error.message)
    process.exit(1)
  }

  const withData = []
  for (const c of companies || []) {
    const [{ count: loads }, { count: drivers }, { count: trucks }] = await Promise.all([
      admin.from("loads").select("id", { count: "exact", head: true }).eq("company_id", c.id),
      admin.from("drivers").select("id", { count: "exact", head: true }).eq("company_id", c.id),
      admin.from("trucks").select("id", { count: "exact", head: true }).eq("company_id", c.id),
    ])
    if ((loads || 0) + (drivers || 0) + (trucks || 0) > 0) {
      withData.push(c)
    }
    if (withData.length >= limit) break
  }

  if (withData.length === 0) {
    console.log("No companies with operational data found.")
    process.exit(0)
  }

  const briefingDate = new Date().toISOString().slice(0, 10)
  let totalSlots = 0
  let totalValidated = 0
  const perCompany = []

  for (const c of withData) {
    const entityCtx = await gatherBriefingEntityContext(c.id)
    const gen = await generateBriefingForCompany({
      companyId: c.id,
      briefingDate,
      usageFeature: "ai_morning_briefing_eval",
    })
    if (gen.error || !gen.data) {
      perCompany.push({ companyId: c.id, name: c.name, error: gen.error || "empty" })
      continue
    }
    const stats = gen.suggestedToolStats || {
      rawNonNull: 0,
      validated: 0,
      discarded: 0,
      nullCount: 0,
    }
    totalSlots += stats.nullCount + stats.rawNonNull
    totalValidated += stats.validated
    perCompany.push({
      companyId: c.id,
      name: c.name,
      slots: stats.nullCount + stats.rawNonNull,
      rawNonNull: stats.rawNonNull,
      validatedNonNull: stats.validated,
      discarded: stats.discarded,
      explicitNull: stats.nullCount,
      entityCounts: {
        loads: entityCtx.allowlist.loadIds.size,
        drivers: entityCtx.allowlist.driverIds.size,
        trucks: entityCtx.allowlist.truckIds.size,
        invoices: entityCtx.allowlist.invoiceIds.size,
        maintenance: entityCtx.allowlist.maintenanceIds.size,
      },
      recommendations: gen.data.recommendations.map((r) => ({
        title: r.title,
        suggested_tool: r.suggested_tool,
      })),
      critical_alerts: gen.data.critical_alerts.map((a) => ({
        title: a.title,
        suggested_tool: a.suggested_tool,
      })),
    })
  }

  console.log(
    JSON.stringify(
      {
        companiesEvaluated: perCompany.length,
        totalRecommendationAndAlertSlots: totalSlots,
        totalRawSuggestedToolNonNull: perCompany.reduce((s, c) => s + (c.rawNonNull || 0), 0),
        totalValidatedSuggestedToolNonNull: totalValidated,
        totalDiscarded: perCompany.reduce((s, c) => s + (c.discarded || 0), 0),
        totalExplicitNull: perCompany.reduce((s, c) => s + (c.explicitNull || 0), 0),
        perCompany,
      },
      null,
      2,
    ),
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
