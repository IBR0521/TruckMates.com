#!/usr/bin/env node
/**
 * Offline AI evaluation harness (NOT user-facing).
 *
 * Runs every scenario in tests/ai-eval/scenarios.json through the REAL production system prompt
 * (LOGISTICS_SYSTEM_PROMPT) and the REAL `callClaude` client, using each scenario's frozen
 * `contextFixture` as grounding context. It then checks `mustInclude` / `mustNotInclude` against the
 * model's answer and prints a pass/fail table with a final score.
 *
 * Determinism: `callClaude` already sends `temperature: 0`, so output is as deterministic as the
 * model allows.
 *
 * No production data: this harness NEVER reads company data from the database. It only uses the
 * frozen fixtures in scenarios.json. To avoid accidental telemetry writes we deliberately load ONLY
 * the Anthropic key from local env files (never Supabase credentials), so the best-effort usage
 * logger inside callClaude no-ops.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... npm run ai:eval
 *   EVAL_AI_MODEL=haiku npm run ai:eval        # default model is "sonnet"
 *   (the key is also auto-loaded from .env.local / .env if present)
 *
 * This file is run through `tsx` (see the "ai:eval" npm script) so it can import the TypeScript
 * client and resolve the "@/" path alias.
 */

import { readFileSync, existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..", "..")
const SCENARIOS_PATH = path.join(ROOT, "tests", "ai-eval", "scenarios.json")

/**
 * Load ONLY the Anthropic API key from local env files (never Supabase or other secrets), so the
 * harness can reach the API without enabling any database side effects. Existing process.env wins.
 */
function loadAnthropicEnv() {
  for (const file of [".env.local", ".env"]) {
    const full = path.join(ROOT, file)
    if (!existsSync(full)) continue
    const raw = readFileSync(full, "utf8")
    for (const line of raw.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      if (!key.startsWith("ANTHROPIC")) continue
      if (process.env[key]) continue
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      process.env[key] = value
    }
  }
}

loadAnthropicEnv()

// Suppress the best-effort AI usage logger's noise (it tries to write telemetry and fails without
// Supabase creds, which is expected and harmless for an offline eval).
const originalConsoleError = console.error
console.error = (...args) => {
  if (typeof args[0] === "string" && args[0].includes("[AI Usage]")) return
  originalConsoleError(...args)
}

const { callClaude } = await import("@/lib/ai/client")
const { LOGISTICS_SYSTEM_PROMPT } = await import("@/lib/ai/prompts/system")

const MODEL = (process.env.EVAL_AI_MODEL || "sonnet").toLowerCase() === "haiku" ? "haiku" : "sonnet"

function loadScenarios() {
  if (!existsSync(SCENARIOS_PATH)) {
    throw new Error(`Scenarios file not found at ${SCENARIOS_PATH}`)
  }
  const parsed = JSON.parse(readFileSync(SCENARIOS_PATH, "utf8"))
  if (!Array.isArray(parsed)) throw new Error("scenarios.json must contain a JSON array")
  return parsed
}

function evaluateAnswer(answer, scenario) {
  const haystack = String(answer || "").toLowerCase()
  const mustInclude = Array.isArray(scenario.mustInclude) ? scenario.mustInclude : []
  const mustNotInclude = Array.isArray(scenario.mustNotInclude) ? scenario.mustNotInclude : []

  const missing = mustInclude.filter((needle) => !haystack.includes(String(needle).toLowerCase()))
  const forbidden = mustNotInclude.filter((needle) => haystack.includes(String(needle).toLowerCase()))

  return { pass: missing.length === 0 && forbidden.length === 0, missing, forbidden }
}

async function runScenario(scenario) {
  const res = await callClaude(LOGISTICS_SYSTEM_PROMPT, String(scenario.userMessage || ""), {
    model: MODEL,
    maxTokens: 800,
    feature: "ai_eval",
    cacheSystemPrompt: true,
    cacheContext: String(scenario.contextFixture || ""),
  })

  if (res.error || res.data == null) {
    return { status: "ERROR", error: res.error || "No response", missing: [], forbidden: [], answer: "" }
  }

  const verdict = evaluateAnswer(res.data, scenario)
  return {
    status: verdict.pass ? "PASS" : "FAIL",
    error: null,
    missing: verdict.missing,
    forbidden: verdict.forbidden,
    answer: res.data,
  }
}

function pad(value, width) {
  const str = String(value)
  return str.length >= width ? str : str + " ".repeat(width - str.length)
}

function detailFor(result) {
  if (result.status === "ERROR") return `error: ${result.error}`
  const parts = []
  if (result.missing.length > 0) parts.push(`missing: ${result.missing.join(", ")}`)
  if (result.forbidden.length > 0) parts.push(`forbidden present: ${result.forbidden.join(", ")}`)
  return parts.join(" | ") || "ok"
}

async function main() {
  const scenarios = loadScenarios()
  console.log(`\nAI Eval Harness — ${scenarios.length} scenarios — model: ${MODEL} — temperature: 0\n`)

  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("WARNING: ANTHROPIC_API_KEY is not set. Every scenario will report ERROR.\n")
  }

  const idWidth = Math.max(4, ...scenarios.map((s) => String(s.id || "").length))
  const results = []

  console.log(`${pad("#", 3)}  ${pad("RESULT", 6)}  ${pad("ID", idWidth)}  DETAIL`)
  console.log("-".repeat(3 + 2 + 6 + 2 + idWidth + 2 + 40))

  let index = 0
  for (const scenario of scenarios) {
    index += 1
    let result
    try {
      result = await runScenario(scenario)
    } catch (e) {
      result = { status: "ERROR", error: e instanceof Error ? e.message : String(e), missing: [], forbidden: [], answer: "" }
    }
    results.push({ scenario, result })
    console.log(
      `${pad(index, 3)}  ${pad(result.status, 6)}  ${pad(scenario.id || "(no id)", idWidth)}  ${detailFor(result)}`,
    )
  }

  const passed = results.filter((r) => r.result.status === "PASS").length
  const failed = results.filter((r) => r.result.status === "FAIL").length
  const errored = results.filter((r) => r.result.status === "ERROR").length
  const total = results.length
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0

  console.log("\n" + "=".repeat(48))
  console.log(`Score: ${passed} / ${total} passed (${pct}%)   FAIL: ${failed}   ERROR: ${errored}`)
  console.log("=".repeat(48) + "\n")

  // Non-zero exit when anything did not pass, so this is CI-friendly.
  process.exit(passed === total ? 0 : 1)
}

main().catch((e) => {
  originalConsoleError(e)
  process.exit(1)
})
