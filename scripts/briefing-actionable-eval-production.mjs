#!/usr/bin/env node
/**
 * Live briefing suggested_tool eval — generate only, never stages.
 * Loads .env.local (Supabase) + .env.vercel.production (Anthropic).
 * Does NOT set staging flag for cron; only enables tool catalog in the prompt.
 *
 * Usage: node scripts/briefing-actionable-eval-production.mjs
 */
import { readFileSync, existsSync } from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

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
loadEnvFile(".env.vercel.production")
if (!process.env.SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Missing ANTHROPIC_API_KEY (expected in .env.vercel.production)")
  process.exit(1)
}

const COMPANIES = [
  { id: "3feda3d9-e771-4809-a59b-4b7dc3a56f15", name: "Demo Logistics Co." },
  { id: "bb0254af-5909-4e5b-aaf4-5466df103757", name: "RoadTruck" },
  { id: "b6b431df-45ab-4e26-8377-b6d9a95b41ba", name: "DriveBoys" },
]

const perCompany = []

for (const company of COMPANIES) {
  process.stderr.write(`\n=== Evaluating ${company.name} ===\n`)
  const result = spawnSync(
    "npx",
    ["vitest", "--run", "--pool=forks", "tests/unit/briefing-actionable-live-eval-one.test.ts"],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        AI_BRIEFING_ACTIONABLE_RECOMMENDATIONS: "true",
        EVAL_COMPANY_ID: company.id,
        EVAL_COMPANY_NAME: company.name,
      },
      encoding: "utf8",
      timeout: 300_000,
    },
  )

  if (result.stderr) process.stderr.write(result.stderr)

  const stdout = result.stdout || ""
  const jsonStart = stdout.indexOf("{")
  if (jsonStart === -1) {
    perCompany.push({ ...company, error: result.error?.message || stdout.slice(-500) || "no json output" })
    continue
  }

  try {
    const parsed = JSON.parse(stdout.slice(jsonStart))
    perCompany.push(parsed)
  } catch {
    perCompany.push({ ...company, error: "failed to parse vitest output" })
  }
}

const summary = {
  companiesEvaluated: perCompany.length,
  totalSlots: perCompany.reduce((s, c) => s + Number(c.recommendationAndAlertSlots || 0), 0),
  totalRawNonNull: perCompany.reduce((s, c) => s + Number(c.rawNonNull || 0), 0),
  totalValidated: perCompany.reduce((s, c) => s + Number(c.validatedNonNull || 0), 0),
  totalDiscarded: perCompany.reduce((s, c) => s + Number(c.discarded || 0), 0),
  totalExplicitNull: perCompany.reduce((s, c) => s + Number(c.explicitNull || 0), 0),
  perCompany,
}

console.log(JSON.stringify(summary, null, 2))
