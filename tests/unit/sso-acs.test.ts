import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  TEST_COMPANY_ID,
  TEST_EMAIL_DOMAIN,
  applySsoTestEnv,
  buildTestSsoConfig,
  createExpiredSamlResponse,
  createSignedSamlResponse,
  getCachedIdpKeys,
  getCachedSpKeys,
  tamperAssertionContent,
  tamperResponseWrapper,
  type TestKeyMaterial,
} from "./sso-fixtures"

const mockCaptureMessage = vi.fn()
const mockCaptureException = vi.fn()

type PendingRow = { id: string; request_id: string; email_domain: string; created_at: string }
type ConsumedRow = { id: string; assertion_id: string; company_id: string; expires_at: string }

const state = {
  pending: [] as PendingRow[],
  consumed: [] as ConsumedRow[],
  audits: [] as Array<{
    company_id?: string
    details?: Record<string, unknown>
    outcome?: string
    failure_category?: string
  }>,
  ssoConfig: null as ReturnType<typeof buildTestSsoConfig> | null,
}

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

vi.mock("@sentry/nextjs", () => ({
  captureMessage: (...args: unknown[]) => mockCaptureMessage(...args),
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "sso_consumed_assertions") {
        return {
          insert: (row: Omit<ConsumedRow, "id">) => ({
            select: () => ({
              maybeSingle: async () => {
                const exists = state.consumed.some((c) => c.assertion_id === row.assertion_id)
                if (exists) {
                  return { data: null, error: { code: "23505", message: "duplicate" } }
                }
                const inserted = { id: makeId("consumed"), ...row }
                state.consumed.push(inserted)
                return { data: inserted, error: null }
              },
            }),
          }),
          delete: () => ({
            lt: async () => ({ data: [], error: null }),
          }),
        }
      }

      if (table === "audit_logs") {
        return {
          insert: async (row: {
            company_id?: string
            details?: Record<string, unknown>
          }) => {
            state.audits.push({
              company_id: row.company_id,
              details: row.details,
              outcome: row.details?.outcome as string | undefined,
              failure_category: row.details?.failure_category as string | undefined,
            })
            return { error: null }
          },
        }
      }

      return {
        delete: () => ({ lt: async () => ({ error: null }) }),
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
        insert: async () => ({ error: null }),
      }
    },
  }),
}))

vi.mock("@/lib/plan-enforcement", () => ({
  checkFeatureAccess: vi.fn(async () => ({ allowed: true })),
}))

vi.mock("@/lib/sso/idp-config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/sso/idp-config")>()
  return {
    ...actual,
    getActiveSsoConfigByIssuer: vi.fn(async () => state.ssoConfig),
    consumeSsoPendingRequest: vi.fn(async (params: { requestId: string; emailDomain: string }) => {
      const row = state.pending.find(
        (p) => p.request_id === params.requestId && p.email_domain === params.emailDomain,
      )
      if (!row) return false
      state.pending = state.pending.filter((p) => p.id !== row.id)
      return true
    }),
    purgeExpiredSsoPendingRequests: vi.fn(async () => undefined),
  }
})

vi.mock("@/lib/sso/provision-user", () => ({
  provisionSsoUserAndCreateSession: vi.fn(async () => ({
    ok: true,
    email: `user@${TEST_EMAIL_DOMAIN}`,
    magicLinkUrl: "http://localhost:3000/auth/sso-callback?code=test",
  })),
}))

function latestAuditFailureCategory(): string | null {
  const row = [...state.audits].reverse().find((a) => a.details?.outcome === "failure")
  return (row?.details?.failure_category as string | undefined) ?? null
}

function seedPendingRequest(requestId: string) {
  state.pending.push({
    id: makeId("pending"),
    request_id: requestId,
    email_domain: TEST_EMAIL_DOMAIN,
    created_at: new Date().toISOString(),
  })
}

