import { NextRequest, NextResponse } from "next/server"
import { getClientIP, rateLimitRedis } from "@/lib/rate-limit-redis"

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const bucket = String(body.bucket || "auth")
  const identifier = String(body.identifier || "anonymous").trim().toLowerCase()
  const limit = Number(body.limit || 10)
  const window = Number(body.window || 60)

  if (!identifier) {
    return NextResponse.json({ allowed: false, error: "Missing identifier" }, { status: 400 })
  }

  const ip = getClientIP(request)
  const result = await rateLimitRedis(`${bucket}:${identifier}:${ip}`, {
    limit: Math.max(1, limit),
    window: Math.max(1, window),
  })
  return NextResponse.json({
    allowed: result.success,
    remaining: result.remaining,
    reset: result.reset,
  })
}
