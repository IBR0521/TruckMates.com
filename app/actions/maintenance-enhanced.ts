"use server"

/**
 * Enhanced Maintenance Features
 * - ELD Fault Code Analysis
 * - Work Orders Management
 * - Document Storage
 * - Parts Inventory Integration
 */

import * as Sentry from "@sentry/nextjs"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { revalidatePath } from "next/cache"
import { checkCreatePermission, checkEditPermission, checkDeletePermission } from "@/lib/server-permissions"

function unknownErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

/** `public.fault_code_maintenance_rules` — supabase/eld_fault_code_maintenance.sql */
const FAULT_CODE_MAINTENANCE_RULES_SELECT =
  "id, company_id, fault_code, fault_code_category, service_type, priority, estimated_cost, estimated_labor_hours, description, auto_create_maintenance, schedule_days_ahead, created_at, updated_at"

/**
 * Analyze ELD fault code and create maintenance if needed
 */
export async function analyzeFaultCodeAndCreateMaintenance(eventId: string) {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // RBAC check
  const permissionCheck = await checkCreatePermission("maintenance")
  if (!permissionCheck.allowed) {
    return { error: permissionCheck.error || "You don't have permission to create maintenance records", data: null }
  }

  // Validate eventId ownership
  const { data: event, error: eventError } = await supabase
    .from("eld_events")
    .select("id, company_id")
    .eq("id", eventId)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (eventError || !event) {
    return { error: "ELD event not found or does not belong to your company", data: null }
  }

  try {
    const { data: maintenanceId, error } = await supabase.rpc(
      "analyze_fault_code_and_create_maintenance",
      { p_event_id: eventId }
    )

    if (error) {
      Sentry.captureException(error)
      return { error: error.message, data: null }
    }

    revalidatePath("/dashboard/maintenance")
    revalidatePath("/dashboard/eld/events")

    return { data: { maintenance_id: maintenanceId }, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: unknownErrorMessage(error, "Failed to analyze fault code"), data: null }
  }
}

/**
 * Batch analyze pending fault codes
 */
export async function batchAnalyzePendingFaultCodes(limit: number = 100) {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // RBAC check
  const permissionCheck = await checkCreatePermission("maintenance")
  if (!permissionCheck.allowed) {
    return { error: permissionCheck.error || "You don't have permission to batch analyze fault codes", data: null }
  }

  try {
    const { data, error } = await supabase.rpc("batch_analyze_pending_fault_codes", {
      p_company_id: ctx.companyId,
      p_limit: limit,
    })

    if (error) {
      Sentry.captureException(error)
      return { error: error.message, data: null }
    }

    revalidatePath("/dashboard/maintenance")
    revalidatePath("/dashboard/eld/events")

    return { data: data?.[0] || { processed: 0, created: 0, skipped: 0 }, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: unknownErrorMessage(error, "Failed to batch analyze fault codes"), data: null }
  }
}

/**
 * Upload maintenance document
 */
