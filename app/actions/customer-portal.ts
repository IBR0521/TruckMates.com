"use server"

import * as Sentry from "@sentry/nextjs"
import { errorMessage, sanitizeError } from "@/lib/error-message"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { revalidatePath } from "next/cache"
import crypto from "crypto"
import { handleDbError } from "@/lib/db-helpers"
import { getResendClientForCompany } from "@/lib/resend-client"
import { sendNotification } from "./notifications"


function safeDbError(error: unknown, fallback = "Database operation failed"): string {
  Sentry.captureException(error)
  return sanitizeError(error, { fallback })
}


async function getResendClient() {
  const ctx = await getCachedAuthContext()
  return getResendClientForCompany(ctx.companyId ?? null)
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
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    // V3-014 FIX: Validate input parameters
    if (!formData.customer_id || typeof formData.customer_id !== "string" || formData.customer_id.trim().length === 0) {
      return { error: "Customer ID is required", data: null }
    }
    if (formData.expires_days !== undefined && (typeof formData.expires_days !== "number" || formData.expires_days < 0)) {
      return { error: "Expires days must be a non-negative number", data: null }
    }

    const supabase = await createClient()

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    const { getUserRole } = await import("@/lib/server-permissions")
    const role = await getUserRole()
    const MANAGER_ROLES = ["super_admin", "operations_manager"]
    if (!role || !MANAGER_ROLES.includes(role)) {
      return { error: "Only managers can create portal access", data: null }
    }

    // Verify customer belongs to company
    // V3-007 FIX: Replace select(*) with explicit columns
    const { data: customer } = await supabase
      .from("customers")
      .select("id, company_id, name, company_name, email, phone, address_line1, address_line2, city, state, zip_code, country, contact_name, contact_email, contact_phone")
      .eq("id", formData.customer_id)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (!customer) {
      return { error: "Customer not found", data: null }
    }

    // Check if access already exists
    // V3-007 FIX: Replace select(*) with explicit columns
    const { data: existingAccess } = await supabase
      .from("customer_portal_access")
      .select("id, customer_id, company_id, access_token, portal_url, can_view_location, can_submit_loads, can_view_invoices, can_download_documents, email_notifications, sms_notifications, expires_at, is_active, created_at, updated_at")
      .eq("customer_id", formData.customer_id)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    // Preserve existing token if updating, only generate new one if creating
    const accessToken = existingAccess?.access_token || generateAccessToken()
    const expiresAt = formData.expires_days
      ? new Date(Date.now() + formData.expires_days * 24 * 60 * 60 * 1000).toISOString()
      : null

    let data, error

    if (existingAccess) {
      // Update existing access - preserve token unless explicitly regenerating
      const updateData: any = {
        portal_url: formData.portal_url || null,
        can_view_location: formData.can_view_location || false,
        can_submit_loads: formData.can_submit_loads || false,
        email_notifications: formData.email_notifications !== false,
        sms_notifications: formData.sms_notifications || false,
        expires_at: expiresAt,
        is_active: true,
      }
      
      // Only update token if it's different (new generation)
      if (accessToken !== existingAccess.access_token) {
        updateData.access_token = accessToken
      }
      
      const { data: updated, error: updateError } = await supabase
        .from("customer_portal_access")
        .update(updateData)
        .eq("id", existingAccess.id)
        .select("id, customer_id, company_id, access_token, portal_url, can_view_location, can_submit_loads, can_view_invoices, can_download_documents, email_notifications, sms_notifications, expires_at, is_active, access_count, last_accessed_at, created_at, updated_at")
        .maybeSingle()

      data = updated
      error = updateError
    } else {
      // Create new access
      const { data: created, error: createError } = await supabase
        .from("customer_portal_access")
        .insert({
          company_id: ctx.companyId,
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
        .select("id, customer_id, company_id, access_token, portal_url, can_view_location, can_submit_loads, can_view_invoices, can_download_documents, email_notifications, sms_notifications, expires_at, is_active, access_count, last_accessed_at, created_at, updated_at")
        .maybeSingle()

      data = created
      error = createError
    }

    if (error) {
      return { error: safeDbError(error), data: null }
    }

    // Send email notification if enabled and customer has email
    if (formData.email_notifications !== false && customer.email) {
      try {
        const emailSend = await sendPortalAccessEmail({
          customerEmail: customer.email,
          customerName: customer.name || customer.company_name || "Customer",
          portalUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://truckmates.com"}/portal/${accessToken}`,
          companyName: ctx.companyId ? (await supabase.from("companies").select("name").eq("id", ctx.companyId).maybeSingle()).data?.name || "TruckMates" : "TruckMates",
          expiresAt: expiresAt,
        })
        if (emailSend.sent) {
          await supabase.from("contact_history").insert({
            company_id: ctx.companyId,
            customer_id: formData.customer_id,
            type: "email",
            subject: `Your ${(await supabase.from("companies").select("name").eq("id", ctx.companyId).maybeSingle()).data?.name || "TruckMates"} Customer Portal Access`,
            message: `Portal access email sent to ${customer.email}.`,
            direction: "outbound",
            user_id: ctx.userId ?? null,
            occurred_at: new Date().toISOString(),
            external_id: emailSend.messageId || null,
            source: "email",
            metadata: {
              email_kind: "customer_portal_access",
              to: customer.email,
              portal_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://truckmates.com"}/portal/${accessToken}`,
            },
          })
        }
      } catch (emailError) {
        Sentry.captureException(emailError)
      }
    }

    revalidatePath("/dashboard/settings/customer-portal")
    revalidatePath(`/dashboard/customers/${formData.customer_id}`)
    return { data, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? errorMessage(error) : "An unexpected error occurred"
    return { error: message, data: null }
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string | null | undefined): string {
  if (!text) return ''
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
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
    Sentry.captureMessage("[PORTAL EMAIL] Resend not configured, skipping email", "info")
    return { sent: false, reason: "Email service not configured" }
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://truckmates.com"

  // V3-014 FIX: Escape HTML to prevent XSS
  const expiresText = data.expiresAt
    ? `Your access will expire on ${escapeHtml(new Date(data.expiresAt).toLocaleDateString())}.`
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
          <p>Dear ${escapeHtml(data.customerName)},</p>
          
          <p>You now have access to the ${escapeHtml(data.companyName)} customer portal. From here, you can:</p>
          
          <ul>
            <li>Track your loads in real-time</li>
            <li>View and download invoices</li>
            <li>Access delivery documents</li>
            <li>View payment history</li>
          </ul>
          
          <div class="info-box">
            <p style="margin: 0;"><strong>Your Portal Access:</strong></p>
            <p style="margin: 10px 0 0 0; word-break: break-all;">
              <a href="${escapeHtml(data.portalUrl)}" style="color: #4F46E5;">${escapeHtml(data.portalUrl)}</a>
            </p>
          </div>
          
          <div style="text-align: center;">
            <a href="${escapeHtml(data.portalUrl)}" class="button">Access Your Portal</a>
          </div>
          
          <p style="font-size: 12px; color: #6b7280; margin-top: 20px;">
            ${expiresText}
          </p>
          
          <p style="margin-top: 30px;">
            If you have any questions, please contact us directly.
          </p>
        </div>
        <div class="footer">
          <p>This is an automated message from ${escapeHtml(data.companyName)}.</p>
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
      Sentry.captureException(result.error)
      return { sent: false, reason: result.error.message || "Failed to send email" }
    }

    return { sent: true, email: data.customerEmail, messageId: result.data?.id }
  } catch (error: unknown) {
    Sentry.captureException(error)
    const reason = error instanceof Error ? errorMessage(error) : "Failed to send email"
    return { sent: false, reason }
  }
}

/**
 * Get customer portal access by token (public access)
 */
export async function getPortalAccessByToken(token: string) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    // V3-014 FIX: Validate input parameters
    if (!token || typeof token !== "string" || token.trim().length === 0) {
      return { error: "Invalid access token", data: null }
    }

    const supabase = await createClient()
    const nowIso = new Date().toISOString()

    // V3-007 FIX: Replace select(*) with explicit columns
    const { data, error } = await supabase
      .from("customer_portal_access")
      .select(`
        id,
        customer_id,
        company_id,
        access_token,
        portal_url,
        can_view_location,
        can_submit_loads,
        can_view_invoices,
        can_download_documents,
        email_notifications,
        sms_notifications,
        expires_at,
        is_active,
        access_count,
        last_accessed_at,
        created_at,
        updated_at,
        customer:customers(id, name, company_name, email),
        company:companies(id, name)
      `)
      .eq("access_token", token)
      .eq("is_active", true)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .maybeSingle()

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
  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? errorMessage(error) : "An unexpected error occurred"
    return { error: message, data: null }
  }
}

