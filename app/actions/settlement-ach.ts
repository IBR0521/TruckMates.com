"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { errorMessage } from "@/lib/error-message"
import * as Sentry from "@sentry/nextjs"
import { mapLegacyRole } from "@/lib/roles"

type StripeLike = any

async function getStripeClient(): Promise<StripeLike> {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) throw new Error(ctx.error || "Not authenticated")

  const envKey = process.env.STRIPE_SECRET_KEY || ""
  if (envKey) {
    const stripe = (await import("stripe")).default
    return new stripe(envKey)
  }

  const { data: integrations, error } = await supabase
    .from("company_integrations")
    .select("stripe_enabled, stripe_api_key")
    .eq("company_id", ctx.companyId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!integrations?.stripe_enabled || !integrations?.stripe_api_key) {
    throw new Error("Stripe integration is not enabled or configured")
  }
  const stripe = (await import("stripe")).default
  return new stripe(integrations.stripe_api_key)
}

export async function createDriverStripeOnboardingLink(params?: { returnUrl?: string; refreshUrl?: string }) {
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId || !ctx.userId) return { error: ctx.error || "Not authenticated", data: null }
    if (!ctx.user || mapLegacyRole(ctx.user.role) !== "driver") return { error: "Driver access only", data: null }

    const { data: driver, error: driverError } = await supabase
      .from("drivers")
      .select("id, name, email, phone, stripe_account_id")
      .eq("company_id", ctx.companyId)
      .eq("user_id", ctx.userId)
      .maybeSingle()
    if (driverError || !driver) return { error: "Driver profile not found", data: null }

    const stripe = await getStripeClient()
    let accountId = driver.stripe_account_id as string | null
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "US",
        email: driver.email || undefined,
        business_type: "individual",
        capabilities: { transfers: { requested: true } },
        metadata: { company_id: ctx.companyId, driver_id: driver.id },
      })
      accountId = account.id
      await supabase.from("drivers").update({ stripe_account_id: accountId }).eq("id", driver.id).eq("company_id", ctx.companyId)
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const returnUrl = params?.returnUrl || `${baseUrl}/dashboard/accounting/settlements`
    const refreshUrl = params?.refreshUrl || `${baseUrl}/dashboard/accounting/settlements`
    const link = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      return_url: returnUrl,
      refresh_url: refreshUrl,
    })
    return { data: { url: link.url, stripe_account_id: accountId }, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to start Stripe onboarding"), data: null }
  }
}

export async function executeSettlementAchTransfer(_params: { settlementId: string; driverId: string; amount: number }) {
  return {
    data: null,
    error:
      "Automated ACH transfers are not currently supported. Please process payment through your bank and mark settlement as paid manually.",
  }
}
