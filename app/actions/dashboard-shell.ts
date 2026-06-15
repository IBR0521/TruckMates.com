"use server"

import { getBillingPlanContext, getCompanyPlanUsageSnapshot, getAiQuotaBannerContext } from "@/app/actions/plan-usage"
import { getAiChatPlanContext } from "@/app/actions/ai-chat"
import { getOnboardingTourStatus } from "@/app/actions/onboarding-tour"
import { getEldConnectionCount } from "@/app/actions/eld-wizard"
import { getNotificationSmartDisplayState } from "@/app/actions/user-preferences"
import { getUnreadNotificationCount } from "@/app/actions/notifications"
import { getCachedAuthContext } from "@/lib/auth/server"
import type { AiChatPlanContext } from "@/lib/ai/plan-context"

export type DashboardShellBootstrap = {
  billing: NonNullable<Awaited<ReturnType<typeof getBillingPlanContext>>["data"]>
  usage: NonNullable<Awaited<ReturnType<typeof getCompanyPlanUsageSnapshot>>["data"]>
  aiQuotaBanner: NonNullable<Awaited<ReturnType<typeof getAiQuotaBannerContext>>["data"]>
  aiChatPlan: AiChatPlanContext
  aiChatAllowed: boolean
  onboarding: { completed: boolean; completed_at: string | null }
  currentUser: { id: string; email: string; role: string; company_id: string | null }
  eld: { count: number; limit: number; tier: string }
  notifications: {
    smartUi: boolean
    unreadCount: number
    unreadCountDegraded: boolean
  }
}

/**
 * One server-action round trip for dashboard chrome (header, sidebar, banners).
 * Replaces ~8 separate layout fetches that each paid middleware + auth overhead.
 */
export async function getDashboardShellBootstrap(): Promise<{
  data: DashboardShellBootstrap | null
  error: string | null
}> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId || !ctx.user) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }

  const [
    billingRes,
    usageRes,
    aiQuotaRes,
    aiChatRes,
    onboardingRes,
    eldRes,
    notifDisplayRes,
    unreadRes,
  ] = await Promise.all([
    getBillingPlanContext(),
    getCompanyPlanUsageSnapshot(),
    getAiQuotaBannerContext(),
    getAiChatPlanContext(),
    getOnboardingTourStatus(),
    getEldConnectionCount(),
    getNotificationSmartDisplayState(),
    getUnreadNotificationCount(),
  ])

  if (billingRes.error || !billingRes.data) {
    return { data: null, error: billingRes.error || "Failed to load billing context" }
  }
  if (usageRes.error || !usageRes.data) {
    return { data: null, error: usageRes.error || "Failed to load plan usage" }
  }
  if (aiQuotaRes.error || !aiQuotaRes.data) {
    return { data: null, error: aiQuotaRes.error || "Failed to load AI quota context" }
  }
  if (aiChatRes.error || !aiChatRes.data) {
    return { data: null, error: aiChatRes.error || "Failed to load AI plan context" }
  }
  if (onboardingRes.error || !onboardingRes.data) {
    return { data: null, error: onboardingRes.error || "Failed to load onboarding status" }
  }
  if (eldRes.error || !eldRes.data) {
    return { data: null, error: eldRes.error || "Failed to load ELD connection count" }
  }

  const smartUi = notifDisplayRes.data?.smartUi ?? false
  const unreadDegraded = Boolean(unreadRes.degraded || unreadRes.error)
  const unreadTotal = unreadRes.data?.total ?? 0

  return {
    error: null,
    data: {
      billing: billingRes.data,
      usage: usageRes.data,
      aiQuotaBanner: aiQuotaRes.data,
      aiChatPlan: aiChatRes.data,
      aiChatAllowed: aiChatRes.data.chatAllowed,
      onboarding: {
        completed: onboardingRes.data.completed,
        completed_at: onboardingRes.data.completed_at,
      },
      currentUser: {
        id: ctx.userId,
        email: ctx.user.email,
        role: ctx.user.role,
        company_id: ctx.companyId,
      },
      eld: eldRes.data,
      notifications: {
        smartUi,
        unreadCount: unreadTotal,
        unreadCountDegraded: unreadDegraded,
      },
    },
  }
}