/**
 * Get loads for customer portal
 */
export async function getCustomerPortalLoads(token: string) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    // V3-014 FIX: Validate input parameters
    if (!token || typeof token !== "string" || token.trim().length === 0) {
      return { error: "Invalid access token", data: null }
    }

    const portalResult = await getPortalAccessByToken(token)
    if (portalResult.error || !portalResult.data) {
      return portalResult
    }

    const portalAccess = portalResult.data
    const supabase = await createClient()

    // SEC-004 FIX: Replace SELECT * with explicit column allowlist
    // Customers should never see internal_notes, financial fields, or internal route metadata
    let query = supabase
    .from("loads")
    .select(`
      id,
      customer_id,
      requested_via_portal,
      portal_request_status,
      portal_request_message,
      requested_equipment_type,
      shipment_number,
      origin,
      destination,
      status,
      load_date,
      estimated_delivery,
      pickup_time,
      delivery_time,
      weight,
      weight_kg,
      contents,
      pieces,
      pallets,
      special_instructions,
      customer_reference,
      driver:drivers(name, phone),
      truck:trucks(truck_number, make, model),
      route:routes(name, origin, destination, status)
    `)
    .eq("company_id", portalAccess.company_id)

    // Filter by customer_id only - no name matching for security
    if (portalAccess.customer_id) {
      query = query.eq("customer_id", portalAccess.customer_id)
    } else {
      // No customer_id means no access
      return { data: [], error: null }
    }

    // V3-007 FIX: Add LIMIT to prevent unbounded queries
    const { data: loads, error } = await query.order("created_at", { ascending: false }).limit(1000)

    if (error) {
      return { error: safeDbError(error), data: null }
    }

    return { data: loads || [], error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? errorMessage(error) : "An unexpected error occurred"
    return { error: message, data: null }
  }
}

