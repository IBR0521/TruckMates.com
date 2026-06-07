"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { Check, ArrowRight, Minus } from "lucide-react"
import { Logo } from "@/components/logo"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import {
  PLAN_FEATURES,
  PLAN_LIMITS,
  PLAN_TIER_ORDER,
  isUnlimited,
  planTierLabel,
  type PlanFeatures,
  type PlanTier,
} from "@/lib/plan-limits"
import { CONTACT_EMAIL } from "@/lib/constants/contact"
import { startPlanCheckout } from "@/app/actions/plan-usage"
import { getPaddleClient } from "@/lib/billing/paddle-client"
import { MarketingSiteFooter } from "@/components/marketing/marketing-site-footer"
import {
  DotBg,
  MarketingFinalCta,
  WBody,
  WEyebrow,
  WSectionHeading,
} from "@/components/marketing/marketing-ui"

const TIER_SUMMARY: Record<PlanTier, string> = {
  owner_operator: "Designed for owner-operators and 1–2 trucks — TMS core loads, invoices, dispatch, limits without premium AI integrations.",
  starter: "3–10 trucks: core TMS plus AI chat, morning briefing, geofencing, and basic fault codes; live ELD API sync unlocks on Professional.",
  professional: "11–35 trucks: live ELD integrations, conversational & autonomous AI, AP, reconciliation, predictive maintenance.",
  fleet: "36–100 trucks: public API + EDI, multi-terminal, HAZMAT/LTL tooling, leases, permits, priority phone support.",
  enterprise: "100+ carriers: custom SLAs, SSO/white-label, dedicated success, bespoke AI tuning on your corpus.",
}

const FEATURE_SHOWCASE: { key: keyof PlanFeatures; label: string }[] = [
  { key: "ai_document_extraction", label: "AI document extraction" },
  { key: "ai_dispatch_suggestions", label: "AI dispatch suggestions" },
  { key: "ai_morning_briefing", label: "AI morning briefing" },
  { key: "ai_chat", label: "AI assistant (fleet Q&A)" },
  { key: "ai_conversational", label: "Conversational AI" },
  { key: "ai_advanced_actions", label: "AI action tools (with approval)" },
  { key: "ai_smart_notifications", label: "Smart notification prioritization" },
  { key: "ai_autonomous_agent", label: "Autonomous AI agent" },
  { key: "eld_live_integrations", label: "ELD live integrations (Samsara / Motive / Geotab)" },
  { key: "geofencing_automation", label: "Geofencing & dwell tracking" },
  { key: "geofencing_load_automation", label: "Auto load status from geofences" },
  { key: "eld_harsh_events", label: "ELD harsh event sync" },
  { key: "driver_safety_scorecards", label: "Driver safety scorecards" },
  { key: "trip_replay", label: "Trip replay & telemetry reports" },
  { key: "eld_idle_tracking", label: "Idle time & fuel waste estimates" },
  { key: "eld_fault_codes_basic", label: "Engine fault codes (raw DTCs)" },
  { key: "eld_fault_codes_advanced", label: "Fault code translation & auto-maintenance" },
  { key: "ap_vendor_invoicing", label: "AP vendor invoicing" },
  { key: "bank_reconciliation", label: "Bank reconciliation" },
  { key: "gl_quickbooks_sync", label: "GL & QuickBooks sync" },
  { key: "factoring_api", label: "Factoring API integration" },
  { key: "predictive_maintenance", label: "Predictive maintenance AI" },
  { key: "public_api", label: "Public REST API" },
  { key: "edi_receiving", label: "EDI receiving" },
  { key: "multi_terminal", label: "Multi-terminal management" },
  { key: "hazmat_module", label: "HAZMAT module" },
  { key: "ltl_shipments", label: "LTL linehaul tooling" },
  { key: "lease_management", label: "Lease management" },
  { key: "permit_management", label: "Permit management" },
  { key: "custom_ai_training", label: "Custom AI training on your docs" },
  { key: "white_label", label: "White-label customer portal" },
  { key: "sso", label: "Enterprise SSO (SAML/OIDC)" },
  { key: "dedicated_account_manager", label: "Dedicated account director" },
  { key: "custom_sla", label: "Custom SLA" },
]

