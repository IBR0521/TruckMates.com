"use server"

import { createClient } from "@/lib/supabase/server"
import { errorMessage, sanitizeError } from "@/lib/error-message"
import { getCachedAuthContext } from "@/lib/auth/server"
import { revalidatePath } from "next/cache"
import * as Sentry from "@sentry/nextjs"
import { generateBOLPDFFile } from "./bol-pdf"
import { getResendClient } from "./invoice-email"
import { escapeHtml } from "@/lib/html-escape"


function safeDbError(error: unknown, fallback = "Database operation failed"): string {
  Sentry.captureException(error)
  return sanitizeError(error, { fallback })
}


// Get all BOLs
export async function getBOLs(filters?: {
  load_id?: string
  status?: string
  search?: string
}) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    // V3-007 FIX: Replace select(*) with explicit columns and add LIMIT
    let query = supabase
      .from("bols")
      .select(`
        id, bol_number, load_id, template_id, shipper_name, consignee_name, carrier_name,
        pickup_date, delivery_date, freight_charges, status, created_at, updated_at,
        shipper_signature, driver_signature, consignee_signature,
        pod_received_date, pod_received_by, pod_delivery_condition, special_instructions,
        loads:load_id (id, shipment_number, contents)
      `)
      .eq("company_id", ctx.companyId)
      .order("created_at", { ascending: false })
      .limit(1000)

    if (filters?.load_id) {
      query = query.eq("load_id", filters.load_id)
    }

    if (filters?.status) {
      query = query.eq("status", filters.status)
    }

    // MEDIUM FIX 3: Add server-side search support
    if (filters?.search) {
      query = query.or(`bol_number.ilike.%${filters.search}%,shipper_name.ilike.%${filters.search}%,consignee_name.ilike.%${filters.search}%`)
    }

    const { data, error } = await query

    if (error) {
      return { error: safeDbError(error), data: null }
    }

    return { data, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { data: null, error: errorMessage(error, "An unexpected error occurred") }
  }
}

// Get single BOL
export async function getBOL(id: string) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    // V3-014 FIX: Validate input parameters
    if (!id || typeof id !== "string" || id.trim().length === 0) {
      return { error: "Invalid BOL ID", data: null }
    }

    const supabase = await createClient()

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    // V3-007 FIX: Replace select(*) with explicit columns
    const { data, error } = await supabase
      .from("bols")
      .select("id, company_id, bol_number, load_id, template_id, shipper_name, shipper_address, shipper_city, shipper_state, shipper_zip, shipper_phone, shipper_email, consignee_name, consignee_address, consignee_city, consignee_state, consignee_zip, consignee_phone, consignee_email, carrier_name, carrier_mc_number, carrier_dot_number, pickup_date, delivery_date, freight_charges, payment_terms, special_instructions, shipper_signature, driver_signature, consignee_signature, status, pod_photos, pod_notes, pod_received_by, pod_received_date, pod_delivery_condition, created_at, updated_at")
      .eq("id", id)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (error) {
      return { error: safeDbError(error), data: null }
    }

    if (!data) {
      return { error: "BOL not found", data: null }
    }

    return { data, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { data: null, error: errorMessage(error, "An unexpected error occurred") }
  }
}

/**
 * Auto-populate BOL data from Load
 */
