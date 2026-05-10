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

  it("returns structured error — ACH automation disabled (manual bank + mark paid)", async () => {
    const { executeSettlementAchTransfer } = await import("../../app/actions/settlement-ach")
    const result = await executeSettlementAchTransfer({
      settlementId: "set_1",
      driverId: "d1",
      amount: 125.5,
    })

    expect(result.data).toBeNull()
    expect(result.error).toMatch(/Automated ACH transfers are not currently supported/i)
    expect(mockStripeClient.transfers.create).not.toHaveBeenCalled()
    expect(mockStripeClient.payouts.create).not.toHaveBeenCalled()
  })

  it("does not call Stripe for ACH when automation is disabled", async () => {
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

