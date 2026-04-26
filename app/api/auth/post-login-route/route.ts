import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const TEMP_DISABLE_PAYMENT_GATE = true

function isSafeRelativePath(path: string | null): path is string {
  return !!path && path.startsWith("/") && !path.startsWith("//")
}

export async function GET(request: NextRequest) {
  const nextParam = request.nextUrl.searchParams.get("next")
  const safeNext = isSafeRelativePath(nextParam) ? nextParam : "/dashboard"

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ redirectTo: "/login" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, company_id")
    .eq("id", user.id)
    .maybeSingle()

  const companyId = (profile as { company_id?: string | null } | null)?.company_id || null
  const role = String((profile as { role?: string | null } | null)?.role || "")
  const isManager = role === "super_admin" || role === "operations_manager"

  if (!companyId) {
    return NextResponse.json({ redirectTo: safeNext })
  }

  if (isManager) {
    const { data: company } = await supabase
      .from("companies")
      .select("setup_complete")
      .eq("id", companyId)
      .maybeSingle()

    const setupComplete = Boolean((company as { setup_complete?: boolean } | null)?.setup_complete)
    if (!setupComplete) {
      return NextResponse.json({ redirectTo: "/account-setup/manager" })
    }
  }

  if (!TEMP_DISABLE_PAYMENT_GATE) {
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select(`
        status,
        trial_end,
        stripe_subscription_id,
        subscription_plans(name)
      `)
      .eq("company_id", companyId)
      .maybeSingle()

    const status = String((subscription as any)?.status || "")
    const trialEnd = (subscription as any)?.trial_end ? new Date((subscription as any).trial_end) : null
    const trialExpired = !!trialEnd && trialEnd.getTime() < Date.now()

    const hasSubscriptionAccess =
      !!subscription &&
      (status === "active" || (status === "trialing" && !trialExpired))

    if (!hasSubscriptionAccess) {
      return NextResponse.json({ redirectTo: "/billing/activate?required=1" })
    }
  }

  return NextResponse.json({ redirectTo: safeNext })
}
