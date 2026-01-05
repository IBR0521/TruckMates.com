"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import crypto from "crypto"
import { handleDbError } from "@/lib/db-helpers"

/**
 * Generate secure access token for customer portal
 */
function generateAccessToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Create or update customer portal access
 */
export async function createCustomerPortalAccess(formData: {
  customer_id: string
  portal_url?: string
  can_view_location?: boolean
  can_submit_loads?: boolean
  email_notifications?: boolean
  sms_notifications?: boolean
  expires_days?: number
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id, role")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
  }

  if (userData.role !== 'manager') {
    return { error: "Only managers can create portal access", data: null }
  }

  // Verify customer belongs to company
  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", formData.customer_id)
    .eq("company_id", userData.company_id)
    .single()

  if (!customer) {
    return { error: "Customer not found", data: null }
  }

  // Check if access already exists
  const { data: existingAccess } = await supabase
    .from("customer_portal_access")
    .select("*")
    .eq("customer_id", formData.customer_id)
    .eq("company_id", userData.company_id)
    .single()

  const accessToken = generateAccessToken()
  const expiresAt = formData.expires_days
    ? new Date(Date.now() + formData.expires_days * 24 * 60 * 60 * 1000).toISOString()
    : null

  let data, error

  if (existingAccess) {
    // Update existing access
    const { data: updated, error: updateError } = await supabase
      .from("customer_portal_access")
      .update({
        access_token: accessToken,
        portal_url: formData.portal_url || null,
        can_view_location: formData.can_view_location || false,
        can_submit_loads: formData.can_submit_loads || false,
        email_notifications: formData.email_notifications !== false,
        sms_notifications: formData.sms_notifications || false,
        expires_at: expiresAt,
        is_active: true,
      })
      .eq("id", existingAccess.id)
      .select()
      .single()

    data = updated
    error = updateError
  } else {
    // Create new access
    const { data: created, error: createError } = await supabase
      .from("customer_portal_access")
      .insert({
        company_id: userData.company_id,
        customer_id: formData.customer_id,
        access_token: accessToken,
        portal_url: formData.portal_url || null,
        can_view_location: formData.can_view_location || false,
        can_submit_loads: formData.can_submit_loads || false,
        email_notifications: formData.email_notifications !== false,
        sms_notifications: formData.sms_notifications || false,
        expires_at: expiresAt,
        is_active: true,
      })
      .select()
      .single()

    data = created
    error = createError
  }

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/settings/customer-portal")
  return { data, error: null }
}

/**
 * Get customer portal access by token (public access)
 */
export async function getPortalAccessByToken(token: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("customer_portal_access")
    .select(`
      *,
      customer:customers(*),
      company:companies(*)
    `)
    .eq("access_token", token)
    .eq("is_active", true)
    .single()

  if (error) {
    const result = handleDbError(error, null)
    if (result.error) return { error: "Invalid or expired access token", data: null }
    return { error: "Table not available. Please run the SQL schema.", data: null }
  }

  if (!data) {
    return { error: "Invalid or expired access token", data: null }
  }

  // Check expiration
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { error: "Access token has expired", data: null }
  }

  // Update last accessed
  await supabase
    .from("customer_portal_access")
    .update({
      last_accessed_at: new Date().toISOString(),
      access_count: (data.access_count || 0) + 1,
    })
    .eq("id", data.id)

  return { data, error: null }
}

/**
 * Get loads for customer portal
 */
export async function getCustomerPortalLoads(token: string) {
  const portalResult = await getPortalAccessByToken(token)
  if (portalResult.error || !portalResult.data) {
    return portalResult
  }

  const portalAccess = portalResult.data
  const supabase = await createClient()

  // Get loads for this customer
  const { data: loads, error } = await supabase
    .from("loads")
    .select(`
      *,
      driver:drivers(name, phone),
      truck:trucks(truck_number, make, model),
      route:routes(name, origin, destination, status)
    `)
    .eq("company_id", portalAccess.company_id)
    .or(`company_name.ilike.%${portalAccess.customer?.name}%,customer_id.eq.${portalAccess.customer_id}`)
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message, data: null }
  }

  return { data: loads || [], error: null }
}

