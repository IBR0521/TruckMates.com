import { readFileSync, existsSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { generateBriefingForCompany } from "@/lib/ai/briefing"
import { gatherBriefingEntityContext } from "@/lib/ai/briefing-actionable"
import {
  parseBriefingSuggestedTool,
  validateBriefingSuggestedTool,
} from "@/lib/ai/briefing-suggested-tool-validation"

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

const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY)
const hasSupabase = Boolean(
  process.env.SUPABASE_SERVICE_ROLE_KEY && (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),
)

const TARGET_COMPANIES = [
  { id: "3feda3d9-e771-4809-a59b-4b7dc3a56f15", name: "Demo Logistics Co." },
  { id: "bb0254af-5909-4e5b-aaf4-5466df103757", name: "RoadTruck" },
  { id: "b6b431df-45ab-4e26-8377-b6d9a95b41ba", name: "DriveBoys" },
]

describe.skipIf(!hasAnthropic || !hasSupabase)("briefing actionable live eval (generate only, no staging)", () => {
  it(
    "reports suggested_tool yield for target companies",
    async () => {
      process.env.AI_BRIEFING_ACTIONABLE_RECOMMENDATIONS = "true"
      const briefingDate = new Date().toISOString().slice(0, 10)
      const perCompany: Array<Record<string, unknown>> = []

      for (const company of TARGET_COMPANIES) {
        const entityCtx = await gatherBriefingEntityContext(company.id)
        const gen = await generateBriefingForCompany({
          companyId: company.id,
          briefingDate,
          usageFeature: "ai_morning_briefing_eval",
        })

        if (gen.error || !gen.data) {
          perCompany.push({ name: company.name, companyId: company.id, error: gen.error || "empty" })
          continue
        }

        const slots = [...gen.data.recommendations, ...gen.data.critical_alerts]
        const rawDetails: Array<Record<string, unknown>> = []
        let rawNonNull = 0
        let validated = 0
        let discarded = 0

        for (const slot of slots) {
          const raw = slot.suggested_tool
          if (raw == null) continue
          rawNonNull += 1
          const parsed = parseBriefingSuggestedTool(raw)
          const ok = parsed ? validateBriefingSuggestedTool(parsed, entityCtx.allowlist) : null
          rawDetails.push({
            title: "title" in slot ? slot.title : "",
            raw_tool: raw,
            validated: ok,
            discard_reason: ok ? null : "validation_failed",
          })
          if (ok) validated += 1
          else discarded += 1
        }

        perCompany.push({
          name: company.name,
          companyId: company.id,
          recommendationAndAlertSlots: slots.length,
          rawNonNull,
          validatedNonNull: validated,
          discarded,
          explicitNull: slots.length - rawNonNull,
          entityCounts: {
            loads: entityCtx.allowlist.loadIds.size,
            drivers: entityCtx.allowlist.driverIds.size,
            trucks: entityCtx.allowlist.truckIds.size,
            invoices: entityCtx.allowlist.invoiceIds.size,
            maintenance: entityCtx.allowlist.maintenanceIds.size,
          },
          details: rawDetails,
        })
      }

      const summary = {
        companiesEvaluated: perCompany.length,
        totalSlots: perCompany.reduce((s, c) => s + Number(c.recommendationAndAlertSlots || 0), 0),
        totalRawNonNull: perCompany.reduce((s, c) => s + Number(c.rawNonNull || 0), 0),
        totalValidated: perCompany.reduce((s, c) => s + Number(c.validatedNonNull || 0), 0),
        totalDiscarded: perCompany.reduce((s, c) => s + Number(c.discarded || 0), 0),
        perCompany,
      }

      // eslint-disable-next-line no-console -- live eval artifact
      console.log(JSON.stringify(summary, null, 2))

      expect(perCompany.some((c) => !c.error)).toBe(true)
    },
    900_000,
  )
})
