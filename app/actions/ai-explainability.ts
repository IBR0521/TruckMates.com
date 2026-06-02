"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { safeDbError } from "@/lib/utils/error"
import * as Sentry from "@sentry/nextjs"
import { errorMessage } from "@/lib/error-message"

export type ExplainabilityRow = {
  id: string
  created_at: string
  category: string
  source: string
  recommendation: string
  confidence: number | null
  model: string | null
  data_points: Record<string, unknown> | null
  context_used: unknown
}

export async function listExplainabilityRecords(params?: { limit?: number }) {
  try {
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { data: null, error: ctx.error || "Not authenticated" }
    const supabase = await createClient()
    const limit = Math.min(Math.max(params?.limit || 50, 1), 200)

    const { data, error } = await supabase
      .from("ai_recommendation_explainability")
      .select("id, created_at, category, source, recommendation, confidence, model, data_points, context_used")
      .eq("company_id", ctx.companyId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) return { data: null, error: safeDbError(error) }
    return { data: (data || []) as ExplainabilityRow[], error: null }
  } catch (e: unknown) {
    Sentry.captureException(e)
    return { data: null, error: errorMessage(e, "Failed to load AI explainability records") }
  }
}

export async function getExplainabilityRecord(id: string) {
  try {
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { data: null, error: ctx.error || "Not authenticated" }
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("ai_recommendation_explainability")
      .select("*")
      .eq("company_id", ctx.companyId)
      .eq("id", id)
      .maybeSingle()

    if (error || !data) return { data: null, error: error ? safeDbError(error) : "Not found" }
    return { data: data as Record<string, unknown>, error: null }
  } catch (e: unknown) {
    Sentry.captureException(e)
    return { data: null, error: errorMessage(e, "Failed to load record") }
  }
}

