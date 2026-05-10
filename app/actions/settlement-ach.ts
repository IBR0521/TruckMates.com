"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { errorMessage } from "@/lib/error-message"
import * as Sentry from "@sentry/nextjs"
import { mapLegacyRole } from "@/lib/roles"

/** Shown when Stripe is not configured; keeps Connect code paths for future US rollout. */
export const ACH_DISABLED_MESSAGE =
  "Automated ACH transfers are not currently available. Please process payment through your bank and mark the settlement as paid manually."

type StripeLike = Record<string, unknown>

type StripeClientResult =
  | { stripe: StripeLike; error: null }
  | { stripe: null; error: string }

async function getStripeClient(): Promise<StripeClientResult> {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { stripe: null, error: ctx.error || "Not authenticated" }
  }

  const envKey = process.env.STRIPE_SECRET_KEY || ""
  if (envKey) {
    const Stripe = (await import("stripe")).default
    const stripe = new Stripe(envKey) as unknown as StripeLike
    return { stripe, error: null }
  }

  const { data: integrations, error } = await supabase
    .from("company_integrations")
    .select("stripe_enabled, stripe_api_key")
    .eq("company_id", ctx.companyId)
    .maybeSingle()
  if (error) {
    return { stripe: null, error: error.message }
  }
  if (!integrations?.stripe_enabled || !integrations?.stripe_api_key) {
    return { stripe: null, error: ACH_DISABLED_MESSAGE }
  }
  const Stripe = (await import("stripe")).default
  const stripe = new Stripe(integrations.stripe_api_key as string) as unknown as StripeLike
  return { stripe, error: null }
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

    const stripeResult = await getStripeClient()
    if (stripeResult.error) {
      return { data: null, error: stripeResult.error }
    }
    const stripe = stripeResult.stripe as {
      accounts: { create: (args: Record<string, unknown>) => Promise<{ id: string }> }
      accountLinks: {
        create: (args: Record<string, unknown>) => Promise<{ url: string }>
      }
    }

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

export async function executeSettlementAchTransfer(params: { settlementId: string; driverId: string; amount: number }) {
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

    const stripeResult = await getStripeClient()
    if (stripeResult.error) {
      return { error: stripeResult.error, data: null }
    }
    const stripe = stripeResult.stripe as {
      transfers: { create: (args: Record<string, unknown>) => Promise<{ id: string }> }
      payouts: { create: (args: Record<string, unknown>, opts?: Record<string, unknown>) => Promise<{ id: string; arrival_date?: number }> }
    }

    const { data: driver, error: driverError } = await supabase
      .from("drivers")
      .select("id, stripe_account_id")
      .eq("id", params.driverId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()
    if (driverError || !driver) return { error: "Driver not found", data: null }
    if (!driver.stripe_account_id) return { error: "Driver has not connected a bank account via Stripe", data: null }

    const amountCents = Math.round(Math.max(0, Number(params.amount || 0)) * 100)
    if (amountCents <= 0) return { error: "Settlement amount must be greater than zero", data: null }

    const transfer = await stripe.transfers.create({
      amount: amountCents,
      currency: "usd",
      destination: driver.stripe_account_id,
      metadata: {
        company_id: ctx.companyId,
        driver_id: params.driverId,
        settlement_id: params.settlementId,
      },
      description: `Settlement ${params.settlementId}`,
    })

    const payout = await stripe.payouts.create(
      {
        amount: amountCents,
        currency: "usd",
        method: "standard",
        metadata: {
          company_id: ctx.companyId,
          driver_id: params.driverId,
          settlement_id: params.settlementId,
          transfer_id: transfer.id,
        },
      },
      { stripeAccount: driver.stripe_account_id },
    )

    const eta = payout.arrival_date ? new Date(payout.arrival_date * 1000).toISOString().slice(0, 10) : null
    return {
      data: {
        transferId: transfer.id as string,
        payoutId: payout.id as string,
        paymentReference: (payout.id || transfer.id) as string,
        eta,
      },
      error: null,
    }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to execute ACH transfer"), data: null }
  }
}