describe("handleSsoAcsPost negative paths", () => {
  let spKeys: TestKeyMaterial
  let idpKeys: TestKeyMaterial

  beforeEach(() => {
    vi.clearAllMocks()
    state.pending = []
    state.consumed = []
    state.audits = []
    spKeys = getCachedSpKeys()
    idpKeys = getCachedIdpKeys()
    applySsoTestEnv(spKeys)
    state.ssoConfig = buildTestSsoConfig(idpKeys)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  async function runAcs(samlResponse: string, requestId: string) {
    seedPendingRequest(requestId)
    const { handleSsoAcsPost } = await import("@/lib/sso/acs-handler")
    return handleSsoAcsPost(samlResponse, null, {
      ipAddress: "203.0.113.10",
      userAgent: "vitest",
    })
  }

  it("rejects tampered assertion content (signature_invalid)", async () => {
    const signed = await createSignedSamlResponse({ sp: spKeys, idp: idpKeys })
    const tampered = tamperAssertionContent(signed.samlResponse)
    const response = await runAcs(tampered, signed.requestId)

    expect(response.status).toBeGreaterThanOrEqual(300)
    expect(response.status).toBeLessThan(400)
    expect(latestAuditFailureCategory()).toBe("signature_invalid")
    expect(mockCaptureMessage).toHaveBeenCalled()
  }, 30_000)

  it("rejects altered Response wrapper (recipient_mismatch / wrapping)", async () => {
    const signed = await createSignedSamlResponse({ sp: spKeys, idp: idpKeys })
    const wrapped = tamperResponseWrapper(signed.samlResponse)
    const response = await runAcs(wrapped, signed.requestId)

    expect(response.status).toBeGreaterThanOrEqual(300)
    expect(response.status).toBeLessThan(400)
    expect(latestAuditFailureCategory()).toBe("recipient_mismatch")
  }, 30_000)

  it("rejects expired NotOnOrAfter", async () => {
    const signed = await createSignedSamlResponse({ sp: spKeys, idp: idpKeys })
    const expired = await createExpiredSamlResponse({
      sp: spKeys,
      idp: idpKeys,
      inResponseTo: signed.requestId,
    })

    const response = await runAcs(expired.samlResponse, expired.requestId)

    expect(response.status).toBeGreaterThanOrEqual(300)
    expect(response.status).toBeLessThan(400)
    expect(latestAuditFailureCategory()).toBe("expired")
  }, 30_000)

  it("rejects audience mismatch against SP entity ID", async () => {
    const signed = await createSignedSamlResponse({
      sp: spKeys,
      idp: idpKeys,
      spEntityId: "http://wrong.example/api/sso/sp",
    })
    const response = await runAcs(signed.samlResponse, signed.requestId)

    expect(response.status).toBeGreaterThanOrEqual(300)
    expect(response.status).toBeLessThan(400)
    expect(latestAuditFailureCategory()).toBe("audience_mismatch")
  }, 30_000)

  it("rejects when InResponseTo has no matching pending request", async () => {
    const signed = await createSignedSamlResponse({ sp: spKeys, idp: idpKeys })
    const { handleSsoAcsPost } = await import("@/lib/sso/acs-handler")
    const response = await handleSsoAcsPost(signed.samlResponse, null, {
      ipAddress: "203.0.113.10",
      userAgent: "vitest",
    })

    expect(response.status).toBeGreaterThanOrEqual(300)
    expect(response.status).toBeLessThan(400)
    expect(latestAuditFailureCategory()).toBe("request_correlation_failed")
  }, 30_000)

  it("rejects replayed assertion_id", async () => {
    const signed = await createSignedSamlResponse({ sp: spKeys, idp: idpKeys })
    state.consumed.push({
      id: makeId("consumed"),
      assertion_id: signed.assertionId,
      company_id: TEST_COMPANY_ID,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    })

    const response = await runAcs(signed.samlResponse, signed.requestId)

    expect(response.status).toBeGreaterThanOrEqual(300)
    expect(response.status).toBeLessThan(400)
    expect(latestAuditFailureCategory()).toBe("replay_detected")
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      "[SSO ACS] replay_detected",
      expect.objectContaining({ level: "error" }),
    )
  }, 30_000)
})

describe("createExpiredSamlResponse helper", () => {
  it("builds assertions with past NotOnOrAfter", async () => {
    const spKeys = getCachedSpKeys()
    const idpKeys = getCachedIdpKeys()
    applySsoTestEnv(spKeys)
    const signed = await createSignedSamlResponse({ sp: spKeys, idp: idpKeys })
    const expired = await createExpiredSamlResponse({
      sp: spKeys,
      idp: idpKeys,
      inResponseTo: signed.requestId,
    })
    expect(expired.xml).toMatch(/NotOnOrAfter=/)
  })
})
