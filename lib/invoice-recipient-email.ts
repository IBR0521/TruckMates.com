import type { SupabaseClient } from "@supabase/supabase-js"
import {
  isValidEmailAddress,
  resolveCustomerEmail,
  resolveCustomerEmailFromSources,
  type CustomerEmailFields,
} from "./customer-email"

export type InvoiceRecipientResult = {
  email: string | null
  customerId: string | null
  source: string | null
}

type CustomerRow = CustomerEmailFields & {
  id: string
  name?: string | null
  company_name?: string | null
}

function normalizeCustomerName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\b(inc|llc|ltd|corp|corporation|co)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
}

async function fetchCustomerById(
  supabase: SupabaseClient,
  companyId: string,
  customerId: string,
): Promise<CustomerRow | null> {
  const { data } = await supabase
    .from("customers")
    .select("id, name, company_name, email, primary_contact_email")
    .eq("id", customerId)
    .eq("company_id", companyId)
    .maybeSingle()
  return data as CustomerRow | null
}

async function fetchCustomerByName(
  supabase: SupabaseClient,
  companyId: string,
  customerName: string,
): Promise<CustomerRow | null> {
  const trimmed = customerName.trim()
  if (!trimmed) return null

  const exactCols = ["name", "company_name"] as const
  for (const col of exactCols) {
    const { data } = await supabase
      .from("customers")
      .select("id, name, company_name, email, primary_contact_email")
      .eq("company_id", companyId)
      .ilike(col, trimmed)
      .limit(1)
      .maybeSingle()
    if (data) return data as CustomerRow
  }

  const normalized = normalizeCustomerName(trimmed)
  if (normalized && normalized !== trimmed.toLowerCase()) {
    const { data: candidates } = await supabase
      .from("customers")
      .select("id, name, company_name, email, primary_contact_email")
      .eq("company_id", companyId)
      .limit(50)

    for (const row of candidates ?? []) {
      const customer = row as CustomerRow
      const nameNorm = normalizeCustomerName(String(customer.name ?? ""))
      const companyNorm = normalizeCustomerName(String(customer.company_name ?? ""))
      if (
        (nameNorm && nameNorm === normalized) ||
        (companyNorm && companyNorm === normalized)
      ) {
        return customer
      }
    }
  }

  const escaped = trimmed.replace(/[%_\\]/g, "\\$&")
  const { data: partial } = await supabase
    .from("customers")
    .select("id, name, company_name, email, primary_contact_email")
    .eq("company_id", companyId)
    .or(`name.ilike.%${escaped}%,company_name.ilike.%${escaped}%`)
    .limit(1)
    .maybeSingle()

  return (partial as CustomerRow | null) ?? null
}

async function fetchPrimaryContactEmail(
  supabase: SupabaseClient,
  companyId: string,
  customerId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("contacts")
    .select("email")
    .eq("company_id", companyId)
    .eq("customer_id", customerId)
    .eq("is_primary", true)
    .not("email", "is", null)
    .limit(1)
    .maybeSingle()

  const email = String(data?.email ?? "").trim()
  return isValidEmailAddress(email) ? email : null
}

/**
 * Resolve who should receive an invoice email.
 * Checks load contacts, linked CRM customers, name match, and primary contacts.
 */
export async function resolveInvoiceRecipientEmail(
  supabase: SupabaseClient,
  companyId: string,
  invoice: {
    id?: string
    customer_id?: string | null
    customer_name?: string | null
    load_id?: string | null
  },
  overrideEmail?: string | null,
): Promise<InvoiceRecipientResult> {
  const override = String(overrideEmail ?? "").trim()
  if (isValidEmailAddress(override)) {
    return { email: override, customerId: null, source: "override" }
  }

  const emailSources: Array<{ email: string | null; customerId: string | null; source: string }> = []

  if (invoice.load_id) {
    const { data: load } = await supabase
      .from("loads")
      .select("customer_id, consignee_contact_email, shipper_contact_email")
      .eq("id", invoice.load_id)
      .eq("company_id", companyId)
      .maybeSingle()

    if (load) {
      emailSources.push({
        email: load.consignee_contact_email,
        customerId: null,
        source: "load.consignee_contact_email",
      })
      emailSources.push({
        email: load.shipper_contact_email,
        customerId: null,
        source: "load.shipper_contact_email",
      })

      if (load.customer_id) {
        const loadCustomer = await fetchCustomerById(supabase, companyId, load.customer_id)
        emailSources.push({
          email: resolveCustomerEmail(loadCustomer),
          customerId: loadCustomer?.id ?? null,
          source: "load.customer",
        })
        if (loadCustomer?.id) {
          emailSources.push({
            email: await fetchPrimaryContactEmail(supabase, companyId, loadCustomer.id),
            customerId: loadCustomer.id,
            source: "load.customer.primary_contact",
          })
        }
      }
    }
  }

  if (invoice.customer_id) {
    const invoiceCustomer = await fetchCustomerById(supabase, companyId, invoice.customer_id)
    emailSources.push({
      email: resolveCustomerEmail(invoiceCustomer),
      customerId: invoiceCustomer?.id ?? null,
      source: "invoice.customer_id",
    })
    if (invoiceCustomer?.id) {
      emailSources.push({
        email: await fetchPrimaryContactEmail(supabase, companyId, invoiceCustomer.id),
        customerId: invoiceCustomer.id,
        source: "invoice.customer.primary_contact",
      })
    }
  }

  const customerName = String(invoice.customer_name ?? "").trim()
  if (customerName) {
    const matched = await fetchCustomerByName(supabase, companyId, customerName)
    if (matched) {
      emailSources.push({
        email: resolveCustomerEmail(matched),
        customerId: matched.id,
        source: "invoice.customer_name_match",
      })
      emailSources.push({
        email: await fetchPrimaryContactEmail(supabase, companyId, matched.id),
        customerId: matched.id,
        source: "invoice.customer_name_match.primary_contact",
      })
    }
  }

  for (const row of emailSources) {
    const email = resolveCustomerEmailFromSources([row.email])
    if (email) {
      return { email, customerId: row.customerId, source: row.source }
    }
  }

  return { email: null, customerId: null, source: null }
}
