import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { authenticateApiKey, enforceApiRateLimit, recordApiUsage } from "@/lib/api/v1/auth"
import { requirePublicApiFeature } from "@/lib/api/v1/public-api-plan"
import {
  getDispatchReadinessError,
  isLoadStatusTransitionAllowed,
  OPERATIONS_WORKFLOW_SETTINGS_SELECT,
} from "@/lib/load-dispatch-validation"
import { computePermitRequirement } from "@/lib/permit-requirement"
import { normalizeLoadStatus } from "@/lib/load-status"

const patchLoadSchema = z
  .object({
    shipment_number: z.string().min(1).optional(),
    origin: z.string().min(1).optional(),
    destination: z.string().min(1).optional(),
    status: z.string().optional(),
    driver_id: z.string().uuid().nullable().optional(),
    truck_id: z.string().uuid().nullable().optional(),
    load_date: z.string().nullable().optional(),
    estimated_delivery: z.string().nullable().optional(),
    value: z.number().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "No fields to update")

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const startedAt = Date.now()
  const auth = await authenticateApiKey(request, "read")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const planBlock = await requirePublicApiFeature(auth.companyId)
  if (planBlock) return planBlock
  const rl = await enforceApiRateLimit(request, "loads:id:get")
  if (!rl.allowed) return NextResponse.json({ error: rl.error }, { status: rl.status })
  const { id } = await params
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("loads")
    .select("id, shipment_number, origin, destination, status, driver_id, truck_id, load_date, estimated_delivery, value, created_at, updated_at")
    .eq("id", id)
    .eq("company_id", auth.companyId)
    .maybeSingle()

  const status = error ? 500 : data ? 200 : 404
  await recordApiUsage({
    apiKeyId: auth.apiKeyId,
    companyId: auth.companyId,
    endpoint: `/api/v1/loads/${id}`,
    method: "GET",
    statusCode: status,
    startedAt,
    ipAddress: auth.ipAddress,
    userAgent: auth.userAgent,
  })
  if (error) return NextResponse.json({ error: error.message || "Failed to fetch load" }, { status })
  if (!data) return NextResponse.json({ error: "Load not found" }, { status: 404 })
  return NextResponse.json({ data }, { status: 200 })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const startedAt = Date.now()
  const auth = await authenticateApiKey(request, "write")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const planBlockW = await requirePublicApiFeature(auth.companyId)
  if (planBlockW) return planBlockW
  const rl = await enforceApiRateLimit(request, "loads:id:patch", 60, 60)
  if (!rl.allowed) return NextResponse.json({ error: rl.error }, { status: rl.status })
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const parsed = patchLoadSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 })

  const supabase = createAdminClient()
  const { data: currentLoad, error: fetchError } = await supabase
    .from("loads")
    .select(
      "id, status, driver_id, truck_id, weight, weight_kg, length, width, height, is_oversized, requires_permit",
    )
    .eq("id", id)
    .eq("company_id", auth.companyId)
    .maybeSingle()

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message || "Failed to fetch load" }, { status: 500 })
  }
  if (!currentLoad) {
    return NextResponse.json({ error: "Load not found" }, { status: 404 })
  }

  const { data: companySettings } = await supabase
    .from("company_settings")
    .select(`${OPERATIONS_WORKFLOW_SETTINGS_SELECT}, emergency_contact_required`)
    .eq("company_id", auth.companyId)
    .maybeSingle()

  if (parsed.data.status && parsed.data.status !== currentLoad.status) {
    const transitionCheck = isLoadStatusTransitionAllowed(
      currentLoad.status,
      parsed.data.status,
      Boolean(companySettings?.allow_status_skip),
      companySettings?.required_statuses,
    )
    if (!transitionCheck.allowed) {
      return NextResponse.json({ error: transitionCheck.error }, { status: 400 })
    }
  }

  const nextStatus = parsed.data.status ?? currentLoad.status
  const permitRequirement = computePermitRequirement({
    weight_kg: currentLoad.weight_kg,
    weight: currentLoad.weight,
    length: currentLoad.length,
    width: currentLoad.width,
    height: currentLoad.height,
    is_oversized: currentLoad.is_oversized,
  })
  const dispatchError = await getDispatchReadinessError({
    supabase,
    companyId: auth.companyId,
    loadId: id,
    currentStatus: normalizeLoadStatus(currentLoad.status),
    nextStatus: String(nextStatus),
    requiresPermit: Boolean(currentLoad.requires_permit ?? permitRequirement.required),
    truckId: parsed.data.truck_id ?? currentLoad.truck_id,
    driverId: parsed.data.driver_id ?? currentLoad.driver_id,
    settings: companySettings,
  })
  if (dispatchError) {
    return NextResponse.json({ error: dispatchError }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("loads")
    .update(parsed.data)
    .eq("id", id)
    .eq("company_id", auth.companyId)
    .select("id, shipment_number, origin, destination, status, driver_id, truck_id, load_date, estimated_delivery, value, updated_at")
    .maybeSingle()

  const status = error ? 500 : data ? 200 : 404
  await recordApiUsage({
    apiKeyId: auth.apiKeyId,
    companyId: auth.companyId,
    endpoint: `/api/v1/loads/${id}`,
    method: "PATCH",
    statusCode: status,
    startedAt,
    ipAddress: auth.ipAddress,
    userAgent: auth.userAgent,
  })
  if (error) return NextResponse.json({ error: error.message || "Failed to update load" }, { status })
  if (!data) return NextResponse.json({ error: "Load not found" }, { status: 404 })
  return NextResponse.json({ data }, { status: 200 })
}
