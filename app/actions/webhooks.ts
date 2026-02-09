"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getCachedUserCompany } from "@/lib/query-optimizer"
import crypto from "crypto"

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

  const { data, error } = await supabase
    .from("webhooks")
    .select("*")
    .eq("company_id", result.company_id)
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message, data: null }
  }

  return { data, error: null }
}

// Get single webhook
export async function getWebhook(id: string) {
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

  const { data, error } = await supabase
    .from("webhooks")
    .select("*")
    .eq("id", id)
    .eq("company_id", result.company_id)
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  return { data, error: null }
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

  // Validate URL
  try {
    new URL(formData.url)
  } catch {
    return { error: "Invalid URL format", data: null }
  }

  // Validate events
  if (!formData.events || formData.events.length === 0) {
    return { error: "At least one event type is required", data: null }
  }

  // Generate secret if not provided
  const secret = formData.secret || crypto.randomBytes(32).toString("hex")

  // Check for duplicate URL
  const { data: existing } = await supabase
    .from("webhooks")
    .select("id")
    .eq("company_id", result.company_id)
    .eq("url", formData.url)
    .single()

  if (existing) {
    return { error: "Webhook with this URL already exists", data: null }
  }

  const { data, error } = await supabase
    .from("webhooks")
    .insert({
      company_id: result.company_id,
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

  // Check if webhook exists
  const { data: existing } = await supabase
    .from("webhooks")
    .select("id, url")
    .eq("id", id)
    .eq("company_id", result.company_id)
    .single()

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
    const { data: duplicate } = await supabase
      .from("webhooks")
      .select("id")
      .eq("company_id", result.company_id)
      .eq("url", formData.url)
      .neq("id", id)
      .single()

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
    .eq("company_id", result.company_id)
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

  const { error } = await supabase
    .from("webhooks")
    .delete()
    .eq("id", id)
    .eq("company_id", result.company_id)

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
  const { data: webhook } = await supabase
    .from("webhooks")
    .select("*")
    .eq("id", webhookId)
    .single()

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
  webhooks.forEach((webhook) => {
    deliverWebhook(webhook.id, eventType, payload).catch((error) => {
      console.error(`[WEBHOOK] Failed to deliver webhook ${webhook.id}:`, error)
    })
  })
}

// Get webhook delivery history
export async function getWebhookDeliveries(webhookId: string, limit: number = 50) {
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

  // Verify webhook belongs to company
  const { data: webhook } = await supabase
    .from("webhooks")
    .select("id")
    .eq("id", webhookId)
    .eq("company_id", result.company_id)
    .single()

  if (!webhook) {
    return { error: "Webhook not found", data: null }
  }

  const { data, error } = await supabase
    .from("webhook_deliveries")
    .select("*")
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

  // Get delivery record
  const { data: delivery } = await supabase
    .from("webhook_deliveries")
    .select("*, webhooks!inner(company_id)")
    .eq("id", deliveryId)
    .single()

  if (!delivery) {
    return { error: "Delivery not found", data: null }
  }

  // Verify company ownership
  const webhook = delivery.webhooks as any
  if (webhook.company_id !== result.company_id) {
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

  // Verify webhook belongs to company
  const { data: webhook } = await supabase
    .from("webhooks")
    .select("id")
    .eq("id", webhookId)
    .eq("company_id", result.company_id)
    .single()

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





