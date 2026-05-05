import { beforeEach, describe, expect, it, vi } from "vitest"

const mockGetCachedAuthContext = vi.fn()
const mockCheckCreatePermission = vi.fn()
const mockRevalidatePath = vi.fn()

type QueryResult = { data?: any; error?: any; count?: number }

function makeSupabaseMock(resultsByTable: Record<string, QueryResult>) {
  const tableChains = new Map<string, any>()
  const from = vi.fn((table: string) => {
    if (tableChains.has(table)) return tableChains.get(table)
    const result = resultsByTable[table] || { data: null, error: null }
    const chain: any = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      in: vi.fn(() => chain),
      gte: vi.fn(() => chain),
      lte: vi.fn(() => chain),
      order: vi.fn(() => chain),
      is: vi.fn(() => chain),
      not: vi.fn(() => chain),
      delete: vi.fn(() => chain),
      insert: vi.fn(() => chain),
      single: vi.fn(async () => result),
      maybeSingle: vi.fn(async () => result),
      then: (resolve: any) => resolve(result),
    }
    tableChains.set(table, chain)
    return chain
  })
  return { from, tableChains }
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}), { virtual: true })
vi.mock("@/lib/auth/server", () => ({
  getCachedAuthContext: () => mockGetCachedAuthContext(),
}), { virtual: true })
vi.mock("@/lib/server-permissions", () => ({
  checkCreatePermission: () => mockCheckCreatePermission(),
  checkDeletePermission: vi.fn(async () => ({ allowed: true, error: null })),
}), { virtual: true })
vi.mock("@/lib/error-message", () => ({
  errorMessage: (e: unknown) => (e instanceof Error ? e.message : "error"),
  sanitizeError: (e: unknown) => (e instanceof Error ? e.message : "error"),
}), { virtual: true })
vi.mock("../../app/actions/eld", () => ({
  getELDMileageData: vi.fn(async () => ({ data: { totalMiles: 0 }, error: null })),
}))
vi.mock("@/lib/fuel-tax-rates", () => ({
  STATE_FUEL_TAX_RATES: { TX: 0.2, OK: 0.25 },
  getFuelTaxRate: (state: string, fallback = 0.25) => ({ TX: 0.2, OK: 0.25 } as any)[state] ?? fallback,
}), { virtual: true })
vi.mock("@sentry/nextjs", () => ({
  default: {},
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))
vi.mock("next/cache", () => ({
  revalidatePath: (p: string) => mockRevalidatePath(p),
}))
vi.mock("../../app/actions/ifta-state-crossing", () => ({
  getStateMileageBreakdown: vi.fn(async () => ({
    data: [
      { state_code: "TX", state_name: "Texas", total_miles: 300 },
      { state_code: "OK", state_name: "Oklahoma", total_miles: 200 },
    ],
    error: null,
  })),
}))
vi.mock("../../app/actions/ifta-trip-sheet", () => ({
  getTripSheetAggregatesForIFTA: vi.fn(async () => ({
    data: {
      has_data: true,
      milesByState: { TX: 100, OK: 50 },
      fuelGallonsByState: { TX: 20, OK: 10 },
    },
    error: null,
  })),
}))
vi.mock("../../app/actions/ifta-tax-rates", () => ({
  getIFTATaxRatesForQuarter: vi.fn(async () => ({
    data: { TX: 0.2, OK: 0.25 },
    error: null,
  })),
}))

describe("app/actions/ifta.ts", () => {
  beforeEach(() => {
    vi.resetModules()
    mockGetCachedAuthContext.mockResolvedValue({ companyId: "c1", userId: "u1", error: null })
    mockCheckCreatePermission.mockResolvedValue({ allowed: true, error: null })
  })

  it("allocates multi-state mileage and writes state breakdown", async () => {
    const { createClient } = await import("@/lib/supabase/server")
    const supabase = makeSupabaseMock({
      trucks: { data: [{ id: "t1" }], error: null },
      fuel_purchases: { data: [], error: null },
      ifta_reports: { data: { id: "r1" }, error: null },
    })
    ;(createClient as any).mockResolvedValue(supabase)

    const { createIFTAReport } = await import("../../app/actions/ifta")
    const result = await createIFTAReport({
      quarter: "Q2",
      year: 2026,
      truck_ids: ["t1"],
      include_eld: true,
    })

    expect(result.error).toBeNull()
    expect(result.data).toBeTruthy()
    const insertCall = (supabase.tableChains.get("ifta_reports").insert as any).mock.calls[0]?.[0]
    expect(insertCall.state_breakdown).toHaveLength(2)
    expect(insertCall.total_miles).toBe(650)
  })

  it("applies state tax rates per state in tax calculation", async () => {
    const { createClient } = await import("@/lib/supabase/server")
    const supabase = makeSupabaseMock({
      trucks: { data: [{ id: "t1" }], error: null },
      fuel_purchases: { data: [], error: null },
      ifta_reports: { data: { id: "r2" }, error: null },
    })
    ;(createClient as any).mockResolvedValue(supabase)

    const { createIFTAReport } = await import("../../app/actions/ifta")
    const result = await createIFTAReport({
      quarter: "Q3",
      year: 2026,
      truck_ids: ["t1"],
      include_eld: false,
    })

    expect(result.error).toBeNull()
    const insertCall = (supabase.tableChains.get("ifta_reports").insert as any).mock.calls[0]?.[0]
    const tx = insertCall.state_breakdown.find((s: any) => s.state_code === "TX")
    const ok = insertCall.state_breakdown.find((s: any) => s.state_code === "OK")
    expect(tx.taxRate).toBe(0.2)
    expect(ok.taxRate).toBe(0.25)
    expect(insertCall.tax_owed).toBeGreaterThan(0)
  })

  it("reconciles fuel purchases from DB + trip sheets", async () => {
    const { createClient } = await import("@/lib/supabase/server")
    const supabase = makeSupabaseMock({
      trucks: { data: [{ id: "t1" }], error: null },
      fuel_purchases: { data: [{ state: "TX", gallons: 15 }], error: null },
      ifta_reports: { data: { id: "r3" }, error: null },
    })
    ;(createClient as any).mockResolvedValue(supabase)

    const { createIFTAReport } = await import("../../app/actions/ifta")
    const result = await createIFTAReport({
      quarter: "Q1",
      year: 2026,
      truck_ids: ["t1"],
      include_eld: true,
    })

    expect(result.error).toBeNull()
    const insertCall = (supabase.tableChains.get("ifta_reports").insert as any).mock.calls[0]?.[0]
    const tx = insertCall.state_breakdown.find((s: any) => s.state_code === "TX")
    expect(tx.fuel).toBe(35) // 15 DB + 20 trip sheet gallons
  })
})