export async function uploadMaintenanceDocument(
  maintenanceId: string,
  file: File,
  documentType: string,
  description?: string
) {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // RBAC check
  const permissionCheck = await checkCreatePermission("documents")
  if (!permissionCheck.allowed) {
    return { error: permissionCheck.error || "You don't have permission to upload maintenance documents", data: null }
  }

  try {
    // Get maintenance to verify access and get truck_id
    const { data: maintenance, error: maintenanceError } = await supabase
      .from("maintenance")
      .select("id, truck_id, company_id")
      .eq("id", maintenanceId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (maintenanceError || !maintenance) {
      return { error: "Maintenance record not found", data: null }
    }

    // Upload to Supabase Storage
    const fileExt = file.name.split(".").pop()
    const fileName = `maintenance/${maintenanceId}/${Date.now()}.${fileExt}`

    const { error: uploadError } = await supabase.storage.from("documents").upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
    })

    if (uploadError) {
      return { error: `Upload failed: ${uploadError.message}`, data: null }
    }

    // Create signed URL instead of public URL for security
    const { data: signedUrlData, error: signedError } = await supabase.storage
      .from("documents")
      .createSignedUrl(fileName, 31536000) // 1 year expiry

    if (signedError || !signedUrlData?.signedUrl) {
      // Delete the uploaded file if we can't create a signed URL
      await supabase.storage.from("documents").remove([fileName])
      return { error: `Failed to create secure access URL: ${signedError?.message || "Unknown error"}. Document not saved.`, data: null }
    }

    const publicUrl = signedUrlData.signedUrl

    // Save document record (trigger will sync to maintenance.documents)
    const { data: doc, error: docError } = await supabase
      .from("maintenance_documents")
      .insert({
        company_id: ctx.companyId,
        maintenance_id: maintenanceId,
        truck_id: maintenance.truck_id,
        document_type: documentType,
        name: file.name,
        description: description || null,
        storage_url: publicUrl,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: ctx.userId!,
      })
      .select()
      .single()

    if (docError) {
      return { error: docError.message, data: null }
    }

    revalidatePath("/dashboard/maintenance")
    revalidatePath(`/dashboard/maintenance/${maintenanceId}`)

    return { data: doc, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: unknownErrorMessage(error, "Failed to upload document"), data: null }
  }
}

/**
 * Get maintenance documents
 */
export async function getMaintenanceDocuments(maintenanceId: string) {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    const { data: documents, error } = await supabase
      .from("maintenance_documents")
      .select(`
        *,
        uploaded_by_user:uploaded_by (id, name, email)
      `)
      .eq("maintenance_id", maintenanceId)
      .eq("company_id", ctx.companyId)
      .order("uploaded_at", { ascending: false })

    if (error) {
      return { error: error.message, data: null }
    }

    return { data: documents || [], error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: unknownErrorMessage(error, "Failed to get documents"), data: null }
  }
}

/**
 * Delete maintenance document
 */
