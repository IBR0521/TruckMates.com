import { beforeEach, describe, expect, it, vi, type Mock } from "vitest"

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

/** Minimal chain for getStripeClient + executeSettlementAchTransfer when Stripe env is unset. */
function createSupabaseSettlementMock(driver: { id: string; stripe_account_id: string | null } | null) {
  return {
    from: vi.fn((table: string) => {
      if (table === "company_integrations") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: null, error: null })),
            })),
          })),
        }
      }
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
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: null, error: null })),
            })),
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          })),
        })),
      }
    }),
  }
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}))

vi.mock("@/lib/auth/server", () => ({
  getCachedAuthContext: () => mockGetCachedAuthContext(),
}))

vi.mock("@/lib/error-message", () => ({
  errorMessage: (e: unknown, fallback = "error") => (e instanceof Error ? e.message : fallback),
}))

vi.mock("@/lib/roles", () => ({
  mapLegacyRole: (role: string) => role,
}))

vi.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}))

vi.mock("stripe", () => ({
  default: class StripeMock {
    transfers = mockStripeClient.transfers
    payouts = mockStripeClient.payouts
    constructor(_secretKey: string) {}
  },
}))

describe("app/actions/settlement-ach.ts", () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    delete process.env.STRIPE_SECRET_KEY

    mockGetCachedAuthContext.mockResolvedValue({
      companyId: "c1",
      userId: "u1",
      error: null,
      user: { role: "driver", id: "u1" },
    })

    const { createClient } = await import("@/lib/supabase/server")
    const supabaseMock = createSupabaseSettlementMock({
      id: "d1",
      stripe_account_id: null,
    })
    ;(createClient as unknown as Mock).mockResolvedValue(supabaseMock)
  })

  it("returns structured error when Stripe is not configured (ACH disabled)", async () => {
    const { executeSettlementAchTransfer } = await import("../../app/actions/settlement-ach")
    const result = await executeSettlementAchTransfer({
      settlementId: "set_1",
      driverId: "d1",
      amount: 125.5,
    })

    expect(result.data).toBeNull()
    expect(result.error).toMatch(/Automated ACH transfers are not currently available/i)
    expect(mockStripeClient.transfers.create).not.toHaveBeenCalled()
    expect(mockStripeClient.payouts.create).not.toHaveBeenCalled()
  })

  it("mentions manual bank payment when ACH is unavailable", async () => {
    const { executeSettlementAchTransfer } = await import("../../app/actions/settlement-ach")
    const result = await executeSettlementAchTransfer({
      settlementId: "set_2",
      driverId: "d1",
      amount: 50,
    })

    expect(result.data).toBeNull()
    expect(result.error).toMatch(/process payment through your bank/i)
    expect(mockStripeClient.transfers.create).not.toHaveBeenCalled()
  })
})
