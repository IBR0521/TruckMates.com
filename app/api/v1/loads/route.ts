import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { authenticateApiKey, recordApiUsage } from "@/lib/api/v1/auth"

const createLoadSchema = z.object({
  shipment_number: z.string().min(1),
  origin: z.string().min(1),
  destination: z.string().min(1),
  status: z.string().optional(),
  driver_id: z.string().uuid().optional(),
  truck_id: z.string().uuid().optional(),
  load_date: z.string().optional(),
  estimated_delivery: z.string().optional(),
  value: z.number().optional(),
})

export async function GET(request: NextRequest) {
  const startedAt = Date.now()
  const auth = await authenticateApiKey(request, "read")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("loads")
      .select("id, shipment_number, origin, destination, status, driver_id, truck_id, load_date, estimated_delivery, value, created_at, updated_at")
      .eq("company_id", auth.companyId)
      .order("created_at", { ascending: false })
      .limit(200)

    const status = error ? 500 : 200
    await recordApiUsage({
      apiKeyId: auth.apiKeyId,
      companyId: auth.companyId,
      endpoint: "/api/v1/loads",
      method: "GET",
      statusCode: status,
      startedAt,
      ipAddress: auth.ipAddress,
      userAgent: auth.userAgent,
    })
    if (error) return NextResponse.json({ error: error.message || "Failed to fetch loads" }, { status })
    return NextResponse.json({ data: data || [] }, { status: 200 })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  const auth = await authenticateApiKey(request, "write")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const body = await request.json().catch(() => ({}))
    const parsed = createLoadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("loads")
      .insert({
        company_id: auth.companyId,
        ...parsed.data,
      })
      .select("id, shipment_number, origin, destination, status, driver_id, truck_id, load_date, estimated_delivery, value")
      .single()

    const status = error ? 500 : 201
    await recordApiUsage({
      apiKeyId: auth.apiKeyId,
      companyId: auth.companyId,
      endpoint: "/api/v1/loads",
      method: "POST",
      statusCode: status,
      startedAt,
      ipAddress: auth.ipAddress,
      userAgent: auth.userAgent,
    })
    if (error) return NextResponse.json({ error: error.message || "Failed to create load" }, { status })
    return NextResponse.json({ data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
