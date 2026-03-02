import { NextRequest, NextResponse } from "next/server"
import { logCommunicationFromWebhook } from "@/app/actions/crm-communication"
import crypto from "crypto"

/**
 * Webhook endpoint for automated communication logging
 * Supports SendGrid, Postmark, Twilio, and custom webhooks
 * SECURITY: Requires webhook secret or API key for authentication
 */
export async function POST(req: NextRequest) {
  try {
    // Verify webhook authentication
    const webhookSecret = process.env.WEBHOOK_SECRET || ""
    const apiKey = req.headers.get("x-api-key") || ""
    const authHeader = req.headers.get("authorization") || ""

    // Check for webhook secret in header (Bearer token or API key)
    let hasValidAuth = 
      (webhookSecret && authHeader === `Bearer ${webhookSecret}`) ||
      (webhookSecret && apiKey === webhookSecret)

    // Get raw body for signature verification (if needed)
    const rawBody = await req.text()
    let body: any = {}

    // Verify SendGrid/Postmark signature if present (HMAC-SHA256)
    const sendgridSig = req.headers.get("x-sendgrid-signature")
    const postmarkSig = req.headers.get("x-postmark-signature")
    
    if (sendgridSig || postmarkSig) {
      const signingKey = process.env.SENDGRID_SIGNING_KEY || process.env.POSTMARK_SIGNING_KEY || webhookSecret
      
      if (signingKey && rawBody) {
        // Verify HMAC signature
        const expectedSig = crypto.createHmac('sha256', signingKey)
          .update(rawBody)
          .digest('hex')
        
        const providedSig = sendgridSig || postmarkSig || ''
        
        // Use timing-safe comparison to prevent timing attacks
        // Note: Both signatures must be same length for timingSafeEqual
        if (expectedSig.length === providedSig.length) {
          try {
            if (crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(providedSig))) {
              hasValidAuth = true
            }
          } catch {
            // Signature mismatch
          }
        }
      }
    }

    // Parse body as JSON
    try {
      body = JSON.parse(rawBody)
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      )
    }

    // SECURITY: Fail-closed - require authentication if WEBHOOK_SECRET is set
    if (!webhookSecret || !hasValidAuth) {
      if (!webhookSecret) {
        console.error("[CRM Webhook] WEBHOOK_SECRET not configured - endpoint disabled")
        return NextResponse.json(
          { error: "Webhook endpoint is not configured. Set WEBHOOK_SECRET environment variable." },
          { status: 503 }
        )
      }
      console.error("[CRM Webhook] Unauthorized request - missing or invalid authentication")
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Determine source from headers or body
    const source = req.headers.get("x-webhook-source") || body.source || "webhook"

    // Extract communication data based on source
    let communicationData: any = {}

    if (source === "sendgrid" || source === "postmark") {
      // Email webhook format
      communicationData = {
        type: "email",
        direction: body.event === "bounce" || body.event === "spam_complaint" ? "inbound" : "outbound",
        subject: body.subject || body.Subject || null,
        message: body.text || body.TextBody || body.html || body.HtmlBody || null,
        external_id: body.message_id || body.MessageID || body["message-id"] || null,
        source: "email",
        metadata: {
          from: body.from || body.From || null,
          to: body.to || body.To || null,
          event: body.event || body.Event || null,
          timestamp: body.timestamp || body.Timestamp || new Date().toISOString(),
        },
        occurred_at: body.timestamp || body.Timestamp || new Date().toISOString(),
      }

      // Try to find customer/vendor by email
      // This would require a lookup - for now, we'll require customer_id/vendor_id in metadata
      if (body.metadata?.customer_id) {
        communicationData.customer_id = body.metadata.customer_id
      }
      if (body.metadata?.vendor_id) {
        communicationData.vendor_id = body.metadata.vendor_id
      }
    } else if (source === "twilio") {
      // SMS webhook format
      communicationData = {
        type: "sms",
        direction: body.Direction === "inbound" ? "inbound" : "outbound",
        message: body.Body || null,
        external_id: body.MessageSid || null,
        source: "sms",
        metadata: {
          from: body.From || null,
          to: body.To || null,
          status: body.MessageStatus || null,
        },
        occurred_at: body.Timestamp || new Date().toISOString(),
      }

      // Try to find customer/vendor by phone number
      if (body.metadata?.customer_id) {
        communicationData.customer_id = body.metadata.customer_id
      }
      if (body.metadata?.vendor_id) {
        communicationData.vendor_id = body.metadata.vendor_id
      }
    } else {
      // Custom webhook format - expect direct mapping
      communicationData = {
        type: body.type || "note",
        direction: body.direction || "outbound",
        subject: body.subject || null,
        message: body.message || null,
        customer_id: body.customer_id || null,
        vendor_id: body.vendor_id || null,
        contact_id: body.contact_id || null,
        load_id: body.load_id || null,
        invoice_id: body.invoice_id || null,
        external_id: body.external_id || body.id || null,
        source: source,
        metadata: body.metadata || {},
        occurred_at: body.occurred_at || body.timestamp || new Date().toISOString(),
      }
    }

    // Validate required fields
    if (!communicationData.customer_id && !communicationData.vendor_id) {
      return NextResponse.json(
        { error: "Either customer_id or vendor_id must be provided" },
        { status: 400 }
      )
    }

    // MEDIUM FIX: Validate company_id from body if provided (prevent cross-company data injection)
    if (body.company_id) {
      // Verify company_id matches the customer/vendor's company
      const { createAdminClient } = await import("@/lib/supabase/admin")
      const adminSupabase = createAdminClient()
      
      if (communicationData.customer_id) {
        const { data: customer } = await adminSupabase
          .from("customers")
          .select("company_id")
          .eq("id", communicationData.customer_id)
          .single()
        
        if (!customer || customer.company_id !== body.company_id) {
          return NextResponse.json(
            { error: "company_id does not match customer's company" },
            { status: 403 }
          )
        }
      } else if (communicationData.vendor_id) {
        const { data: vendor } = await adminSupabase
          .from("vendors")
          .select("company_id")
          .eq("id", communicationData.vendor_id)
          .single()
        
        if (!vendor || vendor.company_id !== body.company_id) {
          return NextResponse.json(
            { error: "company_id does not match vendor's company" },
            { status: 403 }
          )
        }
      }
    }

    // Log the communication
    const result = await logCommunicationFromWebhook(communicationData)

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json(
      { message: "Communication logged successfully", data: result.data },
      { status: 200 }
    )
  } catch (error: any) {
    console.error("Webhook error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to process webhook" },
      { status: 500 }
    )
  }
}



