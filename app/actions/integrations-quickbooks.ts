"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getCachedUserCompany } from "@/lib/query-optimizer"

/**
 * QuickBooks Integration Backend
 * Syncs accounting data between TruckMates and QuickBooks
 */

// Get QuickBooks access token
async function getQuickBooksAccessToken(apiKey: string, apiSecret: string, companyId: string) {
  try {
    // QuickBooks OAuth 2.0 flow
    // In production, you'd use the full OAuth flow with redirects
    // For now, we'll use API key/secret if provided
    const response = await fetch("https://sandbox-quickbooks.api.intuit.com/oauth2/v1/tokens/bearer", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: apiKey,
        client_secret: apiSecret,
        scope: "com.intuit.quickbooks.accounting",
      }),
    })

    if (!response.ok) {
      throw new Error("Failed to get QuickBooks access token")
    }

    const data = await response.json()
    return data.access_token
  } catch (error: any) {
    console.error("[QuickBooks] Token error:", error)
    throw error
  }
}

/**
 * Sync invoice to QuickBooks
 */
export async function syncInvoiceToQuickBooks(invoiceId: string) {
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

  // Get integration settings
  const { data: integrations } = await supabase
    .from("company_integrations")
    .select("quickbooks_enabled, quickbooks_api_key, quickbooks_api_secret, quickbooks_company_id")
    .eq("company_id", result.company_id)
    .single()

  if (!integrations?.quickbooks_enabled || !integrations.quickbooks_api_key) {
    return { error: "QuickBooks integration is not enabled or configured", data: null }
  }

  // Get invoice data
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("company_id", result.company_id)
    .single()

  if (invoiceError || !invoice) {
    return { error: "Invoice not found", data: null }
  }

  try {
    const accessToken = await getQuickBooksAccessToken(
      integrations.quickbooks_api_key,
      integrations.quickbooks_api_secret || "",
      integrations.quickbooks_company_id || ""
    )

    const qbCompanyId = integrations.quickbooks_company_id || ""
    const baseUrl = qbCompanyId.includes("sandbox")
      ? "https://sandbox-quickbooks.api.intuit.com"
      : "https://quickbooks.api.intuit.com"

    // Create invoice in QuickBooks
    const qbInvoice = {
      Line: [
        {
          Amount: invoice.amount,
          DetailType: "SalesItemLineDetail",
          SalesItemLineDetail: {
            ItemRef: {
              value: "1", // Default item - should be configured
              name: "Services",
            },
            UnitPrice: invoice.amount,
            Qty: 1,
          },
        },
      ],
      CustomerRef: {
        value: invoice.customer_name, // Should map to QB customer ID
        name: invoice.customer_name,
      },
      TxnDate: invoice.issue_date,
      DueDate: invoice.due_date,
      TotalAmt: invoice.amount,
      DocNumber: invoice.invoice_number,
      PrivateNote: invoice.description || `Invoice for load ${invoice.load_id}`,
    }

    const response = await fetch(`${baseUrl}/v3/company/${qbCompanyId}/invoice`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(qbInvoice),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error("[QuickBooks] Invoice sync error:", errorData)
      return { error: `QuickBooks sync failed: ${errorData.fault?.error?.[0]?.message || "Unknown error"}`, data: null }
    }

    const qbResponse = await response.json()
    const qbInvoiceId = qbResponse.Invoice?.Id

    // Store QuickBooks ID in invoice
    await supabase
      .from("invoices")
      .update({
        quickbooks_id: qbInvoiceId,
        quickbooks_synced_at: new Date().toISOString(),
      })
      .eq("id", invoiceId)

    revalidatePath("/dashboard/accounting/invoices")
    return { data: { quickbooks_id: qbInvoiceId, synced: true }, error: null }
  } catch (error: any) {
    console.error("[QuickBooks] Sync error:", error)
    return { error: error?.message || "Failed to sync invoice to QuickBooks", data: null }
  }
}

/**
 * Sync expense to QuickBooks
 */
