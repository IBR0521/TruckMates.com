import { beforeEach, describe, expect, it, vi } from "vitest"

const mockHeaders = vi.fn()
const mockCapturePostHogServerEvent = vi.fn()

const mockConstructEvent = vi.fn()

const mockSinglePlanQuery = {
  eq: vi.fn(() => ({
    single: vi.fn(async () => ({ data: { id: "plan_1" } })),
  })),
}
const mockSubscriptionsUpsert = vi.fn(async () => ({ error: null }))

const mockAdminClient = {
  from: vi.fn((table: string) => {
    if (table === "subscription_plans") {
      return {
        select: vi.fn(() => mockSinglePlanQuery),
      }
    }
    if (table === "subscriptions") {
      return {
        upsert: mockSubscriptionsUpsert,
      }
    }
    return {
      update: vi.fn(() => ({
        eq: vi.fn(async () => ({ error: null })),
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({ data: null })),
        })),
      })),
      upsert: vi.fn(async () => ({ error: null })),
    }
  }),
}

vi.mock("stripe", () => ({
  default: class StripeMock {
    webhooks = {
      constructEvent: mockConstructEvent,
    }
    constructor(_secretKey: string) {}
  },
}))

vi.mock("next/headers", () => ({
  headers: () => mockHeaders(),
}), { virtual: true })

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockAdminClient,
}), { virtual: true })

vi.mock("@/lib/analytics/posthog-server", () => ({
  capturePostHogServerEvent: (...args: unknown[]) => mockCapturePostHogServerEvent(...args),
}), { virtual: true })

vi.mock("@/lib/error-message", () => ({
  errorMessage: (e: unknown) => (e instanceof Error ? e.message : "error"),
}), { virtual: true })

describe("app/api/webhooks/stripe/route.ts", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.STRIPE_SECRET_KEY = "sk_test_123"
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_123"
    mockHeaders.mockResolvedValue({
      get: () => "sig_123",
    })
  })

  it("handles customer.subscription.updated and upserts subscription state", async () => {
    mockConstructEvent.mockReturnValue({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_123",
          status: "trialing",
          customer: "cus_123",
          metadata: { company_id: "c1", plan_id: "plan_1" },
          items: { data: [{ price: { id: "price_1" } }] },
          current_period_start: 1760000000,
          current_period_end: 1762600000,
          cancel_at_period_end: false,
          trial_start: null,
          trial_end: null,
          canceled_at: null,
        },
      },
    })

    const { POST } = await import("../../app/api/webhooks/stripe/route")
    const request = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: '{"id":"evt_1"}',
    })
    const response = await POST(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({ received: true })
    expect(mockSubscriptionsUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: "c1",
        plan_id: "plan_1",
        stripe_subscription_id: "sub_123",
        status: "trialing",
      }),
      { onConflict: "company_id" }
    )
    expect(mockCapturePostHogServerEvent).toHaveBeenCalledWith(
      "company:c1",
      "plan_upgraded",
      expect.objectContaining({ plan_id: "plan_1" })
    )
  })
})

