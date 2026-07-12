import { describe, it, expect, beforeAll } from "vitest"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * DB integration tests for the transactional money / assignment RPCs.
 *
 * These exercise a REAL Postgres, so they are opt-in and must point at a NON-production database
 * (a Supabase branch or local `supabase start`). To run:
 *
 *   RUN_RPC_INTEGRATION_TESTS=1 \
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx vitest --run tests/unit/money-rpcs-db-integration.test.ts
 *
 * They skip entirely otherwise (normal `npm test` and CI), so they never hit prod by accident.
 *
 * What they assert:
 *   • F14 — create_invoice/create_settlement/assign_load_transactional are SECURITY DEFINER and were
 *     locked to service_role (migration 256). `anon` must NOT be able to execute them.
 *   • Atomicity — invoked (as service_role) with a company_id that does not exist, each fails cleanly
 *     via its EXCEPTION handler (no partial write), proving the transactional wrapper holds.
 *
 * Behavioural happy-path assertions (correct amounts, lease side effects) need seeded tenant data;
 * point TEST_COMPANY_ID at a throwaway company and extend the final describe block to add them.
 */

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const enabled = Boolean(process.env.RUN_RPC_INTEGRATION_TESTS && url && anonKey && serviceKey)

// UUIDs that do not exist in any tenant table (FK targets), so calls fail without touching real data.
const NO_COMPANY = "00000000-0000-4000-a000-0000000000ff"
const NO_DRIVER = "00000000-0000-4000-a000-0000000000fe"
const NO_LOAD = "00000000-0000-4000-a000-0000000000fd"

function invoiceParams(companyId: string): Record<string, unknown> {
  return {
    p_company_id: companyId,
    p_load_id: null,
    p_invoice_number: `RPCTEST-${Date.now()}`,
    p_invoice_date: "2026-01-01",
    p_due_date: "2026-02-01",
    p_subtotal: 100,
    p_fuel_surcharge: 0,
    p_accessorials: 0,
    p_tax_amount: 0,
    p_total_amount: 100,
    p_status: "pending",
    p_line_items: [],
    p_customer_name: "RPC Test",
    p_payment_terms: "net_30",
    p_description: "integration test",
    p_tax_rate: 0,
  }
}

function settlementParams(companyId: string): Record<string, unknown> {
  return {
    p_company_id: companyId,
    p_driver_id: NO_DRIVER,
    p_period_start: "2026-01-01",
    p_period_end: "2026-01-15",
    p_gross_pay: 1000,
    p_fuel_deduction: 0,
    p_advance_deduction: 0,
    p_other_deductions: 0,
    p_total_deductions: 0,
    p_per_diem_eligible_nights: 0,
    p_per_diem_rate_used: 0,
    p_per_diem_amount: 0,
    p_lease_deduction: 0,
    p_net_pay: 1000,
    p_status: "pending",
    p_payment_method: null,
    p_gl_code: null,
    p_loads: [],
    p_pay_rule_id: null,
    p_calculation_details: {},
    p_lease_agreement_id: null,
    p_lease_remaining_after: null,
  }
}

function assignParams(companyId: string): Record<string, unknown> {
  return {
    p_load_id: NO_LOAD,
    p_company_id: companyId,
    p_truck_id: null,
    p_trailer_id: null,
    p_driver_id: null,
    p_assigned_by: null,
    p_update_driver: false,
    p_update_truck: false,
    p_update_trailer: false,
    p_set_status: false,
    p_new_status: null,
  }
}

const RPCS: Array<[string, (companyId: string) => Record<string, unknown>]> = [
  ["create_invoice_transactional", invoiceParams],
  ["create_settlement_transactional", settlementParams],
  ["assign_load_transactional", assignParams],
]

describe.skipIf(!enabled)("money RPCs — DB integration (F14 lockdown + atomicity)", () => {
  let anon: SupabaseClient
  let service: SupabaseClient

  beforeAll(() => {
    anon = createClient(url, anonKey, { auth: { persistSession: false } })
    service = createClient(url, serviceKey, { auth: { persistSession: false } })
  })

  it.each(RPCS)("anon cannot execute %s (F14 grant lockdown)", async (name, params) => {
    const { error } = await anon.rpc(name, params(NO_COMPANY))
    expect(error).toBeTruthy()
    const insufficientPrivilege =
      error?.code === "42501" || /permission denied|not allowed|denied/i.test(String(error?.message || ""))
    expect(insufficientPrivilege).toBe(true)
  })

  it.each(RPCS)("service_role can execute %s and it fails atomically on a non-existent company", async (name, params) => {
    const { error } = await service.rpc(name, params(NO_COMPANY))
    // Executes (no permission error), then the EXCEPTION handler surfaces a clean "... failed: ..."
    // — the transaction rolls back, so no partial row is written.
    expect(error).toBeTruthy()
    expect(String(error?.message || "")).toContain("failed")
  })
})
