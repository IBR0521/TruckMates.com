import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { callClaude } from "@/lib/ai/client"
import { upsertCompanyMemory, type CompanyMemoryKind } from "@/lib/ai/context"
import { createAdminClient } from "@/lib/supabase/admin"
import { databaseErrorMessage, errorMessage } from "@/lib/error-message"

/** Long-running batch (scans + distills across companies). */
export const maxDuration = 300

type CompanyRow = { id: string }

/** Look back this far over chat messages when distilling durable patterns. */
const LOOKBACK_DAYS = 7
/** Skip companies with fewer than this many recent user questions (not enough signal). */
const MIN_USER_MESSAGES = 5
/** Bound transcript size fed to the model (cost + latency control). */
const MAX_MESSAGES = 150
const MAX_MESSAGE_CHARS = 300
/** Cap how many entries we persist per kind per run. */
const MAX_PER_KIND = 6

const DISTILL_SYSTEM = `You distill DURABLE, reusable patterns from a single trucking company's recent AI chat questions. Output ONLY patterns that would help answer this company's FUTURE questions. Never copy full messages or one-off details.

Return ONLY valid JSON (no markdown, no commentary):
{
  "aliases": [ { "alias": "shorthand the user uses", "canonical": "the real entity/term it maps to" } ],
  "recurring_questions": [ { "topic": "2-4 word slug", "question": "a representative phrasing they ask repeatedly" } ],
  "preferences": [ { "label": "2-4 word slug", "detail": "a stable preference or working style they've expressed" } ]
}

Rules:
- Include a pattern ONLY if it is repeated or clearly stable. Skip one-offs and ephemeral details.
- aliases: nicknames/shorthand for drivers, customers, trucks, or lanes (e.g. "big mike" -> "driver Mike Reynolds"; "the Dallas run" -> "Chicago to Dallas lane").
- Keep every value under ~25 words. At most 6 items per array. Empty arrays are valid and expected when there is no stable pattern.
- Never invent facts; distill only what is evident across the messages.`

type DistillResult = {
  aliases: Array<{ alias: string; canonical: string }>
  recurring_questions: Array<{ topic: string; question: string }>
  preferences: Array<{ label: string; detail: string }>
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function str(value: unknown): string {
  return String(value ?? "").trim()
}

function parseDistillResult(raw: unknown): DistillResult {
  const o = toRecord(raw)
  const aliases: DistillResult["aliases"] = []
  const recurring: DistillResult["recurring_questions"] = []
  const preferences: DistillResult["preferences"] = []

  if (Array.isArray(o.aliases)) {
    for (const item of o.aliases) {
      const r = toRecord(item)
      const alias = str(r.alias)
      const canonical = str(r.canonical)
      if (alias && canonical) aliases.push({ alias, canonical })
    }
  }
  if (Array.isArray(o.recurring_questions)) {
    for (const item of o.recurring_questions) {
      const r = toRecord(item)
      const topic = str(r.topic)
      const question = str(r.question)
      if (topic && question) recurring.push({ topic, question })
    }
  }
  if (Array.isArray(o.preferences)) {
    for (const item of o.preferences) {
      const r = toRecord(item)
      const label = str(r.label)
      const detail = str(r.detail)
      if (label && detail) preferences.push({ label, detail })
    }
  }

  return { aliases, recurring_questions: recurring, preferences }
}

async function processCompany(companyId: string): Promise<"distilled" | "skipped" | "failed"> {
  const admin = createAdminClient()
  const sinceIso = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data: messagesRaw, error: msgErr } = await admin
    .from("ai_chat_messages")
    .select("content, created_at")
    .eq("company_id", companyId)
    .eq("role", "user")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(MAX_MESSAGES)

  if (msgErr) return "failed"

  const messages = ((messagesRaw || []) as Array<{ content?: string | null }>)
    .map((m) => str(m.content).slice(0, MAX_MESSAGE_CHARS))
    .filter(Boolean)

  if (messages.length < MIN_USER_MESSAGES) return "skipped"

  const transcript = messages.map((m, i) => `${i + 1}. ${m}`).join("\n")
  const userBlock = [
    "Recent user questions from this company's AI chat (most recent first):",
    transcript,
    "",
    "Distill durable, reusable patterns per the JSON schema. Use empty arrays when nothing is stable.",
  ].join("\n")

  const res = await callClaude<Record<string, unknown>>(DISTILL_SYSTEM, userBlock, {
    expectJson: true,
    model: "haiku",
    maxTokens: 1024,
    feature: "ai_company_memory_distill",
    companyId,
    cacheSystemPrompt: true,
  })

  if (res.error || !res.data) return "failed"

  const distilled = parseDistillResult(res.data)

  const writes: Array<{ kind: CompanyMemoryKind; key: string; value: string }> = []
  for (const a of distilled.aliases.slice(0, MAX_PER_KIND)) {
    writes.push({ kind: "alias", key: a.alias.toLowerCase(), value: a.canonical })
  }
  for (const q of distilled.recurring_questions.slice(0, MAX_PER_KIND)) {
    writes.push({ kind: "recurring_question", key: q.topic.toLowerCase(), value: q.question })
  }
  for (const p of distilled.preferences.slice(0, MAX_PER_KIND)) {
    writes.push({ kind: "note", key: p.label.toLowerCase(), value: p.detail })
  }

  if (writes.length === 0) return "skipped"

  for (const w of writes) {
    await upsertCompanyMemory({ companyId, kind: w.kind, key: w.key, value: w.value })
  }

  return "distilled"
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const vercelCronHeader = request.headers.get("x-vercel-cron")
  const cronSecret = process.env.CRON_SECRET

  const isAuthorizedBySecret = !!cronSecret && authHeader === `Bearer ${cronSecret}`
  const isAuthorizedByVercelCron = !!vercelCronHeader
  if (!isAuthorizedBySecret && !isAuthorizedByVercelCron) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const admin = createAdminClient()
    // Owner-Operator tier has no AI chat, so there is nothing to distill for them.
    const { data: companiesRaw, error: companiesErr } = await admin
      .from("companies")
      .select("id")
      .in("subscription_status", ["active", "trial"])
      .neq("subscription_tier", "owner_operator")

    if (companiesErr) {
      return NextResponse.json(
        { error: databaseErrorMessage(companiesErr, "Failed to load companies") },
        { status: 500 },
      )
    }

    const companies = ((companiesRaw || []) as CompanyRow[]).filter((r) => r.id)

    let distilled = 0
    let skipped = 0
    let failed = 0

    for (const company of companies) {
      try {
        const outcome = await processCompany(company.id)
        if (outcome === "distilled") distilled += 1
        else if (outcome === "skipped") skipped += 1
        else failed += 1
      } catch (err: unknown) {
        failed += 1
        Sentry.captureException(err, { extra: { companyId: company.id } })
      }
    }

    return NextResponse.json({
      success: true,
      processed: companies.length,
      distilled,
      skipped,
      failed,
    })
  } catch (error: unknown) {
    Sentry.captureException(error)
    return NextResponse.json(
      { success: false, error: errorMessage(error, "distill-company-memory cron failed") },
      { status: 500 },
    )
  }
}
