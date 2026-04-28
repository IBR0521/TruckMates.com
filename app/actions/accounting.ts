"use server"

import { createClient } from "@/lib/supabase/server"
import { errorMessage, sanitizeError } from "@/lib/error-message"
import { revalidatePath } from "next/cache"
import { getCachedAuthContext } from "@/lib/auth/server"
import * as Sentry from "@sentry/nextjs"
import { validatePricingData, validateNonNegativeNumber, sanitizeString, validateDate, validateRequiredString } from "@/lib/validation"
import { checkCreatePermission, checkEditPermission, checkDeletePermission } from "@/lib/server-permissions"
import { requireActiveSubscriptionForWrite } from "@/lib/subscription-access"
import { mapLegacyRole } from "@/lib/roles"

function safeDbError(error: unknown, fallback = "Database operation failed"): string {
  Sentry.captureException(error)
  return sanitizeError(error, { fallback })
}

export async function getInvoices(filters?: {
  load_id?: string
  status?: string
  limit?: number
  offset?: number
}) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    // Build query with selective columns and pagination
    let query = supabase
      .from("invoices")
      .select("id, invoice_number, customer_name, amount, status, issue_date, due_date, load_id, factoring_provider, factoring_status, factoring_external_id, factoring_reference_number, factoring_status_reason, factoring_submitted_at, factoring_last_checked_at, factoring_funded_at, factoring_funded_amount, created_at", { count: "exact" })
      .eq("company_id", ctx.companyId)
      .order("created_at", { ascending: false })

    // Apply filters
    if (filters?.load_id) {
      query = query.eq("load_id", filters.load_id)
    }
    if (filters?.status) {
      query = query.eq("status", filters.status)
    }

    // Apply pagination (default limit 25 for faster initial loads, max 100)
    const limit = Math.min(filters?.limit || 25, 100)
    const offset = filters?.offset || 0
    query = query.range(offset, offset + limit - 1)

    const { data: invoices, error, count } = await query

    if (error) {
      return { error: safeDbError(error), data: null, count: 0 }
    }

    return { data: invoices || [], error: null, count: count || 0 }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "An unexpected error occurred"), data: null, count: 0 }
  }
}

// Get single invoice
export async function getInvoice(id: string) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    // V3-007 FIX: Replace select(*) with explicit columns
    const { data: invoice, error } = await supabase
      .from("invoices")
      .select(`
        id, company_id, invoice_number, customer_id, customer_name, load_id, amount, status, issue_date, due_date, payment_terms, description, items, paid_amount, paid_date, payment_method, notes, tax_amount, tax_rate, subtotal, stripe_invoice_id, stripe_payment_intent_id, quickbooks_id, quickbooks_synced_at,
        factoring_provider, factoring_status, factoring_external_id, factoring_reference_number, factoring_status_reason, factoring_submitted_at, factoring_last_checked_at, factoring_funded_at, factoring_funded_amount,
        created_at, updated_at,
        companies:company_id ( name ),
        loads:load_id (
          id,
          shipment_number,
          origin,
          destination,
          company_name
        )
      `)
      .eq("id", id)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (error || !invoice) {
      return { error: error?.message || "Invoice not found", data: null }
    }

    if (!invoice) {
      return { error: "Invoice not found", data: null }
    }

    return { data: invoice, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "An unexpected error occurred"), data: null }
  }
}

export async function getExpenses(filters?: {
  category?: string
  limit?: number
  offset?: number
}) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    // Build query with selective columns and pagination
    let query = supabase
      .from("expenses")
      .select("id, category, description, amount, date, driver_id, truck_id, vendor, gl_code, payment_method, created_at", { count: "exact" })
      .eq("company_id", ctx.companyId)
      .order("created_at", { ascending: false })

    // Apply filters
    if (filters?.category) {
      query = query.eq("category", filters.category)
    }

    // Apply pagination (default limit 25 for faster initial loads, max 100)
    const limit = Math.min(filters?.limit || 25, 100)
    const offset = filters?.offset || 0
    query = query.range(offset, offset + limit - 1)

    const { data: expenses, error, count } = await query

    if (error) {
      return { error: safeDbError(error), data: null, count: 0 }
    }

    return { data: expenses || [], error: null, count: count || 0 }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "An unexpected error occurred"), data: null, count: 0 }
  }
}

export async function getSettlements() {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // V3-007 FIX: Replace select(*) with explicit columns and add LIMIT
  const { data: settlements, error } = await supabase
    .from("settlements")
    .select(`
      id, company_id, driver_id, period_start, period_end, gross_pay, fuel_deduction, advance_deduction, lease_deduction, other_deductions, total_deductions, per_diem_eligible_nights, per_diem_rate_used, per_diem_amount, net_pay, status, paid_date, payment_method, payment_reference, payment_eta, stripe_transfer_id, stripe_payout_id, gl_code, loads, pay_rule_id, calculation_details, pdf_url, driver_approved, driver_approved_at, driver_approval_method, created_at, updated_at,
      drivers:driver_id (
        id,
        name
      )
    `)
    .eq("company_id", ctx.companyId)
    .order("created_at", { ascending: false })
    .limit(1000)

  if (error || !settlements) {
    return { error: error?.message || "Settlements not found", data: null }
  }

  return { data: settlements, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "An unexpected error occurred"), data: null }
  }
}

export async function getSettlement(id: string) {
  try {
    const supabase = await createClient()

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    const { data: settlement, error } = await supabase
      .from("settlements")
      .select(`
        id, company_id, driver_id, period_start, period_end, gross_pay, fuel_deduction, advance_deduction, lease_deduction, other_deductions, total_deductions, per_diem_eligible_nights, per_diem_rate_used, per_diem_amount, net_pay, status, paid_date, payment_method, payment_reference, payment_eta, stripe_transfer_id, stripe_payout_id, gl_code, loads, pay_rule_id, calculation_details, pdf_url, driver_approved, driver_approved_at, driver_approval_method, created_at, updated_at,
        drivers:driver_id (
          id,
          name
        )
      `)
      .eq("id", id)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (error || !settlement) {
      return { error: error?.message || "Settlement not found", data: null }
    }

    return { data: settlement, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "An unexpected error occurred"), data: null }
  }
}

