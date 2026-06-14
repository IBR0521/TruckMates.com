import { describe, expect, it } from "vitest"
import {
  isValidEmailAddress,
  resolveCustomerEmail,
  resolveCustomerEmailFromSources,
} from "../../lib/customer-email"

describe("lib/customer-email.ts", () => {
  it("prefers main customer email", () => {
    expect(
      resolveCustomerEmail({
        email: "billing@acme.com",
        primary_contact_email: "ops@acme.com",
      }),
    ).toBe("billing@acme.com")
  })

  it("falls back to primary contact email", () => {
    expect(
      resolveCustomerEmail({
        email: "",
        primary_contact_email: "ops@acme.com",
      }),
    ).toBe("ops@acme.com")
  })

  it("never treats company name as email", () => {
    expect(resolveCustomerEmailFromSources(["Acme Logistics LLC"])).toBeNull()
    expect(isValidEmailAddress("Acme Logistics LLC")).toBe(false)
  })

  it("rejects invalid addresses", () => {
    expect(isValidEmailAddress("not-an-email")).toBe(false)
    expect(isValidEmailAddress("@domain.com")).toBe(false)
  })
})
