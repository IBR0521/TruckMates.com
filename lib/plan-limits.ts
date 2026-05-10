export type PlanTier =
  | "owner_operator"
  | "starter"
  | "professional"
  | "fleet"
  | "enterprise"

export interface PlanLimits {
  price_monthly: number
  price_annual: number
  trucks: number
  trailers: number
  drivers: number
  user_seats: number
  customers: number
  vendors: number
  loads_per_month: number
  sms_per_month: number
  ai_calls_per_month: number
  storage_gb: number
  api_requests_per_day: number
}

export interface PlanFeatures {
  ai_document_extraction: boolean
  ai_dispatch_suggestions: boolean
  ai_morning_briefing: boolean
  ai_conversational: boolean
  ai_autonomous_agent: boolean
  eld_live_integrations: boolean
  ap_vendor_invoicing: boolean
  bank_reconciliation: boolean
  gl_quickbooks_sync: boolean
  factoring_api: boolean
  predictive_maintenance: boolean
  public_api: boolean
  edi_receiving: boolean
  multi_terminal: boolean
  hazmat_module: boolean
  ltl_shipments: boolean
  lease_management: boolean
  permit_management: boolean
  custom_ai_training: boolean
  white_label: boolean
  sso: boolean
  dedicated_account_manager: boolean
  custom_sla: boolean
  phone_support: boolean
  priority_email_support: boolean
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  owner_operator: {
    price_monthly: 49,
    price_annual: 39,
    trucks: 2,
    trailers: 4,
    drivers: 3,
    user_seats: 2,
    customers: 25,
    vendors: 25,
    loads_per_month: 30,
    sms_per_month: 200,
    ai_calls_per_month: 100,
    storage_gb: 2,
    api_requests_per_day: 0,
  },
  starter: {
    price_monthly: 149,
    price_annual: 119,
    trucks: 10,
    trailers: 20,
    drivers: 15,
    user_seats: 5,
    customers: 200,
    vendors: 100,
    loads_per_month: 200,
    sms_per_month: 1500,
    ai_calls_per_month: 800,
    storage_gb: 15,
    api_requests_per_day: 0,
  },
  professional: {
    price_monthly: 399,
    price_annual: 319,
    trucks: 35,
    trailers: 75,
    drivers: 50,
    user_seats: 15,
    customers: 1000,
    vendors: 500,
    loads_per_month: 2000,
    sms_per_month: 8000,
    ai_calls_per_month: 5000,
    storage_gb: 100,
    api_requests_per_day: 2000,
  },
  fleet: {
    price_monthly: 899,
    price_annual: 719,
    trucks: 100,
    trailers: 200,
    drivers: 130,
    user_seats: 35,
    customers: 5000,
    vendors: 2000,
    loads_per_month: 10000,
    sms_per_month: 25000,
    ai_calls_per_month: 20000,
    storage_gb: 500,
    api_requests_per_day: 20000,
  },
  enterprise: {
    price_monthly: -1,
    price_annual: -1,
    trucks: -1,
    trailers: -1,
    drivers: -1,
    user_seats: -1,
    customers: -1,
    vendors: -1,
    loads_per_month: -1,
    sms_per_month: 100000,
    ai_calls_per_month: -1,
    storage_gb: -1,
    api_requests_per_day: 200000,
  },
}

const BASELINE_FALSE: Omit<PlanFeatures, never> = {
  ai_document_extraction: false,
  ai_dispatch_suggestions: false,
  ai_morning_briefing: false,
  ai_conversational: false,
  ai_autonomous_agent: false,
  eld_live_integrations: false,
  ap_vendor_invoicing: false,
  bank_reconciliation: false,
  gl_quickbooks_sync: false,
  factoring_api: false,
  predictive_maintenance: false,
  public_api: false,
  edi_receiving: false,
  multi_terminal: false,
  hazmat_module: false,
  ltl_shipments: false,
  lease_management: false,
  permit_management: false,
  custom_ai_training: false,
  white_label: false,
  sso: false,
  dedicated_account_manager: false,
  custom_sla: false,
  phone_support: false,
  priority_email_support: false,
}

