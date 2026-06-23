import { readFileSync, existsSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

function loadEnvFile(file: string) {
  const full = path.join(process.cwd(), file)
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
loadEnvFile(".env.vercel.production")
if (!process.env.SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
}

const companyId = process.env.EVAL_COMPANY_ID || ""
const companyName = process.env.EVAL_COMPANY_NAME || companyId

const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY)
const hasSupabase = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_URL)

describe.skipIf(!hasAnthropic || !hasSupabase || !companyId)("briefing actionable live eval (one company)", () => {
  it(
    "generates briefing and prints suggested_tool stats",
    async () => {
      process.env.AI_BRIEFING_ACTIONABLE_RECOMMENDATIONS = "true"
      process.stderr.write(`[eval] starting ${companyName}\n`)

      process.stderr.write("[eval] importing briefing-actionable\n")
      const { gatherBriefingEntityContext } = await import("@/lib/ai/briefing-actionable")
      process.stderr.write("[eval] importing briefing\n")
      const { generateBriefingForCompany } = await import("@/lib/ai/briefing")

      const briefingDate = new Date().toISOString().slice(0, 10)
      const entityCtx = await gatherBriefingEntityContext(companyId)
      process.stderr.write(`[eval] entity context loaded for ${companyName}\n`)

      const gen = await generateBriefingForCompany({
        companyId,
        briefingDate,
        usageFeature: "ai_morning_briefing_eval",
      })

      if (gen.error || !gen.data) {
        console.log(JSON.stringify({ companyId, companyName, error: gen.error || "empty" }, null, 2))
        expect.fail(gen.error || "empty briefing")
      }

      const stats = gen.suggestedToolStats || { rawNonNull: 0, validated: 0, discarded: 0, nullCount: 0 }
      const slots = [...gen.data.recommendations, ...gen.data.critical_alerts]

      const payload = {
        companyId,
        companyName,
        recommendationAndAlertSlots: slots.length,
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
      }

      console.log(JSON.stringify(payload, null, 2))
      expect(slots.length).toBeGreaterThan(0)
    },
    240_000,
  )
})