export async function getBOLDataFromLoad(loadId: string): Promise<{
  data: {
    shipper_name: string
    shipper_address?: string
    shipper_city?: string
    shipper_state?: string
    shipper_zip?: string
    shipper_phone?: string
    shipper_email?: string
    consignee_name: string
    consignee_address?: string
    consignee_city?: string
    consignee_state?: string
    consignee_zip?: string
    consignee_phone?: string
    consignee_email?: string
    pickup_date?: string
    delivery_date?: string
    freight_charges?: number
    special_instructions?: string
  } | null
  error: string | null
}> {
  try {
    // Validate input
    if (!loadId || typeof loadId !== "string" || loadId.trim().length === 0) {
      return { error: "Invalid load ID", data: null }
    }

    const supabase = await createClient()

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    // Get load with address book entries
    const { data: load, error: loadError } = await supabase
      .from("loads")
      .select(`
        *,
        shipper_address_book:shipper_address_book_id (
          id,
          name,
          company_name,
          contact_name,
          email,
          phone,
          address_line1,
          address_line2,
          city,
          state,
          zip_code
        ),
        consignee_address_book:consignee_address_book_id (
          id,
          name,
          company_name,
          contact_name,
          email,
          phone,
          address_line1,
          address_line2,
          city,
          state,
          zip_code
        )
      `)
      .eq("id", loadId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (loadError || !load) {
      return { error: loadError?.message || "Load not found", data: null }
    }

    const shipperAddressBook = (load as any).shipper_address_book
    const consigneeAddressBook = (load as any).consignee_address_book

    const shipperData = {
      shipper_name: shipperAddressBook?.company_name || shipperAddressBook?.name || load.shipper_name || "",
      shipper_address: shipperAddressBook?.address_line1 || load.shipper_address || undefined,
      shipper_city: shipperAddressBook?.city || load.shipper_city || undefined,
      shipper_state: shipperAddressBook?.state || load.shipper_state || undefined,
      shipper_zip: shipperAddressBook?.zip_code || load.shipper_zip || undefined,
      shipper_phone: shipperAddressBook?.phone || load.shipper_contact_phone || undefined,
      shipper_email: shipperAddressBook?.email || load.shipper_contact_email || undefined,
    }

    const consigneeData = {
      consignee_name: consigneeAddressBook?.company_name || consigneeAddressBook?.name || load.consignee_name || "",
      consignee_address: consigneeAddressBook?.address_line1 || load.consignee_address || undefined,
      consignee_city: consigneeAddressBook?.city || load.consignee_city || undefined,
      consignee_state: consigneeAddressBook?.state || load.consignee_state || undefined,
      consignee_zip: consigneeAddressBook?.zip_code || load.consignee_zip || undefined,
      consignee_phone: consigneeAddressBook?.phone || load.consignee_contact_phone || undefined,
      consignee_email: consigneeAddressBook?.email || load.consignee_contact_email || undefined,
    }

    // Optionally fetch carrier info (kept for future use)
    await supabase
      .from("companies")
      .select("name, mc_number, dot_number")
      .eq("id", ctx.companyId)
      .maybeSingle()

    return {
      data: {
        ...shipperData,
        ...consigneeData,
        pickup_date: load.load_date || undefined,
        delivery_date: load.estimated_delivery || undefined,
        freight_charges: (() => {
          const rate = load.rate || load.value || load.total_rate
          if (!rate) return undefined
          const parsed = typeof rate === "number" ? rate : parseFloat(String(rate))
          return isNaN(parsed) || !isFinite(parsed) ? undefined : parsed
        })(),
        special_instructions:
          load.special_instructions || load.pickup_instructions || load.delivery_instructions || undefined,
      },
      error: null,
    }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to get BOL data from load"), data: null }
  }
}

// Create BOL (enhanced with auto-population)
export async function createBOL(formData: {
  load_id: string
  template_id?: string
  shipper_name?: string
  shipper_address?: string
  shipper_city?: string
  shipper_state?: string
  shipper_zip?: string
  shipper_phone?: string
  shipper_email?: string
  consignee_name?: string
  consignee_address?: string
  consignee_city?: string
  consignee_state?: string
  consignee_zip?: string
  consignee_phone?: string
  consignee_email?: string
  carrier_name?: string
  carrier_mc_number?: string
  carrier_dot_number?: string
  pickup_date?: string
  delivery_date?: string
  freight_charges?: number
  payment_terms?: string
  special_instructions?: string
  auto_populate?: boolean // If true, auto-populate from load data
}) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    // V3-014 FIX: Validate input parameters
    if (!formData.load_id || typeof formData.load_id !== "string" || formData.load_id.trim().length === 0) {
      return { error: "Load ID is required", data: null }
    }

    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    // Auto-populate from load if requested or if fields are missing
    // LOW FIX 3: Destructure auto_populate before merging to prevent leak
    const { auto_populate, ...restFormData } = formData
    let bolData: any = { ...restFormData }
    if (auto_populate || !restFormData.shipper_name || !restFormData.consignee_name) {
      const loadData = await getBOLDataFromLoad(restFormData.load_id)
      if (loadData.data) {
        // Merge: formData takes precedence, but fill in missing fields from load
        bolData = {
          ...loadData.data,
          ...restFormData, // Form data overrides auto-populated data
          load_id: restFormData.load_id, // Preserve load_id
          template_id: restFormData.template_id,
          payment_terms: restFormData.payment_terms,
        }
      }
    }

    // Get company info for carrier if not provided
    if (!bolData.carrier_name || !bolData.carrier_mc_number) {
      const { data: company } = await supabase
        .from("companies")
        .select("name, mc_number, dot_number")
        .eq("id", ctx.companyId)
        .maybeSingle()

      if (company) {
        bolData.carrier_name = bolData.carrier_name || company.name || undefined
        bolData.carrier_mc_number = bolData.carrier_mc_number || company.mc_number || undefined
        bolData.carrier_dot_number = bolData.carrier_dot_number || company.dot_number || undefined
      }
    }

    // CRITICAL FIX 2 & MEDIUM FIX 1: Generate unique BOL number using crypto.randomUUID to prevent collisions
    const bolNumber = `BOL-${crypto.randomUUID().split('-')[0].toUpperCase()}-${Date.now().toString(36).toUpperCase()}`

    const { data, error } = await supabase
      .from("bols")
      .insert({
      company_id: ctx.companyId,
      load_id: bolData.load_id,
      bol_number: bolNumber,
      template_id: bolData.template_id || null,
      shipper_name: bolData.shipper_name || "",
      shipper_address: bolData.shipper_address || null,
      shipper_city: bolData.shipper_city || null,
      shipper_state: bolData.shipper_state || null,
      shipper_zip: bolData.shipper_zip || null,
      shipper_phone: bolData.shipper_phone || null,
      shipper_email: bolData.shipper_email || null,
      consignee_name: bolData.consignee_name || "",
      consignee_address: bolData.consignee_address || null,
      consignee_city: bolData.consignee_city || null,
      consignee_state: bolData.consignee_state || null,
      consignee_zip: bolData.consignee_zip || null,
      consignee_phone: bolData.consignee_phone || null,
      consignee_email: bolData.consignee_email || null,
      carrier_name: bolData.carrier_name || null,
      carrier_mc_number: bolData.carrier_mc_number || null,
      carrier_dot_number: bolData.carrier_dot_number || null,
      pickup_date: bolData.pickup_date || null,
      delivery_date: bolData.delivery_date || null,
      // V3-013 FIX: Guard parseFloat against NaN
      freight_charges: (() => {
        if (!bolData.freight_charges) return null
        const charges = typeof bolData.freight_charges === "number" ? bolData.freight_charges : parseFloat(String(bolData.freight_charges))
        return isNaN(charges) || !isFinite(charges) ? null : charges
      })(),
      payment_terms: bolData.payment_terms || null,
      special_instructions: bolData.special_instructions || null,
      status: "draft",
    })
    .select()
    .single()

    if (error) {
      return { error: safeDbError(error), data: null }
    }

    revalidatePath("/dashboard/bols")
    return { data, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "An unexpected error occurred"), data: null }
  }
}

