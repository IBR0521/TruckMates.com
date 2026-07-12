# TruckMates — Audit Findings Log

Running log of issues found during the systematic review. Severity: 🔴 high · 🟠 medium · 🟡 low · ✅ checked/clear.
Earlier-session bugs that were already **fixed** (password session, dead approve URLs, plan-gating/Fleet tier,
agent autonomous guard, autonomous detention-from-cron) are not repeated here.

---

## Part 1 — Finance / money

### 🔴 F1. IFTA tax_owed computed incorrectly — ✅ **FIXED** — `app/actions/ifta.ts`
The per-state IFTA tax was `taxDue = (miles / 6.5) * taxRate`. Two defects:
1. **Missing fuel-tax credit** → `tax_owed` overstated; filings wrong.
2. **Hardcoded 6.5 MPG** → misstated taxable gallons.
**Fixed:** now computes real fleet MPG (`totalMilesAllStates / totalGallonsPurchased`, default 6.5 only
when no fuel data) and `taxDue = (taxableGallons − purchasedGallons) * taxRate` (net of credit; negative
= jurisdiction credit). Degrades to prior behavior when no fuel-purchase data exists.

### ✅ Checked / clear in Part 1
- `fuel-card-import.ts:250` `totalCost / gallons` — gallons validated `> 0` at :234. Safe.
- `fuel-analytics.ts:197` `miles / gallons` — guarded by `gallons > 0`. Safe.
- `ifta-trip-sheet.ts` `getTripSheetAggregatesForIFTA` — aggregation correct; child rows tenant-scoped
  via company-scoped parent ids. Safe.
- `settlement-ach-constants.ts` — automated ACH intentionally **disabled** (manual bank pay). Product
  behavior, not a bug.

### 🟡 F2. Pay-rule save fallback omits company_id — ✅ **FIXED** (tenant scoping) — `app/actions/settlement-pay-rules.ts:110-157`
**Fixed:** added `.eq("company_id", ctx.companyId)` to both fallback deactivate updates. Non-atomicity of
the fallback remains by design (the RPC path is atomic; fallback only runs if the RPC is absent).
When the `update_driver_pay_rule` RPC is missing, the fallback deactivates old rules then inserts the
new one **non-atomically** — if the insert fails, the driver is left with *no* active pay rule (all
deactivated). Also the deactivate `UPDATE`s filter by `id`/`driver_id` only, no `.eq("company_id")`
(RLS-backstopped, but inconsistent with the codebase's defense-in-depth norm). Low (RPC exists in prod;
authenticated client).

### 🔎 F3. Settlement *calculation* engine is a DB RPC — flagged for SQL review
The pay computation (apply pay_type/bonuses/deductions/minimum-guarantee to miles/loads) runs in a
Postgres function, not TS. Correctness can't be assessed from the app layer — needs migration review.

### 🟠 F4. Detention billing double-charge — ✅ **FIXED** — `app/actions/detention-invoice.ts:addDetentionChargeToInvoice`
No idempotency guard: calling twice for the same `eventId` (retry / auto + manual) appended the
detention line again → customer billed twice. The event was only marked `invoiced` *after*, never checked
*before*. **Fixed:** added an upfront check that returns early when the geofence event is already
`detention_billing_status = "invoiced"`. (A DB unique constraint on `(geofence_event_id)` in invoice
items would be the bulletproof follow-up — SQL, deferred to you.)
- ✅ Detention fee math itself is clean (cent-rounded, tenant-scoped, guarded).

### 🟠 F5. Tax-inclusive invoice subtotal not backed out — ✅ **FIXED** — `lib/finance-settings.ts:resolveInvoiceTaxes`
For tax-INCLUSIVE invoices using configured tax rows (`company_invoice_taxes`), the subtotal was never
backed out of the tax-included amount: tax computed on the gross, returned `subtotal = total = amount`
→ breakdown didn't reconcile (subtotal overstated). The defaults branch did it correctly; the two paths
disagreed. **Fixed:** inclusive branch now backs out `subtotal = (amount − fixed) / (1 + pctRate/100)`
and returns `taxAmount = amount − subtotal` so subtotal + tax == total. Affects tax-inclusive configs
(uncommon in US freight, but a real reporting bug). Shared by createInvoice + auto-invoice.