/**
 * Get load details for customer portal
 */
export async function getCustomerPortalLoad(token: string, loadId: string) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    // V3-014 FIX: Validate input parameters
    if (!token || typeof token !== "string" || token.trim().length === 0) {
      return { error: "Invalid access token", data: null }
    }
    if (!loadId || typeof loadId !== "string" || loadId.trim().length === 0) {
      return { error: "Invalid load ID", data: null }
    }

    const portalResult = await getPortalAccessByToken(token)
    if (portalResult.error || !portalResult.data) {
      return portalResult
    }

    const portalAccess = portalResult.data
    const supabase = await createClient()

    // SEC-004 FIX: Replace SELECT * with explicit column allowlist
    // Exclude internal_notes, value, rate, margin, and all internal route fields
    const { data: load, error } = await supabase
    .from("loads")
    .select(`
      id,
      customer_id,
      driver_id,
      requested_via_portal,
      portal_request_status,
      portal_request_message,
      requested_equipment_type,
      shipment_number,
      origin,
      destination,
      status,
      load_date,
      estimated_delivery,
      pickup_time,
      delivery_time,
      weight,
      weight_kg,
      contents,
      pieces,
      pallets,
      special_instructions,
      customer_reference,
      driver:drivers(name, phone),
      truck:trucks(truck_number, make, model),
      route:routes(name, origin, destination, status),
      invoices:invoices(*)
    `)
      .eq("id", loadId)
      .eq("company_id", portalAccess.company_id)
      .maybeSingle()

    if (error || !load) {
      return { error: "Load not found", data: null }
    }

    // Check if customer has access to this load - strict customer_id matching
    if (load.customer_id !== portalAccess.customer_id) {
      return { error: "Access denied", data: null }
    }

    // Get real-time location if allowed - only for this specific load
    let driverLocation = null
    if (portalAccess.can_view_location && load.driver_id && load.id) {
      // Get latest ELD location for this specific load's route/driver
      // Only return location if driver is currently assigned to this load
      // V3-007 FIX: Replace select(*) with explicit columns
      const { data: location } = await supabase
        .from("eld_locations")
        .select("id, driver_id, latitude, longitude, address, timestamp, speed, heading")
        .eq("driver_id", load.driver_id)
        .order("timestamp", { ascending: false })
        .limit(1)
        .maybeSingle()

      // Verify the driver is still assigned to this load before showing location
      if (location && load.status !== "delivered" && load.status !== "cancelled") {
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
  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? errorMessage(error) : "An unexpected error occurred"
    return { error: message, data: null }
  }
}

/**
 * Submit a new load request from customer portal
 */