/** Feature gates match published five-tier matrices (Owner-Op → Enterprise). */
export const PLAN_FEATURES: Record<PlanTier, PlanFeatures> = {
  owner_operator: {
    ...BASELINE_FALSE,
  },
  starter: {
    ...BASELINE_FALSE,
    ai_document_extraction: true,
    ai_dispatch_suggestions: true,
    ai_morning_briefing: true,
  },
  professional: {
    ...BASELINE_FALSE,
    ai_document_extraction: true,
    ai_dispatch_suggestions: true,
    ai_morning_briefing: true,
    ai_conversational: true,
    ai_autonomous_agent: true,
    eld_live_integrations: true,
    ap_vendor_invoicing: true,
    bank_reconciliation: true,
    gl_quickbooks_sync: true,
    factoring_api: true,
    predictive_maintenance: true,
    priority_email_support: true,
  },
  fleet: {
    ...BASELINE_FALSE,
    ai_document_extraction: true,
    ai_dispatch_suggestions: true,
    ai_morning_briefing: true,
    ai_conversational: true,
    ai_autonomous_agent: true,
    eld_live_integrations: true,
    ap_vendor_invoicing: true,
    bank_reconciliation: true,
    gl_quickbooks_sync: true,
    factoring_api: true,
    predictive_maintenance: true,
    priority_email_support: true,
    public_api: true,
    edi_receiving: true,
    multi_terminal: true,
    hazmat_module: true,
    ltl_shipments: true,
    lease_management: true,
    permit_management: true,
    phone_support: true,
  },
  enterprise: Object.fromEntries(Object.keys(BASELINE_FALSE).map((k) => [k, true])) as unknown as PlanFeatures,
}

/** Public pricing / upgrade UI order (low → high). */
export const PLAN_TIER_ORDER: PlanTier[] = [
  "owner_operator",
  "starter",
  "professional",
  "fleet",
  "enterprise",
]

const TIER_LABEL: Record<PlanTier, string> = {
  owner_operator: "Owner-Operator",
  starter: "Starter",
  professional: "Professional",
  fleet: "Fleet",
  enterprise: "Enterprise",
}

export function getPlanLimits(tier: PlanTier): PlanLimits {
  return PLAN_LIMITS[tier] ?? PLAN_LIMITS.starter
}

export function getPlanFeatures(tier: PlanTier): PlanFeatures {
  return PLAN_FEATURES[tier] ?? PLAN_FEATURES.starter
}

export function isUnlimited(value: number): boolean {
  return value === -1
}

export function hasFeatureAccess(tier: PlanTier, feature: keyof PlanFeatures): boolean {
  return Boolean(getPlanFeatures(tier)[feature])
}

/** Lowest tier that includes `feature` (for upgrade CTAs). */
export function minimumTierForFeature(feature: keyof PlanFeatures): PlanTier {
  for (const tier of PLAN_TIER_ORDER) {
    if (PLAN_FEATURES[tier][feature]) return tier
  }
  return "enterprise"
}

export function tierRank(tier: PlanTier): number {
  const i = PLAN_TIER_ORDER.indexOf(tier)
  return i < 0 ? 0 : i
}

export function tierAtLeast(current: PlanTier, required: PlanTier): boolean {
  return tierRank(current) >= tierRank(required)
}

export function normalizePlanTier(raw: string | null | undefined): PlanTier {
  const k = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_") as PlanTier
  if (k in PLAN_LIMITS) return k

  const original = String(raw || "").trim()
  if (original && typeof window === "undefined") {
    void import("@sentry/nextjs")
      .then((S) =>
        S.captureMessage(`Unrecognized plan tier encountered: ${original}`, "warning"),
      )
      .catch(() => {})
  }

  return "owner_operator"
}

export function nextPlanTier(tier: PlanTier): PlanTier | null {
  const i = PLAN_TIER_ORDER.indexOf(tier)
  if (i < 0 || i >= PLAN_TIER_ORDER.length - 1) return null
  return PLAN_TIER_ORDER[i + 1]
}

export function planTierLabel(tier: PlanTier): string {
  return TIER_LABEL[tier] ?? tier
}

export function formatLimitErrorMessage(params: {
  tier: PlanTier
  resourceLabel: string
  limit: number
  nextTier: PlanTier | null
  nextTierLimit?: number
}): string {
  const name = planTierLabel(params.tier)
  const lim = isUnlimited(params.limit) ? "unlimited" : String(params.limit)
  const next = params.nextTier ? planTierLabel(params.nextTier) : "a higher tier"
  const y =
    params.nextTierLimit !== undefined && !isUnlimited(params.nextTierLimit)
      ? String(params.nextTierLimit)
      : "more"
  return `You've reached your ${name} plan's limit of ${lim} ${params.resourceLabel}. Upgrade to ${next} for ${y} ${params.resourceLabel}. Manage in Settings → Billing.`
}
