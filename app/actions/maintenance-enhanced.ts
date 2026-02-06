"use server"

/**
 * Enhanced Maintenance Features
 * - ELD Fault Code Analysis
 * - Work Orders Management
 * - Document Storage
 * - Parts Inventory Integration
 */

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"
import { revalidatePath } from "next/cache"

/**
 * Analyze ELD fault code and create maintenance if needed
 */
export async function analyzeFaultCodeAndCreateMaintenance(eventId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  try {
    const { data: maintenanceId, error } = await supabase.rpc(
      "analyze_fault_code_and_create_maintenance",
      { p_event_id: eventId }
    )

    if (error) {
      console.error("[Fault Code Analysis] Error:", error)
      return { error: error.message, data: null }
    }

    revalidatePath("/dashboard/maintenance")
    revalidatePath("/dashboard/eld/events")

    return { data: { maintenance_id: maintenanceId }, error: null }
  } catch (error: any) {
    console.error("[Fault Code Analysis] Error:", error)
    return { error: error.message || "Failed to analyze fault code", data: null }
  }
}

/**
 * Batch analyze pending fault codes
 */
export async function batchAnalyzePendingFaultCodes(companyId?: string, limit: number = 100) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = companyId || result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  try {
    const { data, error } = await supabase.rpc("batch_analyze_pending_fault_codes", {
      p_company_id: company_id,
      p_limit: limit,
    })

    if (error) {
      console.error("[Batch Fault Code Analysis] Error:", error)
      return { error: error.message, data: null }
    }

    revalidatePath("/dashboard/maintenance")
    revalidatePath("/dashboard/eld/events")

    return { data: data?.[0] || { processed: 0, created: 0, skipped: 0 }, error: null }
  } catch (error: any) {
    console.error("[Batch Fault Code Analysis] Error:", error)
    return { error: error.message || "Failed to batch analyze fault codes", data: null }
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", data: null }
  }

  try {
    // Get maintenance to verify access and get truck_id
    const { data: maintenance, error: maintenanceError } = await supabase
      .from("maintenance")
      .select("id, truck_id, company_id")
      .eq("id", maintenanceId)
      .eq("company_id", result.company_id)
      .single()

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

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("documents").getPublicUrl(fileName)

    // Save document record (trigger will sync to maintenance.documents)
    const { data: doc, error: docError } = await supabase
      .from("maintenance_documents")
      .insert({
        company_id: result.company_id,
        maintenance_id: maintenanceId,
        truck_id: maintenance.truck_id,
        document_type: documentType,
        name: file.name,
        description: description || null,
        storage_url: publicUrl,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: user.id,
      })
      .select()
      .single()

    if (docError) {
      return { error: docError.message, data: null }
    }

    revalidatePath("/dashboard/maintenance")
    revalidatePath(`/dashboard/maintenance/${maintenanceId}`)

    return { data: doc, error: null }
  } catch (error: any) {
    console.error("[Upload Maintenance Document] Error:", error)
    return { error: error.message || "Failed to upload document", data: null }
  }
}

/**
 * Get maintenance documents
 */
export async function getMaintenanceDocuments(maintenanceId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", data: null }
  }

  try {
    const { data: documents, error } = await supabase
      .from("maintenance_documents")
      .select(`
        *,
        uploaded_by_user:uploaded_by (id, name, email)
      `)
      .eq("maintenance_id", maintenanceId)
      .eq("company_id", result.company_id)
      .order("uploaded_at", { ascending: false })

    if (error) {
      return { error: error.message, data: null }
    }

    return { data: documents || [], error: null }
  } catch (error: any) {
    console.error("[Get Maintenance Documents] Error:", error)
    return { error: error.message || "Failed to get documents", data: null }
  }
}

/**
 * Delete maintenance document
 */
export async function deleteMaintenanceDocument(documentId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", data: null }
  }

  try {
    // Get document to get storage URL
    const { data: document, error: docError } = await supabase
      .from("maintenance_documents")
      .select("storage_url, maintenance_id")
      .eq("id", documentId)
      .eq("company_id", result.company_id)
      .single()

    if (docError || !document) {
      return { error: "Document not found", data: null }
    }

    // Delete from storage
    const fileName = document.storage_url.split("/").pop()
    if (fileName) {
      await supabase.storage.from("documents").remove([`maintenance/${document.maintenance_id}/${fileName}`])
    }

    // Delete from database (trigger will remove from maintenance.documents)
    const { error: deleteError } = await supabase.from("maintenance_documents").delete().eq("id", documentId)

    if (deleteError) {
      return { error: deleteError.message, data: null }
    }

    revalidatePath("/dashboard/maintenance")
    revalidatePath(`/dashboard/maintenance/${document.maintenance_id}`)

    return { data: { success: true }, error: null }
  } catch (error: any) {
    console.error("[Delete Maintenance Document] Error:", error)
    return { error: error.message || "Failed to delete document", data: null }
  }
}

/**
 * Create work order from maintenance
 */