export async function deleteMaintenanceDocument(documentId: string) {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // RBAC check
  const permissionCheck = await checkDeletePermission("documents")
  if (!permissionCheck.allowed) {
    return { error: permissionCheck.error || "You don't have permission to delete maintenance documents", data: null }
  }

  try {
    // Get document to get storage URL and path
    const { data: document, error: docError } = await supabase
      .from("maintenance_documents")
      .select("storage_url, maintenance_id")
      .eq("id", documentId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (docError || !document) {
      return { error: "Document not found", data: null }
    }

    // Delete from storage - extract path correctly from URL
    let storagePath: string | null = null
    const url = document.storage_url
    
    // Handle signed URLs, public URLs, and direct paths
    if (url.includes("/storage/v1/object/sign/")) {
      // Signed URL format: .../sign/documents/maintenance/{maintenanceId}/{filename}?...
      const match = url.match(/\/sign\/documents\/(.+?)(\?|$)/)
      if (match && match[1]) {
        storagePath = match[1]
      }
    } else if (url.includes("/storage/v1/object/public/documents/")) {
      // Public URL format: .../object/public/documents/maintenance/{maintenanceId}/{filename}
      const parts = url.split("/storage/v1/object/public/documents/")
      if (parts.length > 1) {
        storagePath = parts[1]
      }
    } else if (url.startsWith("maintenance/")) {
      // Direct path
      storagePath = url
    } else {
      // Fallback: try to extract from known structure
      const fileName = url.split("/").pop()
      if (fileName && document.maintenance_id) {
        storagePath = `maintenance/${document.maintenance_id}/${fileName}`
      }
    }
    
    if (storagePath) {
      const { error: removeError } = await supabase.storage.from("documents").remove([storagePath])
      if (removeError) {
        Sentry.captureException(removeError)
        // Continue with DB deletion even if storage deletion fails
      }
    }

    // Delete from database (trigger will remove from maintenance.documents)
    // Defense-in-depth: Add company_id to DELETE query
    const { error: deleteError } = await supabase
      .from("maintenance_documents")
      .delete()
      .eq("id", documentId)
      .eq("company_id", ctx.companyId)

    if (deleteError) {
      return { error: deleteError.message, data: null }
    }

    revalidatePath("/dashboard/maintenance")
    revalidatePath(`/dashboard/maintenance/${document.maintenance_id}`)

    return { data: { success: true }, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: unknownErrorMessage(error, "Failed to delete document"), data: null }
  }
}

/**
 * Create work order from maintenance
 */
export async function createWorkOrderFromMaintenance(maintenanceId: string) {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // RBAC check
  const permissionCheck = await checkCreatePermission("maintenance")
  if (!permissionCheck.allowed) {
    return { error: permissionCheck.error || "You don't have permission to create work orders", data: null }
  }

  // Validate maintenance_id ownership
  const { data: maintenance, error: maintenanceError } = await supabase
    .from("maintenance")
    .select("id, company_id")
    .eq("id", maintenanceId)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (maintenanceError || !maintenance) {
    return { error: "Maintenance record not found or does not belong to your company", data: null }
  }

  try {
    const { data: workOrderId, error } = await supabase.rpc("create_work_order_from_maintenance", {
      p_maintenance_id: maintenanceId,
    })

    if (error) {
      Sentry.captureException(error)
      return { error: error.message, data: null }
    }

    revalidatePath("/dashboard/maintenance")
    revalidatePath(`/dashboard/maintenance/${maintenanceId}`)

    return { data: { work_order_id: workOrderId }, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: unknownErrorMessage(error, "Failed to create work order"), data: null }
  }
}

/**
 * Get work order details
 */
export async function getWorkOrder(workOrderId: string) {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    const { data: workOrder, error } = await supabase
      .from("work_orders")
      .select(`
        *,
        maintenance:maintenance_id (
          id,
          service_type,
          scheduled_date,
          status
        ),
        truck:truck_id (
          id,
          truck_number,
          make,
          model
        ),
        assigned_user:assigned_to (
          id,
          name,
          email
        ),
        assigned_vendor:assigned_vendor_id (
          id,
          name,
          contact_name,
          phone
        )
      `)
      .eq("id", workOrderId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (error) {
      return { error: error.message, data: null }
    }
    if (!workOrder) {
      return { error: "Work order not found", data: null }
    }

    return { data: workOrder, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: unknownErrorMessage(error, "Failed to get work order"), data: null }
  }
}

/**
 * Get all work orders
 */
export async function getWorkOrders(filters?: {
  maintenance_id?: string
  truck_id?: string
  status?: string
  assigned_to?: string
}) {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    let query = supabase
      .from("work_orders")
      .select(`
        *,
        maintenance:maintenance_id (
          id,
          service_type,
          scheduled_date
        ),
        truck:truck_id (
          id,
          truck_number
        )
      `)
      .eq("company_id", ctx.companyId)
      .order("created_at", { ascending: false })

    if (filters?.maintenance_id) {
      query = query.eq("maintenance_id", filters.maintenance_id)
    }
    if (filters?.truck_id) {
      query = query.eq("truck_id", filters.truck_id)
    }
    if (filters?.status) {
      query = query.eq("status", filters.status)
    }
    if (filters?.assigned_to) {
      query = query.eq("assigned_to", filters.assigned_to)
    }

    const { data: workOrders, error } = await query

    if (error) {
      return { error: error.message, data: null }
    }

    return { data: workOrders || [], error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: unknownErrorMessage(error, "Failed to get work orders"), data: null }
  }
}

/**
 * Update work order
 */
