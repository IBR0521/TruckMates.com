import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Single source of truth for the entitlement tier (F8). getCompanyTier must resolve from the live
 * subscription's plan and only fall back to the denormalized companies.subscription_tier column when
 * there is no active/trialing subscription — so a stale column can never over/under-entitle a paid
 * customer.
 */
type QueryResult = { data?: unknown; error?: unknown }

function makeAdminMock(resultsByTable: Record<string, QueryResult>) {
  const from = vi.fn((table: string) => {
    const result = resultsByTable[table] ?? { data: null, error: null }
    const chain: Record<string, unknown> = {}
    chain.select = vi.fn(() => chain)
    chain.eq = vi.fn(() => chain)
    chain.in = vi.fn(() => chain)
    chain.maybeSingle = vi.fn(async () => result)
    return chain
  })
  return { from }
}

let adminMock: ReturnType<typeof makeAdminMock>

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => adminMock,
}))
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import { getCompanyTier } from "@/lib/plan-enforcement"

describe("getCompanyTier — single source of truth (F8 drift)", () => {
  beforeEach(() => vi.clearAllMocks())

  it("derives the tier from the active subscription, ignoring a stale companies column", async () => {
    adminMock = makeAdminMock({
      subscriptions: { data: { subscription_plans: { name: "Professional" } } },
      companies: { data: { subscription_tier: "starter" } }, // stale — must be ignored
    })
    expect(await getCompanyTier("c1")).toBe("professional")
  })

  it("handles the plan join returned as an array (PostgREST embed shape)", async () => {
    adminMock = makeAdminMock({
      subscriptions: { data: { subscription_plans: [{ name: "Fleet" }] } },
      companies: { data: { subscription_tier: "starter" } },
    })
    expect(await getCompanyTier("c1")).toBe("fleet")
  })

  it("falls back to companies.subscription_tier when there is no active subscription", async () => {
    adminMock = makeAdminMock({
      subscriptions: { data: null },
      companies: { data: { subscription_tier: "fleet" } },
    })
    expect(await getCompanyTier("c1")).toBe("fleet")
  })

  it("falls back to the column when the subscription has no resolvable plan", async () => {
    adminMock = makeAdminMock({
      subscriptions: { data: { subscription_plans: null } },
      companies: { data: { subscription_tier: "enterprise" } },
    })
    expect(await getCompanyTier("c1")).toBe("enterprise")
  })

  it("defaults safely when neither source resolves", async () => {
    adminMock = makeAdminMock({ subscriptions: { data: null }, companies: { data: null } })
    expect(await getCompanyTier("c1")).toBe("owner_operator")
  })
})
