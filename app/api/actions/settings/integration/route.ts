import { NextRequest, NextResponse } from "next/server"
import { errorMessage } from "@/lib/error-message"
import { updateIntegrationSettings } from "@/app/actions/settings-integration"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))

    const result = await updateIntegrationSettings({
      quickbooks_default_income_account_id:
        body?.quickbooks_default_income_account_id !== undefined
          ? body.quickbooks_default_income_account_id
          : undefined,
      quickbooks_default_item_id:
        body?.quickbooks_default_item_id !== undefined ? body.quickbooks_default_item_id : undefined,
      quickbooks_gl_account_mappings:
        body?.quickbooks_gl_account_mappings !== undefined ? body.quickbooks_gl_account_mappings : undefined,
    } as any)

    if (!result?.success) {
      return NextResponse.json({ success: false, error: result?.error || "Update failed" }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: errorMessage(error, "Internal server error") },
      { status: 500 },
    )
  }
}