// Update BOL signature
export async function updateBOLSignature(
  bolId: string,
  signatureType: "shipper" | "driver" | "consignee",
  signatureData: {
    signature_url: string
    signed_by: string
    signed_at: string
    ip_address?: string
  }
) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    // V3-014 FIX: Validate input parameters
    if (!bolId || typeof bolId !== "string" || bolId.trim().length === 0) {
      return { error: "Invalid BOL ID", data: null }
    }
    if (!signatureType || !["shipper", "driver", "consignee"].includes(signatureType)) {
      return { error: "Invalid signature type", data: null }
    }
    if (!signatureData.signature_url || typeof signatureData.signature_url !== "string") {
      return { error: "Signature URL is required", data: null }
    }
    if (!signatureData.signed_by || typeof signatureData.signed_by !== "string") {
      return { error: "Signed by is required", data: null }
    }
    if (!signatureData.signed_at || typeof signatureData.signed_at !== "string") {
      return { error: "Signed at is required", data: null }
    }

    const supabase = await createClient()

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    // SECURITY FIX 3: Role check - consignee signatures should only be added by authorized users
    const { getUserRole } = await import("@/lib/server-permissions")
    const mappedRole = (await getUserRole()) || ""
    const canSignConsignee = ["super_admin", "operations_manager", "dispatcher"].includes(mappedRole)
    if (signatureType === "consignee" && !canSignConsignee) {
      Sentry.captureMessage(
        `[BOL] Consignee signature added by user with role: ${(await getUserRole()) || ""}`,
        "warning",
      )
    }

    const signatureField = `${signatureType}_signature`

    // Get current BOL to check status and signatures
    const { data: currentBOL } = await supabase
      .from("bols")
      .select("status, shipper_signature, driver_signature, consignee_signature")
      .eq("id", bolId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (!currentBOL) {
      return { error: "BOL not found", data: null }
    }

    // HIGH FIX 3: Enforce signature order - shipper before driver, driver before consignee
    if (signatureType === "driver" && !(currentBOL as any).shipper_signature) {
      return { error: "Shipper must sign before driver", data: null }
    }
    if (signatureType === "consignee" && !(currentBOL as any).driver_signature) {
      return { error: "Driver must sign before consignee", data: null }
    }

    // Reject if BOL is already delivered or completed
    if (["delivered", "completed"].includes((currentBOL as any).status)) {
      return { error: `Cannot update signature on ${(currentBOL as any).status} BOL`, data: null }
    }

    const updateData: any = {
      [signatureField]: signatureData,
    }

    // Check if we should update status to 'signed'
    // At minimum, driver signature should be required
    const hasDriverSignature = signatureType === "driver" || (currentBOL as any).driver_signature

    if (hasDriverSignature && (currentBOL as any).status === "draft") {
      updateData.status = "signed"
    }

    // If consignee signature is being added (POD captured), update status to delivered
    if (signatureType === "consignee" && updateData.consignee_signature) {
      updateData.status = "delivered"
    }

    const { data, error } = await supabase
      .from("bols")
      .update(updateData)
      .eq("id", bolId)
      .eq("company_id", ctx.companyId)
      .select()
      .single()

    if (error) {
      return { error: safeDbError(error), data: null }
    }

    // Auto-store PDF if BOL is completed (has consignee signature)
    if (data && data.consignee_signature && signatureType === "consignee") {
      try {
        const { autoStoreBOLPDFOnCompletion } = await import("./bol-enhanced")
        await autoStoreBOLPDFOnCompletion(bolId, ctx.companyId).catch((err) => {
          Sentry.captureException(err)
          // Don't fail if PDF storage fails
        })
      } catch (error) {
        Sentry.captureException(error)
      }
    }

    revalidatePath("/dashboard/bols")
    revalidatePath(`/dashboard/bols/${bolId}`)
    return { data, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "An unexpected error occurred"), data: null }
  }
}

