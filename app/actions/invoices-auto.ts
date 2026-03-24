"use server"

import { createClient } from "@/lib/supabase/server"
import { errorMessage } from "@/lib/error-message"
import { revalidatePath } from "next/cache"
import { getCachedAuthContext } from "@/lib/auth/server"
import { createInvoice } from "./accounting"
import { checkCreatePermission } from "@/lib/server-permissions"
import * as Sentry from "@sentry/nextjs"

// BUG-010 FIX: Add try/catch and permission check
export async function autoGenerateInvoicesFromLoads() {
  // BUG-010 FIX: Add permission check
  const permission = await checkCreatePermission("accounting")
  if (!permission.allowed) {
    return { error: permission.error || "You don't have permission to create invoices", data: null }
  }

  // BUG-010 FIX: Add try/catch wrapper
  try {
    const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // Get all delivered loads that don't have an invoice yet
  const { data: loads, error: loadsError } = await supabase
    .from("loads")
    .select("id, shipment_number, company_name, value, total_revenue, estimated_revenue, customer_id, status, load_date")
    .eq("company_id", ctx.companyId)
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
    .eq("company_id", ctx.companyId)
    .not("load_id", "is", null)

  const existingLoadIds = new Set<string>()
  if (existingInvoices && Array.isArray(existingInvoices)) {
    for (let i = 0; i < existingInvoices.length; i++) {
      const invoice = existingInvoices[i] as { load_id: string | null; [key: string]: any }
      if (invoice && invoice.load_id) {
        existingLoadIds.add(invoice.load_id)
      }
    }
  }

  let generated = 0
  const errors: Array<{ load_id: string; error: string }> = []

  // BUG-008 FIX: Batch invoice creation instead of sequential loop to prevent timeout
  // First, get all customer names in one query
  const customerIds = [...new Set(loads.map((l: any) => l.customer_id).filter(Boolean) as string[])]
  const customerMap = new Map<string, string>()
  
  if (customerIds.length > 0) {
    const { data: customers } = await supabase
      .from("customers")
      .select("id, name, company_name")
      .in("id", customerIds)
    
    if (customers) {
      for (const customer of customers) {
        customerMap.set(customer.id, customer.company_name || customer.name || "Unknown Customer")
      }
    }
  }

  // Prepare all invoice data for batch insert
  const invoiceData: Array<{
    company_id: string
    customer_name: string
    load_id: string
    amount: number
    issue_date: string
    due_date: string
    payment_terms: string
    description: string
    status: string
    invoice_number?: string
  }> = []

  const issueDate = new Date().toISOString().split("T")[0]
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 30)
  const dueDateStr = dueDate.toISOString().split("T")[0]

  for (const load of loads) {
    // Skip if invoice already exists for this load
    if (existingLoadIds.has(load.id)) {
      continue
    }

    // Get customer name
    const customerName = load.customer_id 
      ? (customerMap.get(load.customer_id) || load.company_name || "Unknown Customer")
      : (load.company_name || "Unknown Customer")

    // Calculate invoice amount
    const amount = Number(load.total_revenue || load.estimated_revenue || load.value || 0)

    if (amount <= 0) {
      errors.push({
        load_id: load.id,
        error: "Load has no revenue value",
      })
      continue
    }

    invoiceData.push({
      company_id: ctx.companyId,
      customer_name: customerName,
      load_id: load.id,
      amount: amount,
      issue_date: issueDate,
      due_date: dueDateStr,
      payment_terms: "Net 30",
      description: `Invoice for load ${load.shipment_number}`,
      status: "pending",
    })
  }

  // BUG-008 FIX: Batch insert invoices in chunks of 50 to avoid timeout
  const chunkSize = 50
  for (let i = 0; i < invoiceData.length; i += chunkSize) {
    const chunk = invoiceData.slice(i, i + chunkSize)
    
    try {
      const { data: insertedInvoices, error: insertError } = await supabase
        .from("invoices")
        .insert(chunk)
        .select("id, load_id")

      if (insertError) {
        // If batch insert fails, add all in chunk to errors
        for (const invoice of chunk) {
          errors.push({
            load_id: invoice.load_id,
            error: insertError.message || "Failed to create invoice",
          })
        }
        continue
      }

      // Update loads with invoice_ids
      if (insertedInvoices && insertedInvoices.length > 0) {
        for (const invoice of insertedInvoices) {
          if (invoice.load_id) {
            await supabase
              .from("loads")
              .update({ invoice_id: invoice.id })
              .eq("id", invoice.load_id)
          }
        }
        generated += insertedInvoices.length
      }
    } catch (error: unknown) {
      // If batch fails, add all in chunk to errors
      for (const invoice of chunk) {
        errors.push({
          load_id: invoice.load_id,
          error: errorMessage(error, "Unknown error"),
        })
      }
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
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { 
      error: errorMessage(error, "An unexpected error occurred while generating invoices"), 
      data: null 
    }
  }
}