export async function syncExpenseToQuickBooks(expenseId: string) {
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

  // Get integration settings
  const { data: integrations } = await supabase
    .from("company_integrations")
    .select("quickbooks_enabled, quickbooks_api_key, quickbooks_api_secret, quickbooks_company_id")
    .eq("company_id", result.company_id)
    .single()

  if (!integrations?.quickbooks_enabled || !integrations.quickbooks_api_key) {
    return { error: "QuickBooks integration is not enabled or configured", data: null }
  }

  // Get expense data
  const { data: expense, error: expenseError } = await supabase
    .from("expenses")
    .select("*")
    .eq("id", expenseId)
    .eq("company_id", result.company_id)
    .single()

  if (expenseError || !expense) {
    return { error: "Expense not found", data: null }
  }

  try {
    const accessToken = await getQuickBooksAccessToken(
      integrations.quickbooks_api_key,
      integrations.quickbooks_api_secret || "",
      integrations.quickbooks_company_id || ""
    )

    const qbCompanyId = integrations.quickbooks_company_id || ""
    const baseUrl = qbCompanyId.includes("sandbox")
      ? "https://sandbox-quickbooks.api.intuit.com"
      : "https://quickbooks.api.intuit.com"

    // Create purchase/payment in QuickBooks
    const qbPurchase = {
      PaymentType: "Cash",
      AccountRef: {
        value: "1", // Should map to expense account
        name: "Expenses",
      },
      Line: [
        {
          Amount: expense.amount,
          DetailType: "AccountBasedExpenseLineDetail",
          AccountBasedExpenseLineDetail: {
            AccountRef: {
              value: "1",
              name: expense.category || "Other",
            },
            BillableStatus: "NotBillable",
          },
        },
      ],
      TxnDate: expense.date,
      TotalAmt: expense.amount,
      PrivateNote: expense.description,
    }

    const response = await fetch(`${baseUrl}/v3/company/${qbCompanyId}/purchase`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(qbPurchase),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error("[QuickBooks] Expense sync error:", errorData)
      return { error: `QuickBooks sync failed: ${errorData.fault?.error?.[0]?.message || "Unknown error"}`, data: null }
    }

    const qbResponse = await response.json()
    const qbPurchaseId = qbResponse.Purchase?.Id

    // Store QuickBooks ID in expense
    await supabase
      .from("expenses")
      .update({
        quickbooks_id: qbPurchaseId,
        quickbooks_synced_at: new Date().toISOString(),
      })
      .eq("id", expenseId)

    revalidatePath("/dashboard/accounting/expenses")
    return { data: { quickbooks_id: qbPurchaseId, synced: true }, error: null }
  } catch (error: any) {
    console.error("[QuickBooks] Sync error:", error)
    return { error: error?.message || "Failed to sync expense to QuickBooks", data: null }
  }
}

/**
 * Bulk sync invoices to QuickBooks
 */
export async function bulkSyncInvoicesToQuickBooks(invoiceIds: string[]) {
  const results = []
  for (const invoiceId of invoiceIds) {
    const result = await syncInvoiceToQuickBooks(invoiceId)
    results.push({ invoiceId, ...result })
  }
  return { data: results, error: null }
}

/**
 * Test QuickBooks connection
 */
export async function testQuickBooksConnection() {
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

  // Get integration settings
  const { data: integrations } = await supabase
    .from("company_integrations")
    .select("quickbooks_enabled, quickbooks_api_key, quickbooks_api_secret, quickbooks_company_id")
    .eq("company_id", result.company_id)
    .single()

  if (!integrations?.quickbooks_enabled || !integrations.quickbooks_api_key) {
    return { error: "QuickBooks integration is not enabled or configured", data: null }
  }

  try {
    const accessToken = await getQuickBooksAccessToken(
      integrations.quickbooks_api_key,
      integrations.quickbooks_api_secret || "",
      integrations.quickbooks_company_id || ""
    )

    const qbCompanyId = integrations.quickbooks_company_id || ""
    const baseUrl = qbCompanyId.includes("sandbox")
      ? "https://sandbox-quickbooks.api.intuit.com"
      : "https://quickbooks.api.intuit.com"

    // Test connection by fetching company info
    const response = await fetch(`${baseUrl}/v3/company/${qbCompanyId}/companyinfo/${qbCompanyId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
      },
    })

    if (!response.ok) {
      return { error: "Failed to connect to QuickBooks. Please check your credentials.", data: null }
    }

    const companyInfo = await response.json()
    return { data: { connected: true, company: companyInfo.CompanyInfo?.CompanyName }, error: null }
  } catch (error: any) {
    console.error("[QuickBooks] Connection test error:", error)
    return { error: error?.message || "Failed to test QuickBooks connection", data: null }
  }
}

