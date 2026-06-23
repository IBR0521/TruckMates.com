import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"

/**
 * Deliberate Sentry smoke test for production verification.
 * Protected by CRON_SECRET — not exposed to unauthenticated callers.
 *
 * GET /api/debug/sentry-test
 * Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  const isAuthorized = !!cronSecret && authHeader === `Bearer ${cronSecret}`

  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const dsnConfigured = Boolean(String(process.env.NEXT_PUBLIC_SENTRY_DSN || "").trim())
  if (!dsnConfigured) {
    return NextResponse.json(
      {
        ok: false,
        error: "NEXT_PUBLIC_SENTRY_DSN is not set — create a Sentry project and add the DSN to Vercel production env first.",
      },
      { status: 503 },
    )
  }

  const testId = `sentry-smoke-${Date.now()}`
  Sentry.captureMessage(`[Sentry smoke test] ${testId}`, "warning")

  try {
    throw new Error(`[Sentry smoke test] deliberate exception ${testId}`)
  } catch (error) {
    Sentry.captureException(error, {
      tags: { source: "sentry_smoke_test" },
      extra: { testId },
    })
  }

  await Sentry.flush(2000)

  return NextResponse.json({
    ok: true,
    testId,
    message: "Test events sent. Confirm both the message and exception appear in Sentry within ~1 minute.",
  })
}
