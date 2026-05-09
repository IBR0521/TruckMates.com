import { beforeEach, describe, expect, it, vi, type Mock } from "vitest"

const mockGetCachedAuthContext = vi.fn()
const mockCheckCreatePermission = vi.fn()
const mockRevalidatePath = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}))
vi.mock("@/lib/auth/server", () => ({
  getCachedAuthContext: () => mockGetCachedAuthContext(),
}))
vi.mock("@/lib/server-permissions", () => ({
  checkCreatePermission: () => mockCheckCreatePermission(),
}))
vi.mock("@/lib/error-message", () => ({
  errorMessage: (e: unknown) => (e instanceof Error ? e.message : "error"),
}))
vi.mock("@/app/actions/accounting", () => ({
  createInvoice: vi.fn(),
}))
vi.mock("@sentry/nextjs", () => ({
  default: {},
  captureException: vi.fn(),
}))
vi.mock("next/cache", () => ({
  revalidatePath: (p: string) => mockRevalidatePath(p),
}))

type LoadRecord = Record<string, unknown>
type InvoiceRecord = Record<string, unknown>
type CustomerRecord = Record<string, unknown>
type UpdatePayload = Record<string, unknown>

function makeSupabaseForInvoices(input: {
  loads: LoadRecord[]
  existingInvoices?: InvoiceRecord[]
  customers?: CustomerRecord[]
  insertedInvoices?: InvoiceRecord[]
}) {
  const insertedPayloads: Record<string, unknown>[] = []
  const updates: UpdatePayload[] = []

  const buildThenable = (result: { data: unknown; error: unknown }) => ({
    eq: () => buildThenable(result),
    is: () => buildThenable(result),
    not: () => buildThenable(result),
    in: () => buildThenable(result),
    select: () => buildThenable(result),
    update: (payload: UpdatePayload) => {
      updates.push(payload)
      return { eq: vi.fn(async () => ({ data: null, error: null })) }
    },
    insert: (payload: Array<Record<string, unknown>>) => {
      insertedPayloads.push(...payload)
      return {
        select: vi.fn(async () => ({
          data:
            input.insertedInvoices ||
            payload.map((row, idx) => ({
              id: `inv-${idx + 1}`,
              load_id: row.load_id,
            })),
          error: null,
        })),
      }
    },
    then: (resolve: (value: { data: unknown; error: unknown }) => unknown) => resolve(result),
  })

  const from = vi.fn((table: string) => {
    if (table === "loads") return buildThenable({ data: input.loads, error: null })
    if (table === "invoices")
      return buildThenable({ data: input.existingInvoices || [], error: null })
    if (table === "customers") return buildThenable({ data: input.customers || [], error: null })
    return buildThenable({ data: [], error: null })
  })

  return { from, insertedPayloads, updates }
}

describe("app/actions/invoices-auto.ts", () => {
  beforeEach(() => {
    vi.resetModules()
    mockGetCachedAuthContext.mockResolvedValue({ companyId: "c1", userId: "u1", error: null })
    mockCheckCreatePermission.mockResolvedValue({ allowed: true, error: null })
  })

  it("uses total_revenue (line items + accessorial + surcharge - discounts) as invoice amount", async () => {
    const expectedTotal = 1200 + 150 + 80 - 100
    const { createClient } = await import("@/lib/supabase/server")
    const supabase = makeSupabaseForInvoices({
      loads: [
        {
          id: "l1",
          shipment_number: "SHP-1",
          company_name: "Acme",
          value: 1000,
          total_revenue: expectedTotal,
          estimated_revenue: 0,
          customer_id: "cust-1",
          status: "delivered",
          load_date: "2026-05-01",
        },
      ],
      customers: [{ id: "cust-1", company_name: "Acme Corp", name: "Acme" }],
    })
    ;(createClient as unknown as Mock).mockResolvedValue(supabase)

    const { autoGenerateInvoicesFromLoads } = await import("../../app/actions/invoices-auto")
    const result = await autoGenerateInvoicesFromLoads()

    expect(result.error).toBeNull()
    expect(result.data?.generated).toBe(1)
    expect(supabase.insertedPayloads[0].amount).toBe(expectedTotal)
  })

  it("falls back to estimated_revenue then value when total_revenue missing", async () => {
    const { createClient } = await import("@/lib/supabase/server")
    const supabase = makeSupabaseForInvoices({
      loads: [
        {
          id: "l2",
          shipment_number: "SHP-2",
          company_name: "Beta",
          value: 500,
          total_revenue: null,
          estimated_revenue: 900,
          customer_id: null,
          status: "delivered",
          load_date: "2026-05-01",
        },
      ],
    })
    ;(createClient as unknown as Mock).mockResolvedValue(supabase)

    const { autoGenerateInvoicesFromLoads } = await import("../../app/actions/invoices-auto")
    const result = await autoGenerateInvoicesFromLoads()

    expect(result.error).toBeNull()
    expect(supabase.insertedPayloads[0].amount).toBe(900)
  })

  it("skips invoice creation when computed amount is <= 0 (e.g., heavy discount)", async () => {
    const { createClient } = await import("@/lib/supabase/server")
    const supabase = makeSupabaseForInvoices({
      loads: [
        {
          id: "l3",
          shipment_number: "SHP-3",
          company_name: "Gamma",
          value: 0,
          total_revenue: 0,
          estimated_revenue: 0,
          customer_id: null,
          status: "delivered",
          load_date: "2026-05-01",
        },
      ],
    })
    ;(createClient as unknown as Mock).mockResolvedValue(supabase)

    const { autoGenerateInvoicesFromLoads } = await import("../../app/actions/invoices-auto")
    const result = await autoGenerateInvoicesFromLoads()

    expect(result.error).toBeNull()
    expect(result.data?.generated).toBe(0)
    expect(result.data?.errors[0].error).toMatch(/no revenue value/i)
  })
})
