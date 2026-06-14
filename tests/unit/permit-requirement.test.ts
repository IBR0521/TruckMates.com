import { describe, expect, it } from "vitest"
import {
  computePermitRequirement,
  hasValidPermitAttachment,
} from "../../lib/permit-requirement"

describe("lib/permit-requirement.ts", () => {
  describe("computePermitRequirement", () => {
    it("returns not required for standard dimensions", () => {
      expect(
        computePermitRequirement({
          weight: "40000",
          length: 48,
          width: 8,
          height: 12,
          is_oversized: false,
        }),
      ).toEqual({ required: false, reason: null })
    })

    it("flags weight over 80,000 lbs", () => {
      const result = computePermitRequirement({ weight: "85000" })
      expect(result.required).toBe(true)
      expect(result.reason).toMatch(/80,000/)
    })

    it("flags length over 53 ft", () => {
      const result = computePermitRequirement({ length: 60 })
      expect(result.required).toBe(true)
      expect(result.reason).toMatch(/53 ft/)
    })

    it("flags width over 8.5 ft", () => {
      const result = computePermitRequirement({ width: 10 })
      expect(result.required).toBe(true)
      expect(result.reason).toMatch(/8\.5 ft/)
    })

    it("flags height over 13.5 ft", () => {
      const result = computePermitRequirement({ height: 14 })
      expect(result.required).toBe(true)
      expect(result.reason).toMatch(/13\.5 ft/)
    })

    it("flags is_oversized even without dimension triggers", () => {
      const result = computePermitRequirement({ is_oversized: true })
      expect(result.required).toBe(true)
      expect(result.reason).toContain("marked oversized")
    })

    it("prefers weight_kg when provided", () => {
      const result = computePermitRequirement({ weight_kg: 40000 })
      expect(result.required).toBe(true)
    })
  })

  describe("hasValidPermitAttachment", () => {
    it("requires document_id and non-expired date", () => {
      expect(
        hasValidPermitAttachment(
          [{ document_id: "doc-1", expiry_date: "2099-01-01" }],
          "2026-06-13",
        ),
      ).toBe(true)
    })

    it("rejects missing document", () => {
      expect(
        hasValidPermitAttachment([{ document_id: null, expiry_date: "2099-01-01" }], "2026-06-13"),
      ).toBe(false)
    })

    it("rejects expired permit", () => {
      expect(
        hasValidPermitAttachment(
          [{ document_id: "doc-1", expiry_date: "2020-01-01" }],
          "2026-06-13",
        ),
      ).toBe(false)
    })

    it("accepts permit with no expiry date", () => {
      expect(
        hasValidPermitAttachment([{ document_id: "doc-1", expiry_date: null }], "2026-06-13"),
      ).toBe(true)
    })
  })
})
