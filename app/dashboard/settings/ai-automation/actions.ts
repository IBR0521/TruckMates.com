"use server"

import { getCompanyAutomationSettings, getPendingApprovals, updateAutomationConfig } from "@/lib/ai/agent/settings"
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
