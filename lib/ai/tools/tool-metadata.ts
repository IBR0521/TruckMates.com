import type { PlanTier } from "@/lib/plan-limits"
import type { AiToolJsonSchema, AppRole } from "@/lib/ai/tools/types"
import { isAiDispatchPlannerExperimentalEnabled } from "@/lib/ai/feature-flags"

/** Office roles that may use read-only analysis tools (excludes driver). */
const OFFICE_ANALYSIS_ROLES: AppRole[] = [
  "super_admin",
  "operations_manager",
  "dispatcher",
  "safety_compliance",
  "financial_controller",
]

/** Dispatch-style mutations (loads, assignment, SMS, driver status). */
const DISPATCH_ROLES: AppRole[] = ["super_admin", "operations_manager", "dispatcher"]

/** Invoice / payment tools. */
const FINANCE_ROLES: AppRole[] = ["super_admin", "operations_manager", "financial_controller"]

/** Maintenance scheduling and completion. */
const MAINTENANCE_ROLES: AppRole[] = ["super_admin", "operations_manager", "dispatcher", "safety_compliance"]

export type AiToolMetadata = {
  name: string
  description: string
  input_schema: AiToolJsonSchema
  requires_confirmation: boolean
  force_confirmation?: boolean
  allowed_roles: AppRole[]
  minimum_plan_tier: PlanTier
  feature_flag?: () => boolean
}

