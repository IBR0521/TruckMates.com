"use server"

import { createClient } from "@/lib/supabase/server"
import { errorMessage } from "@/lib/error-message"
import { getCachedAuthContext } from "@/lib/auth/server"
import { revalidatePath } from "next/cache"
import { checkEditPermission, checkViewPermission } from "@/lib/server-permissions"

/**
 * Link a document to an existing record
 */
export async function linkDocumentToRecord(
  documentId: string,
  recordType: "driver" | "vehicle" | "load" | "route" | "invoice" | "expense" | "maintenance",
  recordId: string
): Promise<{ success: boolean; error: string | null }> {
  // FIXED: Add RBAC check - linking documents requires edit permission
  const permissionCheck = await checkEditPermission("documents")
  if (!permissionCheck.allowed) {
    return { success: false, error: permissionCheck.error || "You don't have permission to link documents" }
  }

  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { success: false, error: ctx.error || "Not authenticated" }
    }

    // Verify document belongs to company
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("id, company_id, type") // FIXED: Include type to check if it should be preserved
      .eq("id", documentId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (docError || !document) {
      return { success: false, error: "Document not found" }
    }

    // FIXED: Verify record belongs to company before linking
    let recordBelongsToCompany = false
    switch (recordType) {
      case "driver":
        const { data: driverCheck } = await supabase
          .from("drivers")
          .select("id")
          .eq("id", recordId)
          .eq("company_id", ctx.companyId)
          .maybeSingle()
        recordBelongsToCompany = !!driverCheck
        break
      case "vehicle":
        const { data: truckCheck } = await supabase
          .from("trucks")
          .select("id")
          .eq("id", recordId)
          .eq("company_id", ctx.companyId)
          .maybeSingle()
        recordBelongsToCompany = !!truckCheck
        break
      case "load":
        const { data: loadCheck } = await supabase
          .from("loads")
          .select("id")
          .eq("id", recordId)
          .eq("company_id", ctx.companyId)
          .maybeSingle()
        recordBelongsToCompany = !!loadCheck
        break
      case "route":
        const { data: routeCheck } = await supabase
          .from("routes")
          .select("id")
          .eq("id", recordId)
          .eq("company_id", ctx.companyId)
          .maybeSingle()
        recordBelongsToCompany = !!routeCheck
        break
      case "invoice":
        const { data: invoiceCheck } = await supabase
          .from("invoices")
          .select("id")
          .eq("id", recordId)
          .eq("company_id", ctx.companyId)
          .maybeSingle()
        recordBelongsToCompany = !!invoiceCheck
        break
      case "expense":
        const { data: expenseCheck } = await supabase
          .from("expenses")
          .select("id")
          .eq("id", recordId)
          .eq("company_id", ctx.companyId)
          .maybeSingle()
        recordBelongsToCompany = !!expenseCheck
        break
      case "maintenance":
        const { data: maintenanceCheck } = await supabase
          .from("maintenance")
          .select("id")
          .eq("id", recordId)
          .eq("company_id", ctx.companyId)
          .maybeSingle()
        recordBelongsToCompany = !!maintenanceCheck
        break
    }

    if (!recordBelongsToCompany) {
      return { success: false, error: "Record not found or does not belong to your company" }
    }

    // Update document with appropriate foreign key
    const updateData: any = {}

    switch (recordType) {
      case "driver":
        updateData.driver_id = recordId
        updateData.type = "license" // Default type for driver documents
        break
      case "vehicle":
        updateData.truck_id = recordId
        // FIXED: Don't hardcode type to "insurance" - preserve existing type or use "other"
        // Only set type if document doesn't already have a meaningful type
        if (!document.type || document.type === "other") {
          updateData.type = "insurance" // Only default if no type set
        }
        break
      case "load":
        // FIXED: Set load_id foreign key (migration: supabase/add_documents_foreign_keys.sql)
        updateData.load_id = recordId
        // Preserve existing type if meaningful, otherwise set to "bol" or "pod_photo" based on document type
        if (!document.type || document.type === "other") {
          updateData.type = "bol" // Default for load documents
        }
        break
      case "route":
        // FIXED: Set route_id foreign key (migration: supabase/add_documents_foreign_keys.sql)
        updateData.route_id = recordId
        if (!document.type || document.type === "other") {
          updateData.type = "route_document"
        }
        break
      case "invoice":
        // FIXED: Set invoice_id foreign key (migration: supabase/add_documents_foreign_keys.sql)
        updateData.invoice_id = recordId
        updateData.type = "invoice"
        break
      case "expense":
        // FIXED: Set expense_id foreign key (migration: supabase/add_documents_foreign_keys.sql)
        updateData.expense_id = recordId
        if (!document.type || document.type === "other") {
          updateData.type = "expense_receipt"
        }
        break
      case "maintenance":
        updateData.type = "maintenance"
        // FIXED: Maintenance lookup with company_id filter
        const { data: maintenanceRecord } = await supabase
          .from("maintenance")
          .select("truck_id")
          .eq("id", recordId)
          .eq("company_id", ctx.companyId) // FIXED: Add company_id filter
          .maybeSingle()
        if (maintenanceRecord?.truck_id) {
          updateData.truck_id = maintenanceRecord.truck_id
        }
        break
    }

    // FIXED: Add company_id filter to update query for defense-in-depth
    const { error: updateError } = await supabase
      .from("documents")
      .update(updateData)
      .eq("id", documentId)
      .eq("company_id", ctx.companyId) // FIXED: Add company_id filter

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    revalidatePath("/dashboard/documents")
    return { success: true, error: null }
  } catch (error: unknown) {
    return { success: false, error: errorMessage(error, "Failed to link document") }
  }
}

