"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"
import { revalidatePath } from "next/cache"

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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  try {
    // Call database function to perform verification
    const { data, error } = await supabase.rpc("verify_invoice_three_way_match", {
      p_invoice_id: invoiceId,
    })

    if (error) {
      console.error("[Invoice Verification] Database error:", error)
      return { error: error.message, data: null }
    }

    if (!data || data.length === 0) {
      return { error: "Verification failed - no results returned", data: null }
    }

    revalidatePath("/dashboard/accounting/invoices")
    revalidatePath(`/dashboard/accounting/invoices/${invoiceId}`)

    return { data: data[0], error: null }
  } catch (error: any) {
    console.error("[Invoice Verification] Error:", error)
    return { error: error?.message || "Failed to verify invoice", data: null }
  }
}

/**
 * Get invoice verification details
 */
export async function getInvoiceVerification(invoiceId: string) {
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
      .eq("company_id", result.company_id)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        // No verification record found - invoice hasn't been verified yet
        return { data: null, error: null }
      }
      return { error: error.message, data: null }
    }

    return { data, error: null }
  } catch (error: any) {
    console.error("[Invoice Verification] Error:", error)
    return { error: error?.message || "Failed to get verification", data: null }
  }
}

/**
 * Get all invoices requiring manual review
 */
export async function getInvoicesRequiringReview() {
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
      .eq("company_id", result.company_id)
      .eq("requires_manual_review", true)
      .order("created_at", { ascending: false })

    if (error) {
      return { error: error.message, data: null }
    }

    return { data: data || [], error: null }
  } catch (error: any) {
    console.error("[Invoice Verification] Error:", error)
    return { error: error?.message || "Failed to get invoices requiring review", data: null }
  }
}

/**
 * Manually approve invoice (override exception)
 */
export async function approveInvoiceManually(invoiceId: string, reason?: string) {
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
    // Update invoice to verified status
    const { data, error } = await supabase
      .from("invoices")
      .update({
        matching_status: "verified",
        requires_manual_review: false,
        verified_by: user.id,
        verified_at: new Date().toISOString(),
        exception_reason: reason || "Manually approved by user",
      })
      .eq("id", invoiceId)
      .eq("company_id", result.company_id)
      .select()
      .single()

    if (error) {
      return { error: error.message, data: null }
    }

    // Update verification record
    await supabase
      .from("invoice_verifications")
      .update({
        verification_status: "verified",
        verified_by: user.id,
        verified_at: new Date().toISOString(),
      })
      .eq("invoice_id", invoiceId)

    revalidatePath("/dashboard/accounting/invoices")
    revalidatePath(`/dashboard/accounting/invoices/${invoiceId}`)

    return { data, error: null }
  } catch (error: any) {
    console.error("[Invoice Verification] Error:", error)
    return { error: error?.message || "Failed to approve invoice", data: null }
  }
}

/**
 * Batch verify all pending invoices
 */
export async function batchVerifyInvoices() {
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
    // Get all pending invoices with load_id
    const { data: invoices, error: invoicesError } = await supabase
      .from("invoices")
      .select("id")
      .eq("company_id", result.company_id)
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

    // Verify each invoice
    for (const invoice of invoices) {
      try {
        const { data: verification, error: verifyError } = await supabase.rpc(
          "verify_invoice_three_way_match",
          {
            p_invoice_id: invoice.id,
          }
        )

        if (verifyError) {
          errors++
          errorDetails.push({
            invoice_id: invoice.id,
            error: verifyError.message,
          })
        } else {
          verified++
        }
      } catch (error: any) {
        errors++
        errorDetails.push({
          invoice_id: invoice.id,
          error: error.message || "Unknown error",
        })
      }
    }

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
  } catch (error: any) {
    console.error("[Invoice Verification] Error:", error)
    return { error: error?.message || "Failed to batch verify invoices", data: null }
  }
}



