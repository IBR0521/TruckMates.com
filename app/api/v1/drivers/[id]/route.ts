import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { authenticateApiKey, enforceApiRateLimit, recordApiUsage } from "@/lib/api/v1/auth"

const patchDriverSchema = z
  .object({
    name: z.string().min(1).optional(),
    email: z.string().email().nullable().optional(),
    phone: z.string().nullable().optional(),
    status: z.string().optional(),
    truck_id: z.string().uuid().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "No fields to update")

function toNormalizedPhone(raw: string | null | undefined) {
  const value = String(raw || "").trim()
  if (!value) return null
  if (value.startsWith("+")) return value.replace(/\s/g, "")
  const digits = value.replace(/\D/g, "")
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  return digits ? `+${digits}` : null
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const startedAt = Date.now()
  const auth = await authenticateApiKey(request, "read")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const rl = await enforceApiRateLimit(request, "drivers:id:get")
  if (!rl.allowed) return NextResponse.json({ error: rl.error }, { status: rl.status })
  const { id } = await params

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("drivers")
    .select("id, name, email, phone, status, truck_id, license_number, license_expiry, created_at, updated_at")
    .eq("id", id)
    .eq("company_id", auth.companyId)
    .maybeSingle()

  const status = error ? 500 : data ? 200 : 404
  await recordApiUsage({
    apiKeyId: auth.apiKeyId,
    companyId: auth.companyId,
    endpoint: `/api/v1/drivers/${id}`,
    method: "GET",
    statusCode: status,
    startedAt,
    ipAddress: auth.ipAddress,
    userAgent: auth.userAgent,
  })
  if (error) return NextResponse.json({ error: error.message || "Failed to fetch driver" }, { status })
  if (!data) return NextResponse.json({ error: "Driver not found" }, { status: 404 })
  return NextResponse.json({ data }, { status: 200 })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const startedAt = Date.now()
  const auth = await authenticateApiKey(request, "write")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const rl = await enforceApiRateLimit(request, "drivers:id:patch", 60, 60)
  if (!rl.allowed) return NextResponse.json({ error: rl.error }, { status: rl.status })
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const parsed = patchDriverSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 })

  const supabase = createAdminClient()
  const updatePayload: Record<string, unknown> = { ...parsed.data }
  if ("phone" in parsed.data) {
    updatePayload.normalized_phone = toNormalizedPhone(parsed.data.phone ?? null)
  }
  const { data, error } = await supabase
    .from("drivers")
    .update(updatePayload)
    .eq("id", id)
    .eq("company_id", auth.companyId)
    .select("id, name, email, phone, status, truck_id, updated_at")
    .maybeSingle()

  const status = error ? 500 : data ? 200 : 404
  await recordApiUsage({
    apiKeyId: auth.apiKeyId,
    companyId: auth.companyId,
    endpoint: `/api/v1/drivers/${id}`,
    method: "PATCH",
    statusCode: status,
    startedAt,
    ipAddress: auth.ipAddress,
    userAgent: auth.userAgent,
  })
  if (error) return NextResponse.json({ error: error.message || "Failed to update driver" }, { status })
  if (!data) return NextResponse.json({ error: "Driver not found" }, { status: 404 })
  return NextResponse.json({ data }, { status: 200 })
}