export async function markSettlementPaid(id: string, paymentMethod?: string) {
  try {
    const supabase = await createClient()

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    const permissionCheck = await checkEditPermission("settlements")
    if (!permissionCheck.allowed) {
      return { error: permissionCheck.error || "You don't have permission to update settlements", data: null }
    }

    const { data: settlementRow, error: settlementErr } = await supabase
      .from("settlements")
      .select("id, driver_id, net_pay, status, payment_method")
      .eq("id", id)
      .eq("company_id", ctx.companyId)
      .maybeSingle()
    if (settlementErr || !settlementRow) {
      return { error: "Settlement not found", data: null }
    }
    if (settlementRow.status === "paid") {
      return { error: "Settlement is already paid or not found", data: null }
    }

    const effectiveMethod = sanitizeString(paymentMethod || settlementRow.payment_method || "", 50).toLowerCase()
    const updateData: Record<string, any> = {
      status: "paid",
      paid_date: new Date().toISOString(),
    }
    if (effectiveMethod) {
      updateData.payment_method = effectiveMethod
    }

    if (effectiveMethod === "ach_stripe") {
      const { executeSettlementAchTransfer } = await import("./settlement-ach")
      const ach = await executeSettlementAchTransfer({
        settlementId: id,
        driverId: settlementRow.driver_id,
        amount: Number(settlementRow.net_pay || 0),
      })
      if (ach.error || !ach.data) {
        return { error: ach.error || "ACH transfer failed", data: null }
      }
      updateData.payment_reference = ach.data.paymentReference
      updateData.payment_eta = ach.data.eta || null
      updateData.stripe_transfer_id = ach.data.transferId
      updateData.stripe_payout_id = ach.data.payoutId
    }

    const { data, error } = await supabase
      .from("settlements")
      .update(updateData)
      .eq("id", id)
      .eq("company_id", ctx.companyId)
      .select("id, status, paid_date, payment_method, payment_reference, payment_eta, stripe_transfer_id, stripe_payout_id")
      .maybeSingle()

    if (error) {
      return { error: safeDbError(error), data: null }
    }
    if (!data) {
      return { error: "Settlement is already paid or not found", data: null }
    }

    revalidatePath("/dashboard/accounting/settlements")
    revalidatePath(`/dashboard/accounting/settlements/${id}`)
    return { data, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to mark settlement as paid"), data: null }
  }
}

export async function approveSettlementAsDriver(settlementId: string, approvalMethod: "web_app" | "mobile_app" | "email" | "sms" = "web_app") {
  try {
    const supabase = await createClient()

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId || !ctx.userId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    if (!ctx.user || mapLegacyRole(ctx.user.role) !== "driver") {
      return { error: "Only driver accounts can approve settlements", data: null }
    }

    const sub = await requireActiveSubscriptionForWrite()
    if (!sub.allowed) {
      return { error: sub.error || "Subscription inactive", data: null }
    }

    const { data: driver, error: driverError } = await supabase
      .from("drivers")
      .select("id")
      .eq("user_id", ctx.userId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (driverError || !driver) {
      return { error: "Driver profile not found", data: null }
    }

    const { data: settlement, error: settlementError } = await supabase
      .from("settlements")
      .select("id, status, driver_approved")
      .eq("id", settlementId)
      .eq("company_id", ctx.companyId)
      .eq("driver_id", driver.id)
      .maybeSingle()

    if (settlementError || !settlement) {
      return { error: "Settlement not found", data: null }
    }
    if (settlement.driver_approved) {
      return { error: "Settlement already approved", data: null }
    }
    if (settlement.status === "cancelled") {
      return { error: "Cannot approve a cancelled settlement", data: null }
    }

    const { data, error } = await supabase
      .from("settlements")
      .update({
        driver_approved: true,
        driver_approved_at: new Date().toISOString(),
        driver_approval_method: approvalMethod,
      })
      .eq("id", settlementId)
      .eq("company_id", ctx.companyId)
      .eq("driver_id", driver.id)
      .select("id, driver_approved, driver_approved_at, driver_approval_method")
      .maybeSingle()

    if (error || !data) {
      return { error: error?.message || "Failed to approve settlement", data: null }
    }

    revalidatePath("/dashboard/accounting/settlements")
    revalidatePath(`/dashboard/accounting/settlements/${settlementId}`)
    return { data, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to approve settlement"), data: null }
  }
}

export async function updateInvoice(
  id: string,
  formData: {
    status?: string
    amount?: number
    issue_date?: string
    due_date?: string
    payment_terms?: string
    description?: string
    [key: string]: any
  }
) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    // RBAC check
    const permissionCheck = await checkEditPermission("invoicing")
    if (!permissionCheck.allowed) {
      return { error: permissionCheck.error || "You don't have permission to edit invoices", data: null }
    }

    // V3-014 FIX: Validate negative amounts
    if (formData.amount !== undefined && formData.amount < 0) {
      return { error: "Amount must be non-negative", data: null }
    }

    // DAT-005 FIX: Validate due_date is after issue_date if both are provided
    if (formData.issue_date && formData.due_date) {
      const issueDate = new Date(formData.issue_date)
      const dueDate = new Date(formData.due_date)
      if (dueDate <= issueDate) {
        return { error: "Due date must be after issue date", data: null }
      }
    }

    // Build update data
    const { data: existingInvoice } = await supabase
      .from("invoices")
      .select("id, status, invoice_number, amount")
      .eq("id", id)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    const updateData: any = {}
    if (formData.status !== undefined) updateData.status = formData.status
    if (formData.amount !== undefined) updateData.amount = formData.amount
    if (formData.issue_date !== undefined) updateData.issue_date = formData.issue_date
    if (formData.due_date !== undefined) updateData.due_date = formData.due_date
    if (formData.payment_terms !== undefined) updateData.payment_terms = formData.payment_terms
    if (formData.description !== undefined) updateData.description = formData.description

    // V3-007 FIX: Replace implicit select() with explicit columns
    const { data, error } = await supabase
      .from("invoices")
      .update(updateData)
      .eq("id", id)
      .eq("company_id", ctx.companyId)
      .select("id, company_id, invoice_number, customer_id, customer_name, load_id, amount, status, issue_date, due_date, payment_terms, description, items, paid_amount, paid_date, payment_method, notes, tax_amount, tax_rate, subtotal, created_at, updated_at")
      .maybeSingle()

    if (error || !data) {
      return { error: error?.message || "Invoice not found", data: null }
    }

    revalidatePath("/dashboard/accounting/invoices")
    revalidatePath(`/dashboard/accounting/invoices/${id}`)
    if (
      String(existingInvoice?.status || "").toLowerCase() !== "paid" &&
      String(updateData.status || "").toLowerCase() === "paid"
    ) {
      try {
        const { sendPushToCompanyRoles } = await import("./push-notifications")
        await sendPushToCompanyRoles(
          ctx.companyId,
          ["super_admin", "operations_manager", "financial_controller"],
          {
            title: "Invoice payment received",
            body: `${data.invoice_number || "Invoice"} was marked paid for $${Number(data.amount || 0).toFixed(2)}`,
            data: {
              type: "invoice_paid",
              invoiceId: String(id),
              link: `/dashboard/accounting/invoices/${id}`,
            },
          },
        )
      } catch (error) {
        Sentry.captureException(error)
      }
    }
    return { data, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "An unexpected error occurred"), data: null }
  }
}

