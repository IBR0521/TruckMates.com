import type { PlanTier } from "@/lib/plan-limits"
import { PLAN_TIER_ORDER } from "@/lib/plan-limits"
import type { AiToolDefinitionBase, AppRole } from "@/lib/ai/tools/types"
import {
  execAssignDriverToLoad,
  execCopyLoad,
  execCreateLoad,
  execCreateMaintenanceRecord,
  execDriverPerformance,
  execFindAvailableDrivers,
  execFindBestTruckForLoad,
  execLoadProfitability,
  execMarkInvoicePaid,
  execMarkMaintenanceComplete,
  execSendDriverMessage,
  execSendInvoice,
  execUpdateDriverStatus,
  execUpdateLoadStatus,
  previewAssignDriver,
  previewCopyLoad,
  previewCreateLoad,
  previewCreateMaintenance,
  previewDriverPerf,
  previewFindBestTruck,
  previewFindDrivers,
  previewLoadProfitability,
  previewMarkInvoicePaid,
  previewMarkMaintenanceComplete,
  previewSendDriverMessage,
  previewSendInvoice,
  previewUpdateDriverStatus,
  previewUpdateLoadStatus,
} from "@/lib/ai/tools/handlers"

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

export function tierMeetsMinimum(companyTier: PlanTier, minimum: PlanTier): boolean {
  const i = PLAN_TIER_ORDER.indexOf(companyTier)
  const j = PLAN_TIER_ORDER.indexOf(minimum)
  if (i < 0 || j < 0) return false
  return i >= j
}

