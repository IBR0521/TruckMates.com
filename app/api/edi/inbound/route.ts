import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { authenticateApiKey, recordApiUsage } from "@/lib/api/v1/auth"
import { parseX12 } from "@/lib/edi/x12"
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
    const payload = await request.text()
    if (!payload?.trim()) {
      statusCode = 400
      return NextResponse.json({ error: "EDI payload is required" }, { status: statusCode })
    }

    const parsed = parseX12(payload)
    if (!parsed.transactionSet) {
      statusCode = 400
      return NextResponse.json({ error: "Unable to detect transaction set (ST segment missing)" }, { status: statusCode })
    }

    if (parsed.transactionSet !== "204" || !parsed.data) {
      statusCode = 422
      return NextResponse.json({ error: `Unsupported transaction set ${parsed.transactionSet}. Only 204 is enabled.` }, { status: statusCode })
    }

    const supabase = createAdminClient()
    const messageRes = await supabase
      .from("edi_messages")
      .insert({
        company_id: auth.companyId,
        direction: "inbound",
        transaction_set: "204",
        control_number: parsed.data.controlNumber,
        raw_payload: payload,
        status: "parsed",
        processed_at: new Date().toISOString(),
      })
      .select("id")
      .single()

    if (messageRes.error || !messageRes.data?.id) {
      statusCode = 500
      return NextResponse.json({ error: messageRes.error?.message || "Failed to store inbound EDI message" }, { status: statusCode })
    }

    const tenderRes = await supabase
      .from("edi_load_tenders")
      .insert({
        company_id: auth.companyId,
        edi_message_id: messageRes.data.id,
        tender_number: parsed.data.tenderNumber,
        shipment_reference: parsed.data.shipmentReference,
        shipper_name: parsed.data.shipperName,
        shipper_address: parsed.data.shipperAddress,
        shipper_city: parsed.data.shipperCity,
        shipper_state: parsed.data.shipperState,
        shipper_zip: parsed.data.shipperZip,
        consignee_name: parsed.data.consigneeName,
        consignee_address: parsed.data.consigneeAddress,
        consignee_city: parsed.data.consigneeCity,
        consignee_state: parsed.data.consigneeState,
        consignee_zip: parsed.data.consigneeZip,
        pickup_date: parsed.data.pickupDate,
        delivery_date: parsed.data.deliveryDate,
        weight_lbs: parsed.data.weightLbs,
        status: "received",
      })
      .select("id, tender_number, shipment_reference, status")
      .single()

    if (tenderRes.error || !tenderRes.data) {
      statusCode = 500
      return NextResponse.json({ error: tenderRes.error?.message || "Failed to create load tender" }, { status: statusCode })
    }

    return NextResponse.json({
      success: true,
      transaction_set: "204",
      tender: tenderRes.data,
      message_id: messageRes.data.id,
    })
  } finally {
    if (auth.ok) {
      await recordApiUsage({
        apiKeyId: auth.apiKeyId,
        companyId: auth.companyId,
        endpoint: "/api/edi/inbound",
        method: "POST",
        statusCode,
        startedAt,
        ipAddress: auth.ipAddress,
        userAgent: auth.userAgent,
      })
    }
  }
}