export async function duplicateInvoice(id: string) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // RBAC check
  const permissionCheck = await checkCreatePermission("invoicing")
  if (!permissionCheck.allowed) {
    return { error: permissionCheck.error || "You don't have permission to duplicate invoices", data: null }
  }

  // Get the original invoice
  // V3-007 FIX: Replace select(*) with explicit columns
  // Include all columns needed for duplication
  const { data: originalInvoice, error: fetchError } = await supabase
    .from("invoices")
    .select("id, company_id, invoice_number, customer_id, customer_name, load_id, amount, status, issue_date, due_date, payment_terms, description, items, paid_amount, paid_date, payment_method, notes, created_at, updated_at")
    .eq("id", id)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (fetchError || !originalInvoice) {
    return { error: "Invoice not found", data: null }
  }

  // Generate new invoice number (only after RBAC passes)
  const { generateInvoiceNumber } = await import("./number-formats")
  const numberResult = await generateInvoiceNumber()
  if (numberResult.error || !numberResult.data) {
    return { error: numberResult.error || "Failed to generate invoice number", data: null }
  }

  // Create duplicate with new invoice number and reset status
  const duplicateData: any = { ...originalInvoice }
  delete duplicateData.id
  delete duplicateData.created_at
  delete duplicateData.updated_at
  delete duplicateData.paid_at
  delete duplicateData.stripe_invoice_id
  delete duplicateData.stripe_payment_intent_id
  duplicateData.invoice_number = numberResult.data
  duplicateData.status = "draft" // Reset to draft
  duplicateData.issue_date = new Date().toISOString().split("T")[0] // Today's date
  
  // Recalculate due_date based on new issue_date and payment_terms
  const issueDate = new Date(duplicateData.issue_date)
  const paymentTerms = duplicateData.payment_terms || "Net 30"
  let days = 30 // default
  if (paymentTerms.includes("Net 7")) days = 7
  else if (paymentTerms.includes("Net 15")) days = 15
  else if (paymentTerms.includes("Net 45")) days = 45
  else if (paymentTerms.includes("Net 60")) days = 60
  else if (paymentTerms.includes("Net 90")) days = 90
  else if (paymentTerms.includes("Due on Receipt")) days = 0
  issueDate.setDate(issueDate.getDate() + days)
  duplicateData.due_date = issueDate.toISOString().split("T")[0]

  // V3-007 FIX: Replace implicit select() with explicit columns
  const { data: newInvoice, error: createError } = await supabase
    .from("invoices")
    .insert(duplicateData)
    .select("id, company_id, invoice_number, customer_id, customer_name, load_id, amount, status, issue_date, due_date, payment_terms, description, items, paid_amount, paid_date, payment_method, notes, tax_amount, tax_rate, subtotal, created_at, updated_at")
    .maybeSingle()

  if (createError || !newInvoice) {
    return { error: createError?.message || "Invoice not created", data: null }
  }

  revalidatePath("/dashboard/accounting/invoices")
  return { data: newInvoice, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "An unexpected error occurred"), data: null }
  }
}

export async function deleteInvoice(id: string) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated" }
  }

  // RBAC check
  const permissionCheck = await checkDeletePermission("invoicing")
  if (!permissionCheck.allowed) {
    return { error: permissionCheck.error || "You don't have permission to delete invoices" }
  }

  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", id)
    .eq("company_id", ctx.companyId)

  if (error) return { error: safeDbError(error) }

  revalidatePath("/dashboard/accounting/invoices")
    return { error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "An unexpected error occurred") }
  }
}

export async function deleteExpense(id: string) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated" }
  }

  // RBAC check
  const permissionCheck = await checkDeletePermission("accounting")
  if (!permissionCheck.allowed) {
    return { error: permissionCheck.error || "You don't have permission to delete expenses" }
  }

  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("company_id", ctx.companyId)

  if (error) return { error: safeDbError(error) }

  revalidatePath("/dashboard/accounting/expenses")
  return { error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "An unexpected error occurred") }
  }
}

export async function deleteSettlement(id: string) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated" }
  }

  // RBAC check
  const permissionCheck = await checkDeletePermission("settlements")
  if (!permissionCheck.allowed) {
    return { error: permissionCheck.error || "You don't have permission to delete settlements" }
  }

  const { error } = await supabase
    .from("settlements")
    .delete()
    .eq("id", id)
    .eq("company_id", ctx.companyId)

  if (error) return { error: safeDbError(error) }

  revalidatePath("/dashboard/accounting/settlements")
  return { error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "An unexpected error occurred") }
  }
}

