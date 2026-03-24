import { NextRequest, NextResponse } from "next/server"
import { errorMessage } from "@/lib/error-message"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { getQuickBooksConnection, qbFetch, qbQuery } from "@/lib/quickbooks/client"

function qbEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")
}

type QuickBooksMapping = {
  defaultIncomeAccountId?: string | null
  defaultItemId?: string | null
}

async function getOrCreateIncomeAccountId(conn: any, mapping: QuickBooksMapping) {
  // Prefer explicit mapping if configured
  if (mapping.defaultIncomeAccountId) {
    return String(mapping.defaultIncomeAccountId)
  }

  // Fallback: pick first Income account from QuickBooks
  const q = "select Id, Name, AccountType from Account where AccountType = 'Income' maxresults 1"
  const res = await qbQuery(conn, q)
  const acct = res?.QueryResponse?.Account?.[0]
  if (acct?.Id) return String(acct.Id)
  throw new Error("No Income account found in QuickBooks")
}

async function getOrCreateServiceItem(conn: any, mapping: QuickBooksMapping) {
  // Prefer explicit mapping if configured
  if (mapping.defaultItemId) {
    return String(mapping.defaultItemId)
  }

  const name = "Freight Services"
  const q = `select Id, Name from Item where Name = '${qbEscape(name)}' maxresults 1`
  const res = await qbQuery(conn, q)
  const existing = res?.QueryResponse?.Item?.[0]
  if (existing?.Id) return String(existing.Id)

  const incomeAccountId = await getOrCreateIncomeAccountId(conn, mapping)
  const created = await qbFetch(conn, "/item", {
    method: "POST",
    body: JSON.stringify({
      Name: name,
      Type: "Service",
      IncomeAccountRef: { value: incomeAccountId },
    }),
  })
  const id = created?.Item?.Id
  if (!id) throw new Error("Failed to create default service item")
  return String(id)
}

async function getOrCreateCustomer(conn: any, displayName: string) {
  const normalized = String(displayName || "")
    .trim()
    .replace(/\s+/g, " ")
  const q = `select Id, DisplayName from Customer where DisplayName = '${qbEscape(normalized)}' maxresults 1`
  const res = await qbQuery(conn, q)
  const existing = res?.QueryResponse?.Customer?.[0]
  if (existing?.Id) return String(existing.Id)

  const created = await qbFetch(conn, "/customer", {
    method: "POST",
    body: JSON.stringify({ DisplayName: normalized }),
  })
  const id = created?.Customer?.Id
  if (!id) throw new Error("Failed to create customer in QuickBooks")
  return String(id)
}

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
      .select("id, customer_name, amount, issue_date, due_date, invoice_number, description, quickbooks_id")
      .eq("company_id", ctx.companyId)
      .eq("id", id)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: invoiceError?.message || "Invoice not found" }, { status: 404 })
    }

    if (invoice.quickbooks_id) {
      return NextResponse.json(
        { error: "Already synced", quickbooks_id: invoice.quickbooks_id },
        { status: 409 },
      )
    }

    const conn = await getQuickBooksConnection(ctx.companyId)

    // Load optional mapping preferences from company_integrations
    const { data: mappingRow } = await supabase
      .from("company_integrations")
      .select("quickbooks_default_income_account_id, quickbooks_default_item_id")
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    const mapping: QuickBooksMapping = {
      defaultIncomeAccountId: mappingRow?.quickbooks_default_income_account_id || null,
      defaultItemId: mappingRow?.quickbooks_default_item_id || null,
    }

    const customerName = String(invoice.customer_name || "Customer")
    const customerId = await getOrCreateCustomer(conn as any, customerName)
    const itemId = await getOrCreateServiceItem(conn as any, mapping)

    const amount = Number(invoice.amount || 0)
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invoice amount must be > 0" }, { status: 400 })
    }

    const txnDate = invoice.issue_date ? String(invoice.issue_date) : new Date().toISOString().slice(0, 10)
    const dueDate = invoice.due_date ? String(invoice.due_date) : undefined

    // Create invoice in QBO (update later if needed)
    const payload: any = {
      CustomerRef: { value: customerId },
      TxnDate: txnDate,
      Line: [
        {
          Amount: amount,
          DetailType: "SalesItemLineDetail",
          Description: invoice.description || `Invoice ${invoice.invoice_number || invoice.id}`,
          SalesItemLineDetail: {
            ItemRef: { value: itemId },
            Qty: 1,
            UnitPrice: amount,
          },
        },
      ],
      PrivateNote: invoice.invoice_number ? `TruckMates invoice: ${invoice.invoice_number}` : `TruckMates invoice: ${invoice.id}`,
    }
    if (dueDate) payload.DueDate = dueDate

    const created = await qbFetch(conn as any, "/invoice", { method: "POST", body: JSON.stringify(payload) })
    const qbInvoiceId = created?.Invoice?.Id
    if (!qbInvoiceId) throw new Error("QuickBooks invoice create failed")

    await supabase
      .from("invoices")
      .update({
        quickbooks_id: String(qbInvoiceId),
        quickbooks_synced_at: new Date().toISOString(),
      })
      .eq("company_id", ctx.companyId)
      .eq("id", invoice.id)

    return NextResponse.json({ success: true, quickbooks_id: String(qbInvoiceId) })
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error, "Internal server error") }, { status: 500 })
  }
}

