import { Paddle, Environment } from "@paddle/paddle-node-sdk"
import type { PlanTier } from "@/lib/plan-limits"

function paddleClient(): Paddle | null {
  const apiKey = String(process.env.PADDLE_API_KEY || "").trim()
  if (!apiKey) return null
  const env =
    String(process.env.PADDLE_ENVIRONMENT || "sandbox").toLowerCase() === "production"
      ? Environment.production
      : Environment.sandbox
  return new Paddle(apiKey, { environment: env })
}

function priceIdForTier(tier: PlanTier, billingCycle: "monthly" | "annual"): string | null {
  const cycle = billingCycle === "annual" ? "ANNUAL" : "MONTHLY"
  const tierKey = String(tier).toUpperCase()
  const envKey = `PADDLE_PRICE_${tierKey}_${cycle}`
  const v = process.env[envKey]
  if (v && String(v).trim()) return String(v).trim()
  const fallback = process.env[`PADDLE_PRICE_${tier}_${billingCycle}`]
  return fallback && String(fallback).trim() ? String(fallback).trim() : null
}

export async function createPaddleCheckout(params: {
  companyId: string
  tier: PlanTier
  billingCycle: "monthly" | "annual"
}): Promise<{ checkoutUrl: string | null; error: string | null }> {
  const paddle = paddleClient()
  if (!paddle) {
    return {
      checkoutUrl: null,
      error: "Paddle billing is not configured. Set PADDLE_API_KEY and catalog price IDs.",
    }
  }

  const priceId = priceIdForTier(params.tier, params.billingCycle)
  if (!priceId) {
    return {
      checkoutUrl: null,
      error: `Missing Paddle price ID for tier ${params.tier} (${params.billingCycle}). Set PADDLE_PRICE_${String(params.tier).toUpperCase()}_MONTHLY / _ANNUAL in environment.`,
    }
  }

  const adminMod = await import("@/lib/supabase/admin")
  const admin = adminMod.createAdminClient()
  const { data: company } = await admin
    .from("companies")
    .select("id, name, paddle_customer_id")
    .eq("id", params.companyId)
    .maybeSingle()

  const companyRow = company as { id?: string; name?: string | null; paddle_customer_id?: string | null } | null
  if (!companyRow?.id) {
    return { checkoutUrl: null, error: "Company not found" }
  }

  let customerId = companyRow.paddle_customer_id || null
  if (!customerId) {
    const emailRow = await admin
      .from("users")
      .select("email")
      .eq("company_id", params.companyId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()
    const email = String((emailRow?.data as { email?: string } | null)?.email || "").trim()

    try {
      const cust = await paddle.customers.create({
        email: email || `company-${params.companyId}@placeholder.truckmates.invalid`,
        name: companyRow.name || undefined,
        customData: { company_id: params.companyId },
      })
      customerId = cust.id
      await admin
        .from("companies")
        .update({ paddle_customer_id: customerId } as never)
        .eq("id", params.companyId)
    } catch (e: unknown) {
      return {
        checkoutUrl: null,
        error: e instanceof Error ? e.message : "Failed to create Paddle customer",
      }
    }
  }

  try {
    const tx = await paddle.transactions.create({
      customerId,
      items: [{ priceId, quantity: 1 }],
      customData: {
        company_id: params.companyId,
        target_tier: params.tier,
        billing_cycle: params.billingCycle,
      },
    })

    const url = tx.checkout?.url || null
    return url ? { checkoutUrl: url, error: null } : { checkoutUrl: null, error: "Paddle did not return a checkout URL" }
  } catch (e: unknown) {
    return {
      checkoutUrl: null,
      error: e instanceof Error ? e.message : "Paddle checkout failed",
    }
  }
}

export async function getPaddleSubscription(
  paddleSubscriptionId: string,
): Promise<{ data: unknown; error: string | null }> {
  const paddle = paddleClient()
  if (!paddle) return { data: null, error: "Paddle not configured" }
  try {
    const sub = await paddle.subscriptions.get(paddleSubscriptionId)
    return { data: sub, error: null }
  } catch (e: unknown) {
    return { data: null, error: e instanceof Error ? e.message : "Failed to fetch subscription" }
  }
}

export async function cancelPaddleSubscription(
  paddleSubscriptionId: string,
): Promise<{ success: boolean; error: string | null }> {
  const paddle = paddleClient()
  if (!paddle) return { success: false, error: "Paddle not configured" }
  try {
    await paddle.subscriptions.cancel(paddleSubscriptionId, {
      effectiveFrom: "next_billing_period",
    })
    return { success: true, error: null }
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Cancel failed" }
  }
}

export async function changePaddlePlan(params: {
  paddleSubscriptionId: string
  newTier: PlanTier
  newBillingCycle: "monthly" | "annual"
}): Promise<{ success: boolean; error: string | null }> {
  const paddle = paddleClient()
  if (!paddle) return { success: false, error: "Paddle not configured" }
  const priceId = priceIdForTier(params.newTier, params.newBillingCycle)
  if (!priceId) {
    return { success: false, error: "Missing Paddle price ID for target plan" }
  }
  try {
    await paddle.subscriptions.update(params.paddleSubscriptionId, {
      items: [{ priceId, quantity: 1 }],
      prorationBillingMode: "prorated_immediately",
    })
    return { success: true, error: null }
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Plan change failed" }
  }
}

function paddleRestBase(): string {
  return String(process.env.PADDLE_ENVIRONMENT || "sandbox").toLowerCase() === "production"
    ? "https://api.paddle.com"
    : "https://sandbox-api.paddle.com"
}

function firstPortalUrlFromPayload(data: unknown): string | null {
  if (!data || typeof data !== "object") return null
  const urls = (data as { urls?: unknown }).urls
  if (!urls || typeof urls !== "object") return null
  const u = urls as Record<string, unknown>
  const general = u.general
  if (typeof general === "string" && general.startsWith("http")) return general
  if (general && typeof general === "object") {
    for (const v of Object.values(general as Record<string, unknown>)) {
      if (typeof v === "string" && v.startsWith("http")) return v
    }
  }
  const subs = u.subscriptions
  if (Array.isArray(subs)) {
    for (const item of subs) {
      if (item && typeof item === "object") {
        for (const v of Object.values(item as Record<string, unknown>)) {
          if (typeof v === "string" && v.startsWith("http")) return v
        }
      }
    }
  }
  return null
}

/** Authenticated Paddle customer portal URL (short-lived). */
export async function createPaddleCustomerPortalSession(params: {
  customerId: string
  subscriptionIds?: string[]
}): Promise<{ portalUrl: string | null; error: string | null }> {
  const apiKey = String(process.env.PADDLE_API_KEY || "").trim()
  if (!apiKey) {
    return { portalUrl: null, error: "Paddle billing is not configured. Set PADDLE_API_KEY." }
  }
  const base = paddleRestBase()
  try {
    const body: { subscription_ids?: string[] } = {}
    if (params.subscriptionIds?.length) {
      body.subscription_ids = params.subscriptionIds
    }
    const res = await fetch(`${base}/customers/${encodeURIComponent(params.customerId)}/portal-sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
    const json = (await res.json()) as {
      data?: unknown
      error?: { detail?: string; message?: string }
    }
    if (!res.ok) {
      const msg = json?.error?.detail || json?.error?.message || `HTTP ${res.status}`
      return { portalUrl: null, error: typeof msg === "string" ? msg : "Portal session failed" }
    }
    const url = firstPortalUrlFromPayload(json.data)
    return url ? { portalUrl: url, error: null } : { portalUrl: null, error: "Paddle did not return a portal URL" }
  } catch (e: unknown) {
    return { portalUrl: null, error: e instanceof Error ? e.message : "Portal session failed" }
  }
}
