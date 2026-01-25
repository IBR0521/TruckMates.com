"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import crypto from "crypto"
import { handleDbError } from "@/lib/db-helpers"

// Helper to get Resend client (uses platform API key)
async function getResendClient() {
  // Always use platform API key from environment variables
  const apiKey = process.env.RESEND_API_KEY
  
  if (!apiKey) {
    console.error("[RESEND] Platform API key not configured")
    return null
  }

  // Check if integration is enabled for this company
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const { getCachedUserCompany } = await import("@/lib/query-optimizer")
      const result = await getCachedUserCompany(user.id)
      
      if (result.company_id) {
        const { data: integrations } = await supabase
          .from("company_integrations")
          .select("resend_enabled")
          .eq("company_id", result.company_id)
          .single()

        if (!integrations?.resend_enabled) {
          console.log("[RESEND] Integration not enabled for company")
          return null
        }
      }
    }
  } catch (error) {
    console.error("[RESEND] Error checking integration:", error)
    return null
  }
  
  try {
    const Resend = (await import("resend")).Resend
    return new Resend(apiKey)
  } catch {
    return null
  }
}

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

  // Send email notification if enabled and customer has email
  if (formData.email_notifications !== false && customer.email) {
    try {
      await sendPortalAccessEmail({
        customerEmail: customer.email,
        customerName: customer.name || customer.company_name || "Customer",
        portalUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://truckmates.com"}/portal/${accessToken}`,
        companyName: userData.company_id ? (await supabase.from("companies").select("name").eq("id", userData.company_id).single()).data?.name || "TruckMates" : "TruckMates",
        expiresAt: expiresAt,
      })
    } catch (emailError) {
      // Don't fail the whole operation if email fails
      console.error("Failed to send portal access email:", emailError)
    }
  }

  revalidatePath("/dashboard/settings/customer-portal")
  revalidatePath(`/dashboard/customers/${formData.customer_id}`)
  return { data, error: null }
}

/**
 * Send portal access email to customer
 */
async function sendPortalAccessEmail(data: {
  customerEmail: string
  customerName: string
  portalUrl: string
  companyName: string
  expiresAt: string | null
}) {
  const resend = await getResendClient()

  if (!resend) {
    console.log("[PORTAL EMAIL] Resend not configured, skipping email")
    return { sent: false, reason: "Email service not configured" }
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://truckmates.com"

  const expiresText = data.expiresAt
    ? `Your access will expire on ${new Date(data.expiresAt).toLocaleDateString()}.`
    : "Your access does not expire."

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4F46E5; color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; padding: 14px 28px; background: #4F46E5; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
        .info-box { background: white; padding: 20px; border-radius: 6px; border-left: 4px solid #4F46E5; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to Your Customer Portal</h1>
        </div>
        <div class="content">
          <p>Dear ${data.customerName},</p>
          
          <p>You now have access to the ${data.companyName} customer portal. From here, you can:</p>
          
          <ul>
            <li>Track your loads in real-time</li>
            <li>View and download invoices</li>
            <li>Access delivery documents</li>
            <li>View payment history</li>
          </ul>
          
          <div class="info-box">
            <p style="margin: 0;"><strong>Your Portal Access:</strong></p>
            <p style="margin: 10px 0 0 0; word-break: break-all;">
              <a href="${data.portalUrl}" style="color: #4F46E5;">${data.portalUrl}</a>
            </p>
          </div>
          
          <div style="text-align: center;">
            <a href="${data.portalUrl}" class="button">Access Your Portal</a>
          </div>
          
          <p style="font-size: 12px; color: #6b7280; margin-top: 20px;">
            ${expiresText}
          </p>
          
          <p style="margin-top: 30px;">
            If you have any questions, please contact us directly.
          </p>
        </div>
        <div class="footer">
          <p>This is an automated message from ${data.companyName}.</p>
          <p>Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `

  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to: data.customerEmail,
      subject: `Your ${data.companyName} Customer Portal Access`,
      html: emailHtml,
    })

    if (result.error) {
      console.error("[PORTAL EMAIL ERROR]", result.error)
      return { sent: false, reason: result.error.message || "Failed to send email" }
    }

    return { sent: true, email: data.customerEmail, messageId: result.data?.id }
  } catch (error: any) {
    console.error("[PORTAL EMAIL ERROR]", error)
    return { sent: false, reason: error?.message || "Failed to send email" }
  }
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
  // Match by customer_id if set, or by customer name in company_name field
  const customerName = portalAccess.customer?.name || ""
  let query = supabase
    .from("loads")
    .select(`
      *,
      driver:drivers(name, phone),
      truck:trucks(truck_number, make, model),
      route:routes(name, origin, destination, status)
    `)
    .eq("company_id", portalAccess.company_id)

  // Filter by customer - try customer_id first, then fallback to name matching
  if (portalAccess.customer_id) {
    // Use OR filter: match by customer_id OR company_name
    if (customerName) {
      query = query.or(`customer_id.eq.${portalAccess.customer_id},company_name.ilike.%${customerName}%`)
    } else {
      query = query.eq("customer_id", portalAccess.customer_id)
    }
  } else if (customerName) {
    query = query.ilike("company_name", `%${customerName}%`)
  }

  const { data: loads, error } = await query.order("created_at", { ascending: false })

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
  const customerId = portalAccess.customer_id

  let query = supabase
    .from("invoices")
    .select("*")
    .eq("company_id", portalAccess.company_id)

  // Filter by customer - try customer_id first, then fallback to name matching
  if (customerId) {
    // Try to match by customer_id or customer_name
    if (customerName) {
      query = query.or(`customer_id.eq.${customerId},customer_name.ilike.%${customerName}%`)
    } else {
      query = query.eq("customer_id", customerId)
    }
  } else if (customerName) {
    query = query.ilike("customer_name", `%${customerName}%`)
  }

  const { data, error } = await query.order("created_at", { ascending: false })

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