/**
 * Get load details for customer portal
 */
export async function getCustomerPortalLoad(token: string, loadId: string) {
  const portalResult = await getPortalAccessByToken(token)
  if (portalResult.error || !portalResult.data) {
    return portalResult
  }

  const portalAccess = portalResult.data
  const supabase = await createClient()

  const { data: load, error } = await supabase
    .from("loads")
    .select(`
      *,
      driver:drivers(name, phone, email),
      truck:trucks(truck_number, make, model),
      route:routes(*),
      invoices:invoices(*)
    `)
    .eq("id", loadId)
    .eq("company_id", portalAccess.company_id)
    .single()

  if (error || !load) {
    return { error: "Load not found", data: null }
  }

  // Check if customer has access to this load
  const customerName = portalAccess.customer?.name || ""
  if (load.company_name && !load.company_name.toLowerCase().includes(customerName.toLowerCase())) {
    if (load.customer_id !== portalAccess.customer_id) {
      return { error: "Access denied", data: null }
    }
  }

  // Get real-time location if allowed
  let driverLocation = null
  if (portalAccess.can_view_location && load.driver_id) {
    // Get latest ELD location
    const { data: location } = await supabase
      .from("eld_locations")
      .select("*")
      .eq("driver_id", load.driver_id)
      .order("timestamp", { ascending: false })
      .limit(1)
      .single()

    if (location) {
      driverLocation = {
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address,
        timestamp: location.timestamp,
      }
    }
  }

  return {
    data: {
      ...load,
      driver_location: driverLocation,
    },
    error: null,
  }
}

/**
 * Get documents for customer portal
 */
export async function getCustomerPortalDocuments(token: string, loadId?: string) {
  const portalResult = await getPortalAccessByToken(token)
  if (portalResult.error || !portalResult.data) {
    return portalResult
  }

  const portalAccess = portalResult.data
  const supabase = await createClient()

  if (!portalAccess.can_download_documents) {
    return { error: "Document access not allowed", data: null }
  }

  let query = supabase
    .from("documents")
    .select("*")
    .eq("company_id", portalAccess.company_id)

  if (loadId) {
    query = query.eq("load_id", loadId)
  }

  const { data, error } = await query.order("created_at", { ascending: false })

  if (error) {
    return { error: error.message, data: null }
  }

  return { data: data || [], error: null }
}

/**
 * Get invoices for customer portal
 */
export async function getCustomerPortalInvoices(token: string) {
  const portalResult = await getPortalAccessByToken(token)
  if (portalResult.error || !portalResult.data) {
    return portalResult
  }

  const portalAccess = portalResult.data
  const supabase = await createClient()

  if (!portalAccess.can_view_invoices) {
    return { error: "Invoice access not allowed", data: null }
  }

  const customerName = portalAccess.customer?.name || ""

  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("company_id", portalAccess.company_id)
    .ilike("customer_name", `%${customerName}%`)
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message, data: null }
  }

  return { data: data || [], error: null }
}

/**
 * Get customer portal access by customer ID
 */
export async function getCustomerPortalAccess(customerId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id, role")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
  }

  const { data, error } = await supabase
    .from("customer_portal_access")
    .select("*")
    .eq("customer_id", customerId)
    .eq("company_id", userData.company_id)
    .eq("is_active", true)
    .single()

  if (error) {
    if (error.code === "PGRST116") {
      return { data: null, error: null } // No access found
    }
    const result = handleDbError(error, null)
    if (result.error) return { error: result.error, data: null }
    return { error: "Table not available. Please run the SQL schema.", data: null }
  }

  return { data, error: null }
}

/**
 * Revoke customer portal access
 */
export async function revokeCustomerPortalAccess(customerId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id, role")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
  }

  if (userData.role !== 'manager') {
    return { error: "Only managers can revoke portal access", data: null }
  }

  const { error } = await supabase
    .from("customer_portal_access")
    .update({ is_active: false })
    .eq("customer_id", customerId)
    .eq("company_id", userData.company_id)

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/settings/customer-portal")
  return { data: { success: true }, error: null }
}

