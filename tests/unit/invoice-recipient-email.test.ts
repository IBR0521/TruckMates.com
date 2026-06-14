import { describe, expect, it } from "vitest"
import { resolveInvoiceRecipientEmail } from "../../lib/invoice-recipient-email"

function mockSupabase(handlers: {
  load?: Record<string, unknown> | null
  customerById?: Record<string, unknown> | null
  customerByName?: Record<string, unknown> | null
  customerByCompanyName?: Record<string, unknown> | null
  customerCandidates?: Record<string, unknown>[]
  primaryContact?: Record<string, unknown> | null
}) {
  return {
    from(table: string) {
      const chain = {
        select: () => chain,
        eq: (col: string, val: unknown) => {
          chain._filters = [...(chain._filters || []), { col, val }]
          return chain
        },
        ilike: (col: string, val: unknown) => {
          chain._ilike = { col, val }
          return chain
        },
        or: () => chain,
        not: () => chain,
        limit: (n: number) => {
          chain._limit = n
          return chain
        },
        maybeSingle: async () => {
          if (table === "loads") return { data: handlers.load ?? null, error: null }
          if (table === "customers") {
            if (chain._limit && chain._limit > 1) {
              return { data: handlers.customerCandidates ?? null, error: null }
            }
            if (chain._ilike?.col === "name") {
              return { data: handlers.customerByName ?? null, error: null }
            }
            if (chain._ilike?.col === "company_name") {
              return { data: handlers.customerByCompanyName ?? null, error: null }
            }
            return { data: handlers.customerById ?? null, error: null }
          }
          if (table === "contacts") {
            return { data: handlers.primaryContact ?? null, error: null }
          }
          return { data: null, error: null }
        },
        _filters: [] as Array<{ col: string; val: unknown }>,
        _ilike: undefined as undefined | { col: string; val: unknown },
        _limit: undefined as number | undefined,
      }
      return chain
    },
  } as unknown as Parameters<typeof resolveInvoiceRecipientEmail>[0]
}

describe("lib/invoice-recipient-email.ts", () => {
  it("uses explicit override first", async () => {
    const result = await resolveInvoiceRecipientEmail(
      mockSupabase({}),
      "co-1",
      { customer_name: "Dallas, TX" },
      "billing@acme.com",
    )
    expect(result).toEqual({
      email: "billing@acme.com",
      customerId: null,
      source: "override",
    })
  })

  it("uses load consignee contact email", async () => {
    const result = await resolveInvoiceRecipientEmail(
      mockSupabase({
        load: {
          customer_id: null,
          consignee_contact_email: "ops@shipper.com",
          shipper_contact_email: null,
        },
      }),
      "co-1",
      { customer_name: "Dallas, TX", load_id: "load-1" },
    )
    expect(result.email).toBe("ops@shipper.com")
    expect(result.source).toBe("load.consignee_contact_email")
  })

  it("matches CRM customer by invoice customer_name", async () => {
    const result = await resolveInvoiceRecipientEmail(
      mockSupabase({
        customerByName: {
          id: "cust-1",
          name: "American Color, Inc",
          email: "ap@americancolor.com",
          primary_contact_email: null,
        },
      }),
      "co-1",
      { customer_name: "American Color, Inc" },
    )
    expect(result.email).toBe("ap@americancolor.com")
    expect(result.customerId).toBe("cust-1")
    expect(result.source).toBe("invoice.customer_name_match")
  })

  it("never uses customer_name as email", async () => {
    const result = await resolveInvoiceRecipientEmail(
      mockSupabase({}),
      "co-1",
      { customer_name: "American Color, Inc" },
    )
    expect(result.email).toBeNull()
  })
})