/**
 * Get list of records for manual routing
 */
export async function getRecordsForRouting(
  recordType: "driver" | "vehicle" | "load" | "route" | "invoice" | "expense" | "maintenance"
): Promise<{ data: Array<{ id: string; name: string; [key: string]: any }> | null; error: string | null }> {
  // FIXED: Add RBAC check
  const permissionCheck = await checkViewPermission("documents")
  if (!permissionCheck.allowed) {
    return { error: permissionCheck.error || "You don't have permission to view records", data: null }
  }

  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    let query: any = null
    let selectFields = "id"

    switch (recordType) {
      case "driver":
        query = supabase
          .from("drivers")
          .select("id, name, email, phone")
          .eq("company_id", ctx.companyId)
          .order("name", { ascending: true })
        break
      case "vehicle":
        query = supabase
          .from("trucks")
          .select("id, truck_number, make, model, year")
          .eq("company_id", ctx.companyId)
          .order("truck_number", { ascending: true })
        break
      case "load":
        query = supabase
          .from("loads")
          .select("id, shipment_number, origin, destination, status")
          .eq("company_id", ctx.companyId)
          .order("created_at", { ascending: false })
          .limit(50)
        break
      case "route":
        query = supabase
          .from("routes")
          .select("id, name, origin, destination, status")
          .eq("company_id", ctx.companyId)
          .order("created_at", { ascending: false })
          .limit(50)
        break
      case "invoice":
        query = supabase
          .from("invoices")
          .select("id, invoice_number, customer_name, amount, status")
          .eq("company_id", ctx.companyId)
          .order("created_at", { ascending: false })
          .limit(50)
        break
      case "expense":
        query = supabase
          .from("expenses")
          .select("id, description, amount, date, category")
          .eq("company_id", ctx.companyId)
          .order("date", { ascending: false })
          .limit(50)
        break
      case "maintenance":
        query = supabase
          .from("maintenance")
          .select("id, service_type, scheduled_date, truck_id")
          .eq("company_id", ctx.companyId)
          .order("scheduled_date", { ascending: false })
          .limit(50)
        break
    }

    if (!query) {
      return { error: "Invalid record type", data: null }
    }

    const { data, error } = await query

    if (error) {
      return { error: error.message, data: null }
    }

    // Format data for display
    const formattedData = data?.map((record: any) => {
      let name = ""
      switch (recordType) {
        case "driver":
          name = `${record.name || "Unknown"}${record.email ? ` (${record.email})` : ""}`
          break
        case "vehicle":
          name = `${record.truck_number || "Unknown"}${record.make ? ` - ${record.make} ${record.model || ""}` : ""}`
          break
        case "load":
          name = `${record.shipment_number || "Unknown"} - ${record.origin || ""} → ${record.destination || ""}`
          break
        case "route":
          name = `${record.name || "Unknown"} - ${record.origin || ""} → ${record.destination || ""}`
          break
        case "invoice":
          name = `${record.invoice_number || "Unknown"} - ${record.customer_name || ""} ($${record.amount || 0})`
          break
        case "expense":
          name = `${record.description || "Unknown"} - $${record.amount || 0} (${record.category || ""})`
          break
        case "maintenance":
          name = `${record.service_type || "Unknown"} - ${record.scheduled_date || ""}`
          break
      }
      return {
        id: record.id,
        name,
        ...record
      }
    }) || []

    return { data: formattedData, error: null }
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to fetch records"), data: null }
  }
}






