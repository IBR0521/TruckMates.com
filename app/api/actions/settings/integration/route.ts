import { NextRequest, NextResponse } from "next/server"
import { errorMessage } from "@/lib/error-message"
import { updateIntegrationSettings } from "@/app/actions/settings-integration"

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const asOptionalString = (value: unknown): string | undefined =>
      typeof value === "string" ? value : undefined
    const asStringRecord = (value: unknown): Record<string, string> | undefined => {
      if (!value || typeof value !== "object") return undefined
      const entries = Object.entries(value as Record<string, unknown>).filter(
        ([, v]) => typeof v === "string",
      ) as Array<[string, string]>
      return entries.length > 0 ? Object.fromEntries(entries) : undefined
    }

    const result = await updateIntegrationSettings({
      quickbooks_default_income_account_id:
        asOptionalString(body?.quickbooks_default_income_account_id),
      quickbooks_default_item_id: asOptionalString(body?.quickbooks_default_item_id),
      quickbooks_gl_account_mappings:
        asStringRecord(body?.quickbooks_gl_account_mappings),
    })

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

