import "server-only"

import { Paddle, Environment } from "@paddle/paddle-node-sdk"
import { createAdminClient } from "@/lib/supabase/admin"
import type { PlanTier } from "@/lib/plan-limits"

function paddleSDK(): Paddle | null {
  const apiKey = String(process.env.PADDLE_API_KEY || "").trim()
  if (!apiKey) return null
  const env =
    String(process.env.PADDLE_ENVIRONMENT || "sandbox").toLowerCase() === "production"
      ? Environment.production
      : Environment.sandbox
  return new Paddle(apiKey, { environment: env })
}

export function getPaddlePriceId(tier: PlanTier, billingCycle: "monthly" | "annual"): string | null {
  const cycle = billingCycle === "annual" ? "ANNUAL" : "MONTHLY"
  const tierKey = String(tier).toUpperCase()
  const envKey = `PADDLE_PRICE_${tierKey}_${cycle}`
  const v = process.env[envKey]
  if (v && String(v).trim()) return String(v).trim()
  const fallback = process.env[`PADDLE_PRICE_${tier}_${billingCycle}`]
  return fallback && String(fallback).trim() ? String(fallback).trim() : null
}

export async function getOrCreatePaddleCustomer(companyId: string): Promise<{
  customerId: string | null
  customerEmail: string | null
  error: string | null
}> {
  const paddle = paddleSDK()
  if (!paddle) {
    return { customerId: null, customerEmail: null, error: "Paddle not configured" }
  }

  const admin = createAdminClient()

  const { data: company } = await admin
    .from("companies")
    .select("id, name, paddle_customer_id")
    .eq("id", companyId)
    .maybeSingle()

  const companyRow = company as {
    id?: string
    name?: string | null
    paddle_customer_id?: string | null
  } | null

  if (!companyRow?.id) {
    return { customerId: null, customerEmail: null, error: "Company not found" }
  }

  const { data: userRow } = await admin
    .from("users")
    .select("email")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  const email = String((userRow as { email?: string } | null)?.email || "").trim()

  if (companyRow.paddle_customer_id) {
    return {
      customerId: companyRow.paddle_customer_id,
      customerEmail: email || null,
      error: null,
    }
  }

  try {
    const customer = await paddle.customers.create({
      email: email || `company-${companyId}@placeholder.truckmates.invalid`,
      name: companyRow.name || undefined,
      customData: { company_id: companyId },
    })

    const { error: saveErr } = await admin
      .from("companies")
      .update({ paddle_customer_id: customer.id })
      .eq("id", companyId)

    if (saveErr) {
      return {
        customerId: null,
        customerEmail: null,
        error: `Paddle customer created but failed to save on company: ${saveErr.message}`,
      }
    }

    return {
      customerId: customer.id,
      customerEmail: email || null,
      error: null,
    }
  } catch (e: unknown) {
    return {
      customerId: null,
      customerEmail: null,
      error: e instanceof Error ? e.message : "Failed to create Paddle customer",
    }
  }
}
