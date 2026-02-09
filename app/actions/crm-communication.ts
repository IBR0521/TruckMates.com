"use server"

/**
 * CRM Communication Logging Actions
 * Handles automated and manual communication logging
 */

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"
import { revalidatePath } from "next/cache"

export interface CommunicationLog {
  id: string
  company_id: string
  customer_id: string | null
  vendor_id: string | null
  contact_id: string | null
  type: "email" | "phone" | "sms" | "meeting" | "note" | "invoice_sent" | "payment_received"
  subject: string | null
  message: string | null
  direction: "inbound" | "outbound"
  load_id: string | null
  invoice_id: string | null
  user_id: string | null
  occurred_at: string
  attachments: any[] | null
  external_id: string | null
  source: "manual" | "email" | "sms" | "webhook"
  metadata: Record<string, any> | null
  created_at: string
  customer_name?: string | null
  vendor_name?: string | null
  contact_name?: string | null
  user_name?: string | null
}

/**
 * Log a communication (manual entry)
 */
export async function logCommunication(input: {
  customer_id?: string
  vendor_id?: string
  contact_id?: string
  type: CommunicationLog["type"]
  subject?: string
  message?: string
  direction?: "inbound" | "outbound"
  load_id?: string
  invoice_id?: string
  occurred_at?: string
  attachments?: any[]
}): Promise<{ data: CommunicationLog | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  // Validate that either customer_id or vendor_id is provided
  if (!input.customer_id && !input.vendor_id) {
    return { error: "Either customer_id or vendor_id must be provided", data: null }
  }

  try {
    const { data, error } = await supabase
      .from("contact_history")
      .insert({
        company_id: company_id,
        customer_id: input.customer_id || null,
        vendor_id: input.vendor_id || null,
        contact_id: input.contact_id || null,
        type: input.type,
        subject: input.subject || null,
        message: input.message || null,
        direction: input.direction || "outbound",
        load_id: input.load_id || null,
        invoice_id: input.invoice_id || null,
        user_id: user.id,
        occurred_at: input.occurred_at || new Date().toISOString(),
        attachments: input.attachments || null,
        source: "manual",
        metadata: {},
      })
      .select()
      .single()

    if (error) {
      return { error: error.message, data: null }
    }

    revalidatePath("/dashboard/crm")
    return { data: data as CommunicationLog, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to log communication", data: null }
  }
}

/**
 * Get communication timeline for a customer or vendor
 */
export async function getCommunicationTimeline(filters: {
  customer_id?: string
  vendor_id?: string
  contact_id?: string
  type?: CommunicationLog["type"]
  limit?: number
}): Promise<{ data: CommunicationLog[] | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  try {
    let query = supabase
      .from("contact_history")
      .select(`
        *,
        customers:customer_id(name),
        vendors:vendor_id(name),
        contacts:contact_id(first_name, last_name),
        users:user_id(full_name)
      `)
      .eq("company_id", company_id)

    if (filters.customer_id) {
      query = query.eq("customer_id", filters.customer_id)
    }
    if (filters.vendor_id) {
      query = query.eq("vendor_id", filters.vendor_id)
    }
    if (filters.contact_id) {
      query = query.eq("contact_id", filters.contact_id)
    }
    if (filters.type) {
      query = query.eq("type", filters.type)
    }

    query = query.order("occurred_at", { ascending: false })

    if (filters.limit) {
      query = query.limit(filters.limit)
    }

    const { data, error } = await query

    if (error) {
      return { error: error.message, data: null }
    }

    // Format the response
    const formattedData = (data || []).map((log: any) => ({
      ...log,
      customer_name: log.customers?.name || null,
      vendor_name: log.vendors?.name || null,
      contact_name: log.contacts
        ? `${log.contacts.first_name} ${log.contacts.last_name}`
        : null,
      user_name: log.users?.full_name || null,
    }))

    return { data: formattedData as CommunicationLog[], error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to get communication timeline", data: null }
  }
}

/**
 * Webhook handler for automated communication logging (called by external services)
 */
export async function logCommunicationFromWebhook(input: {
  customer_id?: string
  vendor_id?: string
  contact_id?: string
  type: CommunicationLog["type"]
  subject?: string
  message?: string
  direction: "inbound" | "outbound"
  external_id: string
  source: "email" | "sms" | "webhook"
  metadata?: Record<string, any>
  occurred_at?: string
}): Promise<{ data: CommunicationLog | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  // For webhooks, we might not have a user - use service role if available
  if (authError || !user) {
    // Try to get company_id from customer_id or vendor_id
    let company_id: string | null = null

    if (input.customer_id) {
      const { data: customer } = await supabase
        .from("customers")
        .select("company_id")
        .eq("id", input.customer_id)
        .single()
      company_id = customer?.company_id || null
    } else if (input.vendor_id) {
      const { data: vendor } = await supabase
        .from("vendors")
        .select("company_id")
        .eq("id", input.vendor_id)
        .single()
      company_id = vendor?.company_id || null
    }

    if (!company_id) {
      return { error: "Could not determine company", data: null }
    }
  } else {
    const result = await getCachedUserCompany(user.id)
    const company_id = result.company_id

    if (!company_id) {
      return { error: "No company found", data: null }
    }
  }

  // Validate that either customer_id or vendor_id is provided
  if (!input.customer_id && !input.vendor_id) {
    return { error: "Either customer_id or vendor_id must be provided", data: null }
  }

  try {
    // Check if communication already exists (prevent duplicates)
    if (input.external_id) {
      const { data: existing } = await supabase
        .from("contact_history")
        .select("id")
        .eq("external_id", input.external_id)
        .single()

      if (existing) {
        return { data: existing as any, error: null }
      }
    }

    const result = await getCachedUserCompany(user?.id || "")
    const company_id = result.company_id

    if (!company_id) {
      return { error: "No company found", data: null }
    }

    const { data, error } = await supabase
      .from("contact_history")
      .insert({
        company_id: company_id,
        customer_id: input.customer_id || null,
        vendor_id: input.vendor_id || null,
        contact_id: input.contact_id || null,
        type: input.type,
        subject: input.subject || null,
        message: input.message || null,
        direction: input.direction,
        user_id: user?.id || null,
        occurred_at: input.occurred_at || new Date().toISOString(),
        external_id: input.external_id,
        source: input.source,
        metadata: input.metadata || {},
      })
      .select()
      .single()

    if (error) {
      return { error: error.message, data: null }
    }

    revalidatePath("/dashboard/crm")
    return { data: data as CommunicationLog, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to log communication", data: null }
  }
}



