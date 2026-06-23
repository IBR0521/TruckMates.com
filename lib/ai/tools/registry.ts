import type { PlanTier } from "@/lib/plan-limits"
import { PLAN_TIER_ORDER } from "@/lib/plan-limits"
import type { AiToolDefinitionBase, AppRole } from "@/lib/ai/tools/types"
import {
  AI_TOOL_METADATA,
  getAllToolMetadata,
  getToolMetadataByName,
  toolMetadataConfirmationRequired,
  type AiToolMetadata,
} from "@/lib/ai/tools/tool-metadata"
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
  execDispatchPlanner,
  previewDispatchPlanner,
} from "@/lib/ai/tools/handlers"

export function tierMeetsMinimum(companyTier: PlanTier, minimum: PlanTier): boolean {
  const i = PLAN_TIER_ORDER.indexOf(companyTier)
  const j = PLAN_TIER_ORDER.indexOf(minimum)
  if (i < 0 || j < 0) return false
  return i >= j
}

type ToolHandlers = Pick<AiToolDefinitionBase, "execute" | "preview">

const TOOL_HANDLERS: Record<string, ToolHandlers> = {
  dispatch_planner_experimental: { execute: execDispatchPlanner, preview: previewDispatchPlanner },
  create_load: { execute: execCreateLoad, preview: previewCreateLoad },
  assign_driver_to_load: { execute: execAssignDriverToLoad, preview: previewAssignDriver },
  update_load_status: { execute: execUpdateLoadStatus, preview: previewUpdateLoadStatus },
  copy_load: { execute: execCopyLoad, preview: previewCopyLoad },
  send_invoice: { execute: execSendInvoice, preview: previewSendInvoice },
  mark_invoice_paid: { execute: execMarkInvoicePaid, preview: previewMarkInvoicePaid },
  send_driver_message: { execute: execSendDriverMessage, preview: previewSendDriverMessage },
  update_driver_status: { execute: execUpdateDriverStatus, preview: previewUpdateDriverStatus },
  create_maintenance_record: { execute: execCreateMaintenanceRecord, preview: previewCreateMaintenance },
  mark_maintenance_complete: { execute: execMarkMaintenanceComplete, preview: previewMarkMaintenanceComplete },
  find_best_truck_for_load: { execute: execFindBestTruckForLoad, preview: previewFindBestTruck },
  find_available_drivers_near_location: { execute: execFindAvailableDrivers, preview: previewFindDrivers },
  get_load_profitability_analysis: { execute: execLoadProfitability, preview: previewLoadProfitability },
  get_driver_performance_summary: { execute: execDriverPerformance, preview: previewDriverPerf },
}

function attachHandlers(meta: AiToolMetadata): AiToolDefinitionBase {
  const handlers = TOOL_HANDLERS[meta.name]
  if (!handlers) {
    throw new Error(`Missing handlers for AI tool: ${meta.name}`)
  }
  return { ...meta, ...handlers }
}

const AI_TOOLS: AiToolDefinitionBase[] = AI_TOOL_METADATA.map(attachHandlers)

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
    if (!tierMeetsMinimum(ctx.companyTier, t.minimum_plan_tier)) return false
    if (t.feature_flag && !t.feature_flag()) return false
    return true
  })
}

export function toolConfirmationRequired(tool: AiToolDefinitionBase, input: Record<string, unknown>): boolean {
  return toolMetadataConfirmationRequired(tool, input)
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

export { getAllToolMetadata, getToolMetadataByName }
