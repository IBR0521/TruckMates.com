import { NextResponse } from "next/server"
import { errorMessage } from "@/lib/error-message"
import {
  acquireJobLock,
  geofenceProcessingLockKey,
  releaseJobLock,
} from "@/lib/cron/job-lock"
import { processGeofenceTelemetryForCompany } from "@/lib/eld/geofence-detector"

export const maxDuration = 120

const LOCK_SECONDS = 120
const SECRET_HEADER = "x-eld-telemetry-webhook-secret"

type SupabaseWebhookPayload = {
  type?: string
  table?: string
  schema?: string
  record?: {
    company_id?: string
    [key: string]: unknown
  }
}

export async function POST(request: Request) {
  const expectedSecret = process.env.ELD_TELEMETRY_WEBHOOK_SECRET
  const providedSecret = request.headers.get(SECRET_HEADER)
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: SupabaseWebhookPayload
  try {
    body = (await request.json()) as SupabaseWebhookPayload
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const companyId = String(body.record?.company_id || "").trim()
  if (!companyId) {
    return NextResponse.json({ error: "Missing company_id in record" }, { status: 400 })
  }

  const lockKey = geofenceProcessingLockKey(companyId)
  const locked = await acquireJobLock(lockKey, LOCK_SECONDS)
  if (!locked) {
    return NextResponse.json({ ok: true, skipped: true, reason: "lock_held", company_id: companyId })
  }

  try {
    const result = await processGeofenceTelemetryForCompany(companyId)
    if (result.error) {
      return NextResponse.json(
        { ok: false, company_id: companyId, error: result.error },
        { status: 500 },
      )
    }
    return NextResponse.json({
      ok: true,
      company_id: companyId,
      processed_points: result.processedPoints,
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: errorMessage(err, "Geofence processing failed") },
      { status: 500 },
    )
  } finally {
    await releaseJobLock(lockKey)
  }
}
