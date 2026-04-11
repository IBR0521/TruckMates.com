import { NextResponse } from "next/server"
import { errorMessage } from "@/lib/error-message"
import { createAdminClient } from "@/lib/supabase/admin"

/** Delete expired rows from api_cache (Google/EIA/HERE response cache). Vercel Cron + CRON_SECRET. */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error("[Cron api_cache] CRON_SECRET not configured - endpoint disabled")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const admin = createAdminClient()
    const now = new Date().toISOString()

    const { data: deleted, error } = await admin.from("api_cache").delete().lt("expires_at", now).select("id")

    if (error) {
      return NextResponse.json({ error: error.message, success: false }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      deleted_count: deleted?.length ?? 0,
      cutoff_iso: now,
    })
  } catch (error: unknown) {
    console.error("[Cron api_cache] Unexpected error:", error)
    return NextResponse.json(
      { error: errorMessage(error, "Cleanup failed"), success: false },
      { status: 500 },
    )
  }
}
