import { createHash } from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import type { AiChatContextType } from "@/lib/ai/chat"

/**
 * Short-TTL cache for READ-ONLY AI chat answers (no tool mutations involved).
 *
 * Key = sha256(company_id + normalized question + conversation-history fingerprint + context-version
 * hash). The context-version hash folds in a per-(company, context_type) counter so that when
 * underlying data changes (e.g. an invoice write bumps "financial"), the key changes and the prior
 * answer is bypassed — lazy invalidation, no row deletes required. Strictly company-scoped: the
 * company_id is part of both the key and every query, so answers are never shared across companies.
 */

/** Default time-to-live for a cached answer. */
export const AI_ANSWER_CACHE_TTL_MS = 10 * 60 * 1000

type AdminClient = ReturnType<typeof createAdminClient>

/** Lowercase, collapse whitespace, strip surrounding punctuation so trivially-different phrasings match. */
export function normalizeQuestion(question: string): string {
  return String(question || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^[\s"'`.!?,;:]+|[\s"'`.!?,;:]+$/g, "")
    .trim()
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex")
}

/**
 * Fingerprint of the prior conversation so a follow-up like "and the second one?" never reuses an
 * answer computed under a different conversation state. Empty history (fresh question) yields a
 * stable empty fingerprint, which is what lets identical standalone questions share a cache entry.
 */
export function conversationFingerprint(history: Array<{ role: string; content: string }>): string {
  if (!history || history.length === 0) return ""
  const joined = history.map((m) => `${m.role}:${m.content}`).join("\n")
  return sha256(joined)
}

/**
 * Hash of the current versions of the involved context types. Missing rows count as version 0, so a
 * never-touched company still produces a stable hash. Sorted for determinism.
 */
export async function computeContextVersionHash(
  admin: AdminClient,
  companyId: string,
  contextTypes: AiChatContextType[],
): Promise<string> {
  const types = [...new Set(contextTypes)].sort()
  if (types.length === 0) return sha256("no-context")

  const versionByType = new Map<string, number>()
  try {
    const { data } = await admin
      .from("ai_context_versions")
      .select("context_type, version")
      .eq("company_id", companyId)
      .in("context_type", types)
    for (const row of (data || []) as Array<{ context_type?: string; version?: number }>) {
      versionByType.set(String(row.context_type || ""), Number(row.version || 0))
    }
  } catch {
    // On error, fall back to version 0 for all — correctness is preserved (just no cross-version reuse).
  }

  const parts = types.map((t) => `${t}:${versionByType.get(t) ?? 0}`)
  return sha256(parts.join("|"))
}

export function buildAnswerCacheKey(params: {
  companyId: string
  normalizedQuestion: string
  historyFingerprint: string
  contextVersionHash: string
}): string {
  return sha256(
    [params.companyId, params.normalizedQuestion, params.historyFingerprint, params.contextVersionHash].join("::"),
  )
}

export type CachedAnswer = { answer: string; contextUsed: string[] }

/** Returns a non-expired cached answer for this company+key, or null. */
export async function getCachedAnswer(params: {
  companyId: string
  cacheKey: string
}): Promise<CachedAnswer | null> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from("ai_answer_cache")
      .select("answer, context_used, expires_at")
      .eq("company_id", params.companyId)
      .eq("cache_key", params.cacheKey)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle()

    if (error || !data) return null
    const row = data as { answer?: string; context_used?: unknown }
    const answer = String(row.answer || "")
    if (!answer) return null
    const contextUsed = Array.isArray(row.context_used) ? (row.context_used as unknown[]).map(String) : []
    return { answer, contextUsed }
  } catch {
    return null
  }
}

/** Stores a read-only answer with a TTL. Best-effort; never throws. */
export async function setCachedAnswer(params: {
  companyId: string
  cacheKey: string
  question: string
  contextTypes: AiChatContextType[]
  answer: string
  contextUsed: string[]
  ttlMs?: number
}): Promise<void> {
  try {
    if (!params.answer.trim()) return
    const admin = createAdminClient()
    const ttl = params.ttlMs && params.ttlMs > 0 ? params.ttlMs : AI_ANSWER_CACHE_TTL_MS
    const expiresAt = new Date(Date.now() + ttl).toISOString()

    await admin.from("ai_answer_cache").upsert(
      {
        company_id: params.companyId,
        cache_key: params.cacheKey,
        question: params.question.slice(0, 2000),
        context_types: [...new Set(params.contextTypes)],
        answer: params.answer,
        context_used: params.contextUsed,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
      },
      { onConflict: "company_id,cache_key" },
    )

    // Opportunistic cleanup of this company's expired rows to keep the table lean.
    void admin
      .from("ai_answer_cache")
      .delete()
      .eq("company_id", params.companyId)
      .lt("expires_at", new Date().toISOString())
  } catch {
    // Best-effort only.
  }
}

/**
 * Invalidate cached answers for a context type by bumping its version (changes future cache keys).
 * Call from write paths, e.g. `invalidateAiContextCache(companyId, "financial")` after an invoice write.
 * Best-effort and fire-and-forget safe; never throws.
 */
export async function invalidateAiContextCache(
  companyId: string,
  contextType: AiChatContextType,
): Promise<void> {
  try {
    if (!companyId) return
    const admin = createAdminClient()
    await admin.rpc("bump_ai_context_version", { p_company_id: companyId, p_context_type: contextType })
    // Also proactively drop matching cached rows so the table doesn't accumulate stale entries.
    void admin
      .from("ai_answer_cache")
      .delete()
      .eq("company_id", companyId)
      .contains("context_types", [contextType])
  } catch {
    // Best-effort only.
  }
}
