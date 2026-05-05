import { beforeEach, describe, expect, it, vi } from "vitest"

const mockGetCachedAuthContext = vi.fn()
const mockRevalidatePath = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}), { virtual: true })

vi.mock("@/lib/auth/server", () => ({
  getCachedAuthContext: () => mockGetCachedAuthContext(),
}), { virtual: true })

vi.mock("@/lib/error-message", () => ({
  sanitizeError: (e: unknown) => (e instanceof Error ? e.message : "error"),
  errorMessage: (e: unknown, fallback = "error") => (e instanceof Error ? e.message : fallback),
}), { virtual: true })

vi.mock("@/lib/invoice-packet-build", () => ({
  buildInvoicePacketAttachments: vi.fn(async () => ({
    attachments: [{ filename: "invoice.pdf", content: Buffer.from("pdf-bytes") }],
    docLines: ["Invoice PDF"],
    error: null,
  })),
}), { virtual: true })

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}), { virtual: true })

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => mockRevalidatePath(path),
}), { virtual: true })

function makeSupabaseMock() {
  const invoiceUpdates: Array<Record<string, unknown>> = []

  const mock = {
    invoiceUpdates,
    from: vi.fn((table: string) => {
      if (table === "company_settings") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  factoring_auto_submit: true,
                  factoring_include_bol: true,
                  factoring_include_rate_conf: true,
                  factoring_include_pod: true,
                  triumphpay_enabled: true,
                  triumphpay_api_base_url: "https://api.triumph.test",
                  triumphpay_api_key: "key",
                  triumphpay_api_secret: "secret",
                },
                error: null,
              })),
            })),
          })),
        }
      }

      if (table === "invoices") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: "inv_1",
                    invoice_number: "INV-100",
                    customer_name: "Acme",
                    amount: 900,
                    issue_date: "2026-01-01",
                    due_date: "2026-01-30",
                    load_id: "load_1",
                  },
                  error: null,
                })),
              })),
            })),
          })),
          update: vi.fn((payload: Record<string, unknown>) => {
            invoiceUpdates.push(payload)
            return {
              eq: vi.fn(() => ({
                eq: vi.fn(async () => ({ error: null })),
              })),
            }
          }),
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

  return mock
}

describe("app/actions/factoring-api.ts", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockGetCachedAuthContext.mockResolvedValue({ companyId: "c1", userId: "u1", error: null })
  })

  it("submits invoice packet to TriumphPay and marks invoice submitted", async () => {
    const { createClient } = await import("@/lib/supabase/server")
    const supabase = makeSupabaseMock()
    ;(createClient as any).mockResolvedValue(supabase)

    const fetchMock = vi.fn(async () => ({
      status: 201,
      json: async () => ({ id: "tp_1", status: "submitted", reference_number: "REF-1" }),
    }))
    vi.stubGlobal("fetch", fetchMock)

    const { submitInvoiceToTriumphPay } = await import("../../app/actions/factoring-api")
    const result = await submitInvoiceToTriumphPay("inv_1")

    expect(result.error).toBeNull()
    expect(result.data?.submitted).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.triumph.test/invoices",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer key",
          "x-api-secret": "secret",
        }),
      })
    )
    expect(supabase.invoiceUpdates[0]).toEqual(
      expect.objectContaining({
        factoring_provider: "triumphpay",
        factoring_status: "submitted",
      })
    )
  })
})

