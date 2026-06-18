import { NextRequest, NextResponse } from "next/server"
import { extractEmailDomain, isSsoAvailableForEmail } from "@/lib/sso/idp-config"

/**
 * Login-page SSO availability check. Always returns the same shape to avoid domain enumeration.
 */
export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email")?.trim() || ""
  const domain = extractEmailDomain(email)

  if (!domain) {
    return NextResponse.json({ available: false })
  }

  const available = await isSsoAvailableForEmail(email)
  return NextResponse.json({ available })
}
