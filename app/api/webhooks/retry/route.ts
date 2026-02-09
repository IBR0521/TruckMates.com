import { NextRequest, NextResponse } from "next/server"
import { retryWebhookDelivery } from "@/app/actions/webhooks"

// Retry failed webhook deliveries
// This endpoint can be called by a cron job to retry failed webhook deliveries
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { createClient } = await import("@/lib/supabase/server")
    const supabase = await createClient()

    // Get all deliveries that need retry
    const { data: deliveries } = await supabase
      .from("webhook_deliveries")
      .select("id, webhook_id, event_type, payload, attempts, max_attempts")
      .eq("status", "retrying")
      .lte("next_retry_at", new Date().toISOString())
      .lt("attempts", supabase.raw("max_attempts"))

    if (!deliveries || deliveries.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No webhook deliveries to retry",
        retried: 0,
      })
    }

    let retried = 0
    let failed = 0

    // Retry each delivery
    for (const delivery of deliveries) {
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





