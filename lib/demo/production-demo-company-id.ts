/**
 * Shared production demo workspace: single company row all anonymous demo viewers use.
 * Must match `supabase/migrations/*_seed_demo_company_data.sql` unless overridden by DEMO_COMPANY_ID.
 */
export const FALLBACK_PRODUCTION_DEMO_COMPANY_ID = "10000000-0000-4000-a000-000000000001" as const

export function getConfiguredProductionDemoCompanyId(): string {
  const trimmed = process.env.DEMO_COMPANY_ID?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : FALLBACK_PRODUCTION_DEMO_COMPANY_ID
}
