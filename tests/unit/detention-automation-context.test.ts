import { describe, it, expect, beforeEach, vi } from "vitest"

/**
 * Regression: the autonomous detention_clock action runs from cron, which has no user session.
 * checkAndCreateDetentions must work when given an explicit companyId (service-role client) instead
 * of failing "Not authenticated", and must not re-fire its own detention_clock agent eval.
 */

const h = vi.hoisted(() => ({
  getCachedAuthContext: vi.fn(),
  rpc: vi.fn(),
  runAgentEvaluation: vi.fn(),
  serverCreateClient: vi.fn(),
}))
const { getCachedAuthContext, rpc, runAgentEvaluation, serverCreateClient } = h

vi.mock("@/lib/auth/server", () => ({ getCachedAuthContext: h.getCachedAuthContext }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: h.rpc }) }))
vi.mock("@/lib/supabase/server", () => ({ createClient: h.serverCreateClient }))
vi.mock("@/lib/ai/agent/loop", () => ({ runAgentEvaluation: h.runAgentEvaluation }))
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }))
vi.mock("@/lib/server-permissions", () => ({
  checkViewPermission: vi.fn(),
  checkCreatePermission: vi.fn(),
}))
vi.mock("@/lib/error-message", () => ({
  errorMessage: (e: unknown, f?: string) => (e instanceof Error ? e.message : f || "error"),
}))
vi.mock("@/lib/utils/error", () => ({ safeDbError: (e: unknown) => String(e) }))

import { checkAndCreateDetentions } from "@/app/actions/detention-tracking"

beforeEach(() => {
  vi.clearAllMocks()
  rpc.mockResolvedValue({ data: [], error: null })
  serverCreateClient.mockResolvedValue({ rpc })
})

describe("checkAndCreateDetentions automation context", () => {
  it("runs from cron with a companyId and no user session (does not hit getCachedAuthContext)", async () => {
    const res = await checkAndCreateDetentions({ companyId: "company-1", fireAgentEval: false })
    expect(getCachedAuthContext).not.toHaveBeenCalled()
    expect(res.error).toBeNull()
    expect(rpc).toHaveBeenCalledWith("calculate_active_detention", { p_company_id: "company-1" })
    expect(runAgentEvaluation).not.toHaveBeenCalled()
  })

  it("falls back to the authenticated session when no companyId is passed", async () => {
    getCachedAuthContext.mockResolvedValue({ error: "Not authenticated", companyId: null })
    const res = await checkAndCreateDetentions()
    expect(getCachedAuthContext).toHaveBeenCalled()
    expect(res.error).toBe("Not authenticated")
  })
})