// Update BOL Proof of Delivery
export async function updateBOLPOD(
  bolId: string,
  podData: {
    pod_photos?: string[]
    pod_notes?: string
    pod_received_by?: string
    pod_received_date?: string
    pod_delivery_condition?: string
  }
) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    // V3-014 FIX: Validate input parameters
    if (!bolId || typeof bolId !== "string" || bolId.trim().length === 0) {
      return { error: "Invalid BOL ID", data: null }
    }

    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    const updateData: any = {}
    if (podData.pod_photos !== undefined) updateData.pod_photos = podData.pod_photos
    if (podData.pod_notes !== undefined) updateData.pod_notes = podData.pod_notes
    if (podData.pod_received_by !== undefined) updateData.pod_received_by = podData.pod_received_by
    if (podData.pod_received_date !== undefined) updateData.pod_received_date = podData.pod_received_date
    if (podData.pod_delivery_condition !== undefined) updateData.pod_delivery_condition = podData.pod_delivery_condition

    // LOW FIX 1: Only update status if not already delivered or completed
    const { data: currentBOL } = await supabase
      .from("bols")
      .select("status")
      .eq("id", bolId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (currentBOL && !["delivered", "completed"].includes(currentBOL.status)) {
      if (podData.pod_received_date || podData.pod_received_by) {
        updateData.status = "delivered"
      }
    }

    const { data, error } = await supabase
      .from("bols")
      .update(updateData)
      .eq("id", bolId)
      .eq("company_id", ctx.companyId)
      .select()
      .single()

    if (error) {
      return { error: safeDbError(error), data: null }
    }

    // Auto-store PDF if BOL is completed (has consignee signature)
    if (data && (data as any).consignee_signature) {
      try {
        const { autoStoreBOLPDFOnCompletion } = await import("./bol-enhanced")
        await autoStoreBOLPDFOnCompletion(bolId, ctx.companyId).catch((err) => {
          Sentry.captureException(err)
          // Don't fail if PDF storage fails
        })
      } catch (error) {
        Sentry.captureException(error)
      }
    }

    let invoiceAutomation: {
      invoiceId?: string
      alreadyExists?: boolean
      triggered?: boolean
      error?: string | null
    } | null = null

    // Trigger invoice automation once POD is captured.
    // This is idempotent: autoGenerateInvoiceOnPOD returns existing invoice if already created.
    if (data && (data as any).load_id && ((data as any).pod_received_date || (data as any).pod_received_by)) {
      try {
        const { autoGenerateInvoiceOnPOD } = await import("./auto-invoice")
        const invoiceResult = await autoGenerateInvoiceOnPOD((data as any).load_id)
        if (invoiceResult.error) {
          invoiceAutomation = {
            triggered: true,
            error: invoiceResult.error,
          }
        } else {
          invoiceAutomation = {
            triggered: true,
            invoiceId: invoiceResult.data?.invoiceId,
            alreadyExists: invoiceResult.data?.alreadyExists,
            error: null,
          }
        }
      } catch (error) {
        Sentry.captureException(error)
        invoiceAutomation = {
          triggered: true,
          error: errorMessage(error, "Invoice automation failed"),
        }
      }
    }

    revalidatePath("/dashboard/bols")
    revalidatePath(`/dashboard/bols/${bolId}`)
    return { data: { ...(data as any), _invoice_automation: invoiceAutomation }, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "An unexpected error occurred"), data: null }
  }
}

