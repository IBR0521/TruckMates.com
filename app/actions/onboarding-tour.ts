"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"

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

  if (error) return { error: error.message, data: null }
  return {
    error: null,
    data: {
      completed: Boolean((data as any)?.onboarding_tour_completed),
      completed_at: (data as any)?.onboarding_tour_completed_at || null,
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
    } as any)
    .eq("id", ctx.userId)
    .eq("company_id", ctx.companyId)

  if (error) return { error: error.message, data: null }
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
    } as any)
    .eq("id", ctx.userId)
    .eq("company_id", ctx.companyId)

  if (error) return { error: error.message, data: null }
  return { error: null, data: { success: true } }
}
