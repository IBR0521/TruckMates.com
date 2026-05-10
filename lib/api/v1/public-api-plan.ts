import { NextResponse } from "next/server"
import { checkFeatureAccess } from "@/lib/plan-enforcement"

/**
 * Fleet+ public API — blocks v1 routes when plan does not include `public_api`.
 */
export async function requirePublicApiFeature(companyId: string): Promise<NextResponse | null> {
  const { allowed } = await checkFeatureAccess({ companyId, feature: "public_api" })
  if (allowed) return null
  return NextResponse.json(
    {
      error:
        "Public API access is not included on your current plan. Upgrade to Fleet or Enterprise in Settings → Billing to use the public API.",
    },
    { status: 403 },
  )
}