export async function submitCustomerPortalLoadRequest(
  token: string,
  input: {
    origin: string
    destination: string
    equipment_type: string
    weight?: number | null
    pickup_date: string
    special_instructions?: string
  },
) {
  try {
    if (!token || typeof token !== "string" || token.trim().length === 0) {
      return { error: "Invalid access token", data: null }
    }

    const origin = (input.origin || "").trim()
    const destination = (input.destination || "").trim()
    const equipmentType = (input.equipment_type || "").trim()
    const pickupDate = (input.pickup_date || "").trim()
    const specialInstructions = (input.special_instructions || "").trim()
    const numericWeight = input.weight == null ? null : Number(input.weight)

    if (!origin || !destination || !equipmentType || !pickupDate) {
      return { error: "Origin, destination, equipment type, and pickup date are required", data: null }
    }

    const portalResult = await getPortalAccessByToken(token)
    if (portalResult.error || !portalResult.data) return { error: portalResult.error || "Invalid access", data: null }
    const portalAccess = portalResult.data

    if (!portalAccess.can_submit_loads) {
      return { error: "Load submission is not enabled for this portal", data: null }
    }
    if (!portalAccess.customer_id || !portalAccess.company_id) {
      return { error: "Portal access is missing customer context", data: null }
    }

    const supabase = await createClient()
    const shipmentNumber = `REQ-${Date.now().toString().slice(-8)}`

    const { data: createdLoad, error: createError } = await supabase
      .from("loads")
      .insert({
        company_id: portalAccess.company_id,
        customer_id: portalAccess.customer_id,
        shipment_number: shipmentNumber,
        origin,
        destination,
        status: "draft",
        load_date: pickupDate,
        weight: numericWeight != null && !Number.isNaN(numericWeight) ? String(numericWeight) : null,
        special_instructions: specialInstructions || null,
        requested_via_portal: true,
        portal_request_status: "pending",
        portal_request_message: "Submitted by shipper. Awaiting dispatcher review.",
        requested_equipment_type: equipmentType,
      })
      .select("id, shipment_number, origin, destination, status, load_date, requested_equipment_type, portal_request_status, portal_request_message, special_instructions")
      .single()

    if (createError || !createdLoad) {
      return { error: safeDbError(createError, "Failed to submit load request"), data: null }
    }

    // Notify dispatch roles in-app
    const { data: dispatchUsers } = await supabase
      .from("users")
      .select("id")
      .eq("company_id", portalAccess.company_id)
      .in("role", ["dispatcher", "operations_manager", "super_admin"])

    await Promise.all(
      (dispatchUsers || []).map(async (user: { id: string }) =>
        sendNotification(user.id, "load_update", {
          shipmentNumber: createdLoad.shipment_number,
          status: "portal_request_submitted",
          origin: createdLoad.origin,
          destination: createdLoad.destination,
        }),
      ),
    )

    try {
      const { sendPushToCompanyRoles } = await import("./push-notifications")
      await sendPushToCompanyRoles(
        portalAccess.company_id,
        ["super_admin", "operations_manager", "dispatcher"],
        {
          title: "New shipper load request",
          body: `${createdLoad.origin} -> ${createdLoad.destination} (${equipmentType})`,
          data: {
            type: "portal_load_request",
            loadId: String(createdLoad.id),
            link: `/dashboard/loads/${createdLoad.id}`,
          },
        },
      )
    } catch (error) {
      Sentry.captureException(error)
    }

    revalidatePath(`/portal/${token}`)
    revalidatePath(`/portal/${token}/loads/${createdLoad.id}`)
    revalidatePath("/dashboard/loads")
    revalidatePath(`/dashboard/loads/${createdLoad.id}`)

    return { data: createdLoad, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? errorMessage(error) : "An unexpected error occurred"
    return { error: message, data: null }
  }
}

/**
 * Dispatcher review for shipper-submitted load requests
 */
export async function reviewPortalLoadRequest(input: {
  load_id: string
  decision: "accepted" | "rejected"
  message?: string
  quoted_rate?: number | null
}) {
  try {
    if (!input.load_id || !input.decision) {
      return { error: "Load and decision are required", data: null }
    }

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    const { getUserRole } = await import("@/lib/server-permissions")
    const role = await getUserRole()
    const allowedRoles = ["super_admin", "operations_manager", "dispatcher"]
    if (!role || !allowedRoles.includes(role)) {
      return { error: "Only dispatch roles can review portal requests", data: null }
    }

    const supabase = await createClient()
    const { data: load, error: loadError } = await supabase
      .from("loads")
      .select("id, company_id, shipment_number, status, requested_via_portal, portal_request_status, customer_id, customers:customer_id(name, company_name, email)")
      .eq("id", input.load_id)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (loadError || !load) {
      return { error: "Load not found", data: null }
    }
    if (!load.requested_via_portal) {
      return { error: "This load was not submitted via customer portal", data: null }
    }

    const message = (input.message || "").trim()
    if (input.decision === "rejected" && message.length < 3) {
      return { error: "Please include a short rejection message", data: null }
    }

    const updateData: Record<string, unknown> = {
      portal_request_status: input.decision,
      portal_request_message:
        message || (input.decision === "accepted" ? "Accepted by dispatcher." : "Rejected by dispatcher."),
    }
    if (input.decision === "accepted") {
      updateData.status = "confirmed"
    }
    if (input.quoted_rate !== undefined && input.quoted_rate !== null && !Number.isNaN(Number(input.quoted_rate))) {
      updateData.rate = Number(input.quoted_rate)
    }

    const { data: updated, error: updateError } = await supabase
      .from("loads")
      .update(updateData)
      .eq("id", input.load_id)
      .eq("company_id", ctx.companyId)
      .select("id, shipment_number, status, portal_request_status, portal_request_message, rate")
      .single()

    if (updateError || !updated) {
      return { error: safeDbError(updateError, "Failed to review portal request"), data: null }
    }

    const customerEmail = (load as any)?.customers?.email as string | undefined
    if (customerEmail) {
      try {
        const resend = await getResendClient()
        if (resend) {
          const subject =
            input.decision === "accepted"
              ? `Load Request Accepted (${updated.shipment_number || "Request"})`
              : `Load Request Rejected (${updated.shipment_number || "Request"})`
          const body = `
            <p>Your load request <strong>${escapeHtml(updated.shipment_number || "request")}</strong> was ${escapeHtml(
              input.decision,
            )}.</p>
            <p>${escapeHtml(String(updateData.portal_request_message || ""))}</p>
          `
          await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
            to: customerEmail,
            subject,
            html: body,
          })
          await supabase.from("contact_history").insert({
            company_id: ctx.companyId,
            customer_id: load.customer_id,
            type: "email",
            subject,
            message: String(updateData.portal_request_message || ""),
            direction: "outbound",
            load_id: input.load_id,
            user_id: ctx.userId ?? null,
            occurred_at: new Date().toISOString(),
            source: "email",
            metadata: {
              email_kind: "portal_request_review",
              to: customerEmail,
              decision: input.decision,
            },
          })
        }
      } catch (error) {
        Sentry.captureException(error)
      }
    }

    revalidatePath("/dashboard/loads")
    revalidatePath(`/dashboard/loads/${input.load_id}`)
    const { data: portalAccess } = await supabase
      .from("customer_portal_access")
      .select("access_token")
      .eq("company_id", ctx.companyId)
      .eq("customer_id", load.customer_id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle()
    if (portalAccess?.access_token) {
      revalidatePath(`/portal/${portalAccess.access_token}`)
      revalidatePath(`/portal/${portalAccess.access_token}/loads/${input.load_id}`)
    }

    return { data: updated, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? errorMessage(error) : "An unexpected error occurred"
    return { error: message, data: null }
  }
}

/**
 * Get documents for customer portal
 */
export async function getCustomerPortalDocuments(token: string, loadId?: string) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    // V3-014 FIX: Validate input parameters
    if (!token || typeof token !== "string" || token.trim().length === 0) {
      return { error: "Invalid access token", data: null }
    }

    const portalResult = await getPortalAccessByToken(token)
    if (portalResult.error || !portalResult.data) {
      return portalResult
    }

    const portalAccess = portalResult.data
    const supabase = await createClient()

    if (!portalAccess.can_download_documents) {
      return { error: "Document access not allowed", data: null }
    }

    // Get customer's loads first to filter documents
    const customerLoadsResult = await getCustomerPortalLoads(token)
    if (customerLoadsResult.error || !customerLoadsResult.data) {
      return { error: "Could not verify customer access", data: null }
    }

    const customerLoadIds = customerLoadsResult.data.map((l: any) => l.id)

    if (customerLoadIds.length === 0) {
      return { data: [], error: null }
    }

    // V3-007 FIX: Replace select(*) with explicit columns and add LIMIT
    let query = supabase
      .from("documents")
      .select("id, company_id, load_id, driver_id, truck_id, document_type, file_name, file_url, file_size, mime_type, uploaded_by, uploaded_at, created_at, updated_at, metadata")
      .eq("company_id", portalAccess.company_id)
      .in("load_id", customerLoadIds)

  if (loadId) {
    // Verify the loadId belongs to this customer
    if (!customerLoadIds.includes(loadId)) {
      return { error: "Access denied to this load's documents", data: null }
    }
    query = query.eq("load_id", loadId)
  }

  const { data, error } = await query.order("created_at", { ascending: false })

  if (error) {
    return { error: safeDbError(error), data: null }
  }

  return { data: data || [], error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? errorMessage(error) : "An unexpected error occurred"
    return { error: message, data: null }
  }
}

