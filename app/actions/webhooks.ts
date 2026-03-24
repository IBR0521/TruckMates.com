"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getCachedAuthContext } from "@/lib/auth/server"
import crypto from "crypto"

/** Matches `webhooks` in supabase/webhooks_schema.sql */
const WEBHOOK_SELECT = "id, company_id, url, events, secret, active, description, created_at, updated_at"

/** Matches `webhook_deliveries` in supabase/webhooks_schema.sql */
const WEBHOOK_DELIVERY_SELECT =
  "id, webhook_id, event_type, payload, status, response_code, response_body, error_message, attempts, max_attempts, delivered_at, created_at, next_retry_at"

// Webhook event types
export type WebhookEventType =
  | "load.created"
  | "load.updated"
  | "load.completed"
  | "load.cancelled"
  | "driver.assigned"
  | "driver.violation"
  | "route.optimized"
  | "route.completed"
  | "invoice.created"
  | "invoice.paid"
  | "invoice.overdue"
  | "maintenance.scheduled"
  | "maintenance.completed"
  | "document.uploaded"
  | "document.expiring"
  | "document.expired"

// Get all webhooks for company
export async function getWebhooks() {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    const { data, error } = await supabase
      .from("webhooks")
      .select(WEBHOOK_SELECT)
      .eq("company_id", ctx.companyId)
      .order("created_at", { ascending: false })

    if (error) {
      return { error: error.message, data: null }
    }

    return { data, error: null }
  } catch (error: any) {
    console.error("[getWebhooks] Unexpected error:", error)
    return { error: error?.message || "An unexpected error occurred", data: null }
  }
}

// Get single webhook
export async function getWebhook(id: string) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    const { data, error } = await supabase
      .from("webhooks")
      .select(WEBHOOK_SELECT)
      .eq("id", id)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (error) {
      return { error: error.message, data: null }
    }

    if (!data) {
      return { error: "Webhook not found", data: null }
    }

    return { data, error: null }
  } catch (error: any) {
    console.error("[getWebhook] Unexpected error:", error)
    return { error: error?.message || "An unexpected error occurred", data: null }
  }
}