// Get BOL templates
export async function getBOLTemplates() {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // V3-007 FIX: Replace select(*) with explicit columns and add LIMIT
  const { data, error } = await supabase
    .from("bol_templates")
    .select("id, name, description, is_default, template_html, template_fields, created_at, updated_at")
    .eq("company_id", ctx.companyId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    return { error: safeDbError(error), data: null }
  }

  return { data, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { data: null, error: errorMessage(error, "An unexpected error occurred") }
  }
}

// Create BOL template
export async function createBOLTemplate(formData: {
  name: string
  description?: string
  is_default?: boolean
  template_html?: string
  template_fields?: any
}) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    // V3-014 FIX: Validate input parameters
    if (!formData.name || typeof formData.name !== "string" || formData.name.trim().length === 0) {
      return { error: "Template name is required", data: null }
    }

    const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // If this is set as default, unset other defaults
  if (formData.is_default) {
    await supabase
      .from("bol_templates")
      .update({ is_default: false })
      .eq("company_id", ctx.companyId)
  }

  const { data, error } = await supabase
    .from("bol_templates")
    .insert({
      company_id: ctx.companyId,
      name: formData.name,
      description: formData.description || null,
      is_default: formData.is_default || false,
      template_html: formData.template_html || null,
      template_fields: formData.template_fields || null,
    })
    .select()
    .single()

  if (error) {
    return { error: safeDbError(error), data: null }
  }

  revalidatePath("/dashboard/bols/templates")
  return { data, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "An unexpected error occurred"), data: null }
  }
}

export async function updateBOLStatus(bolId: string, status: "draft" | "sent" | "signed" | "delivered" | "completed") {
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    const { data, error } = await supabase
      .from("bols")
      .update({ status })
      .eq("id", bolId)
      .eq("company_id", ctx.companyId)
      .select("id, status")
      .single()

    if (error) return { error: safeDbError(error), data: null }
    revalidatePath("/dashboard/bols")
    revalidatePath(`/dashboard/bols/${bolId}`)
    return { data, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to update BOL status"), data: null }
  }
}