/**
 * Get invoices for customer portal
 */
export async function getCustomerPortalInvoices(token: string) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    // V3-014 FIX: Validate input parameters
    if (!token || typeof token !== "string" || token.trim().length === 0) {
      return { error: "Invalid access token", data: null }
    }

    const portalResult = await getPortalAccessByToken(token)
    if (portalResult.error || !portalResult.data) {
      return portalResult
    }

    const portalAccess = portalResult.data
    const supabase = await createClient()

    if (!portalAccess.can_view_invoices) {
      return { error: "Invoice access not allowed", data: null }
    }

    const customerId = portalAccess.customer_id

    // Use strict customer_id matching only - no name matching for security
    if (!customerId) {
      return { data: [], error: null }
    }

    // V3-007 FIX: Replace select(*) with explicit columns and add LIMIT
    let query = supabase
      .from("invoices")
      .select("id, company_id, customer_id, load_id, invoice_number, issue_date, due_date, amount, status, paid_amount, paid_date, payment_method, notes, created_at, updated_at")
      .eq("company_id", portalAccess.company_id)
      .eq("customer_id", customerId)

    const { data, error } = await query.order("created_at", { ascending: false }).limit(1000)

    if (error) {
      return { error: safeDbError(error), data: null }
    }

    return { data: data || [], error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? errorMessage(error) : "An unexpected error occurred"
    return { error: message, data: null }
  }
}

