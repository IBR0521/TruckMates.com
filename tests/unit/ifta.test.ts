import { beforeEach, describe, expect, it, vi, type Mock } from "vitest"

const mockGetCachedAuthContext = vi.fn()
const mockCheckCreatePermission = vi.fn()
const mockRevalidatePath = vi.fn()

type QueryResult = { data?: unknown; error?: unknown; count?: number }
type QueryChain = {
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  in: ReturnType<typeof vi.fn>
  gte: ReturnType<typeof vi.fn>
  lte: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  is: ReturnType<typeof vi.fn>
  not: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
  then: (resolve: (result: QueryResult) => unknown) => unknown
}
type IftaStateBreakdownRow = { state_code: string; taxRate?: number; fuel?: number }
type IftaReportInsertPayload = {
  state_breakdown: IftaStateBreakdownRow[]
  total_miles?: number
  tax_owed?: number
}

function makeSupabaseMock(resultsByTable: Record<string, QueryResult>) {
  const tableChains = new Map<string, QueryChain>()
  const from = vi.fn((table: string) => {
    if (tableChains.has(table)) return tableChains.get(table)
    const result = resultsByTable[table] || { data: null, error: null }
    const chain = {} as QueryChain
    chain.select = vi.fn(() => chain)
    chain.eq = vi.fn(() => chain)
    chain.in = vi.fn(() => chain)
    chain.gte = vi.fn(() => chain)
    chain.lte = vi.fn(() => chain)
    chain.order = vi.fn(() => chain)
    chain.is = vi.fn(() => chain)
    chain.not = vi.fn(() => chain)
    chain.delete = vi.fn(() => chain)
    chain.insert = vi.fn(() => chain)
    chain.single = vi.fn(async () => result)
    chain.maybeSingle = vi.fn(async () => result)
    chain.then = (resolve) => resolve(result)
    tableChains.set(table, chain)
    return chain
  })
  return { from, tableChains }
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}))
vi.mock("@/lib/auth/server", () => ({
  getCachedAuthContext: () => mockGetCachedAuthContext(),
}))
vi.mock("@/lib/server-permissions", () => ({
  checkCreatePermission: () => mockCheckCreatePermission(),
  checkDeletePermission: vi.fn(async () => ({ allowed: true, error: null })),
}))
vi.mock("@/lib/error-message", () => ({
  errorMessage: (e: unknown) => (e instanceof Error ? e.message : "error"),
  sanitizeError: (e: unknown) => (e instanceof Error ? e.message : "error"),
}))
vi.mock("../../app/actions/eld", () => ({
  getELDMileageData: vi.fn(async () => ({ data: { totalMiles: 0 }, error: null })),
}))
vi.mock("@/lib/fuel-tax-rates", () => ({
  STATE_FUEL_TAX_RATES: { TX: 0.2, OK: 0.25 },
  getFuelTaxRate: (state: string, fallback = 0.25) => {
    const ratesByState: Record<string, number> = { TX: 0.2, OK: 0.25 }
    return ratesByState[state] ?? fallback
  },
}))
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
    ;(createClient as unknown as Mock).mockResolvedValue(supabase)

    const { createIFTAReport } = await import("../../app/actions/ifta")
    const result = await createIFTAReport({
      quarter: "Q2",
      year: 2026,
      truck_ids: ["t1"],
      include_eld: true,
    })

    expect(result.error).toBeNull()
    expect(result.data).toBeTruthy()
    const insertMock = supabase.tableChains.get("ifta_reports")?.insert
    const insertCall = (insertMock?.mock.calls[0]?.[0] ?? {}) as IftaReportInsertPayload
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
    ;(createClient as unknown as Mock).mockResolvedValue(supabase)

    const { createIFTAReport } = await import("../../app/actions/ifta")
    const result = await createIFTAReport({
      quarter: "Q3",
      year: 2026,
      truck_ids: ["t1"],
      include_eld: false,
    })

    expect(result.error).toBeNull()
    const insertMock = supabase.tableChains.get("ifta_reports")?.insert
    const insertCall = (insertMock?.mock.calls[0]?.[0] ?? {}) as IftaReportInsertPayload
    const tx = insertCall.state_breakdown.find((s) => s.state_code === "TX")
    const ok = insertCall.state_breakdown.find((s) => s.state_code === "OK")
    expect(tx).toBeDefined()
    expect(ok).toBeDefined()
    expect(tx?.taxRate).toBe(0.2)
    expect(ok?.taxRate).toBe(0.25)
    expect(insertCall.tax_owed).toBeGreaterThan(0)
  })

  it("reconciles fuel purchases from DB + trip sheets", async () => {
    const { createClient } = await import("@/lib/supabase/server")
    const supabase = makeSupabaseMock({
      trucks: { data: [{ id: "t1" }], error: null },
      fuel_purchases: { data: [{ state: "TX", gallons: 15 }], error: null },
      ifta_reports: { data: { id: "r3" }, error: null },
    })
    ;(createClient as unknown as Mock).mockResolvedValue(supabase)

    const { createIFTAReport } = await import("../../app/actions/ifta")
    const result = await createIFTAReport({
      quarter: "Q1",
      year: 2026,
      truck_ids: ["t1"],
      include_eld: true,
    })

    expect(result.error).toBeNull()
    const insertMock = supabase.tableChains.get("ifta_reports")?.insert
    const insertCall = (insertMock?.mock.calls[0]?.[0] ?? {}) as IftaReportInsertPayload
    const tx = insertCall.state_breakdown.find((s) => s.state_code === "TX")
    expect(tx).toBeDefined()
    expect(tx?.fuel).toBe(35) // 15 DB + 20 trip sheet gallons
  })
})
