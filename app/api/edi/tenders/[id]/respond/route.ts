import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { authenticateApiKey, recordApiUsage } from "@/lib/api/v1/auth"
import { buildX12_990 } from "@/lib/edi/x12"
import { getCompanyFeatureAccessByCompanyId } from "@/lib/plan-gates"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const accepted = Boolean(body.accepted)
    const senderId = String(body.senderId || "TRUCKMATES")
    const receiverId = String(body.receiverId || "TRADINGPARTNER")

    const supabase = createAdminClient()
    const { data: tender, error: tenderError } = await supabase
      .from("edi_load_tenders")
      .select("id, company_id, tender_number")
      .eq("id", id)
      .eq("company_id", auth.companyId)
      .maybeSingle()

    if (tenderError || !tender) {
      statusCode = 404
      return NextResponse.json({ error: "Tender not found" }, { status: statusCode })
    }

    const control = String(Math.floor(Math.random() * 999999)).padStart(6, "0")
    const payload = buildX12_990({
      senderId,
      receiverId,
      controlNumber: control,
      tenderNumber: tender.tender_number || id,
      accepted,
    })

    const insertMsg = await supabase
      .from("edi_messages")
      .insert({
        company_id: auth.companyId,
        direction: "outbound",
        transaction_set: "990",
        control_number: control,
        raw_payload: payload,
        status: "generated",
        processed_at: new Date().toISOString(),
      })
      .select("id")
      .single()
    if (insertMsg.error || !insertMsg.data?.id) {
      statusCode = 500
      return NextResponse.json({ error: insertMsg.error?.message || "Failed to persist 990" }, { status: statusCode })
    }

    const update = await supabase
      .from("edi_load_tenders")
      .update({
        status: accepted ? "accepted" : "rejected",
        accepted_at: accepted ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("company_id", auth.companyId)
    if (update.error) {
      statusCode = 500
      return NextResponse.json({ error: update.error.message }, { status: statusCode })
    }

    return NextResponse.json({
      success: true,
      transaction_set: "990",
      accepted,
      payload,
      message_id: insertMsg.data.id,
    })
  } finally {
    await recordApiUsage({
      apiKeyId: auth.apiKeyId,
      companyId: auth.companyId,
      endpoint: "/api/edi/tenders/[id]/respond",
      method: "POST",
      statusCode,
      startedAt,
      ipAddress: auth.ipAddress,
      userAgent: auth.userAgent,
    })
  }
}
