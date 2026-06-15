"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { errorMessage } from "@/lib/error-message"
import { checkEditPermission } from "@/lib/server-permissions"
import { revalidatePath } from "next/cache"
import * as Sentry from "@sentry/nextjs"

/** Add detention charge as a line item on the load's open invoice (or create draft). */
export async function addDetentionChargeToInvoice(input: {
  eventId: string
  loadId: string
  dwellHours: number
  ratePerHour?: number
}) {
  const permission = await checkEditPermission("invoicing")
  if (!permission.allowed) return { error: permission.error || "Permission denied", data: null }

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

  const rate = Number(input.ratePerHour) > 0 ? Number(input.ratePerHour) : 75
  const hours = Math.max(0, Number(input.dwellHours) || 0)
  const amount = Math.round(hours * rate * 100) / 100
  if (amount <= 0) return { error: "Detention amount must be greater than zero", data: null }

  const supabase = await createClient()

  const { data: existing } = await supabase
    .from("invoices")
    .select("id, items, amount, status")
    .eq("company_id", ctx.companyId)
    .eq("load_id", input.loadId)
    .not("status", "in", '("paid","cancelled")')
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const detentionLine = {
    description: `Detention (${hours.toFixed(1)}h @ $${rate}/hr)`,
    quantity: 1,
    rate: amount,
    amount,
    type: "detention",
    geofence_event_id: input.eventId,
  }

  try {
    if (existing?.id) {
      const items = Array.isArray(existing.items) ? [...existing.items, detentionLine] : [detentionLine]
      const newAmount = Math.round((Number(existing.amount || 0) + amount) * 100) / 100
      const { error: updateError } = await supabase
        .from("invoices")
        .update({ items, amount: newAmount })
        .eq("id", existing.id)
        .eq("company_id", ctx.companyId)
      if (updateError) return { error: updateError.message, data: null }

      await supabase
        .from("geofence_events")
        .update({ detention_billing_status: "invoiced" })
        .eq("id", input.eventId)
        .eq("company_id", ctx.companyId)

      revalidatePath(`/dashboard/accounting/invoices/${existing.id}`)
      return { data: { invoiceId: existing.id, created: false }, error: null }
    }

    const { createInvoice } = await import("./accounting")
    const { data: load } = await supabase
      .from("loads")
      .select("customer_name, shipment_number")
      .eq("id", input.loadId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    const today = new Date().toISOString().split("T")[0]
    const due = new Date()
    due.setDate(due.getDate() + 30)

    const created = await createInvoice({
      customer_name: String(load?.customer_name || "Customer"),
      amount,
      issue_date: today,
      due_date: due.toISOString().split("T")[0],
      load_id: input.loadId,
      description: `Detention for load ${load?.shipment_number || input.loadId}`,
      items: [detentionLine],
    })
    if (created.error || !created.data) return { error: created.error || "Failed to create invoice", data: null }

    await supabase
      .from("geofence_events")
      .update({ detention_billing_status: "invoiced" })
      .eq("id", input.eventId)
      .eq("company_id", ctx.companyId)

    return { data: { invoiceId: created.data.id, created: true }, error: null }
  } catch (err: unknown) {
    Sentry.captureException(err)
    return { error: errorMessage(err, "Failed to add detention to invoice"), data: null }
  }
}