/**
 * Get customer portal access by customer ID
 */
export async function getCustomerPortalAccess(customerId: string) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    // V3-014 FIX: Validate input parameters
    if (!customerId || typeof customerId !== "string" || customerId.trim().length === 0) {
      return { error: "Invalid customer ID", data: null }
    }

    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    // V3-007 FIX: Replace select(*) with explicit columns
    const { data, error } = await supabase
      .from("customer_portal_access")
      .select("id, customer_id, company_id, access_token, portal_url, can_view_location, can_submit_loads, can_view_invoices, can_download_documents, email_notifications, sms_notifications, expires_at, is_active, access_count, last_accessed_at, created_at, updated_at")
      .eq("customer_id", customerId)
      .eq("company_id", ctx.companyId)
      .eq("is_active", true)
      .maybeSingle()

    if (error) {
      if (error.code === "PGRST116") {
        return { data: null, error: null } // No access found
      }
      const result = handleDbError(error, null)
      if (result.error) return { error: result.error, data: null }
      return { error: "Table not available. Please run the SQL schema.", data: null }
    }

    return { data, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? errorMessage(error) : "An unexpected error occurred"
    return { error: message, data: null }
  }
}

/**
 * Revoke customer portal access
 */
export async function revokeCustomerPortalAccess(customerId: string) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    // V3-014 FIX: Validate input parameters
    if (!customerId || typeof customerId !== "string" || customerId.trim().length === 0) {
      return { error: "Invalid customer ID", data: null }
    }

    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    const { getUserRole } = await import("@/lib/server-permissions")
    const role = await getUserRole()
    const MANAGER_ROLES = ["super_admin", "operations_manager"]
    if (!role || !MANAGER_ROLES.includes(role)) {
      return { error: "Only managers can revoke portal access", data: null }
    }

    const { error } = await supabase
      .from("customer_portal_access")
      .update({ is_active: false })
      .eq("customer_id", customerId)
      .eq("company_id", ctx.companyId)

    if (error) {
      return { error: safeDbError(error), data: null }
    }

    revalidatePath("/dashboard/settings/customer-portal")
    return { data: { success: true }, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? errorMessage(error) : "An unexpected error occurred"
    return { error: message, data: null }
  }
}
