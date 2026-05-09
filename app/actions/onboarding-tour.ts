"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { safeDbError } from "@/lib/utils/error"

export async function getOnboardingTourStatus() {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.userId || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const { data, error } = await supabase
    .from("users")
    .select("id, onboarding_tour_completed, onboarding_tour_completed_at")
    .eq("id", ctx.userId)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (error) return { error: safeDbError(error, "Failed to load onboarding tour status"), data: null }
  const userTourData = data as {
    onboarding_tour_completed?: boolean | null
    onboarding_tour_completed_at?: string | null
  } | null
  return {
    error: null,
    data: {
      completed: Boolean(userTourData?.onboarding_tour_completed),
      completed_at: userTourData?.onboarding_tour_completed_at || null,
    },
  }
}

export async function markOnboardingTourCompleted() {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.userId || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const { error } = await supabase
    .from("users")
    .update({
      onboarding_tour_completed: true,
      onboarding_tour_completed_at: new Date().toISOString(),
    } as Record<string, unknown>)
    .eq("id", ctx.userId)
    .eq("company_id", ctx.companyId)

  if (error) return { error: safeDbError(error, "Failed to update onboarding tour status"), data: null }
  return { error: null, data: { success: true } }
}

export async function resetOnboardingTour() {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.userId || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const { error } = await supabase
    .from("users")
    .update({
      onboarding_tour_completed: false,
      onboarding_tour_completed_at: null,
    } as Record<string, unknown>)
    .eq("id", ctx.userId)
    .eq("company_id", ctx.companyId)

  if (error) return { error: safeDbError(error, "Failed to reset onboarding tour status"), data: null }
  return { error: null, data: { success: true } }
}
