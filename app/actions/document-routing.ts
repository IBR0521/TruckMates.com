"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

/**
 * Link a document to an existing record
 */
export async function linkDocumentToRecord(
  documentId: string,
  recordType: "driver" | "vehicle" | "load" | "route" | "invoice" | "expense" | "maintenance",
  recordId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "Not authenticated" }
    }

    const { data: userData } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single()

    if (!userData?.company_id) {
      return { success: false, error: "No company found" }
    }

    // Verify document belongs to company
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("id, company_id")
      .eq("id", documentId)
      .eq("company_id", userData.company_id)
      .single()

    if (docError || !document) {
      return { success: false, error: "Document not found" }
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
        updateData.type = "insurance" // Default type for vehicle documents
        break
      case "load":
        // Documents table might need load_id column - for now, we'll use a JSONB field or add it
        // Check if load_id column exists, if not we'll store in metadata
        updateData.type = "other"
        // Note: You may need to add load_id, route_id, invoice_id, expense_id columns to documents table
        break
      case "route":
        updateData.type = "other"
        break
      case "invoice":
        updateData.type = "invoice"
        break
      case "expense":
        updateData.type = "other"
        break
      case "maintenance":
        updateData.type = "maintenance"
        // Maintenance documents should link to truck_id
        const { data: maintenanceRecord } = await supabase
          .from("maintenance")
          .select("truck_id")
          .eq("id", recordId)
          .single()
        if (maintenanceRecord?.truck_id) {
          updateData.truck_id = maintenanceRecord.truck_id
        }
        break
    }

    const { error: updateError } = await supabase
      .from("documents")
      .update(updateData)
      .eq("id", documentId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    revalidatePath("/dashboard/documents")
    return { success: true, error: null }
  } catch (error: any) {
    return { success: false, error: error?.message || "Failed to link document" }
  }
}

/**
 * Get list of records for manual routing
 */
export async function getRecordsForRouting(
  recordType: "driver" | "vehicle" | "load" | "route" | "invoice" | "expense" | "maintenance"
): Promise<{ data: Array<{ id: string; name: string; [key: string]: any }> | null; error: string | null }> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: "Not authenticated", data: null }
    }

    const { data: userData } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single()

    if (!userData?.company_id) {
      return { error: "No company found", data: null }
    }

    let query: any = null
    let selectFields = "id"

    switch (recordType) {
      case "driver":
        query = supabase
          .from("drivers")
          .select("id, name, email, phone")
          .eq("company_id", userData.company_id)
          .order("name", { ascending: true })
        break
      case "vehicle":
        query = supabase
          .from("trucks")
          .select("id, truck_number, make, model, year")
          .eq("company_id", userData.company_id)
          .order("truck_number", { ascending: true })
        break
      case "load":
        query = supabase
          .from("loads")
          .select("id, shipment_number, origin, destination, status")
          .eq("company_id", userData.company_id)
          .order("created_at", { ascending: false })
          .limit(50)
        break
      case "route":
        query = supabase
          .from("routes")
          .select("id, name, origin, destination, status")
          .eq("company_id", userData.company_id)
          .order("created_at", { ascending: false })
          .limit(50)
        break
      case "invoice":
        query = supabase
          .from("invoices")
          .select("id, invoice_number, customer_name, amount, status")
          .eq("company_id", userData.company_id)
          .order("created_at", { ascending: false })
          .limit(50)
        break
      case "expense":
        query = supabase
          .from("expenses")
          .select("id, description, amount, date, category")
          .eq("company_id", userData.company_id)
          .order("date", { ascending: false })
          .limit(50)
        break
      case "maintenance":
        query = supabase
          .from("maintenance")
          .select("id, service_type, scheduled_date, truck_id")
          .eq("company_id", userData.company_id)
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
  } catch (error: any) {
    return { error: error?.message || "Failed to fetch records", data: null }
  }
}