export async function updateWorkOrder(
  workOrderId: string,
  updates: {
    status?: string
    assigned_to?: string
    assigned_vendor_id?: string
    parts_required?: any[]
    estimated_labor_hours?: number
    estimated_total_cost?: number
    started_at?: string
    notes?: string
  }
) {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    const updateData: any = {}
    if (updates.status !== undefined) updateData.status = updates.status
    if (updates.assigned_to !== undefined) updateData.assigned_to = updates.assigned_to
    if (updates.assigned_vendor_id !== undefined) updateData.assigned_vendor_id = updates.assigned_vendor_id
    if (updates.parts_required !== undefined) updateData.parts_required = updates.parts_required
    if (updates.estimated_labor_hours !== undefined)
      updateData.estimated_labor_hours = updates.estimated_labor_hours
    if (updates.estimated_total_cost !== undefined) updateData.estimated_total_cost = updates.estimated_total_cost
    if (updates.started_at !== undefined) updateData.started_at = updates.started_at
    if (updates.notes !== undefined) updateData.notes = updates.notes

    updateData.updated_at = new Date().toISOString()

    // If status changed to in_progress, set started_at
    if (updates.status === "in_progress" && !updates.started_at) {
      updateData.started_at = new Date().toISOString()
    }

    const { data: workOrder, error } = await supabase
      .from("work_orders")
      .update(updateData)
      .eq("id", workOrderId)
      .eq("company_id", ctx.companyId)
      .select()
      .single()

    if (error) {
      return { error: error.message, data: null }
    }

    revalidatePath("/dashboard/maintenance")
    revalidatePath(`/dashboard/maintenance/${workOrder.maintenance_id}`)

    return { data: workOrder, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: unknownErrorMessage(error, "Failed to update work order"), data: null }
  }
}

/**
 * Check and reserve parts for work order
 */
export async function checkAndReserveParts(workOrderId: string) {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // RBAC check
  const permissionCheck = await checkEditPermission("maintenance")
  if (!permissionCheck.allowed) {
    return { error: permissionCheck.error || "You don't have permission to reserve parts", data: null }
  }

  // Validate work_order_id ownership
  const { data: workOrder, error: workOrderError } = await supabase
    .from("work_orders")
    .select("id, company_id")
    .eq("id", workOrderId)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (workOrderError || !workOrder) {
    return { error: "Work order not found or does not belong to your company", data: null }
  }

  try {
    const { data, error } = await supabase.rpc("check_and_reserve_parts", {
      p_work_order_id: workOrderId,
    })

    if (error) {
      Sentry.captureException(error)
      return { error: error.message, data: null }
    }

    revalidatePath("/dashboard/maintenance")

    return { data: data || [], error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: unknownErrorMessage(error, "Failed to check parts"), data: null }
  }
}

/**
 * Complete work order
 */
export async function completeWorkOrder(
  workOrderId: string,
  actualCost?: number,
  actualLaborHours?: number,
  notes?: string
) {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // RBAC check
  const permissionCheck = await checkEditPermission("maintenance")
  if (!permissionCheck.allowed) {
    return { error: permissionCheck.error || "You don't have permission to complete work orders", data: null }
  }

  // Validate work_order_id ownership
  const { data: workOrder, error: workOrderError } = await supabase
    .from("work_orders")
    .select("id, company_id")
    .eq("id", workOrderId)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (workOrderError || !workOrder) {
    return { error: "Work order not found or does not belong to your company", data: null }
  }

  try {
    // Record parts usage first
    await supabase.rpc("record_parts_usage_from_work_order", {
      p_work_order_id: workOrderId,
    })

    // Complete work order (updates maintenance too)
    const { data: maintenanceId, error } = await supabase.rpc("complete_work_order", {
      p_work_order_id: workOrderId,
      p_actual_cost: actualCost || null,
      p_actual_labor_hours: actualLaborHours || null,
      p_notes: notes || null,
    })

    if (error) {
      Sentry.captureException(error)
      return { error: error.message, data: null }
    }

    revalidatePath("/dashboard/maintenance")
    revalidatePath(`/dashboard/maintenance/${maintenanceId}`)

    return { data: { maintenance_id: maintenanceId }, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: unknownErrorMessage(error, "Failed to complete work order"), data: null }
  }
}

/**
 * Get fault code maintenance rules
 */
export async function getFaultCodeRules() {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    const { data: rules, error } = await supabase
      .from("fault_code_maintenance_rules")
      .select(FAULT_CODE_MAINTENANCE_RULES_SELECT)
      .eq("company_id", ctx.companyId)
      .order("fault_code", { ascending: true })
      .limit(200)

    if (error) {
      return { error: error.message, data: null }
    }

    return { data: rules || [], error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: unknownErrorMessage(error, "Failed to get fault code rules"), data: null }
  }
}

/**
 * Create or update fault code rule
 */