export const AI_TOOL_METADATA: AiToolMetadata[] = [
  {
    name: "dispatch_planner_experimental",
    description:
      "EXPERIMENTAL (Fleet only). Propose a multi-load dispatch assignment plan for unassigned loads using available drivers (HOS/endorsements) and trucks, then apply it only after explicit user confirmation.",
    input_schema: { type: "object", properties: {}, required: [] },
    requires_confirmation: true,
    force_confirmation: true,
    allowed_roles: DISPATCH_ROLES,
    minimum_plan_tier: "fleet",
    feature_flag: isAiDispatchPlannerExperimentalEnabled,
  },
  {
    name: "create_load",
    description:
      "Create a new freight load. Required: pickup_location and delivery_location (e.g. \"Chicago, IL\" → \"Dallas, TX\"). Optional: customer_id (UUID), pickup_date/delivery_date (YYYY-MM-DD), rate_usd, weight_lbs, commodity, notes. Requires user confirmation.",
    input_schema: {
      type: "object",
      properties: {
        customer_id: { type: "string", description: "Customer UUID or empty if not linked yet." },
        pickup_location: { type: "string" },
        delivery_location: { type: "string" },
        pickup_date: { type: "string", description: "ISO date YYYY-MM-DD or empty." },
        delivery_date: { type: "string", description: "ISO date YYYY-MM-DD or empty." },
        rate_usd: { type: "number" },
        weight_lbs: { type: "number" },
        commodity: { type: "string" },
        notes: { type: "string" },
      },
      required: ["pickup_location", "delivery_location"],
    },
    requires_confirmation: true,
    allowed_roles: DISPATCH_ROLES,
    minimum_plan_tier: "professional",
  },
  {
    name: "assign_driver_to_load",
    description:
      "Assign a driver to a load (dispatch assignment). Inputs: load_id (UUID), driver_id (UUID). Requires user confirmation.",
    input_schema: {
      type: "object",
      properties: { load_id: { type: "string" }, driver_id: { type: "string" } },
      required: ["load_id", "driver_id"],
    },
    requires_confirmation: true,
    allowed_roles: DISPATCH_ROLES,
    minimum_plan_tier: "professional",
  },
  {
    name: "update_load_status",
    description:
      "Change a load's status. Inputs: load_id (UUID), new_status (one of pending, confirmed, in_transit, delivered, cancelled, invoiced, paid). Confirmation is required for the terminal statuses delivered and cancelled; all other transitions execute immediately.",
    input_schema: {
      type: "object",
      properties: { load_id: { type: "string" }, new_status: { type: "string" } },
      required: ["load_id", "new_status"],
    },
    requires_confirmation: false,
    allowed_roles: DISPATCH_ROLES,
    minimum_plan_tier: "professional",
  },
  {
    name: "copy_load",
    description:
      "Duplicate an existing load into a new record. Inputs: source_load_id (UUID); optional new_pickup_date (YYYY-MM-DD) to set the copy's pickup. Requires user confirmation.",
    input_schema: {
      type: "object",
      properties: { source_load_id: { type: "string" }, new_pickup_date: { type: "string" } },
      required: ["source_load_id"],
    },
    requires_confirmation: true,
    allowed_roles: DISPATCH_ROLES,
    minimum_plan_tier: "professional",
  },
  {
    name: "send_invoice",
    description:
      "Email the customer their invoice (PDF and link). Provide invoice_id, or load_id to use that load's invoice. Always requires user confirmation.",
    input_schema: {
      type: "object",
      properties: { invoice_id: { type: "string" }, load_id: { type: "string" } },
      required: [],
    },
    requires_confirmation: true,
    force_confirmation: true,
    allowed_roles: FINANCE_ROLES,
    minimum_plan_tier: "professional",
  },
  {
    name: "mark_invoice_paid",
    description:
      "Mark an invoice as paid (sets status, paid date, and payment method). Required: invoice_id. Optional: payment_date (YYYY-MM-DD), payment_method (ach, check, card, other). Always requires user confirmation.",
    input_schema: {
      type: "object",
      properties: {
        invoice_id: { type: "string" },
        payment_date: { type: "string", description: "YYYY-MM-DD" },
        payment_method: { type: "string", description: "e.g. ach, check, card, other" },
      },
      required: ["invoice_id"],
    },
    requires_confirmation: true,
    force_confirmation: true,
    allowed_roles: FINANCE_ROLES,
    minimum_plan_tier: "professional",
  },
  {
    name: "send_driver_message",
    description:
      "Send an SMS text message to a driver. Inputs: driver_id (UUID), message_text (keep it short and operational). Requires user confirmation.",
    input_schema: {
      type: "object",
      properties: { driver_id: { type: "string" }, message_text: { type: "string" } },
      required: ["driver_id", "message_text"],
    },
    requires_confirmation: true,
    allowed_roles: DISPATCH_ROLES,
    minimum_plan_tier: "professional",
  },
  {
    name: "update_driver_status",
    description:
      "Set a driver's status. Inputs: driver_id (UUID), status; optional note added to the driver record. Requires user confirmation.",
    input_schema: {
      type: "object",
      properties: { driver_id: { type: "string" }, status: { type: "string" }, note: { type: "string" } },
      required: ["driver_id", "status"],
    },
    requires_confirmation: true,
    allowed_roles: DISPATCH_ROLES,
    minimum_plan_tier: "professional",
  },
  {
    name: "create_maintenance_record",
    description:
      "Schedule a maintenance service on a truck. Required: truck_id (UUID), service_type (e.g. \"PM-A\", \"DOT inspection\"), scheduled_date (YYYY-MM-DD). Optional: notes. Requires user confirmation.",
    input_schema: {
      type: "object",
      properties: {
        truck_id: { type: "string" },
        service_type: { type: "string" },
        scheduled_date: { type: "string" },
        notes: { type: "string" },
      },
      required: ["truck_id", "service_type", "scheduled_date"],
    },
    requires_confirmation: true,
    allowed_roles: MAINTENANCE_ROLES,
    minimum_plan_tier: "professional",
  },
  {
    name: "mark_maintenance_complete",
    description:
      "Mark a maintenance record as complete. Required: maintenance_id. Optional: completion_date (YYYY-MM-DD) and cost_usd. Requires user confirmation.",
    input_schema: {
      type: "object",
      properties: {
        maintenance_id: { type: "string" },
        completion_date: { type: "string" },
        cost_usd: { type: "number" },
        notes: { type: "string" },
      },
      required: ["maintenance_id"],
    },
    requires_confirmation: true,
    allowed_roles: MAINTENANCE_ROLES,
    minimum_plan_tier: "professional",
  },
  {
    name: "find_best_truck_for_load",
    description:
      "Read-only. Ranks the company's trucks by availability to recommend the best fit for a load. Input: load_id (UUID). Runs immediately; no confirmation needed.",
    input_schema: {
      type: "object",
      properties: { load_id: { type: "string" } },
      required: ["load_id"],
    },
    requires_confirmation: false,
    allowed_roles: OFFICE_ANALYSIS_ROLES,
    minimum_plan_tier: "professional",
  },
  {
    name: "find_available_drivers_near_location",
    description:
      'Read-only. Lists active drivers available for a pickup to support assignment planning. Inputs: pickup_location (text, e.g. "Chicago, IL"); optional pickup_date (YYYY-MM-DD). Runs immediately; no confirmation needed.',
    input_schema: {
      type: "object",
      properties: { pickup_location: { type: "string" }, pickup_date: { type: "string" } },
      required: ["pickup_location"],
    },
    requires_confirmation: false,
    allowed_roles: OFFICE_ANALYSIS_ROLES,
    minimum_plan_tier: "professional",
  },
  {
    name: "get_load_profitability_analysis",
    description:
      "Read-only. Reports a load's recorded revenue and profit figures. Input: load_id (UUID). Runs immediately; no confirmation needed.",
    input_schema: {
      type: "object",
      properties: { load_id: { type: "string" } },
      required: ["load_id"],
    },
    requires_confirmation: false,
    allowed_roles: OFFICE_ANALYSIS_ROLES,
    minimum_plan_tier: "professional",
  },
  {
    name: "get_driver_performance_summary",
    description:
      "Read-only. Summarizes a driver's recent activity by counting loads assigned over a recent window. Required: driver_id (UUID). Optional: days_back (1–365, default 30). Runs immediately; no confirmation needed.",
    input_schema: {
      type: "object",
      properties: { driver_id: { type: "string" }, days_back: { type: "number" } },
      required: ["driver_id"],
    },
    requires_confirmation: false,
    allowed_roles: OFFICE_ANALYSIS_ROLES,
    minimum_plan_tier: "professional",
  },
]

const METADATA_BY_NAME = new Map<string, AiToolMetadata>(AI_TOOL_METADATA.map((t) => [t.name, t]))

export function getAllToolMetadata(): AiToolMetadata[] {
  return [...AI_TOOL_METADATA]
}

export function getToolMetadataByName(name: string): AiToolMetadata | undefined {
  return METADATA_BY_NAME.get(name)
}

export function toolMetadataConfirmationRequired(tool: AiToolMetadata, input: Record<string, unknown>): boolean {
  if (tool.force_confirmation) return true
  if (tool.name === "update_load_status") {
    const st = String(input.new_status || "").toLowerCase()
    return st === "delivered" || st === "cancelled"
  }
  return tool.requires_confirmation
}