// Create webhook
export async function createWebhook(formData: {
  url: string
  events: string[]
  secret?: string
  description?: string
  active?: boolean
}) {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // Validate URL format and security (SSRF protection)
  let parsedUrl: URL
  try {
    parsedUrl = new URL(formData.url)
  } catch {
    return { error: "Invalid URL format", data: null }
  }

  // SECURITY: Enforce HTTPS only (prevent SSRF via HTTP)
  if (parsedUrl.protocol !== "https:") {
    return { error: "Webhook URL must use HTTPS protocol", data: null }
  }

  // SECURITY: Block private/internal IP addresses (SSRF protection)
  const hostname = parsedUrl.hostname.toLowerCase()
  const privateIpPatterns = [
    /^127\./,           // 127.0.0.0/8 (localhost)
    /^10\./,            // 10.0.0.0/8 (private)
    /^192\.168\./,      // 192.168.0.0/16 (private)
    /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12 (private)
    /^169\.254\./,      // 169.254.0.0/16 (link-local, AWS metadata)
    /^localhost$/,     // localhost
    /^0\.0\.0\.0$/,     // 0.0.0.0
  ]

  if (privateIpPatterns.some(pattern => pattern.test(hostname))) {
    return { error: "Webhook URL cannot point to private or internal addresses", data: null }
  }

  // Block cloud metadata endpoints
  if (hostname.includes("metadata") || hostname.includes("169.254.169.254")) {
    return { error: "Webhook URL cannot point to cloud metadata endpoints", data: null }
  }

  // Validate events
  if (!formData.events || formData.events.length === 0) {
    return { error: "At least one event type is required", data: null }
  }

  // Generate secret if not provided
  const secret = formData.secret || crypto.randomBytes(32).toString("hex")

  // Check for duplicate URL
  const { data: existing, error: existingError } = await supabase
    .from("webhooks")
    .select("id")
    .eq("company_id", ctx.companyId)
    .eq("url", formData.url)
    .maybeSingle()

  if (existingError) {
    return { error: existingError.message, data: null }
  }

  if (existing) {
    return { error: "Webhook with this URL already exists", data: null }
  }

  const { data, error } = await supabase
    .from("webhooks")
    .insert({
      company_id: ctx.companyId,
      url: formData.url,
      events: formData.events,
      secret: secret,
      active: formData.active !== undefined ? formData.active : true,
      description: formData.description || null,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/settings/webhooks")
  return { data, error: null }
}

// Update webhook
export async function updateWebhook(
  id: string,
  formData: {
    url?: string
    events?: string[]
    secret?: string
    description?: string
    active?: boolean
  }
) {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // Check if webhook exists
  const { data: existing, error: existingError } = await supabase
    .from("webhooks")
    .select("id, url")
    .eq("id", id)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (existingError) {
    return { error: existingError.message, data: null }
  }

  if (!existing) {
    return { error: "Webhook not found", data: null }
  }

  // Validate URL if changing
  if (formData.url && formData.url !== existing.url) {
    try {
      new URL(formData.url)
    } catch {
      return { error: "Invalid URL format", data: null }
    }

    // Check for duplicate URL
    const { data: duplicate, error: duplicateError } = await supabase
      .from("webhooks")
      .select("id")
      .eq("company_id", ctx.companyId)
      .eq("url", formData.url)
      .neq("id", id)
      .maybeSingle()

    if (duplicateError) {
      return { error: duplicateError.message, data: null }
    }

    if (duplicate) {
      return { error: "Webhook with this URL already exists", data: null }
    }
  }

  const updateData: any = {
    updated_at: new Date().toISOString(),
  }

  if (formData.url !== undefined) updateData.url = formData.url
  if (formData.events !== undefined) updateData.events = formData.events
  if (formData.secret !== undefined) updateData.secret = formData.secret
  if (formData.description !== undefined) updateData.description = formData.description
  if (formData.active !== undefined) updateData.active = formData.active

  const { data, error } = await supabase
    .from("webhooks")
    .update(updateData)
    .eq("id", id)
    .eq("company_id", ctx.companyId)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/settings/webhooks")
  return { data, error: null }
}

// Delete webhook
export async function deleteWebhook(id: string) {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const { error } = await supabase
    .from("webhooks")
    .delete()
    .eq("id", id)
    .eq("company_id", ctx.companyId)

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/settings/webhooks")
  return { data: { success: true }, error: null }
}

// Generate HMAC signature for webhook payload
function generateWebhookSignature(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex")
}

// Deliver webhook (internal function)
export async function deliverWebhook(
  webhookId: string,
  eventType: WebhookEventType,
  payload: any
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // Get webhook
  const { data: webhook, error: webhookError } = await supabase
    .from("webhooks")
    .select(WEBHOOK_SELECT)
    .eq("id", webhookId)
    .maybeSingle()

  if (webhookError) {
    return { success: false, error: webhookError.message }
  }

  if (!webhook || !webhook.active) {
    return { success: false, error: "Webhook not found or inactive" }
  }

  // Check if webhook subscribes to this event
  const events = webhook.events as string[]
  if (!events.includes(eventType)) {
    return { success: false, error: "Webhook does not subscribe to this event" }
  }

  // Create delivery record
  const payloadString = JSON.stringify(payload)
  const signature = generateWebhookSignature(payloadString, webhook.secret || "")

  const { data: delivery, error: deliveryError } = await supabase
    .from("webhook_deliveries")
    .insert({
      webhook_id: webhookId,
      event_type: eventType,
      payload: payload,
      status: "pending",
      attempts: 0,
    })
    .select()
    .single()

  if (deliveryError) {
    return { success: false, error: deliveryError.message }
  }

  // BUG-067 FIX: Re-validate resolved IP address before delivery to prevent DNS rebinding SSRF
  // An attacker can register a webhook with a valid domain, then change DNS to point to internal IPs
  let resolvedIp: string
  try {
    const parsedUrl = new URL(webhook.url)
    // Resolve DNS to get actual IP address
    const dns = await import("dns").then(m => m.promises)
    const addresses = await dns.resolve4(parsedUrl.hostname).catch(() => [])
    if (addresses.length === 0) {
      return { success: false, error: "Failed to resolve webhook URL hostname" }
    }
    resolvedIp = addresses[0]
    
    // BUG-067 FIX: Check resolved IP against private IP blocklist
    const privateIpPatterns = [
      /^127\./,           // 127.0.0.0/8 (localhost)
      /^10\./,            // 10.0.0.0/8 (private)
      /^192\.168\./,      // 192.168.0.0/16 (private)
      /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12 (private)
      /^169\.254\./,      // 169.254.0.0/16 (link-local, AWS metadata)
    ]
    
    if (privateIpPatterns.some(pattern => pattern.test(resolvedIp))) {
      return { success: false, error: "Webhook URL resolves to private/internal IP address - SSRF protection" }
    }
  } catch (dnsError: any) {
    // If DNS resolution fails, block the request
    return { success: false, error: `DNS resolution failed: ${dnsError.message}` }
  }

  // Attempt delivery
  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Event": eventType,
        "X-Webhook-Signature": `sha256=${signature}`,
        "X-Webhook-Delivery-Id": delivery.id,
      },
      body: payloadString,
      signal: AbortSignal.timeout(30000), // 30 second timeout
    })

    const responseBody = await response.text().catch(() => "")

    // Update delivery record
    const status = response.ok ? "delivered" : "failed"
    await supabase
      .from("webhook_deliveries")
      .update({
        status,
        response_code: response.status,
        response_body: responseBody.substring(0, 1000), // Limit response body size
        delivered_at: status === "delivered" ? new Date().toISOString() : null,
        attempts: 1,
        error_message: response.ok ? null : `HTTP ${response.status}: ${response.statusText}`,
      })
      .eq("id", delivery.id)

    if (!response.ok) {
      // Schedule retry if not at max attempts
      if (delivery.max_attempts > 1) {
        await supabase
          .from("webhook_deliveries")
          .update({
            status: "retrying",
            next_retry_at: new Date(Date.now() + 60000).toISOString(), // Retry in 1 minute
            attempts: 1,
          })
          .eq("id", delivery.id)
      }
    }

    return { success: response.ok, error: response.ok ? undefined : `HTTP ${response.status}` }
  } catch (error: any) {
    // Update delivery record with error
    await supabase
      .from("webhook_deliveries")
      .update({
        status: "failed",
        error_message: error.message || "Network error",
        attempts: 1,
      })
      .eq("id", delivery.id)

    // Schedule retry if not at max attempts
    if (delivery.max_attempts > 1) {
      await supabase
        .from("webhook_deliveries")
        .update({
          status: "retrying",
          next_retry_at: new Date(Date.now() + 60000).toISOString(),
          attempts: 1,
        })
        .eq("id", delivery.id)
    }

    return { success: false, error: error.message || "Network error" }
  }
}

