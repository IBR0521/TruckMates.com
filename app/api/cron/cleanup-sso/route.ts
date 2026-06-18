import { NextResponse } from "next/server"
import { purgeExpiredSsoConsumedAssertions } from "@/lib/sso/assertion-replay"
import { purgeExpiredSsoPendingRequests } from "@/lib/sso/idp-config"

/** Purge expired SSO correlation and replay rows. Vercel Cron + CRON_SECRET. */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error("[Cron SSO cleanup] CRON_SECRET not configured - endpoint disabled")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    await purgeExpiredSsoPendingRequests()
    const consumedDeleted = await purgeExpiredSsoConsumedAssertions()

    return NextResponse.json({
      success: true,
      data: {
        consumedAssertionsDeleted: consumedDeleted,
      },
    })
  } catch (error: unknown) {
    console.error("[Cron SSO cleanup] Unexpected error:", error)
    return NextResponse.json({ error: "Cleanup failed", success: false }, { status: 500 })
  }
}
