import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { authenticateApiKey, enforceApiRateLimit, recordApiUsage } from "@/lib/api/v1/auth"

const createTruckSchema = z.object({
  truck_number: z.string().min(1),
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.number().optional(),
  vin: z.string().optional(),
  plate_number: z.string().optional(),
  status: z.string().optional(),
  driver_id: z.string().uuid().optional(),
})

export async function GET(request: NextRequest) {
  const startedAt = Date.now()
  const auth = await authenticateApiKey(request, "read")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const rl = await enforceApiRateLimit(request, "trucks:get")
  if (!rl.allowed) return NextResponse.json({ error: rl.error }, { status: rl.status })
  const url = new URL(request.url)
  const page = Math.max(1, Number(url.searchParams.get("page") || 1))
  const perPage = Math.min(100, Math.max(1, Number(url.searchParams.get("per_page") || 100)))
  const from = (page - 1) * perPage
  const to = from + perPage - 1

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("trucks")
    .select("id, truck_number, make, model, year, vin, plate_number, status, driver_id, created_at, updated_at")
    .eq("company_id", auth.companyId)
    .order("created_at", { ascending: false })
    .range(from, to)

  const status = error ? 500 : 200
  await recordApiUsage({
    apiKeyId: auth.apiKeyId,
    companyId: auth.companyId,
    endpoint: "/api/v1/trucks",
    method: "GET",
    statusCode: status,
    startedAt,
    ipAddress: auth.ipAddress,
    userAgent: auth.userAgent,
  })
  if (error) return NextResponse.json({ error: error.message || "Failed to fetch trucks" }, { status })
  const nextPage = (data || []).length === perPage ? page + 1 : null
  return NextResponse.json({ data: data || [], next_page: nextPage }, { status: 200 })
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  const auth = await authenticateApiKey(request, "write")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const rl = await enforceApiRateLimit(request, "trucks:post", 60, 60)
  if (!rl.allowed) return NextResponse.json({ error: rl.error }, { status: rl.status })
  const body = await request.json().catch(() => ({}))
  const parsed = createTruckSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("trucks")
    .insert({
      company_id: auth.companyId,
      ...parsed.data,
    })
    .select("id, truck_number, make, model, year, vin, plate_number, status, driver_id, created_at")
    .single()

  const status = error ? 500 : 201
  await recordApiUsage({
    apiKeyId: auth.apiKeyId,
    companyId: auth.companyId,
    endpoint: "/api/v1/trucks",
    method: "POST",
    statusCode: status,
    startedAt,
    ipAddress: auth.ipAddress,
    userAgent: auth.userAgent,
  })
  if (error) return NextResponse.json({ error: error.message || "Failed to create truck" }, { status })
  return NextResponse.json({ data }, { status: 201 })
}