function tierFeatureBullets(tier: PlanTier, lim: (typeof PLAN_LIMITS)[PlanTier], maxItems = 5): string[] {
  if (tier === "enterprise") {
    return [
      ...FEATURE_SHOWCASE.filter((row) => PLAN_FEATURES.enterprise[row.key]).slice(0, maxItems).map((r) => r.label),
    ].slice(0, maxItems)
  }
  const feats = PLAN_FEATURES[tier]
  const lines: string[] = []
  for (const row of FEATURE_SHOWCASE) {
    if (feats[row.key]) {
      lines.push(row.label)
    }
    if (lines.length >= maxItems) return lines
  }
  const capLines = [
    `Up to ${isUnlimited(lim.trucks) ? "∞" : lim.trucks} active trucks`,
    `${isUnlimited(lim.loads_per_month) ? "Unlimited" : lim.loads_per_month.toLocaleString()} loads / month`,
    `${isUnlimited(lim.ai_calls_per_month) ? "Unlimited" : lim.ai_calls_per_month.toLocaleString()} AI calls / month`,
    `${isUnlimited(lim.storage_gb) ? "Unlimited" : lim.storage_gb} GB documents`,
    `${isUnlimited(lim.api_requests_per_day) ? "Unlimited daily" : lim.api_requests_per_day.toLocaleString()} API reqs / day`,
  ]
  for (const extra of capLines) {
    if (lines.includes(extra)) continue
    lines.push(extra)
    if (lines.length >= maxItems) break
  }
  return lines.slice(0, maxItems)
}

function planCtaLabel(tier: PlanTier, isAuthenticated: boolean, checkoutTier: PlanTier | null): string {
  if (tier === "enterprise") return "Contact sales"
  if (checkoutTier === tier) return "Opening…"
  if (isAuthenticated) return "Upgrade now"
  if (tier === "starter") return "Start free trial"
  return "Subscribe now"
}

const ADDONS = [
  { name: "Extra trucks", description: "Overage beyond plan truck limit without full tier upgrade", price: "Contact sales" },
  { name: "Toll routing", description: "Commercial toll lookups via TollGuru", price: "Add at checkout" },
  { name: "Portal branding", description: "Custom logo and colors on customer portal", price: "Fleet tier+" },
]

