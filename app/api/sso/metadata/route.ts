import { NextResponse } from "next/server"
import { generateSpMetadataXml } from "@/lib/sso/sp-metadata"

/**
 * Public SP metadata for customer IdP configuration (SAML 2.0).
 * Phase 1 only — ACS/login flow is not implemented yet.
 */
export async function GET() {
  try {
    const metadata = generateSpMetadataXml()
    return new NextResponse(metadata, {
      status: 200,
      headers: {
        "Content-Type": "application/samlmetadata+xml; charset=utf-8",
        "Content-Disposition": 'attachment; filename="truckmates-sp-metadata.xml"',
        "Cache-Control": "public, max-age=3600",
      },
    })
  } catch (error: unknown) {
    console.error("[SSO metadata] Failed to generate SP metadata:", error)
    return NextResponse.json(
      { error: "SAML service provider metadata is not configured" },
      { status: 503 },
    )
  }
}
