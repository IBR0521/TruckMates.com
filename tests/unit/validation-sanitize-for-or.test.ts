import { describe, it, expect } from "vitest"
import { sanitizeForOr } from "@/lib/validation"

/**
 * F13 regression: search terms are interpolated into PostgREST `.or("col.ilike.%<term>%")` strings.
 * sanitizeForOr must strip the metacharacters that let a term break out of the OR group so it cannot
 * inject an extra condition. (RLS is the real tenant backstop; this closes within-tenant manipulation.)
 */
describe("sanitizeForOr — PostgREST .or() filter-injection guard (F13)", () => {
  it("passes ordinary search terms through unchanged", () => {
    expect(sanitizeForOr("Acme Trucking")).toBe("Acme Trucking")
    expect(sanitizeForOr("INV-2024-001")).toBe("INV-2024-001")
  })

  it("strips the structural characters that delimit .or() conditions", () => {
    expect(sanitizeForOr("a,b(c)")).toBe("abc")
  })

  it("removes embedded PostgREST operator tokens", () => {
    expect(sanitizeForOr("x.eq.y")).not.toContain(".eq")
    expect(sanitizeForOr("foo.ilike.bar")).not.toContain(".ilike")
  })

  it("strips % so the caller alone controls the ilike wildcards", () => {
    expect(sanitizeForOr("50%")).toBe("50")
  })

  it("neutralizes a filter break-out attempt", () => {
    const cleaned = sanitizeForOr("x%,company_id.eq.00000000-0000-0000-0000-000000000000")
    expect(cleaned).not.toContain(",")
    expect(cleaned).not.toContain("%")
    expect(cleaned).not.toContain(".eq")
  })

  it("caps length at 200 characters", () => {
    expect(sanitizeForOr("a".repeat(500))).toHaveLength(200)
  })

  it("treats null / undefined / whitespace as empty", () => {
    expect(sanitizeForOr(null)).toBe("")
    expect(sanitizeForOr(undefined)).toBe("")
    expect(sanitizeForOr("   ")).toBe("")
  })
})