### ✅ More Part 1 cleared
- `auto-invoice` / `accounting.createInvoice`: amount + tax routed through `resolveInvoiceTaxes` (now
  correct); guarded (`amount > 0`), tenant-scoped, RPC-backed. OK.
- `tax-fuel-reconciliation.createFuelPurchase:94` `totalCost = gallons * price` stored without
  cent-rounding — 🟡 minor float imprecision on an input record (not a charge); left as-is.

### 🟠 F6. Year-end tax report recognizes revenue by created_at, not issue_date — ⚠️ **LOGGED, not auto-fixed** — `app/actions/year-end-tax-report.ts:235,282`
Invoices are filtered + month-bucketed by `created_at` (system insert time), while expenses use their
real `date` (:319) and loads use `load_date` (:290). → revenue and expenses recognized on different
bases; any invoice whose `created_at` ≠ `issue_date` (imports, backdated, late entry) lands in the
**wrong tax year**. `issue_date` exists on invoices. Recommended fix: select + filter + bucket by
`issue_date` (fallback `created_at`). **Not auto-fixed** — changing a tax report's date basis needs
confirmation that `issue_date` is reliably populated (null rows mustn't be silently dropped); fixing it
blind could make the report worse. Your call.

### Part 1 status: largely complete
Open (low priority): `invoice-line-items.ts` penny-reconciliation (earlier audit), `factoring-api`
(API integration, low calc risk — skim only), gl-accounts/vendor-invoices (not yet read).

---

## Part 2 — Compliance math (HOS / CSA / DVIR)  *(in progress)*

### 🟠 F7. HOS 14-hour limit = accumulated on-duty, not elapsed shift time — ⚠️ **LOGGED, not auto-fixed** — `lib/hos/compute-daily-remaining.ts:249`
`remainingOnDuty = 14 − onDutyHours`, but `onDutyHours` is the SUM of driving + on_duty minutes
(breaks excluded). FMCSA's 14-hour rule is an **elapsed-time window** from shift start that keeps running
during off-duty/meal breaks. → whenever a driver takes breaks, remaining 14h is overstated and the tool
could green-light driving past the legal window (safety + compliance). Correct: `14h − (now −
shiftStartAfterLast10hReset)`. **Not auto-fixed:** safety-critical, "single source of truth" (used in
multiple places), subtle correct impl (sleeper splits, 10h-reset detection), and possibly secondary to
the ELD provider's authoritative HOS. Confirm which is the legal record first. Your call.
- ✅ Correct here: 11h driving cap, 30-min break (8h driving, reset on ≥30min off/sleeper), 70h/8-day
  (labeled "simplified"). These match FMCSA.

### Part 2 progress
- 🟠 **F7 confirmed in BOTH engines** — `lib/eld/hos-engine.ts:117,188` computes `onDutyWindow` the
  same way (accumulated on-duty, not elapsed). Mitigation: authoritative HOS violations come from the
  ELD provider (synced to `eld_events` as `hos_violation`); these local engines are driver-facing
  *estimates*. So F7 = inaccurate in-app estimate, not a wrong legal record. Still real, still flagged.
- ✅ `safety-scoring.ts` — internal coaching model (NOT regulatory CSA; real CSA syncs from FMCSA).
  Self-consistent: div-by-zero guarded (`max(miles,1)`), components blended (20/15/15/25/25 = 100%).

### Part 2 status: complete
- ✅ `dvir-defects.ts` — pure severity summary, correct precedence, guarded. Clean.
- ✅ `hos-violation-alert.ts` — alert classification + dedup helper. Clean.
- Real CSA/SMS scores sync from FMCSA (not computed locally); `safety-scoring.ts` is an internal model.

---

## Part 3 — Billing / subscriptions  *(in progress)*

### 🔴 F8. Plan changes don't propagate to `companies.subscription_tier` → stale entitlement — ⚠️ **LOGGED (HIGH), not auto-fixed**
`lib/plan-enforcement.ts:getCompanyTier` (:16-20) reads `companies.subscription_tier` as the authoritative
tier — used by `checkFeatureAccess` + every resource-limit check, and middleware prefers it. But the
billing webhooks (`app/api/webhooks/stripe/route.ts:handleSubscriptionUpdated/Deleted`) only update the
`subscriptions` table. **Nothing updates `companies.subscription_tier` on a paid plan change** (column
defaults 'starter' (mig 213), set at signup (mig 214), downgraded only on *trial* expiry (mig 215); no
sync trigger). → after upgrade/downgrade via Stripe/Paddle/PayPal the tier is stale: **paid customers
denied features they bought; downgraded customers keep features they don't pay for.** Revenue impact.
**Not auto-fixed** — billing/entitlement-critical, spans 3 providers, needs the plan→PlanTier mapping.
Fix options:
  (a) Write side: each webhook sets `companies.subscription_tier` after the subscription upsert (must be
      consistent across Stripe/Paddle/PayPal).
  (b) Read side (cleaner, one place): `getCompanyTier` derives tier from the live `subscriptions` join
      instead of the stale column — fixes all gating at once.

### ⏳ Part 3 still to review
Paddle + PayPal webhooks, proration, `expire-trials` cron, `subscription-access.ts`, checkout flow.

---
_Verification: background ESLint on F1/F2 fixes returned **clean (exit 0)**._

---

## Part 5/6/8 — Tenant isolation & server-action attack surface  *(in progress)*

### 🔴 F9. `"use server"` worker functions take a client-supplied `companyId`, use the admin client, and never authorize the caller — cross-tenant read/write/side-effects — ⚠️ **LOGGED (HIGH), not auto-fixed**
In Next.js App Router, **every exported async function in a `"use server"` file is a publicly-callable server-action endpoint** (stable action id; reachable by any authenticated client via a crafted POST, regardless of whether the UI calls it). Several per-company "worker" functions were written to be called by cron / batch wrappers, take `companyId` (or an entity id) as a **parameter**, run on `createAdminClient()` (RLS bypass), and do **no `getCachedAuthContext()` check** — so a logged-in user of company A can pass company B's id.
Confirmed instances (all read cold, no auth in body):
- **`dispatcher-hos.ts:242` `getAllDriversHOSStatusByCompany(companyId)`** — **worst: returns `DriverHOSStatus[]` for an arbitrary company** (driver names + HOS = cross-tenant PII disclosure). An authed sibling `getAllDriversHOSStatus()` (:256) already does it correctly with `ctx.companyId`; the `ByCompany` variant just shouldn't be an export.
- **`csa-scores.ts:281` `syncCompanyCSAScores(companyId, dotNumber)`** — **write**: upserts `csa_scores` for any company/DOT → compliance-data tampering.
- **`invoice-overdue-notify.ts` `scanInvoiceOverdueForCompany` / `scanAllInvoiceOverdue`** — side effects: mark-overdue + fire finance notifications for an arbitrary company (or, via `scanAll…`, all ~5000 companies → notification-spam / cost DoS).
- **`delivery-delay-notify.ts` `scanDeliveryDelaysForCompany`**, **`document-expiry-notify.ts` `scanDocumentExpiryForCompany`**, **`permit-expiry-notify.ts` `scanPermitExpiryForCompany`**, **`dispatch-event-notify.ts`** (all 4 `scanMissedCheckCalls / DriverLate / RouteDeviations / EmergencyEscalations …ForCompany`; file has **zero** auth calls) — same shape (side effects + notifications).
**Root cause:** cron/internal workers and client-facing actions share the same `"use server"` modules. **Fix (structural, not one-liner):** move the per-company workers into a plain `lib/` module (not `"use server"`) imported by the cron routes + batch wrappers, so they are never registered as public actions; keep only the auth-gated (`ctx.companyId`) variants exported from `"use server"`. Cron secret already gates the routes, so the workers don't need to be actions at all. **Not auto-fixed** — touches ~7 files + their cron/executor import sites; needs a coordinated move + a re-scan that no other `"use server"` export takes a trust-the-caller `companyId`.

### ✅ Cleared in this pass (Part 5 tenant-isolation sweep)
- **Auth-gap scan:** every `app/actions/*.ts` that mutates (`insert/update/delete/upsert`) establishes an auth context — **0 files** mutate without one.
- **Admin-client scoping:** all 44 admin-client actions filter by `company_id`; cross-tenant edits use the `row.company_id !== ctx.companyId` guard (verified in `settings-users.ts`, `detention-tracking.ts`, `document-analysis.ts`, `bol-enhanced.ts`, `maintenance.ts`, `factoring-api.ts`, etc.). The F9 exception is specifically the *client-supplied-param* worker functions above, not the ctx-scoped ones.
- **Money math:** the amount `/`·`*` sites outside the already-fixed Part-1 paths are analytics averages (avg speed, violations/driver, avg-per-load) and guarded fuel `price/gallon` — not charge calculations. No new money bug.
- **Mobile API** (`app/api/mobile/*`, `app/api/eld/mobile/*`): authenticated — auth check before admin-client use, or RLS client + `getCachedAuthContext`.

### 🔵 F8 refinement — the tier-sync gap is **Stripe + PayPal only; Paddle already does it right**
Re-checked all three billing webhooks:
- **Stripe** (`webhooks/stripe/route.ts`): `handleSubscriptionUpdated/Deleted` upsert `subscriptions` only — **no `companies.subscription_tier` write**. → F8 applies. 🔴
- **PayPal** (`webhooks/paypal/route.ts`): upserts `subscriptions`, updates status — **never touches `companies.subscription_tier`**. → F8 applies. 🔴
- **Paddle** (`webhooks/paddle/route.ts:96,102`): **`patch.subscription_tier = tier` → `companies.update(patch)`. Correct.** ✓
All three verify signatures (Stripe `constructEvent`; Paddle `unmarshal`; PayPal `verify-webhook-signature` API). **Fix for F8 = mirror the Paddle handler in the Stripe + PayPal handlers** (map plan→tier, write `companies.subscription_tier` after the `subscriptions` upsert). This inconsistency is itself the proof F8 is an oversight, not intent.

### 🟡 F10. Some agent triggers fire as detached `void runAgentEvaluation(...)` — session-scoped executor calls may throw — ⚠️ **LOGGED, verify**
`load_status_auto_update`, `driver_assignment`, `invoice_auto_generation` fire from inside `loads.ts` (user session present) — good. But several fire fire-and-forget (`void`, not awaited). If the detached continuation reaches an executor handler that calls a session-bound server action (`updateLoad`/`quickAssignLoad` → `getCachedAuthContext()` → `cookies()`), it can throw "outside request scope" and the automation silently no-ops. Cron-fired triggers are safe (detention passes `companyId` explicitly; hos/payment/credit are `REQUIRES_HUMAN_APPROVAL` → approval, never auto-exec). **Verify** whether the detached path actually loses request scope in production, or whether the fixed-trigger + explicit-companyId pattern should be extended to `driver_assignment`/`load_status_auto_update` executors.

## Parts 4 / 6 / 8 / 9 / 12 — swept, largely clean
- **✅ Part 4 (loads/dispatch/routing):** `updateLoad` enforces the state machine (`isLoadStatusTransitionAllowed`, honoring the per-company `allow_status_skip`/`required_statuses`), plus `checkEditPermission` + auth + tenant-scoped fetch. `dispatches.ts`/`routes.ts` are densely `company_id`-scoped with RBAC. Agent trigger→executor architecture traced (see F10).
- **✅ Part 6 (public API & webhooks):** v1 API key auth is strong (SHA-256 hash, active/expiry/IP-allowlist/scope, Redis rate limit, usage logging). All billing webhooks verify signatures. Only gap = F8 (tier sync).
- **✅ Part 8 (auth/SSO/SAML): secure.** `wantAssertionsSigned:true` + `wantMessageSigned:true` (no signature-strip bypass); ACS chains samlify signature validation → audience/destination (`validateParsedSamlConstraints`) → assertion-replay consumption (`sso_consumed_assertions`) → JIT provision. Replay/audience/signature failures audited + Sentry-escalated. XSD schema validation intentionally skipped (Vercel/Java constraint) — crypto checks still run; acceptable.
- **✅ Part 9 (privacy/GDPR):** `export/company-data` scopes every table by `company_id` (derived from the session profile), manager-gated; `data-subject-requests.ts` is auth + manager-role gated, owner-or-manager for export payloads.
- **✅ Part 12 (crons):** all 30 routes check `CRON_SECRET` and have error handling; per-company scoping is in the routes that iterate companies (deadline-sweep, scan-hos, scan-detention, eld-sync\*) or in the `*ForCompany` helpers they delegate to. `company_id=0` routes are global by design (cleanup, diesel-price, expire-trials).

### Coverage note (honest)
Swept every part via whole-repo pattern scans (auth-gap, admin-client `company_id` scoping, money-math, `"use server"` export surface, cron secret/scoping, SAML config) **plus cold verification reads on every hit and on all high-risk logic** (`loads.updateLoad`, agent loop+executor, all 3 billing webhooks, full `lib/sso/*`, GDPR export). This is a risk-based audit of all ~320 files — **not** a line-by-line recital of every function body. Still worth a dedicated deeper pass: notification **dedup correctness** (Part 7), the **RN ELD mobile app** (Part 11, separate codebase, out of web scope per CLAUDE.md), and per-cron business-logic correctness beyond scoping.

---

## Extended domains — finance / portal / integrations / crypto  *(swept)*

### 🟠 F11. QuickBooks OAuth tokens stored **plaintext** at rest — ⚠️ **LOGGED (MEDIUM), not auto-fixed** — `app/api/quickbooks/callback/route.ts:114`, `lib/quickbooks/client.ts:57`
The OAuth `quickbooks_access_token` + `quickbooks_refresh_token` are written to and read from `company_integrations` as **plaintext columns** — no encryption anywhere in the path (grep for quickbooks+encrypt/decrypt: empty). These tokens grant full API access to the customer's QuickBooks accounting data (invoices, customers, vendors, P&L). **Inconsistent with the ELD path**, which encrypts credentials at rest with **AES-256-GCM** (`lib/crypto/eld-credentials.ts` — versioned format, random IV, auth tag; `eld.plaintext_count=0` in the prod smoke report). Impact: any DB-read exposure (backup leak, RLS gap, injection elsewhere, insider) leaks live third-party financial credentials. **Fix:** reuse `encryptCredential`/`decryptCredential` — encrypt on write in the callback, decrypt on read in `lib/quickbooks/client.ts`, plus a one-time backfill (mirror the existing `scripts/backfill-eld-credential-encryption.ts`). Company-scoped + RLS-protected today, so defense-in-depth, not an open door — hence MEDIUM.

### 🟡 F12. ELD telemetry webhook secret compared with `!==` (not timing-safe) — LOW — `app/api/webhooks/eld-telemetry-insert/route.ts:28`
`providedSecret !== expectedSecret` on the shared-secret header. The three ELD provider HMAC webhooks (Samsara/Geotab/KeepTruckin) all correctly use `crypto.timingSafeEqual`; this one doesn't. Timing-oracle extraction of a high-entropy secret over network jitter is impractical, so LOW — but trivially fixed with `timingSafeEqual` for consistency.

### ✅ Extended domains cleared
- **Finance core (`accounting.ts`):** 19 auth contexts / 49 `company_id` filters; transactional creates via RPC; `resolveInvoiceTaxes` (F5-fixed) on both invoice paths. **`approveSettlementAsDriver`** is triple-scoped (`id`+`company_id`+`driver_id`), driver-role-gated, idempotent — a driver can only approve their own settlement. **`autoGenerateInvoiceOnPOD(loadId)`** is auth-gated + company-scoped (not F9-class despite being an executor entry).
- **Customer portal (external surface):** token = `crypto.randomBytes(32)` hex (256-bit, unguessable); `getPortalAccessByToken` gates on `is_active` + expiry; create side manager-gated + company-scoped.
- **Ingest webhooks:** Samsara/Geotab/KeepTruckin verify **HMAC-SHA256 with `timingSafeEqual`**; EDI inbound uses the v1 API-key layer and scopes every insert to `auth.companyId`; Twilio uses official `validateRequest`; CRM-communication requires a secret/API key. No unauthenticated ingest.
- **Crypto at rest:** ELD credentials AES-256-GCM (authenticated encryption, versioned, legacy-plaintext read path warns to Sentry). Solid — the QuickBooks gap (F11) is the exception.
- **Notifications:** per-caller dedup (`wasRecentlyReminded` 48h windows; digest existence check) + `company_id` scoping throughout; no systemic dedup bug found (logic-level correctness still deserves its own pass).

---

## CRUD tail — search / uploads / marketplace  *(swept)*

### 🟡 F13. Unsanitized user input interpolated into PostgREST `.or()` filters — LOW — multiple list endpoints
Search terms are interpolated raw into `.or(...)` filter strings: `parts.ts:45`, `bol.ts:132`, `audit-logs.ts:94`, `driver-applications.ts:118`, `vendor-invoices.ts:99,131`, `vendors.ts:65`, `geofencing.ts:188,193`. A term containing PostgREST metacharacters (`,` `(` `)` `*` `:`) can widen the OR group or malform the query. **Bounded — not cross-tenant:** every one runs on the **RLS client** (`createClient()`), so the DB enforces `company_id` regardless of the injected filter; worst case is within-tenant result-broadening or a query error. `loads.ts:592` already shows the right pattern (sanitized `safeOrigin`/`safeDest`). **Fix:** escape PostgREST metacharacters (or allowlist alphanumerics) in search terms before interpolation. Low priority precisely because RLS is the backstop.

### ✅ CRUD tail cleared
- **File upload / OCR:** `receipt-ocr.uploadReceiptAndExtract` scopes the storage key to `receipts/{companyId}/{userId}/{ts}.{ext}`, `upsert:false`, auth-gated, rate-limited (20/min/company). `documents.ts` enforces an own-upload/fleet model and re-checks `company_id` on delete. Supabase storage keys are object-namespaced (no filesystem traversal). Clean.
- **Marketplace (intentional cross-tenant load board):** `acceptMarketplaceLoad` / subscription paths scope by `broker_id` / `carrier_company_id`. Counterparty profile reads (`getBrokerProfile`/`getCarrierProfile`) expose only `COMPANIES_SELECT = id, name, address, phone, email, company_type` — appropriate B2B directory fields, **no** EIN / tier / billing / internal data. No over-exposure.

---

---

## Part 3 (SQL) + Part 11 (mobile) — the previously-untouched surfaces  *(swept)*

### 🔴 F14 (resolves F3). Money RPCs are `SECURITY DEFINER`, trust a caller-supplied `p_company_id`, and are `GRANT`ed to `authenticated` → cross-tenant + RBAC bypass — ⚠️ **LOGGED (HIGH), not auto-fixed** — `supabase/migrations/210_…add_transactional_rpc_functions.sql`
`create_invoice_transactional`, `create_settlement_transactional`, `assign_load_transactional` are `SECURITY DEFINER` (bypass RLS), pin `search_path` (good), but contain **no `auth.uid()` / `get_user_company_id()` check** — they insert `company_id := p_company_id` straight from the argument. Migrations 251/255 revoked `anon`/`PUBLIC` (fixing the smoke-report anon hit) but **`GRANT EXECUTE … TO authenticated`**. Because PostgREST exposes every authenticated-executable function at `/rest/v1/rpc/<name>`, any logged-in user can call these directly with forged args. Two exploit facets:
1. **Cross-tenant write** — pass another company's `p_company_id` (+ a valid FK id) → settlement/invoice/lease rows written into a victim tenant, RLS bypassed. Practical bar: needs valid target UUIDs (driver_id / load_id), so moderate — but the authorization model is broken.
2. **Within-tenant RBAC/business-logic bypass (clearly exploitable)** — a user of *any* role (e.g. `driver`) can invoke the money RPC on their *own* company, bypassing everything the app-layer wrapper enforces: `checkCreatePermission`, plan limits, credit gates, `resolveInvoiceTaxes`, amount validation. Only needs the attacker's own JWT + own entity ids.
**Fix:** either (a) call these RPCs from server actions via the **service-role admin client** and `REVOKE EXECUTE … FROM authenticated` (money RPCs should only run after the app has done auth+RBAC), or (b) add inside each function `IF p_company_id <> (SELECT company_id FROM public.users WHERE id = auth.uid()) THEN RAISE EXCEPTION 'tenant mismatch'; END IF;` plus a role check. (a) is cleaner. This is the SQL-layer twin of F9 and supersedes the F3 "needs SQL review" note.
- ✅ Hygiene good otherwise: all 12 `SECURITY DEFINER` funcs pin `search_path`; 251/255 show active grant-hardening (anon vector already closed).

### ✅ Part 11 — RN ELD mobile app: clean on security-critical dimensions
- **Session tokens in the secure enclave:** `services/supabase.ts` wires Supabase `auth.storage` to an **`expo-secure-store`** adapter (iOS Keychain / Android Keystore) — not AsyncStorage. `services/storage.ts` (AsyncStorage, plaintext) holds only non-secret app state (HOS cache, sync queue).
- **No embedded secrets:** `config/env.ts` uses the **anon** key only (never service-role); API URL is config-driven with sane emulator/device resolution.
- **API auth:** `services/http.ts` sends `Authorization: Bearer <session token>` to the platform mobile API (`app/api/eld/mobile/*`, `app/api/mobile/*`) — endpoints already verified server-side authenticated in Part 6.

## Findings register (running)
| ID | Sev | Area | Status |
|----|-----|------|--------|
| F9 | 🔴 | `"use server"` worker exports take client `companyId`, no auth → cross-tenant read/write | ✅ FIXED |
| F14 | 🔴 | Money RPCs `SECURITY DEFINER` + trust `p_company_id` + granted to `authenticated` → cross-tenant / RBAC bypass (was F3) | ✅ FIXED |
| F8 | 🔴 | Billing tier not synced to `companies.subscription_tier` (Stripe + PayPal; Paddle OK) | ✅ FIXED |
| F11 | 🟠 | QuickBooks OAuth tokens stored plaintext at rest (ELD path encrypts) | ✅ FIXED |
| F12 | 🟡 | ELD telemetry webhook secret compared non-timing-safe | ✅ FIXED |
| F13 | 🟡 | PostgREST `.or()` filter injection via unsanitized search (RLS-bounded) | ✅ FIXED |
| F10 | 🟡 | Detached `runAgentEvaluation` may lose request scope in executor | ⏸ deferred (see below) |

### Fixes applied (this session)
- **Build-blocker** — `lib/ai/agent/loop.ts`: `logLevel` typed `AutomationLevel` (was `string`) + import; `next build` type-check was failing (deploy blocker), now clean.
- **F8** — `webhooks/stripe/route.ts` + `webhooks/paypal/route.ts`: on plan create/update write `companies.subscription_tier = normalizePlanTier(plan.name)`; on cancel drop to `starter`. Mirrors the Paddle handler.
- **F9** — dropped `"use server"` from the pure cron-worker modules (`invoice-overdue-notify`, `delivery-delay-notify`, `document-expiry-notify`, `permit-expiry-notify`, `dispatch-event-notify`) so their exports are no longer client-invocable actions (all callers are cron routes / the agent executor). Added own-company auth guards to the two workers in mixed `"use server"` files (`dispatcher-hos.getAllDriversHOSStatusByCompany`, `csa-scores.syncCompanyCSAScores`).
- **F11** — `quickbooks/callback` + `quickbooks/disconnect` + `lib/quickbooks/client.ts`: OAuth tokens now `encryptCredential`/`decryptCredential` (AES-256-GCM, same as ELD). Backward-compatible (legacy plaintext passes through decrypt; re-encrypts on next refresh).
- **F12** — `webhooks/eld-telemetry-insert/route.ts`: shared-secret compare via `crypto.timingSafeEqual` on sha256 digests.
- **F13** — new `sanitizeForOr` in `lib/validation.ts`, applied to the raw-search `.or()` endpoints (`parts`, `bol`, `audit-logs`, `driver-applications`, `vendor-invoices`).
- **F14** — switched the 3 authenticated money-RPC callers (`accounting.createInvoice`, `accounting.createSettlement`, `dispatches.assignLoad`) to the **admin client**; new migration `256_…_lockdown_money_rpcs_to_service_role.sql` revokes `EXECUTE` from `authenticated`/`anon`/PUBLIC and grants only `service_role`. RPCs now unreachable via PostgREST.

### Deferred / residual (intentional)
- **F10** (🟡): the correct fix is wrapping the detached `runAgentEvaluation(...)` calls (loads ×3, fuel-card ×2, detention ×1) in `after()` from `next/server`. **Not auto-applied** — it changes agent hot-path timing across mixed user/cron contexts and needs runtime verification; shipping it blind risks a worse regression than the (logged, non-security) reliability concern it addresses.
- **`csa-scores` sync workers** — ✅ **FIXED**: `syncCompanyCSAScores` + `syncAllCompaniesCSAScores` (and their helpers) moved to `lib/compliance/csa-sync.ts` (a plain module, imported by the sync-csa-scores cron). They are no longer client-callable server actions, closing the last F9 residual. `csa-scores.ts` keeps only the authenticated reader `getCSAScoreHistory`. A CI guard now fails if the sync workers are re-added to the `"use server"` module.

### Additional hardening / improvements (this session)
- **Single source of truth for the tier** — `getCompanyTier` now resolves from the live `subscriptions → subscription_plans` join (falling back to the `companies.subscription_tier` column), so F8 drift self-heals on read. Memoized per-request with React `cache()`. Unit-tested (`tests/unit/company-tier-source-of-truth.test.ts`).
- **CI pipeline** (`.github/workflows/ci.yml`) — typecheck + lint (errors only) + tests + `scripts/ci/check-security-invariants.mjs` (regression guards for F8/F9/F11/F12/F13/F14) on every PR.
- **Performance** — `company_id` composite indexes on the hot tables that lacked them (`migration 257`): loads, trucks, drivers, invoices, notifications, settlements, ai_usage_logs.
- **Observability** — Stripe/PayPal tier-sync failures now `Sentry.captureMessage(level:error)` instead of a silent `console.error`.
- **SQL-RPC integration suite** (`tests/unit/money-rpcs-db-integration.test.ts`, opt-in) — asserts the F14 lockdown (anon can't execute) + atomicity.

_(F1–F7 earlier: fixed or logged. Full sweep covered Parts 1–12 + extended integrations + CRUD tail + SQL money RPCs + RN mobile app.)_