const AI_TOOLS: AiToolDefinitionBase[] = [
  {
    name: "create_load",
    description:
      "Create a new freight load for this company. Example: customer_id UUID empty string allowed if unknown; pickup_location \"Chicago, IL\"; delivery_location \"Dallas, TX\"; pickup_date \"2026-05-20\"; rate_usd 2500; weight_lbs 42000; commodity \"Steel coils\". Requires user confirmation before execution.",
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
    execute: execCreateLoad,
    preview: previewCreateLoad,
  },
  {
    name: "assign_driver_to_load",
    description:
      "Assign an active driver to a load using dispatch assignment (same as Quick Assign). Inputs: load_id UUID, driver_id UUID. Requires confirmation.",
    input_schema: {
      type: "object",
      properties: {
        load_id: { type: "string" },
        driver_id: { type: "string" },
      },
      required: ["load_id", "driver_id"],
    },
    requires_confirmation: true,
    allowed_roles: DISPATCH_ROLES,
    minimum_plan_tier: "professional",
    execute: execAssignDriverToLoad,
    preview: previewAssignDriver,
  },
  {
    name: "update_load_status",
    description:
      "Update TMS load status. Valid statuses include pending, confirmed, in_transit, delivered, cancelled, invoiced, paid (exact strings depend on load workflow). User confirmation is REQUIRED when new_status is delivered or cancelled (terminal actions); other transitions execute immediately after tool call.",
    input_schema: {
      type: "object",
      properties: {
        load_id: { type: "string" },
        new_status: { type: "string" },
      },
      required: ["load_id", "new_status"],
    },
    requires_confirmation: false,
    allowed_roles: DISPATCH_ROLES,
    minimum_plan_tier: "professional",
    execute: execUpdateLoadStatus,
    preview: previewUpdateLoadStatus,
  },
  {
    name: "copy_load",
    description:
      "Duplicate an existing load as a new record (same as Duplicate Load). Optional new_pickup_date \"YYYY-MM-DD\" adjusts pickup on the copy. Requires confirmation.",
    input_schema: {
      type: "object",
      properties: {
        source_load_id: { type: "string" },
        new_pickup_date: { type: "string" },
      },
      required: ["source_load_id"],
    },
    requires_confirmation: true,
    allowed_roles: DISPATCH_ROLES,
    minimum_plan_tier: "professional",
    execute: execCopyLoad,
    preview: previewCopyLoad,
  },
  {
    name: "send_invoice",
    description:
      "Email the customer invoice PDF/link using TruckMates invoice email action. Provide invoice_id OR load_id (invoice linked to load). ALWAYS requires human confirmation — financial outbound.",
    input_schema: {
      type: "object",
      properties: {
        invoice_id: { type: "string" },
        load_id: { type: "string" },
      },
      required: [],
    },
    requires_confirmation: true,
    force_confirmation: true,
    allowed_roles: FINANCE_ROLES,
    minimum_plan_tier: "professional",
    execute: execSendInvoice,
    preview: previewSendInvoice,
  },
  {
    name: "mark_invoice_paid",
    description:
      "Mark an invoice paid in accounting (updates status, paid_date, payment_method). ALWAYS requires confirmation.",
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
    execute: execMarkInvoicePaid,
    preview: previewMarkInvoicePaid,
  },
  {
    name: "send_driver_message",
    description:
      "Send an SMS to a driver via TruckMates SMS integration. message_text should be short and operational. Requires confirmation.",
    input_schema: {
      type: "object",
      properties: {
        driver_id: { type: "string" },
        message_text: { type: "string" },
      },
      required: ["driver_id", "message_text"],
    },
    requires_confirmation: true,
    allowed_roles: DISPATCH_ROLES,
    minimum_plan_tier: "professional",
    execute: execSendDriverMessage,
    preview: previewSendDriverMessage,
  },
  {
    name: "update_driver_status",
    description:
      "Patch driver record status (and optional notes field mapped to driver notes). Requires confirmation.",
    input_schema: {
      type: "object",
      properties: {
        driver_id: { type: "string" },
        status: { type: "string" },
        note: { type: "string" },
      },
      required: ["driver_id", "status"],
    },
    requires_confirmation: true,
    allowed_roles: DISPATCH_ROLES,
    minimum_plan_tier: "professional",
    execute: execUpdateDriverStatus,
    preview: previewUpdateDriverStatus,
  },
  {
    name: "create_maintenance_record",
    description:
      "Schedule maintenance on a truck: truck_id, service_type (e.g. PM-A, DOT inspection), scheduled_date YYYY-MM-DD, optional notes. Requires confirmation.",
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
    execute: execCreateMaintenanceRecord,
    preview: previewCreateMaintenance,
  },
  {
    name: "mark_maintenance_complete",
    description:
      "Mark a maintenance record completed with optional completion_date (YYYY-MM-DD), cost_usd number, notes ignored by backend action today. Requires confirmation.",
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
    execute: execMarkMaintenanceComplete,
    preview: previewMarkMaintenanceComplete,
  },
  {
    name: "find_best_truck_for_load",
    description:
      "READ ONLY: Rank trucks already in context heuristically for load_id (availability messaging only — not an optimizer). Auto-runs without confirmation.",
    input_schema: {
      type: "object",
      properties: {
        load_id: { type: "string" },
      },
      required: ["load_id"],
    },
    requires_confirmation: false,
    allowed_roles: OFFICE_ANALYSIS_ROLES,
    minimum_plan_tier: "professional",
    execute: execFindBestTruckForLoad,
    preview: previewFindBestTruck,
  },
  {
    name: "find_available_drivers_near_location",
    description:
      'READ ONLY: Lists active drivers for planning near pickup_location text and pickup_date string (e.g. "2026-05-21"); geolocation is NOT computed. Auto-runs.',
    input_schema: {
      type: "object",
      properties: {
        pickup_location: { type: "string" },
        pickup_date: { type: "string" },
      },
      required: ["pickup_location"],
    },
    requires_confirmation: false,
    allowed_roles: OFFICE_ANALYSIS_ROLES,
    minimum_plan_tier: "professional",
    execute: execFindAvailableDrivers,
    preview: previewFindDrivers,
  },
  {
    name: "get_load_profitability_analysis",
    description:
      "READ ONLY: Summarize stored revenue / profit fields on load_id — does not compute unseen costs. Auto-runs.",
    input_schema: {
      type: "object",
      properties: {
        load_id: { type: "string" },
      },
      required: ["load_id"],
    },
    requires_confirmation: false,
    allowed_roles: OFFICE_ANALYSIS_ROLES,
    minimum_plan_tier: "professional",
    execute: execLoadProfitability,
    preview: previewLoadProfitability,
  },
  {
    name: "get_driver_performance_summary",
    description:
      "READ ONLY: Count loads assigned to driver_id in the last days_back (integer 1–365, default 30). Auto-runs.",
    input_schema: {
      type: "object",
      properties: {
        driver_id: { type: "string" },
        days_back: { type: "number" },
      },
      required: ["driver_id"],
    },
    requires_confirmation: false,
    allowed_roles: OFFICE_ANALYSIS_ROLES,
    minimum_plan_tier: "professional",
    execute: execDriverPerformance,
    preview: previewDriverPerf,
  },
]

const TOOLS_BY_NAME = new Map<string, AiToolDefinitionBase>(AI_TOOLS.map((t) => [t.name, t]))

export function getAllTools(): AiToolDefinitionBase[] {
  return [...AI_TOOLS]
}

export function getToolByName(name: string): AiToolDefinitionBase | undefined {
  return TOOLS_BY_NAME.get(name)
}

export function getAvailableTools(ctx: { userRole: AppRole; companyTier: PlanTier }): AiToolDefinitionBase[] {
  return AI_TOOLS.filter((t) => {
    if (!t.allowed_roles.includes(ctx.userRole)) return false
    return tierMeetsMinimum(ctx.companyTier, t.minimum_plan_tier)
  })
}

export function toolConfirmationRequired(tool: AiToolDefinitionBase, input: Record<string, unknown>): boolean {
  if (tool.force_confirmation) return true
  if (tool.name === "update_load_status") {
    const st = String(input.new_status || "").toLowerCase()
    return st === "delivered" || st === "cancelled"
  }
  return tool.requires_confirmation
}

export function anthropicToolsFromRegistry(tools: AiToolDefinitionBase[]): Array<{
  name: string
  description: string
  input_schema: AiToolDefinitionBase["input_schema"]
}> {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }))
}