export async function upsertFaultCodeRule(rule: {
  id?: string
  fault_code: string
  fault_code_category?: string
  service_type: string
  priority?: string
  estimated_cost?: number
  estimated_labor_hours?: number
  description?: string
  auto_create_maintenance?: boolean
  schedule_days_ahead?: number
}) {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // RBAC check
  const permissionCheck = rule.id ? await checkEditPermission("maintenance") : await checkCreatePermission("maintenance")
  if (!permissionCheck.allowed) {
    return { error: permissionCheck.error || "You don't have permission to manage fault code rules", data: null }
  }

  try {
    const ruleData: any = {
      company_id: ctx.companyId,
      fault_code: rule.fault_code,
      fault_code_category: rule.fault_code_category || null,
      service_type: rule.service_type,
      priority: rule.priority || "normal",
      estimated_cost: rule.estimated_cost || null,
      estimated_labor_hours: rule.estimated_labor_hours || null,
      description: rule.description || null,
      auto_create_maintenance: rule.auto_create_maintenance !== false,
      schedule_days_ahead: rule.schedule_days_ahead || 0,
      updated_at: new Date().toISOString(),
    }

    if (rule.id) {
      // Update existing
      const { data: updatedRule, error } = await supabase
        .from("fault_code_maintenance_rules")
        .update(ruleData)
        .eq("id", rule.id)
        .eq("company_id", ctx.companyId)
        .select()
        .single()

      if (error) {
        return { error: error.message, data: null }
      }

      return { data: updatedRule, error: null }
    } else {
      // Create new
      const { data: newRule, error } = await supabase
        .from("fault_code_maintenance_rules")
        .insert(ruleData)
        .select()
        .single()

      if (error) {
        return { error: error.message, data: null }
      }

      return { data: newRule, error: null }
    }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: unknownErrorMessage(error, "Failed to save fault code rule"), data: null }
  }
}

/**
 * Delete fault code rule
 */
export async function deleteFaultCodeRule(ruleId: string) {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // RBAC check
  const permissionCheck = await checkDeletePermission("maintenance")
  if (!permissionCheck.allowed) {
    return { error: permissionCheck.error || "You don't have permission to delete fault code rules", data: null }
  }

  try {
    const { error } = await supabase
      .from("fault_code_maintenance_rules")
      .delete()
      .eq("id", ruleId)
      .eq("company_id", ctx.companyId)

    if (error) {
      return { error: error.message, data: null }
    }

    revalidatePath("/dashboard/maintenance/fault-code-rules")
    return { data: { success: true }, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: unknownErrorMessage(error, "Failed to delete fault code rule"), data: null }
  }
}

/**
 * Check low stock for maintenance parts
 */
export async function checkLowStockForMaintenanceParts() {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    const { data, error } = await supabase.rpc("check_low_stock_for_maintenance_parts", {
      p_company_id: ctx.companyId,
    })

    if (error) {
      return { error: error.message, data: null }
    }

    return { data: data || [], error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: unknownErrorMessage(error, "Failed to check low stock"), data: null }
  }
}

/**
 * Auto-create part orders for low stock
 */
export async function autoCreatePartOrdersForLowStock(reorderMultiplier: number = 2.0) {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // RBAC check
  const permissionCheck = await checkCreatePermission("maintenance")
  if (!permissionCheck.allowed) {
    return { error: permissionCheck.error || "You don't have permission to create part orders", data: null }
  }

  // Validate reorderMultiplier to prevent abuse
  if (reorderMultiplier < 1 || reorderMultiplier > 10) {
    return { error: "Reorder multiplier must be between 1 and 10", data: null }
  }

  try {
    const { data, error } = await supabase.rpc("auto_create_part_orders_for_low_stock", {
      p_company_id: ctx.companyId,
      p_reorder_quantity_multiplier: reorderMultiplier,
    })

    if (error) {
      return { error: error.message, data: null }
    }

    revalidatePath("/dashboard/maintenance")

    return { data: data || [], error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: unknownErrorMessage(error, "Failed to create part orders"), data: null }
  }
}