// Create invoice
export async function createInvoice(formData: {
  customer_name: string
  load_id?: string
  amount: number
  issue_date: string
  due_date: string
  payment_terms?: string
  description?: string
  items?: any[]
}) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // RBAC check
  const permissionCheck = await checkCreatePermission("invoicing")
  if (!permissionCheck.allowed) {
    return { error: permissionCheck.error || "You don't have permission to create invoices", data: null }
  }

  // Get company settings to apply invoice defaults
  const { getCompanySettings } = await import("./number-formats")
  const settingsResult = await getCompanySettings()
  const settings = settingsResult.data || {}

  // Professional validation
  if (!validateRequiredString(formData.customer_name, 2, 200)) {
    return { error: "Customer name is required and must be between 2 and 200 characters", data: null }
  }

  if (!validateNonNegativeNumber(formData.amount)) {
    return { error: "Amount must be a non-negative number", data: null }
  }

  if (formData.amount <= 0) {
    return { error: "Invoice amount must be greater than 0", data: null }
  }

  if (!validateDate(formData.issue_date)) {
    return { error: "Invalid issue date format (use YYYY-MM-DD)", data: null }
  }

  if (!validateDate(formData.due_date)) {
    return { error: "Invalid due date format (use YYYY-MM-DD)", data: null }
  }

  // DAT-005 FIX: Validate that due_date is after issue_date (not equal or before)
  const issueDate = new Date(formData.issue_date)
  const dueDate = new Date(formData.due_date)
  if (dueDate <= issueDate) {
    return { error: "Due date must be after issue date", data: null }
  }

  // Validate load if provided
  if (formData.load_id) {
    const { data: load, error: loadError } = await supabase
      .from("loads")
      .select("id, company_id")
      .eq("id", formData.load_id)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (loadError || !load) {
      return { error: "Invalid load selected", data: null }
    }
  }

  // Generate invoice number using format system
  const { generateInvoiceNumber } = await import("./number-formats")
  const numberResult = await generateInvoiceNumber()
  if (numberResult.error || !numberResult.data) {
    return { error: numberResult.error || "Failed to generate invoice number", data: null }
  }
  const invoiceNumber = numberResult.data

  // Apply invoice settings
  const paymentTerms = formData.payment_terms || settings.default_payment_terms || "Net 30"
  // V3-013 FIX: Guard parseFloat against NaN and invalid strings
  let finalAmount: number =
    typeof formData.amount === "string"
      ? Number.parseFloat(formData.amount)
      : Number(formData.amount)

  if (!Number.isFinite(finalAmount) || Number.isNaN(finalAmount)) {
    return { error: "Amount must be a valid number", data: null }
  }

  let taxAmount = 0
  let subtotal = finalAmount

  // Apply tax if enabled
  // V3-006 FIX: Round at each step to prevent float precision errors
  if (settings.tax_enabled && settings.default_tax_rate) {
    if (settings.tax_inclusive) {
      // Tax is included in the amount, calculate subtotal
      // Round to 2 decimal places to prevent float precision errors
      subtotal = Math.round((finalAmount / (1 + settings.default_tax_rate / 100)) * 100) / 100
      taxAmount = Math.round((finalAmount - subtotal) * 100) / 100
      // Ensure final amount matches exactly
      finalAmount = Math.round((subtotal + taxAmount) * 100) / 100
    } else {
      // Tax is added to the amount
      taxAmount = Math.round((subtotal * settings.default_tax_rate / 100) * 100) / 100
      finalAmount = Math.round((subtotal + taxAmount) * 100) / 100
    }
  }

  // Calculate due date from payment terms if not provided
  let calculatedDueDate = formData.due_date
  if (!calculatedDueDate && formData.issue_date) {
    const issueDate = new Date(formData.issue_date)
    let days = 30 // default
    if (paymentTerms && typeof paymentTerms === 'string') {
      if (paymentTerms.includes("Net 7")) days = 7
      else if (paymentTerms.includes("Net 15")) days = 15
      else if (paymentTerms.includes("Net 45")) days = 45
      else if (paymentTerms.includes("Net 60")) days = 60
      else if (paymentTerms.includes("Net 90")) days = 90
      else if (paymentTerms.includes("Due on Receipt")) days = 0
    }
    issueDate.setDate(issueDate.getDate() + days)
    calculatedDueDate = issueDate.toISOString().split('T')[0]
  }

  const invoiceData: any = {
    company_id: ctx.companyId,
    invoice_number: invoiceNumber,
    customer_name: sanitizeString(formData.customer_name, 200),
    load_id: formData.load_id || null,
    amount: finalAmount,
    status: "pending",
    issue_date: formData.issue_date,
    due_date: calculatedDueDate,
    payment_terms: sanitizeString(paymentTerms, 50),
    description: formData.description ? sanitizeString(formData.description, 2000) : null,
    items: formData.items || null,
  }

  // Add tax information if tax is enabled
  if (settings.tax_enabled) {
    invoiceData.tax_amount = taxAmount
    invoiceData.tax_rate = settings.default_tax_rate
    invoiceData.subtotal = subtotal
  }

  // V3-007 FIX: Replace implicit select() with explicit columns
  const { data, error } = await supabase
    .from("invoices")
    .insert(invoiceData)
    .select("id, company_id, invoice_number, customer_id, customer_name, load_id, amount, status, issue_date, due_date, payment_terms, description, items, paid_amount, paid_date, payment_method, notes, tax_amount, tax_rate, subtotal, created_at, updated_at")
    .single()

  if (error || !data) {
    return { error: error?.message || "Invoice not created", data: null }
  }

  // Auto-send invoice if enabled
  if (settings.invoice_auto_send && data) {
    try {
      // Import email sending function (to be implemented)
      const { sendInvoiceEmail } = await import("./invoice-email")
      await sendInvoiceEmail(data.id, {
        subject: settings.invoice_email_subject || "Invoice {INVOICE_NUMBER} from {COMPANY_NAME}",
        body: settings.invoice_email_body || "",
      cc_emails: settings.cc_emails ? settings.cc_emails.split(',').map((e: string) => e.trim()).filter((e: string) => e.length > 0) : [],
      bcc_emails: settings.bcc_emails ? settings.bcc_emails.split(',').map((e: string) => e.trim()).filter((e: string) => e.length > 0) : [],
        send_copy_to_company: settings.send_copy_to_company || false,
        include_bol: settings.include_bol_in_invoice || false,
        auto_attach_documents: settings.auto_attach_documents || false,
      })
    } catch (emailError) {
      // Log error but don't fail invoice creation
      Sentry.captureException(emailError)
    }
  }

  // Auto-submit to factoring company API (if enabled/configured)
  if (data?.id) {
    try {
      const { maybeAutoSubmitFactoringApiOnInvoiceCreated } = await import("./factoring-api")
      await maybeAutoSubmitFactoringApiOnInvoiceCreated(data.id).catch((err) =>
        Sentry.captureException(err),
      )
    } catch (e) {
      Sentry.captureException(e)
    }
  }

  revalidatePath("/dashboard/accounting/invoices")
  
  // Trigger webhook
  try {
    const { triggerWebhook } = await import("./webhooks")
    await triggerWebhook(ctx.companyId, "invoice.created", {
      invoice_id: data.id,
      invoice_number: invoiceNumber,
      amount: finalAmount,
      customer_name: formData.customer_name,
    })
  } catch (error) {
    Sentry.captureException(error)
  }
  
    return { data, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to create invoice"), data: null }
  }
}

