"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { createInvoice } from "./accounting"

export async function autoGenerateInvoicesFromLoads() {
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

  // Get all delivered loads that don't have an invoice yet
  const { data: loads, error: loadsError } = await supabase
    .from("loads")
    .select("id, shipment_number, company_name, value, total_revenue, estimated_revenue, customer_id, status, load_date")
    .eq("company_id", userData.company_id)
    .eq("status", "delivered")
    .is("invoice_id", null)

  if (loadsError) {
    return { error: loadsError.message, data: null }
  }

  if (!loads || loads.length === 0) {
    return {
      data: {
        generated: 0,
        message: "No delivered loads found without invoices",
        errors: [],
      },
      error: null,
    }
  }

  // Get existing invoice IDs to check for duplicates
  const { data: existingInvoices } = await supabase
    .from("invoices")
    .select("load_id")
    .eq("company_id", userData.company_id)
    .not("load_id", "is", null)

  const existingLoadIds = new Set(existingInvoices?.map((inv) => inv.load_id) || [])

  let generated = 0
  const errors: Array<{ load_id: string; error: string }> = []

  // Generate invoice for each load
  for (const load of loads) {
    // Skip if invoice already exists for this load
    if (existingLoadIds.has(load.id)) {
      continue
    }

    try {
      // Get customer name
      let customerName = load.company_name || "Unknown Customer"
      
      if (load.customer_id) {
        const { data: customer } = await supabase
          .from("customers")
          .select("name, company_name")
          .eq("id", load.customer_id)
          .single()
        
        if (customer) {
          customerName = customer.company_name || customer.name || customerName
        }
      }

      // Calculate invoice amount
      const amount = Number(load.total_revenue || load.estimated_revenue || load.value || 0)

      if (amount <= 0) {
        errors.push({
          load_id: load.id,
          error: "Load has no revenue value",
        })
        continue
      }

      // Calculate due date (30 days from today)
      const issueDate = new Date().toISOString().split("T")[0]
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 30)
      const dueDateStr = dueDate.toISOString().split("T")[0]

      // Create invoice
      const invoiceResult = await createInvoice({
        customer_name: customerName,
        load_id: load.id,
        amount: amount,
        issue_date: issueDate,
        due_date: dueDateStr,
        payment_terms: "Net 30",
        description: `Invoice for load ${load.shipment_number}`,
      })

      if (invoiceResult.error) {
        errors.push({
          load_id: load.id,
          error: invoiceResult.error,
        })
      } else {
        // Update load with invoice_id
        await supabase
          .from("loads")
          .update({ invoice_id: invoiceResult.data?.id })
          .eq("id", load.id)

        generated++
      }
    } catch (error: any) {
      errors.push({
        load_id: load.id,
        error: error.message || "Unknown error",
      })
    }
  }

  revalidatePath("/dashboard/accounting/invoices")
  revalidatePath("/dashboard/loads")

  return {
    data: {
      generated,
      message: `Successfully generated ${generated} invoice(s) from ${loads.length} delivered load(s)`,
      errors,
    },
    error: null,
  }
}