export async function createWorkOrderFromMaintenance(maintenanceId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  try {
    const { data: workOrderId, error } = await supabase.rpc("create_work_order_from_maintenance", {
      p_maintenance_id: maintenanceId,
    })

    if (error) {
      console.error("[Create Work Order] Error:", error)
      return { error: error.message, data: null }
    }

    revalidatePath("/dashboard/maintenance")
    revalidatePath(`/dashboard/maintenance/${maintenanceId}`)

    return { data: { work_order_id: workOrderId }, error: null }
  } catch (error: any) {
    console.error("[Create Work Order] Error:", error)
    return { error: error.message || "Failed to create work order", data: null }
  }
}

/**
 * Get work order details
 */
export async function getWorkOrder(workOrderId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", data: null }
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
      .eq("company_id", result.company_id)
      .single()

    if (error) {
      return { error: error.message, data: null }
    }

    return { data: workOrder, error: null }
  } catch (error: any) {
    console.error("[Get Work Order] Error:", error)
    return { error: error.message || "Failed to get work order", data: null }
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", data: null }
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
      .eq("company_id", result.company_id)
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
  } catch (error: any) {
    console.error("[Get Work Orders] Error:", error)
    return { error: error.message || "Failed to get work orders", data: null }
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", data: null }
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
      .eq("company_id", result.company_id)
      .select()
      .single()

    if (error) {
      return { error: error.message, data: null }
    }

    revalidatePath("/dashboard/maintenance")
    revalidatePath(`/dashboard/maintenance/${workOrder.maintenance_id}`)

    return { data: workOrder, error: null }
  } catch (error: any) {
    console.error("[Update Work Order] Error:", error)
    return { error: error.message || "Failed to update work order", data: null }
  }
}

/**
 * Check and reserve parts for work order
 */
export async function checkAndReserveParts(workOrderId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  try {
    const { data, error } = await supabase.rpc("check_and_reserve_parts", {
      p_work_order_id: workOrderId,
    })

    if (error) {
      console.error("[Check Parts] Error:", error)
      return { error: error.message, data: null }
    }

    revalidatePath("/dashboard/maintenance")

    return { data: data || [], error: null }
  } catch (error: any) {
    console.error("[Check Parts] Error:", error)
    return { error: error.message || "Failed to check parts", data: null }
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
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
      console.error("[Complete Work Order] Error:", error)
      return { error: error.message, data: null }
    }

    revalidatePath("/dashboard/maintenance")
    revalidatePath(`/dashboard/maintenance/${maintenanceId}`)

    return { data: { maintenance_id: maintenanceId }, error: null }
  } catch (error: any) {
    console.error("[Complete Work Order] Error:", error)
    return { error: error.message || "Failed to complete work order", data: null }
  }
}

/**
 * Get fault code maintenance rules
 */
export async function getFaultCodeRules() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", data: null }
  }

  try {
    const { data: rules, error } = await supabase
      .from("fault_code_maintenance_rules")
      .select("*")
      .eq("company_id", result.company_id)
      .order("fault_code", { ascending: true })

    if (error) {
      return { error: error.message, data: null }
    }

    return { data: rules || [], error: null }
  } catch (error: any) {
    console.error("[Get Fault Code Rules] Error:", error)
    return { error: error.message || "Failed to get fault code rules", data: null }
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", data: null }
  }

  try {
    const ruleData: any = {
      company_id: result.company_id,
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
        .eq("company_id", result.company_id)
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
  } catch (error: any) {
    console.error("[Upsert Fault Code Rule] Error:", error)
    return { error: error.message || "Failed to save fault code rule", data: null }
  }
}

/**
 * Delete fault code rule
 */
export async function deleteFaultCodeRule(ruleId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", data: null }
  }

  try {
    const { error } = await supabase
      .from("fault_code_maintenance_rules")
      .delete()
      .eq("id", ruleId)
      .eq("company_id", result.company_id)

    if (error) {
      return { error: error.message, data: null }
    }

    revalidatePath("/dashboard/maintenance/fault-code-rules")
    return { data: { success: true }, error: null }
  } catch (error: any) {
    console.error("[Delete Fault Code Rule] Error:", error)
    return { error: error.message || "Failed to delete fault code rule", data: null }
  }
}

/**
 * Check low stock for maintenance parts
 */
export async function checkLowStockForMaintenanceParts() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", data: null }
  }

  try {
    const { data, error } = await supabase.rpc("check_low_stock_for_maintenance_parts", {
      p_company_id: result.company_id,
    })

    if (error) {
      return { error: error.message, data: null }
    }

    return { data: data || [], error: null }
  } catch (error: any) {
    console.error("[Check Low Stock] Error:", error)
    return { error: error.message || "Failed to check low stock", data: null }
  }
}

/**
 * Auto-create part orders for low stock
 */
export async function autoCreatePartOrdersForLowStock(reorderMultiplier: number = 2.0) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", data: null }
  }

  try {
    const { data, error } = await supabase.rpc("auto_create_part_orders_for_low_stock", {
      p_company_id: result.company_id,
      p_reorder_quantity_multiplier: reorderMultiplier,
    })

    if (error) {
      return { error: error.message, data: null }
    }

    revalidatePath("/dashboard/maintenance")

    return { data: data || [], error: null }
  } catch (error: any) {
    console.error("[Auto Create Part Orders] Error:", error)
    return { error: error.message || "Failed to create part orders", data: null }
  }
}