// Get load data for invoice auto-fill
export async function getLoadForInvoice(loadId: string) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const { data: load, error } = await supabase
    .from("loads")
    .select("id, shipment_number, value, company_name, origin, destination, contents")
    .eq("id", loadId)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (error || !load) {
    return { error: error?.message || "Load not found", data: null }
  }

  return { data: load, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "An unexpected error occurred"), data: null }
  }
}

// Create expense
export async function createExpense(formData: {
  category: string
  description: string
  amount: number
  date: string
  vendor?: string
  driver_id?: string
  truck_id?: string
  mileage?: number
  payment_method?: string
  receipt_url?: string
  has_receipt?: boolean
  fuel_level_after?: number
  gallons?: number
  price_per_gallon?: number
  gl_code?: string
}) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    // RBAC check
    const permissionCheck = await checkCreatePermission("accounting")
    if (!permissionCheck.allowed) {
      return { error: permissionCheck.error || "You don't have permission to create expenses", data: null }
    }

  // Professional validation
  if (!validateRequiredString(formData.category, 1, 100)) {
    return { error: "Category is required and must be between 1 and 100 characters", data: null }
  }

  if (!validateRequiredString(formData.description, 3, 500)) {
    return { error: "Description is required and must be between 3 and 500 characters", data: null }
  }

  if (!validateNonNegativeNumber(formData.amount)) {
    return { error: "Amount must be a non-negative number", data: null }
  }

  if (formData.amount <= 0) {
    return { error: "Expense amount must be greater than 0", data: null }
  }

  if (!validateDate(formData.date)) {
    return { error: "Invalid date format (use YYYY-MM-DD)", data: null }
  }

  if (formData.mileage !== undefined && formData.mileage !== null) {
    if (!validateNonNegativeNumber(formData.mileage)) {
      return { error: "Mileage must be a non-negative number", data: null }
    }
  }

  if (formData.fuel_level_after !== undefined && formData.fuel_level_after !== null) {
    const fuel = typeof formData.fuel_level_after === 'string' ? parseFloat(formData.fuel_level_after) : formData.fuel_level_after
    if (isNaN(fuel) || fuel < 0 || fuel > 100) {
      return { error: "Fuel level must be between 0 and 100", data: null }
    }
  }

  // Validate driver if provided
  if (formData.driver_id) {
    const { data: driver, error: driverError } = await supabase
      .from("drivers")
      .select("id, company_id")
      .eq("id", formData.driver_id)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (driverError || !driver) {
      return { error: "Invalid driver selected", data: null }
    }
  }

  // Validate truck if provided
  if (formData.truck_id) {
    const { data: truck, error: truckError } = await supabase
      .from("trucks")
      .select("id, company_id")
      .eq("id", formData.truck_id)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (truckError || !truck) {
      return { error: "Invalid truck selected", data: null }
    }
  }

  // Vendor is stored as free-text name on expenses; no ID validation.

  // Try to auto-link to route/load based on date, driver, and truck
  let linkedRouteId = null
  let linkedLoadId = null

  if (formData.driver_id || formData.truck_id) {
    // Find matching route for the same date, driver, and truck
    let routeQuery = supabase
      .from("routes")
      .select("id")
      .eq("company_id", ctx.companyId)
      .gte("created_at", `${formData.date}T00:00:00`)
      .lte("created_at", `${formData.date}T23:59:59`)

    if (formData.driver_id) {
      routeQuery = routeQuery.eq("driver_id", formData.driver_id)
    }
    if (formData.truck_id) {
      routeQuery = routeQuery.eq("truck_id", formData.truck_id)
    }

    const { data: matchingRoute, error: matchingRouteError } = await routeQuery.limit(1).maybeSingle()

    if (matchingRouteError) {
      return { error: matchingRouteError.message, data: null }
    }

    if (matchingRoute) {
      linkedRouteId = matchingRoute.id
    }

    // Find matching load for the same date, driver, and truck
    let loadQuery = supabase
      .from("loads")
      .select("id")
      .eq("company_id", ctx.companyId)
      .eq("load_date", formData.date)

    if (formData.driver_id) {
      loadQuery = loadQuery.eq("driver_id", formData.driver_id)
    }
    if (formData.truck_id) {
      loadQuery = loadQuery.eq("truck_id", formData.truck_id)
    }

    const { data: matchingLoad, error: matchingLoadError } = await loadQuery.limit(1).maybeSingle()

    if (matchingLoadError) {
      return { error: matchingLoadError.message, data: null }
    }

    if (matchingLoad) {
      linkedLoadId = matchingLoad.id
    }
  }

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      company_id: ctx.companyId,
      category: sanitizeString(formData.category, 100).toLowerCase(),
      description: sanitizeString(formData.description, 500),
      // V3-013 FIX: Guard parseFloat against NaN
      amount: (() => {
        const val = typeof formData.amount === 'string' ? parseFloat(formData.amount) : formData.amount
        if (isNaN(val) || !isFinite(val)) {
          throw new Error("Invalid amount: must be a valid number")
        }
        return val
      })(),
      date: formData.date,
      vendor: formData.vendor || null,
      driver_id: formData.driver_id || null,
      truck_id: formData.truck_id || null,
      // V3-013 FIX: Guard all parseFloat calls against NaN
      mileage: formData.mileage ? (() => {
        const val = typeof formData.mileage === 'string' ? parseFloat(formData.mileage) : formData.mileage
        return (isNaN(val) || !isFinite(val)) ? null : val
      })() : null,
      payment_method: formData.payment_method ? sanitizeString(formData.payment_method, 50) : null,
      receipt_url: formData.receipt_url ? sanitizeString(formData.receipt_url, 500) : null,
      has_receipt: formData.has_receipt || false,
      fuel_level_after: formData.fuel_level_after ? (() => {
        const val = typeof formData.fuel_level_after === 'string' ? parseFloat(formData.fuel_level_after) : formData.fuel_level_after
        return (isNaN(val) || !isFinite(val)) ? null : val
      })() : null,
      gallons: formData.gallons ? (() => {
        const val = typeof formData.gallons === 'string' ? parseFloat(formData.gallons) : formData.gallons
        return (isNaN(val) || !isFinite(val)) ? null : val
      })() : null,
      price_per_gallon: formData.price_per_gallon ? (() => {
        const val = typeof formData.price_per_gallon === 'string' ? parseFloat(formData.price_per_gallon) : formData.price_per_gallon
        return (isNaN(val) || !isFinite(val)) ? null : val
      })() : null,
      gl_code: formData.gl_code ? sanitizeString(formData.gl_code, 40) : null,
      route_id: linkedRouteId,
      load_id: linkedLoadId,
    })
    // V3-007 FIX: Replace implicit select() with explicit columns
    .select("id, company_id, category, description, amount, date, vendor, gl_code, driver_id, truck_id, mileage, payment_method, receipt_url, has_receipt, route_id, load_id, fuel_level_after, gallons, price_per_gallon, created_at, updated_at")
    .maybeSingle()

  if (error) {
    return { error: safeDbError(error), data: null, totalFuelExpense: 0 }
  }

  // Auto-update fuel level if this is a fuel expense with truck_id and fuel_level_after
  if (formData.category.toLowerCase() === "fuel" && formData.truck_id && formData.fuel_level_after !== undefined) {
    try {
      const { updateTruck } = await import("./trucks")
      await updateTruck(formData.truck_id, {
        fuel_level: formData.fuel_level_after,
      })
      
      // Revalidate truck paths so fuel level updates in UI
      revalidatePath("/dashboard/trucks")
      revalidatePath(`/dashboard/trucks/${formData.truck_id}`)
    } catch (error) {
      // Don't fail expense creation if fuel level update fails
      Sentry.captureException(error)
    }
  }

  revalidatePath("/dashboard/accounting/expenses")
  return { data, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "An unexpected error occurred"), data: null }
  }
}

