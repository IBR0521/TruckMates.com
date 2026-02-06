"use server"

/**
 * Auto-generate invoice when POD is captured
 */

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"
import { createInvoice } from "./invoices"
import { getLoad } from "./loads"

/**
 * Auto-generate invoice when POD is captured
 */
export async function autoGenerateInvoiceOnPOD(loadId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  try {
    // Check if invoice already exists for this load
    const { data: existingInvoice } = await supabase
      .from("invoices")
      .select("id")
      .eq("load_id", loadId)
      .eq("company_id", company_id)
      .single()

    if (existingInvoice) {
      return {
        data: {
          invoiceId: existingInvoice.id,
          alreadyExists: true,
        },
        error: null,
      }
    }

    // Get load details
    const loadResult = await getLoad(loadId)
    if (loadResult.error || !loadResult.data) {
      return { error: loadResult.error || "Load not found", data: null }
    }

    const load = loadResult.data

    // Calculate invoice amount (use load rate or value)
    const amount = load.rate || load.value || 0

    if (amount === 0) {
      return {
        error: "Load has no rate or value. Cannot generate invoice.",
        data: null,
      }
    }

    // Get customer name (from load or company)
    const customerName = load.customer_name || load.consignee_name || "Customer"

    // Create invoice
    const invoiceResult = await createInvoice({
      customer_name: customerName,
      load_id: loadId,
      amount: amount,
      issue_date: new Date().toISOString().split("T")[0],
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0], // 30 days from now
      description: `Invoice for load ${load.shipment_number || loadId}`,
      items: [
        {
          description: `Freight: ${load.origin} to ${load.destination}`,
          quantity: 1,
          unit_price: amount,
          total: amount,
        },
      ],
    })

    if (invoiceResult.error) {
      return { error: invoiceResult.error, data: null }
    }

    // Attach POD documents to invoice
    if (invoiceResult.data) {
      try {
        // Get POD documents for this load
        const { data: podDocuments } = await supabase
          .from("documents")
          .select("id")
          .eq("load_id", loadId)
          .eq("type", "pod_photo")
          .limit(10)

        if (podDocuments && podDocuments.length > 0) {
          const { linkDocumentToRecord } = await import("./document-routing")
          for (const doc of podDocuments) {
            await linkDocumentToRecord(doc.id, "invoice", invoiceResult.data.id).catch(
              (err) => console.error("Failed to link POD to invoice:", err)
            )
          }
        }
      } catch (error) {
        console.error("Failed to attach POD documents:", error)
        // Don't fail if document linking fails
      }
    }

    return {
      data: {
        invoiceId: invoiceResult.data?.id,
        alreadyExists: false,
      },
      error: null,
    }
  } catch (error: any) {
    return { error: error.message || "Failed to auto-generate invoice", data: null }
  }
}


