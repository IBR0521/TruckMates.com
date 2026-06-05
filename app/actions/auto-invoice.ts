"use server"

/**
 * Auto-generate draft invoice when a load is delivered / POD captured (opt-in only).
 */

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { errorMessage } from "@/lib/error-message"
import { getCachedAuthContext } from "@/lib/auth/server"
import { createInvoice } from "./accounting"
import { getLoad } from "./loads"
import * as Sentry from "@sentry/nextjs"

export type AutoInvoiceResult = {
  invoiceId?: string
  invoiceNumber?: string
  alreadyExists?: boolean
  skipped?: boolean
  skipReason?: string
}

async function pickCompanyNotificationUserId(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
): Promise<string | null> {
  const { data: preferred } = await admin
    .from("users")
    .select("id")
    .eq("company_id", companyId)
    .eq("notification_smart_mode", true)
    .neq("role", "driver")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  if (preferred && typeof (preferred as { id: string }).id === "string") {
    return (preferred as { id: string }).id
  }

  const { data: anyUser } = await admin
    .from("users")
    .select("id")
    .eq("company_id", companyId)
    .neq("role", "driver")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  return anyUser && typeof (anyUser as { id: string }).id === "string" ? (anyUser as { id: string }).id : null
}

async function notifyAutoDraftInvoice(params: {
  companyId: string
  invoiceId: string
  invoiceNumber: string
  loadRef: string
  loadId: string
}) {
  try {
    const admin = createAdminClient()
    const userId = await pickCompanyNotificationUserId(admin, params.companyId)
    if (!userId) return

    const message = `Invoice ${params.invoiceNumber} drafted automatically for delivered load ${params.loadRef} — review and send.`
    const { error } = await admin.from("notifications").insert({
      user_id: userId,
      company_id: params.companyId,
      type: "load_update",
      title: "Auto-drafted invoice",
      message,
      priority: "normal",
      read: false,
      metadata: {
        invoice_id: params.invoiceId,
        load_id: params.loadId,
        auto_drafted: true,
      },
    })
    if (error) Sentry.captureException(error)
  } catch (error) {
    Sentry.captureException(error)
  }
}

export async function isAutoInvoiceOnDeliveryEnabled(companyId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("company_settings")
    .select("auto_invoice_on_delivery")
    .eq("company_id", companyId)
    .maybeSingle()
  if (error) {
    Sentry.captureException(error)
    return false
  }
  return data?.auto_invoice_on_delivery === true
}

function formatInvoiceNumber(format: string, sequence: number, companyName?: string): string {
  const now = new Date()
  const year = String(now.getFullYear())
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  const company = (companyName || "COMPANY").toUpperCase().replace(/\s+/g, "").slice(0, 8)
  return format
    .replace(/\{YEAR\}/g, year)
    .replace(/\{MONTH\}/g, month)
    .replace(/\{DAY\}/g, day)
    .replace(/\{SEQUENCE\}/g, String(sequence).padStart(4, "0"))
    .replace(/\{COMPANY\}/g, company)
}

async function linkPodDocumentsToInvoice(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  loadId: string,
  invoiceId: string,
) {
  try {
    const { data: podDocuments } = await admin
      .from("documents")
      .select("id")
      .eq("load_id", loadId)
      .eq("company_id", companyId)
      .eq("type", "pod_photo")
      .limit(10)

    if (podDocuments && podDocuments.length > 0) {
      const { linkDocumentToRecord } = await import("./document-routing")
      for (const doc of podDocuments) {
        await linkDocumentToRecord(doc.id, "invoice", invoiceId).catch((err) => Sentry.captureException(err))
      }
    }
  } catch (error) {
    Sentry.captureException(error)
  }
}

/**
 * System automation path (opt-in gated). Uses service role — safe for driver POD capture.
 */