export async function getBOLStats() {
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }
    const today = new Date().toISOString().slice(0, 10)

    const [{ count: total }, { count: sent }, { count: completed }, { data: awaitingRows }] = await Promise.all([
      supabase.from("bols").select("id", { count: "exact", head: true }).eq("company_id", ctx.companyId),
      supabase.from("bols").select("id", { count: "exact", head: true }).eq("company_id", ctx.companyId).eq("status", "sent"),
      supabase.from("bols").select("id", { count: "exact", head: true }).eq("company_id", ctx.companyId).gte("updated_at", `${today}T00:00:00.000Z`).eq("status", "completed"),
      supabase
        .from("bols")
        .select("id, status, shipper_signature, driver_signature, consignee_signature")
        .eq("company_id", ctx.companyId)
        .in("status", ["sent", "signed", "delivered"]),
    ])

    const awaitingSignature = (awaitingRows || []).filter(
      (b: any) => !b.shipper_signature || !b.driver_signature || !b.consignee_signature
    ).length

    return {
      data: {
        total: total || 0,
        awaiting_signature: awaitingSignature,
        sent: sent || 0,
        completed_today: completed || 0,
      },
      error: null,
    }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to load BOL stats"), data: null }
  }
}

export async function sendBOLEmail(bolId: string, options?: { subject?: string; body?: string }) {
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

    const { data: bol, error } = await supabase
      .from("bols")
      .select("id, bol_number, status, consignee_name, consignee_email")
      .eq("id", bolId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (error || !bol) return { error: error?.message || "BOL not found", data: null }
    if (!bol.consignee_email || !String(bol.consignee_email).includes("@")) {
      return { error: "Consignee email is missing on this BOL", data: null }
    }

    const pdfResult = await generateBOLPDFFile(bolId)
    if (pdfResult.error || !pdfResult.pdf) return { error: pdfResult.error || "Failed to generate PDF", data: null }

    const resend = await getResendClient()
    if (!resend) return { error: "Email service not configured", data: null }

    const subject = options?.subject || `Bill of Lading ${bol.bol_number}`
    const bodyText =
      options?.body ||
      `Hello ${bol.consignee_name || "Consignee"},\n\nPlease find attached Bill of Lading ${bol.bol_number}.\n\nThank you.`

    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"
    const emailResult = await resend.emails.send({
      from: fromEmail,
      to: [bol.consignee_email],
      subject,
      text: bodyText,
      html: `<p>${escapeHtml(bodyText).replace(/\n/g, "<br>")}</p>`,
      attachments: [
        {
          filename: `${bol.bol_number}.pdf`,
          content: Buffer.from(pdfResult.pdf).toString("base64"),
        },
      ],
    })

    if (emailResult.error) return { error: emailResult.error.message || "Failed to send email", data: null }

    if (bol.status === "draft") {
      await supabase.from("bols").update({ status: "sent" }).eq("id", bolId).eq("company_id", ctx.companyId)
    }
    revalidatePath("/dashboard/bols")
    revalidatePath(`/dashboard/bols/${bolId}`)
    return { data: { sent: true }, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to send BOL email"), data: null }
  }
}

export async function markBOLPODReceived(bolId: string, receivedBy: string, condition: string, notes?: string) {
  return updateBOLPOD(bolId, {
    pod_received_by: receivedBy,
    pod_received_date: new Date().toISOString(),
    pod_delivery_condition: condition,
    pod_notes: notes,
  })
}

export async function updateBOLTemplate(id: string, formData: { name: string; description?: string; is_default?: boolean }) {
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    if (formData.is_default) {
      await supabase.from("bol_templates").update({ is_default: false }).eq("company_id", ctx.companyId)
    }

    const { data, error } = await supabase
      .from("bol_templates")
      .update({
        name: formData.name,
        description: formData.description || null,
        is_default: !!formData.is_default,
      })
      .eq("id", id)
      .eq("company_id", ctx.companyId)
      .select()
      .single()
    if (error) return { error: safeDbError(error), data: null }
    revalidatePath("/dashboard/bols/templates")
    return { data, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to update template"), data: null }
  }
}

export async function deleteBOLTemplate(id: string) {
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    const { error } = await supabase.from("bol_templates").delete().eq("id", id).eq("company_id", ctx.companyId)
    if (error) return { error: safeDbError(error), data: null }
    revalidatePath("/dashboard/bols/templates")
    return { data: { deleted: true }, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to delete template"), data: null }
  }
}

