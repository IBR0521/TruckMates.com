import type { SupabaseClient } from "@supabase/supabase-js"

const TEMP_DISABLE_PAYMENT_GATE = false

export function isSafeRelativeLoginNext(path: string | null): path is string {
  return !!path && path.startsWith("/") && !path.startsWith("//")
}

/**
 * Resolves where to send a user immediately after password sign-in.
 * Prefer companies.subscription_* (Paddle) over legacy Stripe rows when present.
 */
export async function resolvePostLoginRedirect(
  supabase: SupabaseClient,
  safeNext: string,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return "/login"
  }

  const { data: profile } = await supabase.from("users").select("role, company_id").eq("id", user.id).maybeSingle()

  const companyId = (profile as { company_id?: string | null } | null)?.company_id || null
  const role = String((profile as { role?: string | null } | null)?.role || "")
  const isManager = role === "super_admin" || role === "operations_manager"

  if (!companyId) {
    return safeNext
  }

  if (isManager) {
    const { data: company } = await supabase
      .from("companies")
      .select("setup_complete")
      .eq("id", companyId)
      .maybeSingle()

    const setupComplete = Boolean((company as { setup_complete?: boolean } | null)?.setup_complete)
    if (!setupComplete) {
      return "/account-setup/manager"
    }
  }

  if (!TEMP_DISABLE_PAYMENT_GATE) {
    const { data: companyBilling } = await supabase
      .from("companies")
      .select("subscription_status")
      .eq("id", companyId)
      .maybeSingle()

    const subStatus = (companyBilling as { subscription_status?: string | null } | null)?.subscription_status
    const hasPaddleStyleRow = typeof subStatus === "string" && subStatus.length > 0

    if (hasPaddleStyleRow) {
      return safeNext
    }

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select(
        `
        status,
        trial_end,
        stripe_subscription_id,
        subscription_plans(name)
      `,
      )
      .eq("company_id", companyId)
      .maybeSingle()

    const subscriptionRow = subscription as { status?: string | null; trial_end?: string | null } | null
    const status = String(subscriptionRow?.status || "")
    const trialEnd = subscriptionRow?.trial_end ? new Date(subscriptionRow.trial_end) : null
    const trialExpired = !!trialEnd && trialEnd.getTime() < Date.now()

    const hasSubscriptionAccess =
      !!subscription && (status === "active" || (status === "trialing" && !trialExpired))

    if (!hasSubscriptionAccess) {
      return "/billing/activate?required=1"
    }
  }

  return safeNext
}