async function createAutoDraftInvoiceForLoad(
  companyId: string,
  loadId: string,
): Promise<{ data: AutoInvoiceResult | null; error: string | null }> {
  const admin = createAdminClient()

  const { data: existingInvoices, error: invoiceCheckError } = await admin
    .from("invoices")
    .select("id, invoice_number")
    .eq("load_id", loadId)
    .eq("company_id", companyId)

  if (invoiceCheckError) {
    Sentry.captureException(invoiceCheckError)
    return { error: "Failed to check existing invoices", data: null }
  }

  if (existingInvoices && existingInvoices.length > 0) {
    const existing = existingInvoices[0] as { id: string; invoice_number?: string }
    return {
      data: {
        invoiceId: existing.id,
        invoiceNumber: existing.invoice_number,
        alreadyExists: true,
      },
      error: null,
    }
  }

  const { data: load, error: loadError } = await admin
    .from("loads")
    .select(
      "id, shipment_number, customer_name, consignee_name, company_name, origin, destination, rate, value, total_rate",
    )
    .eq("id", loadId)
    .eq("company_id", companyId)
    .maybeSingle()

  if (loadError || !load) {
    return { error: loadError?.message || "Load not found", data: null }
  }

  const amount = Number(load.total_rate ?? load.rate ?? load.value ?? 0)
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Load has no rate or value. Cannot generate invoice.", data: null }
  }

  const { data: settings } = await admin
    .from("company_settings")
    .select("invoice_number_format, default_payment_terms, tax_enabled, default_tax_rate, tax_inclusive")
    .eq("company_id", companyId)
    .maybeSingle()

  const format = settings?.invoice_number_format || "INV-{YEAR}-{MONTH}-{SEQUENCE}"
  const paymentTerms = settings?.default_payment_terms || "Net 30"

  const { data: seqResult, error: seqError } = await admin.rpc("increment_invoice_number_sequence", {
    p_company_id: companyId,
  })
  if (seqError) {
    Sentry.captureException(seqError)
    return { error: "Failed to generate invoice number", data: null }
  }
  const sequence = typeof seqResult === "number" ? seqResult : Number.parseInt(String(seqResult), 10)

  const { data: company } = await admin.from("companies").select("name").eq("id", companyId).maybeSingle()
  const invoiceNumber = formatInvoiceNumber(format, sequence, company?.name)

  const issueDate = new Date().toISOString().split("T")[0]
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  const customerName = load.customer_name || load.consignee_name || load.company_name || "Customer"
  const loadRef = load.shipment_number || loadId.slice(0, 8)

  let subtotal = amount
  let taxAmount = 0
  let finalAmount = amount
  if (settings?.tax_enabled && settings.default_tax_rate) {
    if (settings.tax_inclusive) {
      subtotal = Math.round((finalAmount / (1 + settings.default_tax_rate / 100)) * 100) / 100
      taxAmount = Math.round((finalAmount - subtotal) * 100) / 100
      finalAmount = Math.round((subtotal + taxAmount) * 100) / 100
    } else {
      taxAmount = Math.round((subtotal * settings.default_tax_rate) / 100 * 100) / 100
      finalAmount = Math.round((subtotal + taxAmount) * 100) / 100
    }
  }

  const lineItems = [
    {
      description: `Freight: ${load.origin || "Origin"} to ${load.destination || "Destination"}`,
      quantity: 1,
      unit_price: subtotal,
      total: subtotal,
    },
  ]

  const { data: rpcInvoice, error: rpcError } = await admin.rpc("create_invoice_transactional", {
    p_company_id: companyId,
    p_load_id: loadId,
    p_invoice_number: invoiceNumber,
    p_invoice_date: issueDate,
    p_due_date: dueDate,
    p_subtotal: subtotal,
    p_fuel_surcharge: 0,
    p_accessorials: 0,
    p_tax_amount: taxAmount,
    p_total_amount: finalAmount,
    p_status: "draft",
    p_line_items: lineItems,
    p_customer_name: customerName,
    p_payment_terms: paymentTerms,
    p_description: `Invoice for load ${loadRef}`,
    p_tax_rate: settings?.tax_enabled && settings.default_tax_rate ? settings.default_tax_rate : null,
  })

  if (rpcError) {
    Sentry.captureException(rpcError)
    return { error: errorMessage(rpcError, "Failed to create draft invoice"), data: null }
  }

  const invoiceId =
    rpcInvoice &&
    typeof rpcInvoice === "object" &&
    "invoice_id" in rpcInvoice &&
    (rpcInvoice as { invoice_id?: string }).invoice_id
      ? String((rpcInvoice as { invoice_id: string }).invoice_id)
      : null

  if (!invoiceId) {
    return { error: "Invoice not created", data: null }
  }

  await linkPodDocumentsToInvoice(admin, companyId, loadId, invoiceId)

  try {
    const { autoAddDetentionsToInvoice } = await import("./detention-tracking")
    await autoAddDetentionsToInvoice(loadId).catch((err) => Sentry.captureException(err))
  } catch (error) {
    Sentry.captureException(error)
  }

  Sentry.captureMessage(
    `[AUTO-INVOICE] Draft ${invoiceNumber} created for load ${loadRef} (company ${companyId})`,
    "info",
  )

  return {
    data: {
      invoiceId,
      invoiceNumber,
      alreadyExists: false,
    },
    error: null,
  }
}