// Trigger webhook for event (called by other actions)
export async function triggerWebhook(
  companyId: string,
  eventType: WebhookEventType,
  payload: any
): Promise<void> {
  const supabase = await createClient()

  // Get all active webhooks for company that subscribe to this event
  const { data: webhooks } = await supabase
    .from("webhooks")
    .select("id")
    .eq("company_id", companyId)
    .eq("active", true)
    .contains("events", [eventType])

  if (!webhooks || webhooks.length === 0) {
    return // No webhooks to deliver
  }

  // Deliver to all matching webhooks (async, don't wait)
  webhooks.forEach((webhook: { id: string; [key: string]: any }) => {
    deliverWebhook(webhook.id, eventType, payload).catch((error) => {
      console.error(`[WEBHOOK] Failed to deliver webhook ${webhook.id}:`, error)
    })
  })
}

// Get webhook delivery history
export async function getWebhookDeliveries(webhookId: string, limit: number = 50) {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // Verify webhook belongs to company
  const { data: webhook, error: webhookError } = await supabase
    .from("webhooks")
    .select("id")
    .eq("id", webhookId)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (webhookError) {
    return { error: webhookError.message, data: null }
  }

  if (!webhook) {
    return { error: "Webhook not found", data: null }
  }

  const { data, error } = await supabase
    .from("webhook_deliveries")
    .select(WEBHOOK_DELIVERY_SELECT)
    .eq("webhook_id", webhookId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    return { error: error.message, data: null }
  }

  return { data, error: null }
}

// Retry failed webhook delivery
export async function retryWebhookDelivery(deliveryId: string) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // Get delivery record
  const { data: delivery, error: deliveryError } = await supabase
    .from("webhook_deliveries")
    .select(`${WEBHOOK_DELIVERY_SELECT}, webhooks!inner(company_id)`)
    .eq("id", deliveryId)
    .maybeSingle()

  if (deliveryError) {
    return { error: deliveryError.message, data: null }
  }

  if (!delivery) {
    return { error: "Delivery not found", data: null }
  }

  // Verify company ownership
  const webhook = delivery.webhooks as any
  if (webhook.company_id !== ctx.companyId) {
    return { error: "Access denied", data: null }
  }

  // Check if max attempts reached
  if (delivery.attempts >= delivery.max_attempts) {
    return { error: "Maximum retry attempts reached", data: null }
  }

  // Retry delivery
  const result_delivery = await deliverWebhook(
    delivery.webhook_id,
    delivery.event_type as WebhookEventType,
    delivery.payload
  )

  if (!result_delivery.success) {
    // Update attempts
    await supabase
      .from("webhook_deliveries")
      .update({
        attempts: delivery.attempts + 1,
        next_retry_at:
          delivery.attempts + 1 < delivery.max_attempts
            ? new Date(Date.now() + 60000 * Math.pow(2, delivery.attempts)).toISOString() // Exponential backoff
            : null,
      })
      .eq("id", deliveryId)
  }

  return { data: result_delivery, error: result_delivery.error || null }
}

// Test webhook (send test event)
export async function testWebhook(webhookId: string) {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // Verify webhook belongs to company
  const { data: webhook, error: webhookError } = await supabase
    .from("webhooks")
    .select("id")
    .eq("id", webhookId)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (webhookError) {
    return { error: webhookError.message, data: null }
  }

  if (!webhook) {
    return { error: "Webhook not found", data: null }
  }

  // Send test event
  const testPayload = {
    event: "webhook.test",
    timestamp: new Date().toISOString(),
    message: "This is a test webhook from TruckMates",
  }

  const result_delivery = await deliverWebhook(webhookId, "load.created" as WebhookEventType, testPayload)

  return { data: result_delivery, error: result_delivery.error || null }
}





