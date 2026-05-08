import { getCachedAuthContext } from "@/lib/auth/server"
import { mapLegacyRole } from "@/lib/roles"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import type { AutomationLevel } from "@/lib/ai/types"
import type { AutomationConfig, AutomationLog, PendingApproval } from "@/lib/ai/agent/types"

type DefaultAutomationConfig = {
  level: AutomationLevel
  confidenceThreshold: number
  enabled: boolean
  config: Record<string, unknown>
}

const MANAGER_ROLES = new Set(["super_admin", "operations_manager"])

export const DEFAULT_AUTOMATION_CONFIGS: Record<string, DefaultAutomationConfig> = {
  load_status_auto_update: { level: "autonomous", confidenceThreshold: 80, enabled: true, config: {} },
  detention_clock: { level: "autonomous", confidenceThreshold: 75, enabled: true, config: {} },
  hos_violation_prevention: { level: "autonomous", confidenceThreshold: 70, enabled: true, config: {} },
  driver_assignment: { level: "approval", confidenceThreshold: 75, enabled: true, config: {} },
  backhaul_matching: { level: "approval", confidenceThreshold: 70, enabled: true, config: {} },
  predictive_maintenance: { level: "approval", confidenceThreshold: 72, enabled: true, config: {} },
  invoice_auto_generation: { level: "autonomous", confidenceThreshold: 85, enabled: true, config: {} },
  payment_followup: { level: "autonomous", confidenceThreshold: 80, enabled: true, config: {} },
  credit_hold: { level: "approval", confidenceThreshold: 90, enabled: true, config: {} },
  document_expiry_alert: { level: "autonomous", confidenceThreshold: 100, enabled: true, config: {} },
  csa_threshold_alert: { level: "autonomous", confidenceThreshold: 100, enabled: true, config: {} },
  fuel_anomaly: { level: "autonomous", confidenceThreshold: 75, enabled: true, config: {} },
  idle_time_alert: { level: "autonomous", confidenceThreshold: 80, enabled: true, config: {} },
  unresponsive_driver: { level: "autonomous", confidenceThreshold: 85, enabled: true, config: {} },
  churn_risk: { level: "approval", confidenceThreshold: 65, enabled: true, config: {} },
  cash_flow_alert: { level: "autonomous", confidenceThreshold: 80, enabled: true, config: {} },
}

type AutomationConfigRow = {
  id: string
  company_id: string
  automation_type: string
  level: string
  enabled: boolean
  confidence_threshold: number
  config: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

type PendingApprovalRow = {
  id: string
  company_id: string
  automation_type: string
  description: string
  confidence: number
  reasoning: string
  action_payload: Record<string, unknown> | null
  expires_at: string
  created_at: string
}

function clampThreshold(value: unknown, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(100, Math.max(0, Math.round(parsed)))
}

function toAutomationLevel(value: unknown, fallback: AutomationLevel): AutomationLevel {
  const candidate = String(value || "").toLowerCase()
  if (candidate === "off" || candidate === "notify" || candidate === "approval" || candidate === "autonomous") {
    return candidate
  }
  return fallback
}

function buildDefaultConfig(companyId: string, automationType: string): AutomationConfig {
  const now = new Date(0).toISOString()
  const defaults = DEFAULT_AUTOMATION_CONFIGS[automationType] || {
    level: "notify" as AutomationLevel,
    confidenceThreshold: 70,
    enabled: true,
    config: {},
  }

  return {
    id: `default:${companyId}:${automationType}`,
    companyId,
    automationType,
    level: defaults.level,
    enabled: defaults.enabled,
    confidenceThreshold: defaults.confidenceThreshold,
    config: defaults.config,
    createdAt: now,
    updatedAt: now,
  }
}

function mapAutomationConfigRow(row: AutomationConfigRow): AutomationConfig {
  const defaultConfig = buildDefaultConfig(row.company_id, row.automation_type)

  return {
    id: row.id,
    companyId: row.company_id,
    automationType: row.automation_type,
    level: toAutomationLevel(row.level, defaultConfig.level),
    enabled: Boolean(row.enabled),
    confidenceThreshold: clampThreshold(row.confidence_threshold, defaultConfig.confidenceThreshold),
    config: (row.config || {}) as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapPendingApprovalRow(row: PendingApprovalRow): PendingApproval {
  return {
    id: row.id,
    companyId: row.company_id,
    automationType: row.automation_type,
    description: row.description,
    confidence: row.confidence,
    reasoning: row.reasoning,
    actionPayload: (row.action_payload || {}) as Record<string, unknown>,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }
}

export async function getCompanyAutomationSettings(
  companyId: string
): Promise<{ data: AutomationConfig[]; error: string | null }> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("ai_automation_configs")
      .select("id, company_id, automation_type, level, enabled, confidence_threshold, config, created_at, updated_at")
      .eq("company_id", companyId)

    if (error) return { data: [], error: error.message || "Failed to load automation settings" }

    const rows = ((data || []) as unknown as AutomationConfigRow[]).map(mapAutomationConfigRow)
    const byType = new Map<string, AutomationConfig>()
    for (const row of rows) byType.set(row.automationType, row)

    for (const automationType of Object.keys(DEFAULT_AUTOMATION_CONFIGS)) {
      if (!byType.has(automationType)) {
        byType.set(automationType, buildDefaultConfig(companyId, automationType))
      }
    }

    return {
      data: [...byType.values()].sort((a, b) => a.automationType.localeCompare(b.automationType)),
      error: null,
    }
  } catch (error: unknown) {
    return { data: [], error: error instanceof Error ? error.message : "Failed to load automation settings" }
  }
}

export async function getAutomationConfig(
  companyId: string,
  automationType: string
): Promise<{ data: AutomationConfig | null; error: string | null }> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("ai_automation_configs")
      .select("id, company_id, automation_type, level, enabled, confidence_threshold, config, created_at, updated_at")
      .eq("company_id", companyId)
      .eq("automation_type", automationType)
      .maybeSingle()

    if (error) return { data: null, error: error.message || "Failed to load automation config" }
    if (!data) return { data: buildDefaultConfig(companyId, automationType), error: null }

    return { data: mapAutomationConfigRow(data as unknown as AutomationConfigRow), error: null }
  } catch (error: unknown) {
    return { data: null, error: error instanceof Error ? error.message : "Failed to load automation config" }
  }
}