/**
 * Opt-in automation entry point — call from delivery status changes and POD capture.
 */
export async function maybeAutoInvoiceOnDelivery(
  loadId: string,
  companyId: string,
): Promise<{ data: AutoInvoiceResult | null; error: string | null }> {
  try {
    const enabled = await isAutoInvoiceOnDeliveryEnabled(companyId)
    if (!enabled) {
      return {
        data: { skipped: true, skipReason: "auto_invoice_on_delivery_disabled" },
        error: null,
      }
    }

    const result = await createAutoDraftInvoiceForLoad(companyId, loadId)
    if (result.error || !result.data) {
      return result
    }

    if (!result.data.alreadyExists && result.data.invoiceId && result.data.invoiceNumber) {
      const admin = createAdminClient()
      const { data: load } = await admin
        .from("loads")
        .select("shipment_number")
        .eq("id", loadId)
        .eq("company_id", companyId)
        .maybeSingle()
      const loadRef = load?.shipment_number || loadId.slice(0, 8)

      await notifyAutoDraftInvoice({
        companyId,
        invoiceId: result.data.invoiceId,
        invoiceNumber: result.data.invoiceNumber,
        loadRef,
        loadId,
      })
    }

    return result
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to auto-invoice on delivery"), data: null }
  }
}

/**
 * Manual invoice generation from the UI (not gated on auto_invoice_on_delivery).
 */
export async function autoGenerateInvoiceOnPOD(loadId: string) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    const { data: existingInvoices, error: invoiceCheckError } = await supabase
      .from("invoices")
      .select("id")
      .eq("load_id", loadId)
      .eq("company_id", ctx.companyId)

    if (invoiceCheckError) {
      Sentry.captureException(invoiceCheckError)
      return { error: "Failed to check existing invoices", data: null }
    }

    if (existingInvoices && existingInvoices.length > 0) {
      const existingInvoice = existingInvoices[0]
      return {
        data: {
          invoiceId: existingInvoice.id,
          alreadyExists: true,
        },
        error: null,
      }
    }

    const loadResult = await getLoad(loadId)
    if (loadResult.error || !loadResult.data) {
      return { error: loadResult.error || "Load not found", data: null }
    }

    const load = loadResult.data
    const amount = load.rate || load.value || 0

    if (amount === 0) {
      return {
        error: "Load has no rate or value. Cannot generate invoice.",
        data: null,
      }
    }

    const customerName = load.customer_name || load.consignee_name || "Customer"

    const invoiceResult = await createInvoice({
      customer_name: customerName,
      load_id: loadId,
      amount: amount,
      issue_date: new Date().toISOString().split("T")[0],
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
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

    if (invoiceResult.data) {
      try {
        const { data: podDocuments } = await supabase
          .from("documents")
          .select("id")
          .eq("load_id", loadId)
          .eq("type", "pod_photo")
          .limit(10)

        if (podDocuments && podDocuments.length > 0) {
          const { linkDocumentToRecord } = await import("./document-routing")
          for (const doc of podDocuments) {
            await linkDocumentToRecord(doc.id, "invoice", invoiceResult.data.id).catch((err) =>
              Sentry.captureException(err),
            )
          }
        }
      } catch (error) {
        Sentry.captureException(error)
      }
    }

    return {
      data: {
        invoiceId: invoiceResult.data?.id,
        alreadyExists: false,
      },
      error: null,
    }
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to auto-generate invoice"), data: null }
  }
}
