import { NextRequest, NextResponse } from "next/server"
import { retryWebhookDelivery } from "@/app/actions/webhooks"

// Retry failed webhook deliveries
// This endpoint can be called by a cron job to retry failed webhook deliveries
export async function POST(request: NextRequest) {
  // SECURITY: Fail-closed - require CRON_SECRET if set
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error("[Cron] CRON_SECRET not configured - endpoint disabled")
    return NextResponse.json(
      { error: "Cron endpoint is not configured. Set CRON_SECRET environment variable." },
      { status: 503 }
    )
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { createClient } = await import("@/lib/supabase/server")
    const supabase = await createClient()

    // BUG-007 FIX: Use proper Supabase filter instead of non-existent .raw() method
    // Get all deliveries that need retry (attempts < max_attempts)
    const { data: deliveries } = await supabase
      .from("webhook_deliveries")
      .select("id, webhook_id, event_type, payload, attempts, max_attempts")
      .eq("status", "retrying")
      .lte("next_retry_at", new Date().toISOString())
    
    // Filter in JavaScript since Supabase doesn't support column comparison in filter
    // This is acceptable for a cron job that runs infrequently
    const filteredDeliveries = (deliveries || []).filter(
      (delivery: any) => delivery.attempts < delivery.max_attempts
    )

    if (!filteredDeliveries || filteredDeliveries.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No webhook deliveries to retry",
        retried: 0,
      })
    }

    let retried = 0
    let failed = 0

    // Retry each delivery
    for (const delivery of filteredDeliveries) {
      const result = await retryWebhookDelivery(delivery.id)
      if (result.error) {
        failed++
      } else {
        retried++
      }
    }

    return NextResponse.json({
      success: true,
      message: `Retried ${retried} webhook delivery(ies), ${failed} failed`,
      retried,
      failed,
    })
  } catch (error: any) {
    console.error("Webhook retry cron error:", error)
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    )
  }
}





