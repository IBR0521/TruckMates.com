import type { EmployeeRole } from "@/lib/roles"
import type { PlanTier } from "@/lib/plan-limits"

/** Alias for RBAC in AI tools (six-role system). */
export type AppRole = EmployeeRole

export type AiToolContext = {
  companyId: string
  userId: string
  userRole: AppRole
}

/** Anthropic-compatible JSON-schema subset for tools. */
export type AiToolJsonSchema = {
  type: "object"
  properties: Record<string, unknown>
  required?: string[]
}

export type AiToolExecuteResult<TOutput> =
  | { ok: true; data: TOutput }
  | { ok: false; error: string }

export type AiToolPreviewSuccess = {
  summary: string
  affected: Array<{ type: string; id: string; label: string }>
  /**
   * Optional draft tool input to persist for confirmation. Used when the preview step computes
   * a plan (or other large artifact) that the execute step must reuse exactly on approval.
   */
  draftInput?: Record<string, unknown>
}

/** Preview could not produce a confirmable plan — must not create a pending_confirmation row. */
export type AiToolPreviewBlocked = {
  blocked: true
  reason: string
}

export type AiToolPreviewResult = AiToolPreviewSuccess | AiToolPreviewBlocked

export function isPreviewBlocked(preview: AiToolPreviewResult): preview is AiToolPreviewBlocked {
  return "blocked" in preview && preview.blocked === true
}

export function blockedPreview(reason: string): AiToolPreviewBlocked {
  return { blocked: true, reason }
}

export type AiToolDefinitionBase = {
  name: string
  description: string
  input_schema: AiToolJsonSchema
  requires_confirmation: boolean
  /** Roles allowed to invoke this tool (any match). */
  allowed_roles: AppRole[]
  /** Minimum subscription tier (Professional+ for mutations per product). */
  minimum_plan_tier: PlanTier
  /** When true, executor always stages confirmation (financial safety). */
  force_confirmation?: boolean
  /** When set, tool is omitted from the model's tool list unless this returns true. */
  feature_flag?: () => boolean
  execute: (input: Record<string, unknown>, ctx: AiToolContext) => Promise<AiToolExecuteResult<unknown>>
  preview: (input: Record<string, unknown>, ctx: AiToolContext) => Promise<AiToolPreviewResult>
}
