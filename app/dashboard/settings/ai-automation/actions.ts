"use server"

import {
  DEFAULT_AUTOMATION_CONFIGS,
  getCompanyAutomationSettings,
  getPendingApprovals,
  updateAutomationConfig,
} from "@/lib/ai/agent/settings"
import { getCachedAuthContext } from "@/lib/auth/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { levelForPreset, isAutonomyPreset, type AutonomyPreset } from "@/lib/ai/agent/autonomy-presets"
import type { AutomationConfig } from "@/lib/ai/agent/types"

export async function loadCompanyAutomationSettings(companyId: string) {
  return getCompanyAutomationSettings(companyId)
}

export async function saveAutomationConfig(
  companyId: string,
  automationType: string,
  updates: Partial<Pick<AutomationConfig, "level" | "enabled" | "confidenceThreshold" | "config">>,
) {
  return updateAutomationConfig(companyId, automationType, updates)
}

export async function loadPendingAiApprovals(companyId: string) {
  return getPendingApprovals(companyId)
}

/**
 * One-click autopilot: apply an autonomy preset to every automation at once instead of configuring
 * ~16 individually. The company is taken from the session (never a client arg); manager-role, plan,
 * and cross-tenant checks are enforced per automation by updateAutomationConfig.
 */
export async function applyAutonomyPreset(preset: AutonomyPreset) {
  if (!isAutonomyPreset(preset)) {
    return { data: null, error: "Invalid autopilot preset" }
  }
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }

  const automationTypes = Object.keys(DEFAULT_AUTOMATION_CONFIGS)
  let applied = 0
  let firstError: string | null = null
  for (const automationType of automationTypes) {
    const res = await updateAutomationConfig(ctx.companyId, automationType, {
      level: levelForPreset(automationType, preset),
      enabled: true,
    })
    if (res.error) firstError = firstError ?? res.error
    else applied += 1
  }

  // Deterministic cascade (runs with or without the AI agent). Autopilot also turns on rules-based
  // auto-dispatch — assign the best HOS- and maintenance-aware driver when a load is ready — and the
  // notification chain, so the whole flow is hands-off. Assisted keeps dispatch manual (driver
  // assignment stays "approval"). Best-effort: a failure here must not undo the automation levels.
  try {
    const notify = preset !== "manual"
    await createAdminClient()
      .from("company_settings")
      .update({
        auto_dispatch_on_ready: preset === "autopilot",
        notify_on_status_change: notify,
        notify_driver_on_assignment: notify,
        notify_on_delivery: notify,
        notify_on_delivery_delay: notify,
        consider_driver_hours: true,
        consider_truck_maintenance: true,
      })
      .eq("company_id", ctx.companyId)
  } catch {
    // Non-fatal — the automation levels above are the primary outcome.
  }

  if (applied === 0 && firstError) {
    return { data: null, error: firstError }
  }
  return { data: { preset, applied, total: automationTypes.length }, error: null }
}
