import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAcquireJobLock = vi.fn()
const mockReleaseJobLock = vi.fn()
const mockGeofenceProcessingLockKey = vi.fn((companyId: string) => `geofence-processing:${companyId}`)
const mockProcessGeofenceTelemetryForCompany = vi.fn()

vi.mock("@/lib/cron/job-lock", () => ({
  acquireJobLock: (...args: unknown[]) => mockAcquireJobLock(...args),
  releaseJobLock: (...args: unknown[]) => mockReleaseJobLock(...args),
  geofenceProcessingLockKey: (companyId: string) => mockGeofenceProcessingLockKey(companyId),
}))

vi.mock("@/lib/eld/geofence-detector", () => ({
  processGeofenceTelemetryForCompany: (...args: unknown[]) =>
    mockProcessGeofenceTelemetryForCompany(...args),
}))

vi.mock("@/lib/error-message", () => ({
  errorMessage: (e: unknown) => (e instanceof Error ? e.message : "error"),
}))

describe("app/api/webhooks/eld-telemetry-insert/route.ts", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.ELD_TELEMETRY_WEBHOOK_SECRET = "test-webhook-secret"
    mockAcquireJobLock.mockResolvedValue(true)
    mockReleaseJobLock.mockResolvedValue(undefined)
    mockProcessGeofenceTelemetryForCompany.mockResolvedValue({
      processedPoints: 1,
      error: null,
    })
  })

  it(
    "returns 401 when secret header is missing or wrong",
    async () => {
    const { POST } = await import("../../app/api/webhooks/eld-telemetry-insert/route")

    const missing = await POST(
      new Request("http://localhost/api/webhooks/eld-telemetry-insert", {
        method: "POST",
        body: JSON.stringify({ record: { company_id: "c1" } }),
      }),
    )
    expect(missing.status).toBe(401)

    const wrong = await POST(
      new Request("http://localhost/api/webhooks/eld-telemetry-insert", {
        method: "POST",
        headers: { "x-eld-telemetry-webhook-secret": "wrong" },
        body: JSON.stringify({ record: { company_id: "c1" } }),
      }),
    )
    expect(wrong.status).toBe(401)
  },
    30_000,
  )

  it("returns 400 when company_id is missing from record", async () => {
    const { POST } = await import("../../app/api/webhooks/eld-telemetry-insert/route")
    const response = await POST(
      new Request("http://localhost/api/webhooks/eld-telemetry-insert", {
        method: "POST",
        headers: { "x-eld-telemetry-webhook-secret": "test-webhook-secret" },
        body: JSON.stringify({ type: "INSERT", record: {} }),
      }),
    )
    expect(response.status).toBe(400)
  })

  it("returns 200 skipped when per-company lock is held", async () => {
    mockAcquireJobLock.mockResolvedValue(false)
    const { POST } = await import("../../app/api/webhooks/eld-telemetry-insert/route")
    const response = await POST(
      new Request("http://localhost/api/webhooks/eld-telemetry-insert", {
        method: "POST",
        headers: { "x-eld-telemetry-webhook-secret": "test-webhook-secret" },
        body: JSON.stringify({
          type: "INSERT",
          table: "eld_telemetry_points",
          record: { company_id: "company-abc" },
        }),
      }),
    )
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json).toMatchObject({ ok: true, skipped: true, reason: "lock_held" })
    expect(mockProcessGeofenceTelemetryForCompany).not.toHaveBeenCalled()
  })

  it("processes geofences and releases lock on success", async () => {
    const { POST } = await import("../../app/api/webhooks/eld-telemetry-insert/route")
    const response = await POST(
      new Request("http://localhost/api/webhooks/eld-telemetry-insert", {
        method: "POST",
        headers: { "x-eld-telemetry-webhook-secret": "test-webhook-secret" },
        body: JSON.stringify({
          type: "INSERT",
          table: "eld_telemetry_points",
          record: { company_id: "company-abc", truck_id: "truck-1" },
        }),
      }),
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({ ok: true, company_id: "company-abc", processed_points: 1 })
    expect(mockGeofenceProcessingLockKey).toHaveBeenCalledWith("company-abc")
    expect(mockAcquireJobLock).toHaveBeenCalledWith("geofence-processing:company-abc", 120)
    expect(mockProcessGeofenceTelemetryForCompany).toHaveBeenCalledWith("company-abc")
    expect(mockReleaseJobLock).toHaveBeenCalledWith("geofence-processing:company-abc")
  })
})
