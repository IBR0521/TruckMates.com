import { beforeEach, describe, expect, it, vi } from "vitest"

const mockGetCachedAuthContext = vi.fn()
const mockCaptureException = vi.fn()

const mockStripeClient = {
  transfers: {
    create: vi.fn(),
  },
  payouts: {
    create: vi.fn(),
  },
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}), { virtual: true })

vi.mock("@/lib/auth/server", () => ({
  getCachedAuthContext: () => mockGetCachedAuthContext(),
}), { virtual: true })

vi.mock("@/lib/error-message", () => ({
  errorMessage: (e: unknown, fallback = "error") => (e instanceof Error ? e.message : fallback),
}), { virtual: true })

vi.mock("@/lib/roles", () => ({
  mapLegacyRole: (role: string) => role,
}), { virtual: true })

vi.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}), { virtual: true })

vi.mock("stripe", () => ({
  default: class StripeMock {
    transfers = mockStripeClient.transfers
    payouts = mockStripeClient.payouts
    constructor(_secretKey: string) {}
  },
}))

function makeSupabaseMock(driver: { id: string; stripe_account_id: string | null } | null) {
  return {
    from: vi.fn((table: string) => {
      if (table === "drivers") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: driver, error: null })),
              })),
            })),
          })),
        }
      }
      if (table === "company_integrations") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: null, error: null })),
            })),
          })),
        }
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          })),
        })),
      }
    }),
  }
}

describe("app/actions/settlement-ach.ts", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.STRIPE_SECRET_KEY = "sk_test_123"
    mockGetCachedAuthContext.mockResolvedValue({ companyId: "c1", userId: "u1", error: null })
  })

  it("executes Stripe transfer + payout for valid ACH settlement", async () => {
    const { createClient } = await import("@/lib/supabase/server")
    ;(createClient as any).mockResolvedValue(makeSupabaseMock({ id: "d1", stripe_account_id: "acct_1" }))

    mockStripeClient.transfers.create.mockResolvedValue({ id: "tr_123" })
    mockStripeClient.payouts.create.mockResolvedValue({
      id: "po_123",
      arrival_date: 1760000000,
    })

    const { executeSettlementAchTransfer } = await import("../../app/actions/settlement-ach")
    const result = await executeSettlementAchTransfer({
      settlementId: "set_1",
      driverId: "d1",
      amount: 125.5,
    })

    expect(result.error).toBeNull()
    expect(result.data?.transferId).toBe("tr_123")
    expect(result.data?.payoutId).toBe("po_123")
    expect(mockStripeClient.transfers.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 12550,
        destination: "acct_1",
      })
    )
    expect(mockStripeClient.payouts.create).toHaveBeenCalled()
  })

  it("rejects ACH transfer when driver has no connected Stripe account", async () => {
    const { createClient } = await import("@/lib/supabase/server")
    ;(createClient as any).mockResolvedValue(makeSupabaseMock({ id: "d1", stripe_account_id: null }))

    const { executeSettlementAchTransfer } = await import("../../app/actions/settlement-ach")
    const result = await executeSettlementAchTransfer({
      settlementId: "set_2",
      driverId: "d1",
      amount: 50,
    })

    expect(result.data).toBeNull()
    expect(result.error).toMatch(/not connected a bank account/i)
    expect(mockStripeClient.transfers.create).not.toHaveBeenCalled()
  })
})

