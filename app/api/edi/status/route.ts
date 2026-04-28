import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { authenticateApiKey, recordApiUsage } from "@/lib/api/v1/auth"
import { buildX12_214 } from "@/lib/edi/x12"
import { getCompanyFeatureAccessByCompanyId } from "@/lib/plan-gates"

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  const auth = await authenticateApiKey(request, "write")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const gate = await getCompanyFeatureAccessByCompanyId(auth.companyId, "edi")
  if (!gate.allowed) {
    return NextResponse.json(
      {
        error: "EDI is available on Fleet and Enterprise plans. Please upgrade to continue.",
        upgrade: { required: true, feature: "edi" },
      },
      { status: 403 },
    )
  }

  let statusCode = 200
  try {
    const body = await request.json().catch(() => ({}))
    const shipmentReference = String(body.shipmentReference || "")
    const statusCode214 = String(body.statusCode || "X3")
    const senderId = String(body.senderId || "TRUCKMATES")
    const receiverId = String(body.receiverId || "TRADINGPARTNER")
    const city = body.city ? String(body.city) : undefined
    const state = body.state ? String(body.state) : undefined

    if (!shipmentReference) {
      statusCode = 400
      return NextResponse.json({ error: "shipmentReference is required" }, { status: statusCode })
    }

    const control = String(Math.floor(Math.random() * 999999)).padStart(6, "0")
    const payload = buildX12_214({
      senderId,
      receiverId,
      controlNumber: control,
      shipmentReference,
      statusCode: statusCode214,
      city,
      state,
    })

    const supabase = createAdminClient()
    const insert = await supabase
      .from("edi_messages")
      .insert({
        company_id: auth.companyId,
        direction: "outbound",
        transaction_set: "214",
        control_number: control,
        raw_payload: payload,
        status: "generated",
        processed_at: new Date().toISOString(),
      })
      .select("id")
      .single()

    if (insert.error || !insert.data?.id) {
      statusCode = 500
      return NextResponse.json({ error: insert.error?.message || "Failed to persist 214" }, { status: statusCode })
    }

    return NextResponse.json({
      success: true,
      transaction_set: "214",
      payload,
      message_id: insert.data.id,
    })
  } finally {
    await recordApiUsage({
      apiKeyId: auth.apiKeyId,
      companyId: auth.companyId,
      endpoint: "/api/edi/status",
      method: "POST",
      statusCode,
      startedAt,
      ipAddress: auth.ipAddress,
      userAgent: auth.userAgent,
    })
  }
}
