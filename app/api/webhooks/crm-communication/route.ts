import { NextRequest, NextResponse } from "next/server"
import { logCommunicationFromWebhook } from "@/app/actions/crm-communication"

/**
 * Webhook endpoint for automated communication logging
 * Supports SendGrid, Postmark, Twilio, and custom webhooks
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

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