export default function PricingPage() {
  const [billingAnnual, setBillingAnnual] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [checkoutTier, setCheckoutTier] = useState<PlanTier | null>(null)
  const [onboarding, setOnboarding] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    async function loadUser() {
      const response = await supabase.auth.getUser()
      setIsAuthenticated(!!response.data.user)
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search)
        setOnboarding(params.get("onboarding") === "1")
      }
    }
    void loadUser()
  }, [])

  const handlePlanChoose = async (tier: PlanTier) => {
    if (tier === "enterprise") {
      window.location.href =
        `mailto:${CONTACT_EMAIL}?subject=TruckMates%20Enterprise%20plan`
      return
    }
    if (!isAuthenticated) {
      router.push(`/register?tier=${encodeURIComponent(tier)}`)
      return
    }

    setCheckoutTier(tier)
    try {
      const result = await startPlanCheckout({
        tier,
        billingCycle: billingAnnual ? "annual" : "monthly",
      })
      if (result.error || !result.data) {
        toast.error(result.error || "Checkout unavailable.")
        return
      }

      const paddle = await getPaddleClient()
      if (!paddle) {
        toast.error("Payment system not available. Please refresh and try again.")
        return
      }

      paddle.Checkout.open({
        items: [{ priceId: result.data.priceId, quantity: 1 }],
        customer: result.data.customerId
          ? { id: result.data.customerId }
          : result.data.customerEmail
            ? { email: result.data.customerEmail }
            : undefined,
        customData: result.data.customData,
        settings: {
          displayMode: "overlay",
          theme: "dark",
          locale: "en",
          successUrl: `${window.location.origin}/dashboard/settings/billing?upgraded=1`,
        },
      })
      toast.success("Secure checkout opened — complete payment in the window above.")
    } catch (e) {
      console.error(e)
      toast.error("Failed to open checkout. Please try again.")
    } finally {
      setTimeout(() => setCheckoutTier(null), 1000)
    }
  }

  return (
    <div className="relative min-h-screen" style={{ background: "var(--w-bg)" }}>
      <DotBg className="opacity-80" />
      <header
        className="border-b"
        style={{
          borderColor: "var(--w-border)",
          background: "rgba(9,9,14,0.85)",
          backdropFilter: "blur(20px)",
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/">
            <Logo size="sm" />
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm hover:text-[var(--w-blue)]"
              style={{ color: "rgba(241,245,249,0.65)", fontFamily: "var(--font-jakarta), sans-serif" }}
            >
              Login
            </Link>
            <Link
              href="/register"
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
              style={{ background: "var(--w-blue)", fontFamily: "var(--font-jakarta), sans-serif" }}
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden pt-[120px] pb-16 text-center">
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {onboarding && (
            <p
              className="mb-4 text-sm font-medium text-[var(--w-blue)]"
              style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
            >
              Choose your plan — billing runs securely through Paddle.
            </p>
          )}
          <WEyebrow>Pricing</WEyebrow>
          <WSectionHeading>Simple pricing for every size fleet.</WSectionHeading>
          <WBody className="mx-auto mt-4 max-w-2xl">
            Five tiers from Owner-Operator to Enterprise. Every limit published on this page — no hidden caps.
          </WBody>
          <div
            className="mx-auto mt-10 inline-flex items-center gap-1 rounded-full p-1"
            style={{ background: "var(--w-bg-3)", border: "1px solid var(--w-border-md)" }}
          >
            <button
              type="button"
              onClick={() => setBillingAnnual(false)}
              className="rounded-full px-5 py-2 text-sm transition-colors"
              style={{
                fontFamily: "var(--font-jakarta), sans-serif",
                background: !billingAnnual ? "var(--w-blue)" : "transparent",
                color: !billingAnnual ? "#fff" : "var(--w-text-2)",
              }}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingAnnual(true)}
              className="rounded-full px-5 py-2 text-sm transition-colors"
              style={{
                fontFamily: "var(--font-jakarta), sans-serif",
                background: billingAnnual ? "var(--w-blue)" : "transparent",
                color: billingAnnual ? "#fff" : "var(--w-text-2)",
              }}
            >
              Annual (~20% off)
            </button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {PLAN_TIER_ORDER.map((tier) => {
            const lim = PLAN_LIMITS[tier]
            const isEnterprise = tier === "enterprise"
            const monthlyPrice = isEnterprise ? null : lim.price_monthly
            const annualPrice = isEnterprise ? null : lim.price_annual
            const highlighted = tier === "professional"

            return (
              <div
                key={tier}
                className={`relative flex flex-col rounded-2xl p-8 ${highlighted ? "xl:scale-[1.02]" : ""}`}
                style={{
                  background: "var(--w-card)",
                  border: highlighted
                    ? "1px solid var(--w-blue-border)"
                    : isEnterprise
                      ? "1px solid rgba(255,255,255,0.1)"
                      : "1px solid var(--w-border)",
                  boxShadow: highlighted
                    ? "0 0 0 1px rgba(59,130,246,0.15), 0 8px 32px rgba(59,130,246,0.08)"
                    : undefined,
                }}
              >
                {highlighted ? (
                  <span
                    className="absolute top-0 right-0 rounded-bl-lg rounded-tr-2xl px-3 py-1 text-[11px] font-semibold text-white"
                    style={{ background: "var(--w-blue)", fontFamily: "var(--font-jakarta), sans-serif" }}
                  >
                    Most Popular
                  </span>
                ) : null}
                <h2
                  className="text-[22px] font-bold text-[var(--w-text)]"
                  style={{ fontFamily: "var(--font-bricolage), sans-serif" }}
                >
                  {planTierLabel(tier)}
                </h2>
                <p
                  className="mb-6 mt-1 min-h-[2.5rem] text-[13px] leading-relaxed"
                  style={{ color: "rgba(241,245,249,0.45)", fontFamily: "var(--font-jakarta), sans-serif" }}
                >
                  {TIER_SUMMARY[tier]}
                </p>
                <div className="mb-6">
                  {!isEnterprise &&
                    (!billingAnnual ? (
                      <>
                        <span
                          className="text-[44px] leading-none text-[var(--w-green)]"
                          style={{ fontFamily: "var(--font-mono-display), monospace" }}
                        >
                          ${monthlyPrice}
                        </span>
                        <span
                          className="text-sm text-[var(--w-text-2)]"
                          style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
                        >
                          {" "}
                          /month
                        </span>
                        <p
                          className="mt-2 text-xs text-[var(--w-text-2)]"
                          style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
                        >
                          or ${annualPrice}/mo billed annually
                        </p>
                      </>
                    ) : (
                      <>
                        <span
                          className="text-[44px] leading-none text-[var(--w-green)]"
                          style={{ fontFamily: "var(--font-mono-display), monospace" }}
                        >
                          ${annualPrice}
                        </span>
                        <span
                          className="text-sm text-[var(--w-text-2)]"
                          style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
                        >
                          {" "}
                          /month billed annually
                        </span>
                        <p
                          className="mt-2 text-xs text-[var(--w-text-2)]"
                          style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
                        >
                          vs ${monthlyPrice}/mo month-to-month
                        </p>
                      </>
                    ))}
                  {isEnterprise && (
                    <span
                      className="text-[44px] leading-none text-[var(--w-green)]"
                      style={{ fontFamily: "var(--font-mono-display), monospace" }}
                    >
                      Custom
                    </span>
                  )}
                </div>
                <div className="my-6 h-px" style={{ background: "var(--w-border)" }} />
                <ul className="flex-1 space-y-2.5 text-left">
                  {tierFeatureBullets(tier, lim, 5).map((line) => (
                    <li key={line} className="flex gap-2 text-sm text-[var(--w-text)]">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--w-blue)]" />
                      <span style={{ fontFamily: "var(--font-jakarta), sans-serif" }}>{line}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  <button
                    type="button"
                    className="flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold uppercase tracking-wide transition-colors disabled:opacity-60"
                    style={{
                      fontFamily: "var(--font-bricolage), sans-serif",
                      background: highlighted ? "var(--w-blue)" : "transparent",
                      color: highlighted ? "#fff" : "var(--w-text)",
                      border: highlighted ? "none" : "1px solid var(--w-border-md)",
                    }}
                    disabled={checkoutTier !== null}
                    onClick={() => handlePlanChoose(tier)}
                  >
                    {planCtaLabel(tier, isAuthenticated, checkoutTier)}
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <p
          className="mx-auto mt-8 max-w-3xl text-center text-xs text-[var(--w-text-2)]"
          style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
        >
          Subscription and tax receipts are handled by Paddle. Manage or cancel anytime from Settings → Billing.
        </p>

        <div className="mt-20 overflow-x-auto">
          <h2
            className="mb-6 text-center text-xl font-bold uppercase tracking-wider text-[var(--w-blue)]"
            style={{ fontFamily: "var(--font-bricolage), sans-serif" }}
          >
            Full feature breakdown
          </h2>
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr>
                <th
                  className="p-3 text-xs font-bold uppercase tracking-wider"
                  style={{
                    color: "rgba(241,245,249,0.5)",
                    fontFamily: "var(--font-bricolage), sans-serif",
                  }}
                >
                  Feature
                </th>
                {PLAN_TIER_ORDER.map((tier) => (
                  <th
                    key={tier}
                    className="p-3 text-center text-xs font-bold uppercase tracking-wider text-[var(--w-blue)]"
                    style={{ fontFamily: "var(--font-bricolage), sans-serif" }}
                  >
                    {planTierLabel(tier)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_SHOWCASE.map((row, i) => (
                <tr
                  key={row.key}
                  style={{ background: i % 2 === 0 ? "var(--w-bg)" : "var(--w-card)" }}
                >
                  <td
                    className="p-3"
                    style={{
                      color: "rgba(241,245,249,0.7)",
                      fontFamily: "var(--font-jakarta), sans-serif",
                    }}
                  >
                    {row.label}
                  </td>
                  {PLAN_TIER_ORDER.map((tier) => {
                    const enabled = PLAN_FEATURES[tier][row.key]
                    return (
                      <td key={tier} className="p-3 text-center">
                        {enabled ? (
                          <Check className="mx-auto h-4 w-4 text-[var(--w-blue)]" />
                        ) : (
                          <Minus className="mx-auto h-3.5 w-3.5 text-[var(--w-text-3)]" />
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-16">
          <h2
            className="mb-4 text-xl font-bold text-[var(--w-text)]"
            style={{ fontFamily: "var(--font-bricolage), sans-serif" }}
          >
            Add-ons
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {ADDONS.map((addon) => (
              <div
                key={addon.name}
                className="rounded-xl p-4"
                style={{ background: "var(--w-card)", border: "1px solid var(--w-border)" }}
              >
                <h3
                  className="font-semibold text-[var(--w-text)]"
                  style={{ fontFamily: "var(--font-bricolage), sans-serif" }}
                >
                  {addon.name}
                </h3>
                <p
                  className="mt-1 text-sm text-[var(--w-text-2)]"
                  style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
                >
                  {addon.description}
                </p>
                <p className="mt-2 text-sm font-medium text-[var(--w-blue)]">{addon.price}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <MarketingFinalCta />
      <MarketingSiteFooter />
    </div>
  )
}
