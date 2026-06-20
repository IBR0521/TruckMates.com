import { checkMonthlyUsage, getCompanyTier } from "@/lib/plan-enforcement"
import {
  type PlanTier,
  hasFeatureAccess,
  minimumTierForFeature,
  planTierLabel,
} from "@/lib/plan-limits"

/** Short badge labels used in sidebar locks (matches existing NavItem convention). */
export function planTierBadgeLabel(tier: PlanTier): string {
  switch (tier) {
    case "owner_operator":
      return "OO"
    case "starter":
      return "Starter"
    case "professional":
      return "Pro"
    case "fleet":
      return "Fleet"
    case "enterprise":
      return "Enterprise"
    default:
      return planTierLabel(tier)
  }
}

export type AiChatPlanContext = {
  /** Resolved from `companies.subscription_tier` via `getCompanyTier`. */
  tier: PlanTier
  tierLabel: string
  chatAllowed: boolean
  /** True when tier includes `ai_advanced_actions`. */
  enableTools: boolean
  remainingAiCalls: number
  /** Banner copy for the AI assistant panel. */
  actionsModeLabel: string
  /** Sidebar lock badge when actions are unavailable; null when actions are enabled. */
  sidebarLockBadge: string | null
  minimumActionsTier: PlanTier
  minimumActionsTierBadge: string
}

/**
 * Single source of truth for AI chat plan tier + action-tool eligibility.
 * Used by assertAiChatAllowed, buildChatRequest companyTier, UI banners, and sidebar badges.
 */
export async function resolveAiChatPlanContext(companyId: string): Promise<AiChatPlanContext> {
  const [tier, usage] = await Promise.all([
    getCompanyTier(companyId),
    checkMonthlyUsage({ companyId, usageType: "ai_calls" }),
  ])
  const chatAllowed = hasFeatureAccess(tier, "ai_chat")
  const enableTools = hasFeatureAccess(tier, "ai_advanced_actions")
  const remainingAiCalls = usage.limit === -1 ? -1 : Math.max(0, usage.limit - usage.used)
  const tierBadge = planTierBadgeLabel(tier)
  const minimumActionsTier = minimumTierForFeature("ai_advanced_actions")
  const minimumActionsTierBadge = planTierBadgeLabel(minimumActionsTier)

  const actionsModeLabel = enableTools
    ? `Actions enabled (${tierBadge})`
    : `Read-only answers (${tierBadge})`

  return {
    tier,
    tierLabel: planTierLabel(tier),
    chatAllowed,
    enableTools,
    remainingAiCalls,
    actionsModeLabel,
    sidebarLockBadge: enableTools ? null : minimumActionsTierBadge,
    minimumActionsTier,
    minimumActionsTierBadge,
  }
}

/** Whether the company's tier includes AI action tools (ignores role / tool registry). */
export function companyTierSupportsAiActions(tier: PlanTier): boolean {
  return hasFeatureAccess(tier, "ai_advanced_actions")
}
