"use server"

import { createClient } from "@/lib/supabase/server"
import { errorMessage, sanitizeError } from "@/lib/error-message"
import { getCachedAuthContext } from "@/lib/auth/server"
import { revalidatePath } from "next/cache"
import * as Sentry from "@sentry/nextjs"


function safeDbError(error: unknown, fallback = "Database operation failed"): string {
  Sentry.captureException(error)
  return sanitizeError(error, { fallback })
}


/**
 * Invoice Three-Way Matching
 * Verifies invoices against load data and BOLs
 * Flags exceptions for manual review
 */

/**
 * Verify invoice three-way match
 */
export async function verifyInvoiceMatch(invoiceId: string) {
  const supabase = await createClient()

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    try {
    // Call database function to perform verification
    const { data, error } = await supabase.rpc("verify_invoice_three_way_match", {
      p_invoice_id: invoiceId,
    })

    if (error) {
      Sentry.captureException(error)
      return { error: safeDbError(error), data: null }
    }

    if (!data || data.length === 0) {
      return { error: "Verification failed - no results returned", data: null }
    }

    revalidatePath("/dashboard/accounting/invoices")
    revalidatePath(`/dashboard/accounting/invoices/${invoiceId}`)

    return { data: data[0], error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to verify invoice"), data: null }
  }
}

/**
 * Get invoice verification details
 */
export async function getInvoiceVerification(invoiceId: string) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    const { data, error } = await supabase
      .from("invoice_verifications")
      .select(`
        *,
        invoice:invoice_id (
          id,
          invoice_number,
          amount,
          customer_name,
          matching_status
        ),
        load:load_id (
          id,
          shipment_number,
          value,
          total_revenue,
          estimated_revenue,
          company_name
        ),
        bol:bol_id (
          id,
          bol_number,
          status
        )
      `)
      .eq("invoice_id", invoiceId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (error) {
      return { error: safeDbError(error), data: null }
    }

    if (!data) {
      // No verification record found - invoice hasn't been verified yet
      return { data: null, error: null }
    }

    return { data, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "An unexpected error occurred"), data: null }
  }
}

/**
 * Get all invoices requiring manual review
 */
export async function getInvoicesRequiringReview() {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    const { data, error } = await supabase
      .from("invoices")
      .select(`
        id,
        invoice_number,
        customer_name,
        amount,
        status,
        matching_status,
        requires_manual_review,
        exception_reason,
        verification_details,
        load:load_id (
          id,
          shipment_number,
          value,
          total_revenue
        )
      `)
      .eq("company_id", ctx.companyId)
      .eq("requires_manual_review", true)
      .order("created_at", { ascending: false })

    if (error) {
      return { error: safeDbError(error), data: null }
    }

    return { data: data || [], error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to get invoices requiring review"), data: null }
  }
}

/**
 * Manually approve invoice (override exception)
 */
export async function approveInvoiceManually(invoiceId: string, reason?: string) {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    // Update invoice to verified status
    const { data, error } = await supabase
      .from("invoices")
      .update({
        matching_status: "verified",
        requires_manual_review: false,
        verified_by: ctx.userId ?? null,
        verified_at: new Date().toISOString(),
        exception_reason: reason || "Manually approved by user",
      })
      .eq("id", invoiceId)
      .eq("company_id", ctx.companyId)
      .select()
      .single()

    if (error) {
      return { error: safeDbError(error), data: null }
    }

    // Update verification record
    await supabase
      .from("invoice_verifications")
      .update({
        verification_status: "verified",
        verified_by: ctx.userId ?? null,
        verified_at: new Date().toISOString(),
      })
      .eq("invoice_id", invoiceId)

    revalidatePath("/dashboard/accounting/invoices")
    revalidatePath(`/dashboard/accounting/invoices/${invoiceId}`)

    return { data, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to approve invoice"), data: null }
  }
}

/**
 * Batch verify all pending invoices
 */
export async function batchVerifyInvoices() {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    // Get all pending invoices with load_id
    const { data: invoices, error: invoicesError } = await supabase
      .from("invoices")
      .select("id")
      .eq("company_id", ctx.companyId)
      .eq("matching_status", "pending")
      .not("load_id", "is", null)

    if (invoicesError) {
      return { error: invoicesError.message, data: null }
    }

    if (!invoices || invoices.length === 0) {
      return {
        data: {
          verified: 0,
          message: "No pending invoices to verify",
        },
        error: null,
      }
    }

    let verified = 0
    let errors = 0
    const errorDetails: Array<{ invoice_id: string; error: string }> = []

    // RCE-002 FIX: Batch verify invoices in parallel instead of sequential N+1 queries
    // This prevents timeouts on Vercel's 30-second function limit
    const verificationResults = await Promise.all(
      invoices.map(async (invoice: { id: string; [key: string]: any }) => {
        try {
          const { data: verification, error: verifyError } = await supabase.rpc(
            "verify_invoice_three_way_match",
            {
              p_invoice_id: invoice.id,
            }
          )

          if (verifyError) {
            return {
              invoice_id: invoice.id,
              success: false,
              error: verifyError.message,
            }
          } else {
            return {
              invoice_id: invoice.id,
              success: true,
              error: null,
            }
          }
        } catch (error: unknown) {
          return {
            invoice_id: invoice.id,
            success: false,
            error: errorMessage(error, "Unknown error"),
          }
        }
      })
    )

    // Count results
    verificationResults.forEach((result) => {
      if (result.success) {
        verified++
      } else {
        errors++
        errorDetails.push({
          invoice_id: result.invoice_id,
          error: result.error || "Unknown error",
        })
      }
    })

    revalidatePath("/dashboard/accounting/invoices")

    return {
      data: {
        verified,
        errors,
        total: invoices.length,
        error_details: errorDetails,
        message: `Verified ${verified} of ${invoices.length} invoices`,
      },
      error: null,
    }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to batch verify invoices"), data: null }
  }
}



