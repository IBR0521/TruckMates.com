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

export type AiToolPreviewResult = {
  summary: string
  affected: Array<{ type: string; id: string; label: string }>
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
  execute: (input: Record<string, unknown>, ctx: AiToolContext) => Promise<AiToolExecuteResult<unknown>>
  preview: (input: Record<string, unknown>, ctx: AiToolContext) => Promise<AiToolPreviewResult>
}
