import { createAdminClient } from "@/lib/supabase/admin"
import { callClaude } from "@/lib/ai/client"
import { getFleetContext, getLoadContext } from "@/lib/ai/context"
import { logAutomationEvent } from "@/lib/ai/agent/settings"
import { LOGISTICS_SYSTEM_PROMPT } from "@/lib/ai/prompts/system"
import type { AgentAction } from "@/lib/ai/types"

type ExecutionResult = {
  success: boolean
  result: string
  error: string | null
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asString(value: unknown): string {
  return String(value || "").trim()
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value
  return fallback
}

async function buildExecutionSummary(action: AgentAction): Promise<string> {
  const [fleetContext, loadContext] = await Promise.all([
    getFleetContext(action.companyId),
    getLoadContext(action.companyId, asString(action.payload.loadId || action.payload.load_id) || undefined),
  ])

  const prompt = [
    "Summarize this executed automation for dispatch logs in one short sentence.",
    `Action type: ${action.type}`,
    `Confidence: ${action.confidence}`,
    `Reasoning: ${action.reasoning}`,
    `Payload: ${JSON.stringify(action.payload)}`,
    fleetContext ? `Fleet context:\n${fleetContext}` : "",
    loadContext ? `Load context:\n${loadContext}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")

  const response = await callClaude(
    LOGISTICS_SYSTEM_PROMPT,
    prompt,
    {
      maxTokens: 120,
      expectJson: false,
      model: "haiku",
      feature: "automation_summary",
      companyId: action.companyId,
    }
  )

  if (!response.error && response.data) {
    return response.data
  }

  return `Executed ${action.type} with confidence ${action.confidence}.`
}

async function executeLoadStatusUpdate(payload: Record<string, unknown>): Promise<ExecutionResult> {
  try {
    const loadId = asString(payload.loadId || payload.load_id)
    const status = asString(payload.status || payload.newStatus || payload.targetStatus)
    if (!loadId || !status) {
      return { success: false, result: "", error: "loadId and status are required for load status update" }
    }

    const loadsModule = await import("@/app/actions/loads")
    const updateLoadStatusFn =
      (loadsModule as Record<string, unknown>).updateLoadStatus ||
      (loadsModule as Record<string, unknown>).updateLoad

    if (typeof updateLoadStatusFn !== "function") {
      return { success: false, result: "", error: "No load status update action is available" }
    }

    const response = await (updateLoadStatusFn as (...args: unknown[]) => Promise<{ error?: string; data?: unknown }>)(
      loadId,
      { status }
    )

    if (response?.error) {
      return { success: false, result: "", error: String(response.error) }
    }

    return { success: true, result: `Load ${loadId} status updated to ${status}`, error: null }
  } catch (error: unknown) {
    return { success: false, result: "", error: error instanceof Error ? error.message : "Load status update failed" }
  }
}

async function executeDetentionClock(payload: Record<string, unknown>): Promise<ExecutionResult> {
  try {
    const detentionModule = await import("@/app/actions/detention-tracking")
    const startDetentionTimerFn =
      (detentionModule as Record<string, unknown>).startDetentionTimer ||
      (detentionModule as Record<string, unknown>).checkAndCreateDetentions

    if (typeof startDetentionTimerFn !== "function") {
      return { success: false, result: "", error: "No detention timer action is available" }
    }

    const response = await (startDetentionTimerFn as () => Promise<{ error?: string }>)()
    if (response?.error) {
      return { success: false, result: "", error: String(response.error) }
    }

    const { sendPushToCompanyRoles } = await import("@/app/actions/push-notifications")
    await sendPushToCompanyRoles(asString(payload.companyId || payload.company_id), ["dispatcher"], {
      title: "Detention clock updated",
      body: "Detention timer action was triggered by TruckMates AI.",
      data: {
        type: "detention_clock",
        loadId: asString(payload.loadId || payload.load_id),
      },
    })

    return { success: true, result: "Detention clock action executed", error: null }
  } catch (error: unknown) {
    return { success: false, result: "", error: error instanceof Error ? error.message : "Detention clock execution failed" }
  }
}

async function executeDriverAssignment(payload: Record<string, unknown>): Promise<ExecutionResult> {
  try {
    const loadId = asString(payload.loadId || payload.load_id)
    const driverId = asString(payload.driverId || payload.driver_id)
    const truckId = asString(payload.truckId || payload.truck_id)

    if (!loadId || !driverId) {
      return { success: false, result: "", error: "loadId and driverId are required for driver assignment" }
    }

    const dispatchesModule = await import("@/app/actions/dispatches")
    const assignDriverToLoadFn =
      (dispatchesModule as Record<string, unknown>).assignDriverToLoad ||
      (dispatchesModule as Record<string, unknown>).quickAssignLoad

    if (typeof assignDriverToLoadFn !== "function") {
      return { success: false, result: "", error: "No driver assignment action is available" }
    }

    const response = await (assignDriverToLoadFn as (...args: unknown[]) => Promise<{ error?: string }>)(
      loadId,
      driverId,
      truckId || undefined
    )

    if (response?.error) {
      return { success: false, result: "", error: String(response.error) }
    }

    // Send push notification to the assigned driver's user record if available.
    const admin = createAdminClient()
    const { data: driver } = await admin
      .from("drivers")
      .select("user_id")
      .eq("id", driverId)
      .maybeSingle()

    const driverUserId = (driver as { user_id?: string | null } | null)?.user_id
    if (driverUserId) {
      const { sendPushToUser } = await import("@/app/actions/push-notifications")
      await sendPushToUser(String(driverUserId), {
        title: "New load assignment",
        body: "TruckMates AI assigned you a load.",
        data: {
          type: "driver_assignment",
          loadId,
          link: `/dashboard/loads/${loadId}`,
        },
      })
    }

    return { success: true, result: `Assigned driver ${driverId} to load ${loadId}`, error: null }
  } catch (error: unknown) {
    return { success: false, result: "", error: error instanceof Error ? error.message : "Driver assignment execution failed" }
  }
}

async function executeInvoiceGeneration(payload: Record<string, unknown>): Promise<ExecutionResult> {
  try {
    const loadId = asString(payload.loadId || payload.load_id)
    if (!loadId) {
      return { success: false, result: "", error: "loadId is required for invoice generation" }
    }

    const invoiceModule = await import("@/app/actions/auto-invoice")
    const createAutoInvoiceFn =
      (invoiceModule as Record<string, unknown>).createAutoInvoice ||
      (invoiceModule as Record<string, unknown>).autoGenerateInvoiceOnPOD

    if (typeof createAutoInvoiceFn !== "function") {
      return { success: false, result: "", error: "No invoice auto-generation action is available" }
    }

    const response = await (createAutoInvoiceFn as (loadId: string) => Promise<{ error?: string; data?: unknown }>)(loadId)
    if (response?.error) {
      return { success: false, result: "", error: String(response.error) }
    }

    return { success: true, result: `Invoice auto-generation completed for load ${loadId}`, error: null }
  } catch (error: unknown) {
    return { success: false, result: "", error: error instanceof Error ? error.message : "Invoice generation failed" }
  }
}

async function executePaymentFollowup(payload: Record<string, unknown>): Promise<ExecutionResult> {
  try {
    const remindersModule = await import("@/app/actions/reminders-enhanced")
    const sendPaymentReminderFn = (remindersModule as Record<string, unknown>).sendPaymentReminder

    if (typeof sendPaymentReminderFn === "function") {
      const directResponse = await (sendPaymentReminderFn as (...args: unknown[]) => Promise<{ error?: string }>)(
        payload
      )
      if (directResponse?.error) {
        return { success: false, result: "", error: String(directResponse.error) }
      }
      return { success: true, result: "Payment follow-up reminder sent", error: null }
    }

    // Fallback: create a standard reminder when enhanced helper is not present.
    const { createReminder } = await import("@/app/actions/reminders")
    const invoiceId = asString(payload.invoiceId || payload.invoice_id)
    const customerName = asString(payload.customerName || payload.customer_name || "Customer")
    const dueDate = asString(payload.dueDate || payload.due_date) || new Date().toISOString().slice(0, 10)

    const reminderResponse = await createReminder({
      title: `Payment follow-up: ${customerName}`,
      description: asString(payload.message || "Follow up on outstanding invoice payment."),
      reminder_type: "invoice_due",
      due_date: dueDate,
      invoice_id: invoiceId || undefined,
    })

    if (reminderResponse?.error) {
      return { success: false, result: "", error: String(reminderResponse.error) }
    }

    return { success: true, result: "Payment follow-up reminder created", error: null }
  } catch (error: unknown) {
    return { success: false, result: "", error: error instanceof Error ? error.message : "Payment follow-up failed" }
  }
}

async function executeMaintenanceWorkOrder(payload: Record<string, unknown>): Promise<ExecutionResult> {
  try {
    const { createMaintenance } = await import("@/app/actions/maintenance")
    const response = await createMaintenance({
      truck_id: asString(payload.truckId || payload.truck_id) || undefined,
      trailer_id: asString(payload.trailerId || payload.trailer_id) || undefined,
      service_type: asString(payload.serviceType || payload.service_type || "inspection"),
      scheduled_date: asString(payload.scheduledDate || payload.scheduled_date) || new Date().toISOString().slice(0, 10),
      current_mileage: Number(payload.currentMileage || payload.current_mileage || 0) || undefined,
      priority: asString(payload.priority || "normal") || undefined,
      estimated_cost: Number(payload.estimatedCost || payload.estimated_cost || 0) || undefined,
      notes: asString(payload.notes) || undefined,
      vendor: asString(payload.vendor) || undefined,
    })

    if (response?.error) {
      return { success: false, result: "", error: String(response.error) }
    }

    return { success: true, result: "Maintenance work order created", error: null }
  } catch (error: unknown) {
    return { success: false, result: "", error: error instanceof Error ? error.message : "Maintenance work order failed" }
  }
}

async function executeNotification(payload: Record<string, unknown>): Promise<ExecutionResult> {
  try {
    const companyId = asString(payload.companyId || payload.company_id)
    if (!companyId) {
      return { success: false, result: "", error: "companyId is required for notification actions" }
    }

    const rolesRaw = Array.isArray(payload.roles) ? payload.roles.map((role) => String(role)) : []
    const roles = rolesRaw.length > 0 ? rolesRaw : ["super_admin", "operations_manager", "dispatcher"]
    const title = asString(payload.title || "TruckMates AI Notification")
    const body = asString(payload.body || payload.message || "Automation event detected.")

    const { sendPushToCompanyRoles } = await import("@/app/actions/push-notifications")
    const pushResult = await sendPushToCompanyRoles(companyId, roles, {
      title,
      body,
      data: asRecord(payload.data) as Record<string, string>,
    })

    if (pushResult?.error) {
      return { success: false, result: "", error: String(pushResult.error) }
    }

    return { success: true, result: `Notification sent to ${roles.join(", ")}`, error: null }
  } catch (error: unknown) {
    return { success: false, result: "", error: error instanceof Error ? error.message : "Notification action failed" }
  }
}

async function executeCreditHold(payload: Record<string, unknown>): Promise<ExecutionResult> {
  try {
    const companyId = asString(payload.companyId || payload.company_id)
    const customerId = asString(payload.customerId || payload.customer_id)
    const hold = asBoolean(payload.creditHold ?? payload.credit_hold, true)

    if (!companyId || !customerId) {
      return { success: false, result: "", error: "companyId and customerId are required for credit hold actions" }
    }

    const admin = createAdminClient()
    const { error } = await admin
      .from("customers")
      .update({ credit_hold: hold } as never)
      .eq("id", customerId)
      .eq("company_id", companyId)

    if (error) {
      return { success: false, result: "", error: error.message || "Failed to update customer credit hold" }
    }

    const { sendPushToCompanyRoles } = await import("@/app/actions/push-notifications")
    await sendPushToCompanyRoles(companyId, ["operations_manager"], {
      title: "Credit hold updated",
      body: `Customer ${customerId} credit hold is now ${hold ? "enabled" : "disabled"}.`,
      data: {
        type: "credit_hold",
        customerId,
      },
    })

    return { success: true, result: `Credit hold ${hold ? "enabled" : "disabled"} for customer ${customerId}`, error: null }
  } catch (error: unknown) {
    return { success: false, result: "", error: error instanceof Error ? error.message : "Credit hold action failed" }
  }
}

export async function executeAgentAction(
  action: AgentAction
): Promise<{ success: boolean; result: string; error: string | null }> {
  let execution: ExecutionResult

  const payload = asRecord(action.payload)
  const payloadWithCompany = { companyId: action.companyId, ...payload }

  switch (action.type) {
    case "load_status_auto_update":
    case "load_status_update":
      execution = await executeLoadStatusUpdate(payloadWithCompany)
      break
    case "detention_clock":
      execution = await executeDetentionClock(payloadWithCompany)
      break
    case "driver_assignment":
      execution = await executeDriverAssignment(payloadWithCompany)
      break
    case "invoice_auto_generation":
      execution = await executeInvoiceGeneration(payloadWithCompany)
      break
    case "payment_followup":
      execution = await executePaymentFollowup(payloadWithCompany)
      break
    case "predictive_maintenance":
    case "maintenance_work_order":
      execution = await executeMaintenanceWorkOrder(payloadWithCompany)
      break
    case "credit_hold":
      execution = await executeCreditHold(payloadWithCompany)
      break
    case "notification":
      execution = await executeNotification(payloadWithCompany)
      break
    default:
      execution = {
        success: false,
        result: "",
        error: `Unsupported agent action type: ${action.type}`,
      }
      break
  }

  const summary = await buildExecutionSummary(action)

  await logAutomationEvent({
    companyId: action.companyId,
    automationType: action.type,
    level: action.automationLevel,
    triggered: execution.success,
    confidence: action.confidence,
    reasoning: `${action.reasoning}\nExecution summary: ${summary}`,
    actionTaken: execution.success ? action.type : null,
    actionPayload: {
      ...payloadWithCompany,
      _agentAction: action,
      reversible: action.reversible,
      executionResult: execution.result,
      executionError: execution.error,
    },
    approved: action.automationLevel === "approval" ? true : null,
    reversedAt: null,
  })

  return execution
}