// Get driver's loads for a specific period (for settlement calculation)
export async function getDriverLoadsForPeriod(driverId: string, periodStart: string, periodEnd: string) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // Get loads for driver in the period
  // Use COALESCE to prevent double-counting: use load_date if available, otherwise created_at::date
  // Single query approach to avoid double-counting loads that get load_date backfilled
  const { data: allLoads, error: loadsError } = await supabase
    .rpc("get_driver_loads_for_period", {
      p_driver_id: driverId,
      p_company_id: ctx.companyId,
      p_period_start: periodStart,
      p_period_end: periodEnd,
    })

  // Fallback to two queries if RPC doesn't exist, but exclude loads that would be double-counted
  if (loadsError || !allLoads) {
    // Get loads with load_date in period
    const { data: loadsWithDate, error: errorWithDate } = await supabase
      .from("loads")
      .select("id, shipment_number, value, status, actual_delivery, estimated_delivery, load_date, created_at")
      .eq("company_id", ctx.companyId)
      .eq("driver_id", driverId)
      .not("load_date", "is", null)
      .gte("load_date", periodStart)
      .lte("load_date", periodEnd)
      .order("load_date", { ascending: true })

    // Get loads without load_date, filtered by created_at, but exclude those that might have been backfilled
    // Only include loads where created_at is in period AND load_date is still null
    const { data: loadsWithoutDate, error: errorWithoutDate } = await supabase
      .from("loads")
      .select("id, shipment_number, value, status, actual_delivery, estimated_delivery, load_date, created_at")
      .eq("company_id", ctx.companyId)
      .eq("driver_id", driverId)
      .is("load_date", null)
      .gte("created_at", `${periodStart}T00:00:00`)
      .lte("created_at", `${periodEnd}T23:59:59`)
      .order("created_at", { ascending: true })

    if (errorWithDate || errorWithoutDate) {
      return { error: errorWithDate?.message || errorWithoutDate?.message || "Failed to fetch loads", data: null }
    }

    // Combine and deduplicate by id
    const loadMap = new Map()
    ;(loadsWithDate || []).forEach((load: any) => loadMap.set(load.id, load))
    ;(loadsWithoutDate || []).forEach((load: any) => {
      if (!loadMap.has(load.id)) {
        loadMap.set(load.id, load)
      }
    })
    const combinedLoads = Array.from(loadMap.values())
    return { data: combinedLoads, error: null }
  }

  return { data: allLoads, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "An unexpected error occurred"), data: null }
  }
}

// Get driver's fuel expenses for a specific period (for settlement calculation)
export async function getDriverFuelExpensesForPeriod(driverId: string, periodStart: string, periodEnd: string) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // Get fuel expenses for driver in the period
  const { data: expenses, error } = await supabase
    .from("expenses")
    .select("id, amount, date, description")
    .eq("company_id", ctx.companyId)
    .eq("driver_id", driverId)
    .eq("category", "fuel")
    .gte("date", periodStart)
    .lte("date", periodEnd)
    .order("date", { ascending: true })

  if (error) {
    return { error: safeDbError(error), data: null, totalFuelExpense: 0 }
  }

  const totalFuelExpense = expenses?.reduce((sum: number, exp: any) => sum + (Number(exp.amount) || 0), 0) || 0

  return { data: expenses || [], totalFuelExpense, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "An unexpected error occurred"), data: null, totalFuelExpense: 0 }
  }
}