export async function updateAutomationConfig(
  companyId: string,
  automationType: string,
  updates: Partial<Pick<AutomationConfig, "level" | "enabled" | "confidenceThreshold" | "config">>
): Promise<{ error: string | null }> {
  try {
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.user || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated" }
    }

    if (ctx.companyId !== companyId) {
      return { error: "Cannot modify another company's settings" }
    }

    const role = mapLegacyRole(ctx.user.role)
    if (!MANAGER_ROLES.has(role)) {
      return { error: "Only super admins and operations managers can modify automation settings" }
    }

    const fallback = buildDefaultConfig(companyId, automationType)
    const supabase = createAdminClient()
    const { error } = await supabase.from("ai_automation_configs").upsert(
      {
        company_id: companyId,
        automation_type: automationType,
        level: toAutomationLevel(updates.level, fallback.level),
        enabled: typeof updates.enabled === "boolean" ? updates.enabled : fallback.enabled,
        confidence_threshold: clampThreshold(updates.confidenceThreshold, fallback.confidenceThreshold),
        config: (updates.config || fallback.config) as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id,automation_type" }
    )

    if (error) return { error: error.message || "Failed to update automation config" }
    return { error: null }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : "Failed to update automation config" }
  }
}

export async function logAutomationEvent(
  log: Omit<AutomationLog, "id" | "createdAt">
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("ai_automation_logs")
      .insert({
        company_id: log.companyId,
        automation_type: log.automationType,
        level: log.level,
        triggered: log.triggered,
        confidence: clampThreshold(log.confidence, 0),
        reasoning: log.reasoning,
        action_taken: log.actionTaken,
        action_payload: log.actionPayload,
        approved: log.approved,
        reversed_at: log.reversedAt,
      })
      .select("id")
      .single()

    if (error || !data) {
      return { data: null, error: error?.message || "Failed to log automation event" }
    }

    return { data: { id: String((data as { id: string }).id) }, error: null }
  } catch (error: unknown) {
    return { data: null, error: error instanceof Error ? error.message : "Failed to log automation event" }
  }
}

export async function getPendingApprovals(
  companyId: string
): Promise<{ data: PendingApproval[]; error: string | null }> {
  try {
    const supabase = await createClient()
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from("ai_pending_approvals")
      .select("id, company_id, automation_type, description, confidence, reasoning, action_payload, expires_at, created_at")
      .eq("company_id", companyId)
      .is("resolved_at", null)
      .gt("expires_at", now)
      .order("created_at", { ascending: false })

    if (error) return { data: [], error: error.message || "Failed to load pending approvals" }

    return {
      data: ((data || []) as unknown as PendingApprovalRow[]).map(mapPendingApprovalRow),
      error: null,
    }
  } catch (error: unknown) {
    return { data: [], error: error instanceof Error ? error.message : "Failed to load pending approvals" }
  }
}

export async function createPendingApproval(
  approval: Omit<PendingApproval, "id" | "expiresAt" | "createdAt">
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    const supabase = createAdminClient()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from("ai_pending_approvals")
      .insert({
        company_id: approval.companyId,
        automation_type: approval.automationType,
        description: approval.description,
        confidence: clampThreshold(approval.confidence, 0),
        reasoning: approval.reasoning,
        action_payload: approval.actionPayload,
        expires_at: expiresAt,
      })
      .select("id")
      .single()

    if (error || !data) {
      return { data: null, error: error?.message || "Failed to create pending approval" }
    }

    return { data: { id: String((data as { id: string }).id) }, error: null }
  } catch (error: unknown) {
    return { data: null, error: error instanceof Error ? error.message : "Failed to create pending approval" }
  }
}

export async function resolveApproval(
  approvalId: string,
  approved: boolean
): Promise<{ error: string | null }> {
  try {
    const supabase = createAdminClient()
    const { error } = await supabase
      .from("ai_pending_approvals")
      .update({
        approved,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", approvalId)

    if (error) return { error: error.message || "Failed to resolve approval" }
    return { error: null }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : "Failed to resolve approval" }
  }
}
