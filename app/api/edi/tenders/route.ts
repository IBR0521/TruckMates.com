import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { authenticateApiKey, recordApiUsage } from "@/lib/api/v1/auth"
import { getCompanyFeatureAccessByCompanyId } from "@/lib/plan-gates"

export async function GET(request: NextRequest) {
  const startedAt = Date.now()
  const auth = await authenticateApiKey(request, "read")
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
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("edi_load_tenders")
      .select("id, tender_number, shipment_reference, status, shipper_name, consignee_name, pickup_date, delivery_date, weight_lbs, load_id, created_at")
      .eq("company_id", auth.companyId)
      .order("created_at", { ascending: false })
      .limit(100)

    if (error) {
      statusCode = 500
      return NextResponse.json({ error: error.message }, { status: statusCode })
    }

    return NextResponse.json({ data: data || [] })
  } finally {
    await recordApiUsage({
      apiKeyId: auth.apiKeyId,
      companyId: auth.companyId,
      endpoint: "/api/edi/tenders",
      method: "GET",
      statusCode,
      startedAt,
      ipAddress: auth.ipAddress,
      userAgent: auth.userAgent,
    })
  }
}
