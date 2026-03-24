import { NextRequest, NextResponse } from "next/server"
import { errorMessage } from "@/lib/error-message"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { getQuickBooksConnection, qbFetch } from "@/lib/quickbooks/client"

export async function POST(request: NextRequest, ctxRoute: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return NextResponse.json({ error: ctx.error || "Not authenticated" }, { status: 401 })
    }

    const { getUserRole } = await import("@/lib/server-permissions")
    const role = await getUserRole()
    const MANAGER_ROLES = ["super_admin", "operations_manager"]
    if (!role || !MANAGER_ROLES.includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await ctxRoute.params
    if (!id) return NextResponse.json({ error: "Missing invoice id" }, { status: 400 })

    const supabase = await createClient()
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("id, amount, quickbooks_id, status")
      .eq("company_id", ctx.companyId)
      .eq("id", id)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: invoiceError?.message || "Invoice not found" }, { status: 404 })
    }

    if (!invoice.quickbooks_id) {
      return NextResponse.json({ error: "Invoice is not linked to QuickBooks" }, { status: 400 })
    }

    const conn = await getQuickBooksConnection(ctx.companyId)
    const qbInvoice = await qbFetch(conn, `/invoice/${encodeURIComponent(String(invoice.quickbooks_id))}`, {
      method: "GET",
    })

    const qbo = qbInvoice?.Invoice
    if (!qbo) {
      return NextResponse.json({ error: "QuickBooks invoice not found" }, { status: 404 })
    }

    const balance = typeof qbo.Balance === "number" ? qbo.Balance : Number(qbo.Balance || 0)
    const totalAmt = typeof qbo.TotalAmt === "number" ? qbo.TotalAmt : Number(qbo.TotalAmt || 0)

    const isPaid = balance === 0 && totalAmt > 0

    const updateData: any = {}
    if (isPaid) {
      updateData.status = "paid"
      updateData.paid_amount = totalAmt
      updateData.paid_date = qbo.TxnDate ? new Date(qbo.TxnDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
      updateData.payment_method = "quickbooks"
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({
        success: true,
        paid: false,
        message: "Invoice is not marked as fully paid in QuickBooks",
      })
    }

    await supabase
      .from("invoices")
      .update(updateData)
      .eq("company_id", ctx.companyId)
      .eq("id", invoice.id)

    return NextResponse.json({
      success: true,
      paid: true,
      status: updateData.status,
      paid_amount: updateData.paid_amount,
      paid_date: updateData.paid_date,
      payment_method: updateData.payment_method,
    })
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error, "Internal server error") }, { status: 500 })
  }
}

