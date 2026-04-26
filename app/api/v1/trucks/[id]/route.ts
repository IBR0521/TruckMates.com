import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { authenticateApiKey, recordApiUsage } from "@/lib/api/v1/auth"

const patchTruckSchema = z
  .object({
    truck_number: z.string().min(1).optional(),
    make: z.string().nullable().optional(),
    model: z.string().nullable().optional(),
    year: z.number().nullable().optional(),
    vin: z.string().nullable().optional(),
    plate_number: z.string().nullable().optional(),
    status: z.string().optional(),
    driver_id: z.string().uuid().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "No fields to update")

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const startedAt = Date.now()
  const auth = await authenticateApiKey(request, "read")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await params
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("trucks")
    .select("id, truck_number, make, model, year, vin, plate_number, status, driver_id, created_at, updated_at")
    .eq("id", id)
    .eq("company_id", auth.companyId)
    .maybeSingle()

  const status = error ? 500 : data ? 200 : 404
  await recordApiUsage({
    apiKeyId: auth.apiKeyId,
    companyId: auth.companyId,
    endpoint: `/api/v1/trucks/${id}`,
    method: "GET",
    statusCode: status,
    startedAt,
    ipAddress: auth.ipAddress,
    userAgent: auth.userAgent,
  })
  if (error) return NextResponse.json({ error: error.message || "Failed to fetch truck" }, { status })
  if (!data) return NextResponse.json({ error: "Truck not found" }, { status: 404 })
  return NextResponse.json({ data }, { status: 200 })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const startedAt = Date.now()
  const auth = await authenticateApiKey(request, "write")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const parsed = patchTruckSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("trucks")
    .update(parsed.data)
    .eq("id", id)
    .eq("company_id", auth.companyId)
    .select("id, truck_number, make, model, year, vin, plate_number, status, driver_id, updated_at")
    .maybeSingle()

  const status = error ? 500 : data ? 200 : 404
  await recordApiUsage({
    apiKeyId: auth.apiKeyId,
    companyId: auth.companyId,
    endpoint: `/api/v1/trucks/${id}`,
    method: "PATCH",
    statusCode: status,
    startedAt,
    ipAddress: auth.ipAddress,
    userAgent: auth.userAgent,
  })
  if (error) return NextResponse.json({ error: error.message || "Failed to update truck" }, { status })
  if (!data) return NextResponse.json({ error: "Truck not found" }, { status: 404 })
  return NextResponse.json({ data }, { status: 200 })
}