function calculateCalendarNightsBetween(pickupRaw: string, deliveryRaw: string): number {
  const pickup = new Date(pickupRaw)
  const delivery = new Date(deliveryRaw)
  if (Number.isNaN(pickup.getTime()) || Number.isNaN(delivery.getTime()) || delivery <= pickup) return 0
  const start = new Date(Date.UTC(pickup.getUTCFullYear(), pickup.getUTCMonth(), pickup.getUTCDate()))
  const end = new Date(Date.UTC(delivery.getUTCFullYear(), delivery.getUTCMonth(), delivery.getUTCDate()))
  const dayMs = 24 * 60 * 60 * 1000
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / dayMs))
}

function calculatePerDiemEligibleNights(loads: Array<any>): number {
  return loads.reduce((total, load) => {
    const pickupRaw = load?.load_date || load?.pickup_date || load?.created_at
    const deliveryRaw = load?.actual_delivery || load?.estimated_delivery || pickupRaw
    if (!pickupRaw || !deliveryRaw) return total

    const nights = calculateCalendarNightsBetween(String(pickupRaw), String(deliveryRaw))
    return total + Math.max(0, nights)
  }, 0)
}

// Create settlement with automatic calculations
export async function createSettlement(formData: {
  driver_id: string
  period_start: string
  period_end: string
  gross_pay?: number
  fuel_deduction?: number
  advance_deduction?: number
  other_deductions?: number
  payment_method?: string
  gl_code?: string
  notes?: string
}) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    // RBAC check
    const permissionCheck = await checkCreatePermission("settlements")
    if (!permissionCheck.allowed) {
      return { error: permissionCheck.error || "You don't have permission to create settlements", data: null }
    }

  // Validate driver_id belongs to company
  const { data: driver, error: driverError } = await supabase
    .from("drivers")
    .select("id")
    .eq("id", formData.driver_id)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (driverError || !driver) {
    return { error: "Driver not found or does not belong to your company", data: null }
  }

  // Get driver's loads for the period
  const loadsResult = await getDriverLoadsForPeriod(
    formData.driver_id,
    formData.period_start,
    formData.period_end
  )

  if (loadsResult.error) {
    return { error: loadsResult.error, data: null }
  }

  const loads = loadsResult.data || []

  const { getCompanySettings } = await import("./number-formats")
  const companySettingsResult = await getCompanySettings()
  const configuredPerDiemRate = Number(companySettingsResult.data?.per_diem_rate ?? 69)
  const perDiemRate = Number.isFinite(configuredPerDiemRate) && configuredPerDiemRate >= 0 ? configuredPerDiemRate : 69
  const perDiemEligibleNights = calculatePerDiemEligibleNights(loads)
  const perDiemAmount = perDiemEligibleNights * perDiemRate

  // Calculate gross pay using pay rules engine if not provided
  let grossPay = formData.gross_pay || 0
  let calculationDetails: any = {}
  let payRuleId: string | null = null

  if (!formData.gross_pay && loads.length > 0) {
    try {
      // Try to use pay rules engine
      const { calculateGrossPayFromRule } = await import("./settlement-pay-rules")
      
      // Get total miles from ELD data if available
      let totalMiles: number | undefined = undefined
      try {
        const { getELDMileageData } = await import("./eld")
        const { data: trucks, error: trucksError } = await supabase
          .from("trucks")
          .select("id")
          .eq("driver_id", formData.driver_id)
          .limit(1)
          .maybeSingle()

        if (trucksError) {
          // Non-fatal: if we can't find a truck for the driver, keep settlement working.
        } else if (trucks) {
          const eldResult = await getELDMileageData({
            truck_ids: [trucks.id],
            start_date: formData.period_start,
            end_date: formData.period_end,
          })
          if (eldResult.data?.totalMiles) {
            totalMiles = eldResult.data.totalMiles
          }
        }
      } catch (error) {
        // ELD data not available, continue without it
      }

      const payCalculation = await calculateGrossPayFromRule({
        driverId: formData.driver_id,
        loads: loads.map((load: any) => ({
          id: load.id,
          value: Number(load.value) || 0,
          miles: Number(load.miles) || undefined,
          load_type: (load as any).load_type,
          on_time_delivery: (load as any).on_time_delivery,
        })),
        totalMiles,
        periodStart: formData.period_start,
        periodEnd: formData.period_end,
        perDiemEligibleNights,
        perDiemRate,
      })

      if (payCalculation.data && !payCalculation.error) {
        grossPay = payCalculation.data.gross_pay
        calculationDetails = payCalculation.data.calculation_details
        payRuleId = payCalculation.data.pay_rule?.id || null
      } else {
        // Fallback: sum load values if pay rule not found
        grossPay = loads.reduce((sum: number, load: any) => sum + (Number(load.value) || 0), 0)
        calculationDetails = {
          base_pay: grossPay,
          method: "fallback_load_value_sum",
          note: "Pay rule not found, using load value sum",
          per_diem_eligible_nights: perDiemEligibleNights,
          per_diem_rate: perDiemRate,
          per_diem_amount: perDiemAmount,
          non_taxable_pay: perDiemAmount,
          line_items: perDiemAmount > 0 ? [{
            type: "per_diem",
            description: `Per-diem (${perDiemEligibleNights} nights x $${perDiemRate.toFixed(2)})`,
            amount: perDiemAmount,
            taxable: false,
          }] : [],
        }
      }
    } catch (error) {
      // Fallback: sum load values if pay rules engine fails
      Sentry.captureException(error)
      grossPay = loads.reduce((sum: number, load: any) => sum + (Number(load.value) || 0), 0)
      calculationDetails = {
        base_pay: grossPay,
        method: "fallback_load_value_sum",
        note: "Pay rules engine unavailable, using load value sum",
        per_diem_eligible_nights: perDiemEligibleNights,
        per_diem_rate: perDiemRate,
        per_diem_amount: perDiemAmount,
        non_taxable_pay: perDiemAmount,
        line_items: perDiemAmount > 0 ? [{
          type: "per_diem",
          description: `Per-diem (${perDiemEligibleNights} nights x $${perDiemRate.toFixed(2)})`,
          amount: perDiemAmount,
          taxable: false,
        }] : [],
      }
    }
  }

  // Get fuel expenses for the period
  const fuelResult = await getDriverFuelExpensesForPeriod(
    formData.driver_id,
    formData.period_start,
    formData.period_end
  )

  // Get ELD mileage data for the period (if driver has ELD device)
  let eldMiles = 0
  try {
    const { getELDLogs } = await import("./eld")
    const eldLogsResult = await getELDLogs({
      driver_id: formData.driver_id,
      start_date: formData.period_start,
      end_date: formData.period_end,
    })
    
    if (eldLogsResult.data) {
      // Sum miles from ELD logs
      eldMiles = eldLogsResult.data
        .filter((log: any) => log.log_type === "driving" && log.miles_driven)
        .reduce((sum: number, log: any) => sum + (Number(log.miles_driven) || 0), 0)
    }
  } catch (error) {
    // ELD data not available, continue without it
    Sentry.captureMessage("ELD data not available for settlement calculation", "info")
  }

  const fuelDeduction = formData.fuel_deduction !== undefined 
    ? formData.fuel_deduction 
    : (fuelResult.totalFuelExpense || 0)

  const advanceDeduction = formData.advance_deduction || 0
  const otherDeductions = formData.other_deductions || 0
  let leaseDeduction = 0
  let leaseContext: { leaseId: string; remainingAfter: number } | null = null

  // Auto lease deduction from active agreement
  try {
    const { data: activeLease } = await supabase
      .from("lease_agreements")
      .select("id, weekly_payment, remaining_balance, is_active, start_date, end_date")
      .eq("company_id", ctx.companyId)
      .eq("driver_id", formData.driver_id)
      .eq("is_active", true)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle()

    const today = new Date().toISOString().split("T")[0]
    const validLease =
      !!activeLease &&
      activeLease.start_date <= today &&
      (!activeLease.end_date || activeLease.end_date >= today)

    if (validLease && activeLease) {
      const weeklyPayment = Number(activeLease.weekly_payment || 0)
      const remaining = Number(activeLease.remaining_balance || 0)
      if (weeklyPayment > 0 && remaining > 0) {
        leaseDeduction = Math.min(weeklyPayment, remaining)
        leaseContext = { leaseId: activeLease.id, remainingAfter: Math.max(0, remaining - leaseDeduction) }
      }
    }
  } catch (error) {
    Sentry.captureException(error)
  }

  const totalDeductions = fuelDeduction + advanceDeduction + otherDeductions + leaseDeduction
  const netPay = grossPay + perDiemAmount - totalDeductions

  // Prepare loads data for JSONB
  const loadsData = loads.map((load: any) => ({
    id: load.id,
    shipment_number: load.shipment_number,
    value: load.value || 0,
    date: load.load_date || load.actual_delivery,
  }))

  // Create settlement
  if (!calculationDetails || typeof calculationDetails !== "object") {
    calculationDetails = {}
  }
  if (!Array.isArray(calculationDetails.line_items)) {
    calculationDetails.line_items = []
  }
  if (leaseDeduction > 0) {
    calculationDetails.line_items.push({
      type: "lease_deduction",
      description: "Lease payment deduction",
      amount: -leaseDeduction,
      taxable: false,
    })
    calculationDetails.lease_deduction = leaseDeduction
    calculationDetails.lease_remaining_balance = leaseContext?.remainingAfter ?? null
  }

  const { data, error } = await supabase
    .from("settlements")
    .insert({
      company_id: ctx.companyId,
      driver_id: formData.driver_id,
      period_start: formData.period_start,
      period_end: formData.period_end,
      gross_pay: grossPay,
      fuel_deduction: fuelDeduction,
      advance_deduction: advanceDeduction,
      lease_deduction: leaseDeduction,
      other_deductions: otherDeductions,
      total_deductions: totalDeductions,
      per_diem_eligible_nights: perDiemEligibleNights,
      per_diem_rate_used: perDiemRate,
      per_diem_amount: perDiemAmount,
      net_pay: netPay,
      status: "pending",
      payment_method: formData.payment_method || null,
      gl_code: formData.gl_code ? sanitizeString(formData.gl_code, 40) : null,
      loads: loadsData,
      pay_rule_id: payRuleId,
      calculation_details: calculationDetails,
    })
    // V3-007 FIX: Replace implicit select() with explicit columns
    .select("id, company_id, driver_id, period_start, period_end, gross_pay, fuel_deduction, advance_deduction, lease_deduction, other_deductions, total_deductions, per_diem_eligible_nights, per_diem_rate_used, per_diem_amount, net_pay, status, paid_date, payment_method, payment_reference, payment_eta, stripe_transfer_id, stripe_payout_id, gl_code, loads, pay_rule_id, calculation_details, pdf_url, driver_approved, driver_approved_at, driver_approval_method, created_at, updated_at")
    .single()

  if (error || !data) {
    return { error: error?.message || "Settlement not created", data: null }
  }

  // Post settlement side effects: payment history + remaining balance update
  if (leaseDeduction > 0 && leaseContext?.leaseId) {
    try {
      await supabase.from("lease_payments").insert({
        company_id: ctx.companyId,
        lease_agreement_id: leaseContext.leaseId,
        settlement_id: data.id,
        payment_date: formData.period_end,
        amount: leaseDeduction,
        remaining_balance_after: leaseContext.remainingAfter,
      })

      const leasePatch: Record<string, any> = {
        remaining_balance: leaseContext.remainingAfter,
        updated_at: new Date().toISOString(),
      }
      if (leaseContext.remainingAfter <= 0) {
        leasePatch.is_active = false
      }

      await supabase
        .from("lease_agreements")
        .update(leasePatch)
        .eq("id", leaseContext.leaseId)
        .eq("company_id", ctx.companyId)
    } catch (error) {
      Sentry.captureException(error)
    }
  }

  // Generate PDF automatically (non-blocking)
  if (data) {
    try {
      const { saveSettlementPDF } = await import("./settlement-pdf")
      saveSettlementPDF(data.id).catch((err) =>
        Sentry.captureException(err)
      )
    } catch (error) {
      // PDF generation is optional, don't fail settlement creation
      Sentry.captureException(error)
    }
  }

  revalidatePath("/dashboard/accounting/settlements")
  return { data, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "An unexpected error occurred"), data: null }
  }
}
